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
