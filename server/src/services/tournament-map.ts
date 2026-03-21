import { CacheStore } from '../scraper/cache';
import { fetchTournaments, fetchTournamentSeasons } from './football-api';

const TOURNAMENT_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat
const tournamentCache = new CacheStore<Record<string, { id: number; name: string }>>(
  TOURNAMENT_CACHE_TTL
);
const seasonCache = new CacheStore<number>(TOURNAMENT_CACHE_TTL);

// Hardcoded fallback - API cevaplamazsa kullanilir
const FALLBACK_MAP: Record<string, number> = {
  'super-lig': 52,
  'premier-league': 17,
  'la-liga': 8,
  'serie-a': 23,
  'bundesliga': 35,
  'ligue-1': 34,
  '1-lig': 98,
  'eredivisie': 37,
  'liga-portugal': 238,
  'scottish-premiership': 36,
  'championship': 18,
  'champions-league': 7,
  'europa-league': 679,
  'conference-league': 17015,
};

async function loadTournamentMap(): Promise<Record<string, { id: number; name: string }>> {
  const cached = tournamentCache.get('tournaments');
  if (cached) return cached;

  try {
    const data = await fetchTournaments();
    const map = data?.tournaments || {};
    tournamentCache.set('tournaments', map);
    return map;
  } catch (error) {
    console.error('[TournamentMap] Turnuva listesi alinamadi:', error);
    return {};
  }
}
function pickCurrentSeasonId(seasons: any[]): number | null {
  if (!Array.isArray(seasons) || seasons.length === 0) {
    return null;
  }

  const currentSeason =
    seasons.find((season) => season?.current === true) ||
    seasons.find((season) => season?.year === new Date().getFullYear()) ||
    seasons[0];

  return typeof currentSeason?.id === 'number' ? currentSeason.id : null;
}

export async function getTournamentId(slug: string): Promise<number | null> {
  const map = await loadTournamentMap();
  if (map[slug]?.id) return map[slug].id;
  return FALLBACK_MAP[slug] ?? null;
}

export async function getTournamentSeasonId(tournamentId: number): Promise<number | null> {
  const cacheKey = `season:${tournamentId}`;
  const cached = seasonCache.get(cacheKey);
  if (cached) return cached;

  try {
    const data = await fetchTournamentSeasons(tournamentId);
    const seasons = data?.seasons;
    const currentSeasonId = pickCurrentSeasonId(seasons);
    if (currentSeasonId) {
      seasonCache.set(cacheKey, currentSeasonId);
      return currentSeasonId;
    }
  } catch (error) {
    console.error(`[TournamentMap] Sezon bilgisi alinamadi (${tournamentId}):`, error);
  }
  return null;
}

export async function getLeagueMapping(
  slug: string
): Promise<{ tournamentId: number; seasonId: number } | null> {
  const tournamentId = await getTournamentId(slug);
  if (!tournamentId) return null;

  const seasonId = await getTournamentSeasonId(tournamentId);
  if (!seasonId) return null;

  return { tournamentId, seasonId };
}

export const __testables = {
  pickCurrentSeasonId,
  FALLBACK_MAP,
};

