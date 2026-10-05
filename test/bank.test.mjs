import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANK_CAP_MIN, creditBank, spendBank, walkSteps } from '../src/exercise/bank.js';

test('credits stack up to the cap', () => {
  assert.equal(creditBank(0, 10), 10);
  assert.equal(creditBank(20, 10), 30);
  assert.equal(creditBank(55, 10), BANK_CAP_MIN);
  assert.equal(creditBank(-5, 10), 10);
});

test('spending takes what is wanted, or whatever is left', () => {
  assert.deepEqual(spendBank(25, 10), { minutes: 10, bank: 15 });
  assert.deepEqual(spendBank(4, 10), { minutes: 4, bank: 0 });
  assert.deepEqual(spendBank(0, 10), { minutes: 0, bank: 0 });
});

test('walk steps count from the baseline', () => {
  assert.equal(walkSteps(5000, 6043), 1043);
  assert.equal(walkSteps(5000, 5000), 0);
});

test('a reboot mid-walk falls back to steps since boot', () => {
  assert.equal(walkSteps(5000, 320), 320);
});

test('missing readings count as zero', () => {
  assert.equal(walkSteps(null, 100), 0);
  assert.equal(walkSteps(100, null), 0);
});
