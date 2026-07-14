'use strict';
const test = require('node:test');
const assert = require('node:assert');
const core = require('../core.js');

test('NOTEBOOK_SIZES includes Pocket and regular A5 with correct mm', () => {
  assert.deepStrictEqual(core.NOTEBOOK_SIZES.pocket, { label: 'Pocket', w: 89, h: 140 });
  assert.deepStrictEqual(core.NOTEBOOK_SIZES.a5, { label: 'A5', w: 148, h: 210 });
});

test('futureLogBandCount: short pages get 2 bands, tall pages get 3', () => {
  assert.strictEqual(core.futureLogBandCount(124), 2); // passport
  assert.strictEqual(core.futureLogBandCount(140), 2); // pocket
  assert.strictEqual(core.futureLogBandCount(149), 2);
  assert.strictEqual(core.futureLogBandCount(150), 3);
  assert.strictEqual(core.futureLogBandCount(171), 3); // personal
  assert.strictEqual(core.futureLogBandCount(210), 3); // regular / a5
});

test('monthMatrix: Jan 2026, Monday start, has 3 leading blanks', () => {
  // 2026-01-01 is a Thursday (getDay() === 4)
  const weeks = core.monthMatrix(2026, 0, 'monday');
  assert.deepStrictEqual(weeks[0], [null, null, null, 1, 2, 3, 4]);
  assert.strictEqual(weeks.length, 5);
  assert.strictEqual(weeks[weeks.length - 1].includes(31), true);
});

test('monthMatrix: Jan 2026, Sunday start, has 4 leading blanks', () => {
  const weeks = core.monthMatrix(2026, 0, 'sunday');
  assert.deepStrictEqual(weeks[0], [null, null, null, null, 1, 2, 3]);
});

test('monthMatrix: Feb 2026 (28 days, non-leap) Monday start', () => {
  // 2026-02-01 is a Sunday (getDay() === 0)
  const weeks = core.monthMatrix(2026, 1, 'monday');
  assert.deepStrictEqual(weeks[0], [null, null, null, null, null, null, 1]);
  const flat = weeks.flat().filter((d) => d !== null);
  assert.strictEqual(flat.length, 28);
  assert.strictEqual(weeks.flat().length % 7, 0);
});

test('monthMatrix: 6-week month (Aug 2026, Sat start, Monday weeks)', () => {
  // 2026-08-01 is a Saturday; 31 days + Monday-start offset spills to 6 rows
  const weeks = core.monthMatrix(2026, 7, 'monday');
  assert.strictEqual(weeks.length, 6);
  assert.deepStrictEqual(weeks[0], [null, null, null, null, null, 1, 2]);
  assert.strictEqual(weeks.flat().filter((d) => d !== null).length, 31);
});

test('paginateMonths: 12 months from Jan 2026, 3 per page', () => {
  const pages = core.paginateMonths(2026, 0, 12, 3);
  assert.strictEqual(pages.length, 4);
  assert.deepStrictEqual(pages[0], [
    { year: 2026, month: 0 }, { year: 2026, month: 1 }, { year: 2026, month: 2 }
  ]);
  assert.deepStrictEqual(pages[3], [
    { year: 2026, month: 9 }, { year: 2026, month: 10 }, { year: 2026, month: 11 }
  ]);
});

test('paginateMonths: rolls over the year boundary', () => {
  const pages = core.paginateMonths(2026, 10, 4, 2); // Nov26, Dec26, Jan27, Feb27
  assert.deepStrictEqual(pages, [
    [{ year: 2026, month: 10 }, { year: 2026, month: 11 }],
    [{ year: 2027, month: 0 }, { year: 2027, month: 1 }]
  ]);
});

test('bookletAdd appends an entry immutably', () => {
  const a = [];
  const b = core.bookletAdd(a, { id: '1', type: 'cover', config: {}, pageCount: 1 });
  assert.strictEqual(a.length, 0);
  assert.strictEqual(b.length, 1);
  assert.strictEqual(b[0].type, 'cover');
});

test('bookletRemove drops the matching id', () => {
  const list = [{ id: '1', type: 'cover', config: {}, pageCount: 1 },
                { id: '2', type: 'daily', config: {}, pageCount: 31 }];
  const out = core.bookletRemove(list, '1');
  assert.deepStrictEqual(out.map((e) => e.id), ['2']);
});

test('bookletMove shifts an entry up and down within bounds', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepStrictEqual(core.bookletMove(list, 'b', -1).map((e) => e.id), ['b', 'a', 'c']);
  assert.deepStrictEqual(core.bookletMove(list, 'b', 1).map((e) => e.id), ['a', 'c', 'b']);
  assert.deepStrictEqual(core.bookletMove(list, 'a', -1).map((e) => e.id), ['a', 'b', 'c']);
  assert.deepStrictEqual(core.bookletMove(list, 'c', 1).map((e) => e.id), ['a', 'b', 'c']);
});

test('bookletTotalPages sums pageCount', () => {
  const list = [{ pageCount: 1 }, { pageCount: 31 }, { pageCount: 4 }];
  assert.strictEqual(core.bookletTotalPages(list), 36);
});

test('facingAlignInserts: no paired pages -> no inserts', () => {
  assert.deepStrictEqual(core.facingAlignInserts(['other', 'other', 'other']), []);
});

test('facingAlignInserts: run starting at even index -> no insert', () => {
  assert.deepStrictEqual(core.facingAlignInserts(['content', 'facing', 'content', 'facing']), []);
});

test('facingAlignInserts: run starting at odd index -> insert before it', () => {
  assert.deepStrictEqual(core.facingAlignInserts(['other', 'content', 'facing']), [1]);
});

test('facingAlignInserts: two runs separated by other, shift accounted', () => {
  assert.deepStrictEqual(
    core.facingAlignInserts(['other', 'content', 'facing', 'other', 'content', 'facing']),
    [1, 4]
  );
});

test('facingAlignInserts: back-to-back pairs are a single run (no extra insert)', () => {
  assert.deepStrictEqual(core.facingAlignInserts(['content', 'facing', 'content', 'facing']), []);
});

test('facingAlignInserts: even leading others keep the run on the left', () => {
  assert.deepStrictEqual(core.facingAlignInserts(['other', 'other', 'content', 'facing']), []);
});

test('flatImposition double n=8: two sheets, cut-and-stack order', () => {
  assert.deepStrictEqual(core.flatImposition(8, 'double'), {
    pad: 8,
    sheets: [
      { front: [0, 4], back: [1, 5] },
      { front: [2, 6], back: [3, 7] }
    ]
  });
});

test('flatImposition double n=6 pads to 8 (indices >=6 are blanks)', () => {
  assert.deepStrictEqual(core.flatImposition(6, 'double'), {
    pad: 8,
    sheets: [
      { front: [0, 4], back: [1, 5] },
      { front: [2, 6], back: [3, 7] }
    ]
  });
});

test('flatImposition double n=4: one sheet', () => {
  assert.deepStrictEqual(core.flatImposition(4, 'double'), {
    pad: 4,
    sheets: [ { front: [0, 2], back: [1, 3] } ]
  });
});

test('flatImposition single n=8: four fronts, blank backs', () => {
  assert.deepStrictEqual(core.flatImposition(8, 'single'), {
    pad: 8,
    sheets: [
      { front: [0, 4], back: null },
      { front: [1, 5], back: null },
      { front: [2, 6], back: null },
      { front: [3, 7], back: null }
    ]
  });
});

test('flatImposition single n=5 pads to 6', () => {
  assert.deepStrictEqual(core.flatImposition(5, 'single'), {
    pad: 6,
    sheets: [
      { front: [0, 3], back: null },
      { front: [1, 4], back: null },
      { front: [2, 5], back: null }
    ]
  });
});

test('flatImposition n=0: no sheets', () => {
  assert.deepStrictEqual(core.flatImposition(0, 'double'), { pad: 0, sheets: [] });
});

test('clampNotebookDim: in-range values pass through unchanged', () => {
  assert.strictEqual(core.clampNotebookDim(89, 124), 89);
  assert.strictEqual(core.clampNotebookDim('150', 124), 150);
  assert.strictEqual(core.clampNotebookDim(40, 89), 40);   // lower boundary inclusive
  assert.strictEqual(core.clampNotebookDim(300, 89), 300); // upper boundary inclusive
});

test('clampNotebookDim: below 40 clamps up, above 300 clamps down', () => {
  assert.strictEqual(core.clampNotebookDim(0, 89), 40);
  assert.strictEqual(core.clampNotebookDim(-5, 89), 40);
  assert.strictEqual(core.clampNotebookDim(500, 124), 300);
});

test('clampNotebookDim: non-numeric falls back to the default', () => {
  assert.strictEqual(core.clampNotebookDim('', 89), 89);
  assert.strictEqual(core.clampNotebookDim('abc', 124), 124);
  assert.strictEqual(core.clampNotebookDim(NaN, 124), 124);
  assert.strictEqual(core.clampNotebookDim(undefined, 89), 89);
});

test('sanitizeCollection: drops null/undefined/non-object items', () => {
  assert.deepStrictEqual(
    core.sanitizeCollection([{ a: 1 }, null, undefined, 3, 'x', { b: 2 }]),
    [{ a: 1 }, { b: 2 }]
  );
});

test('sanitizeCollection: non-array input yields empty array', () => {
  assert.deepStrictEqual(core.sanitizeCollection('nope'), []);
  assert.deepStrictEqual(core.sanitizeCollection(undefined), []);
  assert.deepStrictEqual(core.sanitizeCollection(null), []);
});

test('sanitizeHabits: drops null items and defaults a missing days array', () => {
  assert.deepStrictEqual(
    core.sanitizeHabits([{ name: 'A', days: [1, 2] }, null, { name: 'B' }]),
    [{ name: 'A', days: [1, 2] }, { name: 'B', days: [] }]
  );
});

test('sanitizeHabits: a non-array days field is replaced with an empty array', () => {
  assert.deepStrictEqual(
    core.sanitizeHabits([{ name: 'C', days: 'notarray' }]),
    [{ name: 'C', days: [] }]
  );
});

test('blankMonthMatrix: 6 weeks of 7 nulls', () => {
  const weeks = core.blankMonthMatrix();
  assert.strictEqual(weeks.length, 6);
  weeks.forEach((w) => {
    assert.strictEqual(w.length, 7);
    assert.ok(w.every((d) => d === null));
  });
  // rows must be independent arrays (no shared reference)
  weeks[0][0] = 1;
  assert.strictEqual(weeks[1][0], null);
});

test('clampDailyCount: clamps to [1,93], defaults 31 on garbage', () => {
  assert.strictEqual(core.clampDailyCount(10), 10);
  assert.strictEqual(core.clampDailyCount('10'), 10);
  assert.strictEqual(core.clampDailyCount(0), 1);
  assert.strictEqual(core.clampDailyCount(-5), 1);
  assert.strictEqual(core.clampDailyCount(200), 93);
  assert.strictEqual(core.clampDailyCount(undefined), 31);
  assert.strictEqual(core.clampDailyCount('abc'), 31);
});

test('canvasBannerText: preview mode names the selection and flags it as not added', () => {
  assert.strictEqual(
    core.canvasBannerText('preview', 'Future Log · Year grid', 1),
    'Previewing: Future Log · Year grid — not in booklet yet'
  );
});

test('canvasBannerText: booklet mode shows page total with pluralization', () => {
  assert.strictEqual(core.canvasBannerText('booklet', null, 7), 'Your booklet — 7 pages');
  assert.strictEqual(core.canvasBannerText('booklet', null, 1), 'Your booklet — 1 page');
});

test('holidayListEntries: flattens a {day:[names]} map sorted by day', () => {
  const entries = core.holidayListEntries({ 15: ['Assumption'], 1: ["New Year's Day", 'Kwanzaa ends'] });
  assert.deepStrictEqual(entries, [
    { day: 1, name: "New Year's Day" },
    { day: 1, name: 'Kwanzaa ends' },
    { day: 15, name: 'Assumption' }
  ]);
});

test('holidayListEntries: empty or garbage input gives []', () => {
  assert.deepStrictEqual(core.holidayListEntries({}), []);
  assert.deepStrictEqual(core.holidayListEntries(null), []);
  assert.deepStrictEqual(core.holidayListEntries(undefined), []);
});

test('escapeXML: escapes the five XML special characters', () => {
  assert.strictEqual(core.escapeXML('Sleep & Rest'), 'Sleep &amp; Rest');
  assert.strictEqual(core.escapeXML('<b>"hi"</b>'), '&lt;b&gt;&quot;hi&quot;&lt;/b&gt;');
  assert.strictEqual(core.escapeXML("it's"), 'it&#39;s');
});

test('escapeXML: non-strings stringify, null/undefined give empty string', () => {
  assert.strictEqual(core.escapeXML(5), '5');
  assert.strictEqual(core.escapeXML(null), '');
  assert.strictEqual(core.escapeXML(undefined), '');
});

test('periodLabel: "Mon YYYY", with xN multiplier only when count > 1', () => {
  assert.strictEqual(core.periodLabel('Jul', 2026, 1), 'Jul 2026');
  assert.strictEqual(core.periodLabel('Jul', 2026, 3), 'Jul 2026 ×3');
  assert.strictEqual(core.periodLabel('Jan', 2027, undefined), 'Jan 2027');
});
