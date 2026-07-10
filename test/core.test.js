'use strict';
const test = require('node:test');
const assert = require('node:assert');
const core = require('../core.js');

test('NOTEBOOK_SIZES includes Pocket and regular A5 with correct mm', () => {
  assert.deepStrictEqual(core.NOTEBOOK_SIZES.pocket, { label: 'Pocket (3.5×5.5")', w: 89, h: 140 });
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
