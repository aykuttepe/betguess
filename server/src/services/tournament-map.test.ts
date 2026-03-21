import test from 'node:test';
import assert from 'node:assert/strict';
import { __testables } from './tournament-map';

test('fallback tournament map contains super-lig slug', () => {
  assert.equal(__testables.FALLBACK_MAP['super-lig'], 52);
});

test('pickCurrentSeasonId prefers current season flag', () => {
  const seasonId = __testables.pickCurrentSeasonId([
    { id: 100, year: 2024 },
    { id: 101, year: 2025, current: true },
  ]);

  assert.equal(seasonId, 101);
});

test('pickCurrentSeasonId falls back to first season when current flag is missing', () => {
  const seasonId = __testables.pickCurrentSeasonId([
    { id: 200, year: 2026 },
    { id: 201, year: 2025 },
  ]);

  assert.equal(seasonId, 200);
});
