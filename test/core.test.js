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
