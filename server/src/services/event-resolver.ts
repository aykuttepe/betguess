import { CacheStore } from '../scraper/cache';
import {
  fetchScheduledMatches,
  searchFootball,
  FootballApiNotFoundError,
} from './football-api';

const EVENT_CACHE_TTL = 30 * 60 * 1000; // 30 dakika
const eventIdCache = new CacheStore<number>(EVENT_CACHE_TTL);

// --- Team name matching (sofascore-service.ts'den tasinmis) ---

const STOPWORDS = new Set([
  'as', 'a', 's', 'a.s', 'a.s.', 'as.', 'fk', 'f', 'k', 'f.k', 'f.k.',
  'fc', 'cf', 'ac', 'sk', 'jk', 'kulubu',
]);

function normalizeTeamName(name: string): string {
  const ascii = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ı]/g, 'i')
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const filteredTokens = ascii
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));

  return filteredTokens.join(' ').trim();
}

function bigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;

  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }

  let overlap = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg) || 0;
    if (count > 0) {
      overlap++;
      bigramsA.set(bg, count - 1);
    }
  }

  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

function teamSimilarity(expected: string, actual: string): number {
  const a = normalizeTeamName(expected);
  const b = normalizeTeamName(actual);

  if (!a || !b) return 0;
  if (a === b) return 1;

  const tokensA = a.split(' ');
  const tokensB = b.split(' ');
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = tokensA.filter((t) => setB.has(t)).length;
  const tokenScore = intersection / Math.max(setA.size, setB.size, 1);
  const textScore = bigramSimilarity(a, b);

  let score = tokenScore * 0.65 + textScore * 0.35;
  if (a.includes(b) || b.includes(a)) {
    score = Math.min(1, score + 0.1);
  }

  return score;
}

interface MatchEvent {
  id: number;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
}

function findBestEvent(
  events: MatchEvent[],
  homeTeam: string,
  awayTeam: string
): MatchEvent | null {
  let best: MatchEvent | null = null;
  let bestScore = 0;

  for (const event of events) {
    const candidateHome = event.homeTeam?.name || '';
    const candidateAway = event.awayTeam?.name || '';
    if (!candidateHome || !candidateAway) continue;

    const directHome = teamSimilarity(homeTeam, candidateHome);
    const directAway = teamSimilarity(awayTeam, candidateAway);
    const directScore = (directHome + directAway) / 2;

    const swappedHome = teamSimilarity(homeTeam, candidateAway);
    const swappedAway = teamSimilarity(awayTeam, candidateHome);
    const swappedScore = ((swappedHome + swappedAway) / 2) * 0.92;

    const score = Math.max(directScore, swappedScore);
    if (score > bestScore) {
      bestScore = score;
      best = event;
    }
  }

  if (!best || bestScore < 0.55) {
    return null;
  }
  return best;
}

// --- Date parsing ---

function parseMatchDate(matchDate: string): string {
  const parts = matchDate.split('.');
  if (parts.length !== 3) {
    throw new FootballApiNotFoundError(`Gecersiz tarih formati: ${matchDate}`);
  }

  const [day, month, year] = parts;
  if (!day || !month || !year) {
    throw new FootballApiNotFoundError(`Gecersiz tarih formati: ${matchDate}`);
  }

  const iso = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new FootballApiNotFoundError(`Gecersiz tarih formati: ${matchDate}`);
  }
  return iso;
}

// --- Main resolver ---

export async function resolveEventId(
  homeTeam: string,
  awayTeam: string,
  matchDate: string
): Promise<number> {
  const cacheKey = `${homeTeam}|${awayTeam}|${matchDate}`;
  const cached = eventIdCache.get(cacheKey);
  if (cached) return cached;

  const dateIso = parseMatchDate(matchDate);

  // 1. Scheduled matches'ten bul
  try {
    const data = await fetchScheduledMatches(dateIso);
    const matches = data?.matches;
    if (Array.isArray(matches) && matches.length > 0) {
      const best = findBestEvent(matches, homeTeam, awayTeam);
      if (best?.id) {
        eventIdCache.set(cacheKey, best.id);
        return best.id;
      }
    }
  } catch {
    // fallback'e devam
  }

  // 2. Search ile dene
  try {
    const searchData = await searchFootball(`${homeTeam} ${awayTeam}`);
    const results = searchData?.results;
    if (Array.isArray(results)) {
      const eventResults = results.filter((r: any) => r.type === 'event');
      for (const result of eventResults) {
        const entity = result.entity;
        if (entity?.id) {
          eventIdCache.set(cacheKey, entity.id);
          return entity.id;
        }
      }
    }
  } catch {
    // hata durumunda exception firlat
  }

  throw new FootballApiNotFoundError(
    `Mac bulunamadi: ${homeTeam} vs ${awayTeam} (${matchDate})`
  );
}

export const __testables = {
  parseMatchDate,
  normalizeTeamName,
  teamSimilarity,
  findBestEvent,
};
