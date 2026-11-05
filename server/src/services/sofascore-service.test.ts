import test from 'node:test';
import assert from 'node:assert/strict';
import { __testables as sofaScoreTestables } from './sofascore-service';

test('parseMatchDate converts DD.MM.YYYY into YYYY-MM-DD', () => {
  const iso = sofaScoreTestables.parseMatchDate('07.03.2026');
  assert.equal(iso, '2026-03-07');
});

test('normalizeTeamName removes punctuation and common suffix tokens', () => {
  const normalized = sofaScoreTestables.normalizeTeamName('Beşiktaş A.Ş. FK');
  assert.equal(normalized, 'besiktas');
});

test('findBestEvent matches Turkish names with corporate suffix differences', () => {
  const events = [
    {
      id: 10,
      homeTeam: { name: 'Beşiktaş JK' },
      awayTeam: { name: 'Galatasaray' },
    },
    {
      id: 11,
      homeTeam: { name: 'Fenerbahce' },
      awayTeam: { name: 'Samsunspor' },
    },
  ];

  const best = sofaScoreTestables.findBestEvent(events, 'Beşiktaş A.Ş.', 'Galatasaray A.Ş.');
  assert.ok(best);
  assert.equal(best?.id, 10);
});

test('classifyAbsenteeStatus detects suspension and injury', () => {
  const suspension = sofaScoreTestables.classifyAbsenteeStatus({
    type: 'missing',
    reason: 11,
    description: 'Yellow card accumulation suspension',
  });
  const injury = sofaScoreTestables.classifyAbsenteeStatus({
    type: 'missing',
    reason: 1,
    description: 'Hamstring injury',
  });

  assert.equal(suspension, 'suspension');
  assert.equal(injury, 'injury');
});

test('extractCards maps card incidents into normalized output', () => {
  const cards = sofaScoreTestables.extractCards({
    incidents: [
      {
        incidentType: 'card',
        incidentClass: 'yellow',
        id: 123,
        time: 77,
        addedTime: 2,
        isHome: true,
        playerName: 'Orkun Kokcu',
        reason: 'Argument',
      },
      {
        incidentType: 'goal',
        id: 124,
      },
    ],
  });

  assert.equal(cards.length, 1);
  assert.equal(cards[0].cardType, 'yellow');
  assert.equal(cards[0].team, 'home');
  assert.equal(cards[0].playerName, 'Orkun Kokcu');
});

test('extractAbsentees supports SofaScore homeMissing format', () => {
  const absentees = sofaScoreTestables.extractAbsentees({
    homeMissing: [
      {
        name: 'Veysel Sari',
        reason: 1,
        description: 'Knock',
        type: 'missing',
      },
    ],
    awayMissing: [],
  });

  assert.equal(absentees.length, 1);
  assert.equal(absentees[0].side, 'home');
  assert.equal(absentees[0].playerName, 'Veysel Sari');
  assert.equal(absentees[0].status, 'injury');
  assert.equal(absentees[0].description, 'Knock');
});
