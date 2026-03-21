import { CacheStore } from '../scraper/cache';
import { Standing, StandingsData, FormResult } from '../scraper/types';
import { getLeagueMapping } from './tournament-map';
import {
  fetchTournamentStandings,
  fetchTeamLastEvents,
  FootballApiNotFoundError,
} from './football-api';

const STANDINGS_CACHE_TTL = 60 * 60 * 1000; // 1 saat
const standingsServiceCache = new CacheStore<StandingsData>(STANDINGS_CACHE_TTL);

// Lig label'lari
const LEAGUE_LABELS: Record<string, string> = {
  'super-lig': 'Süper Lig',
  'premier-league': 'Premier League',
  'la-liga': 'La Liga',
  'serie-a': 'Serie A',
  'bundesliga': 'Bundesliga',
  'ligue-1': 'Ligue 1',
  '1-lig': '1. Lig',
  'eredivisie': 'Eredivisie',
  'liga-portugal': 'Liga Portugal',
  'championship': 'Championship',
};

function deriveForm(events: any[], teamId: number): FormResult[] {
  return events.slice(0, 5).map((evt: any) => {
    const isHome = evt.homeTeam?.id === teamId;
    const hs = evt.homeScore?.current;
    const as_ = evt.awayScore?.current;
    if (typeof hs !== 'number' || typeof as_ !== 'number') return 'D' as FormResult;
    if (hs === as_) return 'D' as FormResult;
    if (isHome) return hs > as_ ? 'W' as FormResult : 'L' as FormResult;
    return as_ > hs ? 'W' as FormResult : 'L' as FormResult;
  });
}

export async function getStandings(leagueId: string): Promise<StandingsData> {
  const cacheKey = `standings:${leagueId}`;
  const cached = standingsServiceCache.get(cacheKey);
  if (cached) return cached;

  const mapping = await getLeagueMapping(leagueId);
  if (!mapping) {
    throw new FootballApiNotFoundError(`Lig bulunamadi: ${leagueId}`);
  }

  const { tournamentId, seasonId } = mapping;
  const data = await fetchTournamentStandings(tournamentId, seasonId, 'total');

  const tables = Array.isArray(data?.standings) ? data.standings : [];
  const rows = tables.length > 0 && Array.isArray(tables[0]?.rows) ? tables[0].rows : [];

  // Form verileri icin son maclari al (paralel)
  const teamIds = rows.map((row: any) => row.team?.id).filter(Boolean);
  const formMap = new Map<number, FormResult[]>();

  // Ilk 6 takim icin form verisi al (performans icin sinirla)
  const formPromises = teamIds.slice(0, 20).map(async (teamId: number) => {
    try {
      const eventsData = await fetchTeamLastEvents(teamId, 0);
      const events = Array.isArray(eventsData?.events) ? eventsData.events : [];
      formMap.set(teamId, deriveForm(events, teamId));
    } catch {
      formMap.set(teamId, []);
    }
  });
  await Promise.all(formPromises);

  const standings: Standing[] = rows.map((row: any) => {
    const teamId = row.team?.id;
    return {
      position: typeof row.position === 'number' ? row.position : 0,
      team: String(row.team?.name || ''),
      played: row.matches ?? 0,
      won: row.wins ?? 0,
      drawn: row.draws ?? 0,
      lost: row.losses ?? 0,
      gf: row.scoresFor ?? 0,
      ga: row.scoresAgainst ?? 0,
      gd: (row.scoresFor ?? 0) - (row.scoresAgainst ?? 0),
      points: row.points ?? 0,
      form: formMap.get(teamId) || [],
    };
  });

  const result: StandingsData = {
    league: leagueId,
    leagueLabel: LEAGUE_LABELS[leagueId] || leagueId,
    standings,
    fetchedAt: new Date().toISOString(),
  };

  standingsServiceCache.set(cacheKey, result);
  return result;
}

export function clearStandingsCache(leagueId?: string): void {
  if (leagueId) {
    standingsServiceCache.clear(`standings:${leagueId}`);
  } else {
    standingsServiceCache.clear();
  }
}
