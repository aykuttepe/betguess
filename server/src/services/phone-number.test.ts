import test from 'node:test';
import assert from 'node:assert/strict';
import { arePhoneNumbersEquivalent, normalizePhoneNumber } from './phone-number';

test('normalizePhoneNumber converts local Turkish numbers into 90-prefixed format', () => {
  const result = normalizePhoneNumber('0555 123 45 67');

  assert.equal(result.isValid, true);
  assert.equal(result.normalizedPhone, '905551234567');
});

test('normalizePhoneNumber accepts already-normalized numbers', () => {
  const result = normalizePhoneNumber('+90 555 123 45 67');

  assert.equal(result.isValid, true);
  assert.equal(result.normalizedPhone, '905551234567');
});

test('normalizePhoneNumber rejects malformed numbers', () => {
  const result = normalizePhoneNumber('12345');

  assert.equal(result.isValid, false);
  assert.equal(result.normalizedPhone, null);
  assert.match(result.reason ?? '', /90 ile baslayacak/i);
});

test('arePhoneNumbersEquivalent compares different local formats correctly', () => {
  assert.equal(arePhoneNumbersEquivalent('5551234567', '+90 555 123 45 67'), true);
});

