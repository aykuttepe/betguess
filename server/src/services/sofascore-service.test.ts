import test from 'node:test';
import assert from 'node:assert/strict';
import { __testables as eventResolverTestables } from './event-resolver';
import { __testables as matchIntelTestables } from './match-intel-service';

test('parseMatchDate converts DD.MM.YYYY into YYYY-MM-DD', () => {
  const iso = eventResolverTestables.parseMatchDate('07.03.2026');
  assert.equal(iso, '2026-03-07');
});

test('normalizeTeamName removes punctuation and common suffix tokens', () => {
  const normalized = eventResolverTestables.normalizeTeamName('Beşiktaş A.Ş. FK');
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

  const best = eventResolverTestables.findBestEvent(events, 'Beşiktaş A.Ş.', 'Galatasaray A.Ş.');
  assert.ok(best);
  assert.equal(best?.id, 10);
});

test('classifyAbsenteeStatus detects suspension and injury', () => {
  const suspension = matchIntelTestables.classifyAbsenteeStatus({
    type: 'missing',
    reason: 11,
    description: 'Yellow card accumulation suspension',
  });
  const injury = matchIntelTestables.classifyAbsenteeStatus({
    type: 'missing',
    reason: 1,
    description: 'Hamstring injury',
  });

  assert.equal(suspension, 'suspension');
  assert.equal(injury, 'injury');
});

test('extractCards maps card incidents into normalized output', () => {
  const cards = matchIntelTestables.extractCards({
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
