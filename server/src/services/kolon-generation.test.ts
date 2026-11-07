import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKolons, validateKolonInputs } from './kolon-generation';

test('kolon generation preserves outcome order and sequential identifiers', () => {
  const inputs = validateKolonInputs([
    { matchNumber: 1, outcomes: ['1', 'X'] }, { matchNumber: 2, outcomes: ['2'] },
  ], 50000);
  assert.deepEqual(generateKolons(inputs), [
    { id: 1, predictions: ['1', '2'] }, { id: 2, predictions: ['X', '2'] },
  ]);
});

test('invalid selections and oversized generation are rejected before allocating results', () => {
  for (const input of [null, [], [{ matchNumber: 1, outcomes: [] }],
    [{ matchNumber: 1, outcomes: ['1', '1'] }], [{ matchNumber: 1, outcomes: ['bad'] }],
    [{ matchNumber: 1, outcomes: ['1'] }, { matchNumber: 1, outcomes: ['X'] }],
    [{ matchNumber: -1, outcomes: ['1'] }], Array(16).fill({ matchNumber: 1, outcomes: ['1'] })]) {
    assert.throws(() => validateKolonInputs(input, 500000));
  }
  const selections = Array.from({ length: 10 }, (_, i) => ({ matchNumber: i + 1, outcomes: ['1', 'X', '2'] }));
  assert.throws(() => validateKolonInputs(selections, 50000));
  assert.equal(validateKolonInputs(selections, 500000).length, 10);
});
