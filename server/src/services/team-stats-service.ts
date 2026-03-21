import { CacheStore } from '../scraper/cache';
import {
  fetchMatchDetail,
  fetchMatchH2H,
  fetchTeamLastEvents,
  fetchTournamentStandings,
  FootballApiNotFoundError,
  FootballApiUpstreamError,
} from './football-api';

// Re-export error types for backward compat
export { FootballApiNotFoundError as MatchIntelNotFoundError } from './football-api';
export { FootballApiUpstreamError as MatchIntelUpstreamError } from './football-api';

// --- Types (mevcut client arayuzleriyle uyumlu) ---

export interface TeamStandingRow {
  position: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface H2HMatch {
  eventId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  tournament: string;
}

export interface RecentMatch {
  eventId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  result: 'W' | 'D' | 'L';
  tournament: string;
}

export interface TeamStatsResponse {
  eventId: number;
  homeTeam: {
    id: number;
    name: string;
    standing: TeamStandingRow | null;
    recentMatches: RecentMatch[];
  };
  awayTeam: {
    id: number;
    name: string;
    standing: TeamStandingRow | null;
    recentMatches: RecentMatch[];
  };
  h2hMatches: H2HMatch[];
}

// --- Cache ---

const TEAM_STATS_CACHE_TTL = 15 * 60 * 1000; // 15 dk
const teamStatsCache = new CacheStore<TeamStatsResponse>(TEAM_STATS_CACHE_TTL);

// --- Transform helpers ---

function extractStandingRow(standingsRaw: any, teamId: number): TeamStandingRow | null {
  const tables = Array.isArray(standingsRaw?.standings) ? standingsRaw.standings : [];
  for (const table of tables) {
    const rows = Array.isArray(table?.rows) ? table.rows : [];
    for (const row of rows) {
      if (row?.team?.id === teamId) {
        return {
          position: typeof row.position === 'number' ? row.position : 0,
          teamId: row.team.id,
          teamName: String(row.team.name || ''),
          played: row.matches ?? 0,
          won: row.wins ?? 0,
          drawn: row.draws ?? 0,
          lost: row.losses ?? 0,
          goalsFor: row.scoresFor ?? 0,
          goalsAgainst: row.scoresAgainst ?? 0,
          goalDifference: (row.scoresFor ?? 0) - (row.scoresAgainst ?? 0),
          points: row.points ?? 0,
        };
      }
    }
  }
  return null;
}

function extractH2HMatches(h2hRaw: any): H2HMatch[] {
  const events = Array.isArray(h2hRaw?.teamDuel?.events)
    ? h2hRaw.teamDuel.events
    : Array.isArray(h2hRaw?.events)
      ? h2hRaw.events
      : [];

  return events.slice(0, 10).map((evt: any) => ({
    eventId: evt.id ?? 0,
    date:
      typeof evt.startTimestamp === 'number'
        ? new Date(evt.startTimestamp * 1000).toISOString()
        : '',
    homeTeam: String(evt.homeTeam?.name || ''),
    awayTeam: String(evt.awayTeam?.name || ''),
    homeScore:
      typeof evt.homeScore?.current === 'number' ? evt.homeScore.current : null,
    awayScore:
      typeof evt.awayScore?.current === 'number' ? evt.awayScore.current : null,
    tournament: String(evt.tournament?.name || ''),
  }));
}

function extractRecentMatches(recentRaw: any, teamId: number): RecentMatch[] {
  const events = Array.isArray(recentRaw?.events) ? recentRaw.events : [];
  return events.slice(0, 6).map((evt: any) => {
    const isHome = evt.homeTeam?.id === teamId;
    const hs =
      typeof evt.homeScore?.current === 'number' ? evt.homeScore.current : null;
    const as_ =
      typeof evt.awayScore?.current === 'number' ? evt.awayScore.current : null;

    let result: 'W' | 'D' | 'L' = 'D';
    if (hs !== null && as_ !== null) {
      if (hs === as_) result = 'D';
      else if (isHome) result = hs > as_ ? 'W' : 'L';
      else result = as_ > hs ? 'W' : 'L';
    }

    return {
      eventId: evt.id ?? 0,
      date:
        typeof evt.startTimestamp === 'number'
          ? new Date(evt.startTimestamp * 1000).toISOString()
          : '',
      homeTeam: String(evt.homeTeam?.name || ''),
      awayTeam: String(evt.awayTeam?.name || ''),
      homeScore: hs,
      awayScore: as_,
      result,
      tournament: String(evt.tournament?.name || ''),
    };
  });
}

async function fetchOptional(fetcher: () => Promise<any>, fallback: any): Promise<any> {
  try {
    return await fetcher();
  } catch (error: any) {
    if (error instanceof FootballApiNotFoundError) {
      return fallback;
    }
    throw error;
  }
}

// --- Main export ---

export async function getTeamStats(eventId: number): Promise<TeamStatsResponse> {
  const cacheKey = `teamstats:${eventId}`;
  const cached = teamStatsCache.get(cacheKey);
  if (cached) return cached;

  const eventRaw = await fetchMatchDetail(eventId);
  const event = eventRaw?.event || eventRaw;
  if (!event) {
    throw new FootballApiNotFoundError('Event bulunamadi.');
  }

  const homeTeamId: number = event.homeTeam?.id;
  const awayTeamId: number = event.awayTeam?.id;
  const tournamentId: number | undefined =
    event.tournament?.uniqueTournament?.id;
  const seasonId: number | undefined = event.season?.id;

  if (!homeTeamId || !awayTeamId) {
    throw new FootballApiNotFoundError('Takim bilgileri bulunamadi.');
  }

  const [standingsRaw, h2hRaw, homeRecentRaw, awayRecentRaw] = await Promise.all([
    tournamentId && seasonId
      ? fetchOptional(
          () => fetchTournamentStandings(tournamentId, seasonId, 'total'),
          { standings: [] }
        )
      : Promise.resolve({ standings: [] }),
    fetchOptional(() => fetchMatchH2H(eventId), { teamDuel: { events: [] } }),
    fetchOptional(() => fetchTeamLastEvents(homeTeamId, 0), { events: [] }),
    fetchOptional(() => fetchTeamLastEvents(awayTeamId, 0), { events: [] }),
  ]);

  const response: TeamStatsResponse = {
    eventId,
    homeTeam: {
      id: homeTeamId,
      name: String(event.homeTeam?.name || ''),
      standing: extractStandingRow(standingsRaw, homeTeamId),
      recentMatches: extractRecentMatches(homeRecentRaw, homeTeamId),
    },
    awayTeam: {
      id: awayTeamId,
      name: String(event.awayTeam?.name || ''),
      standing: extractStandingRow(standingsRaw, awayTeamId),
      recentMatches: extractRecentMatches(awayRecentRaw, awayTeamId),
    },
    h2hMatches: extractH2HMatches(h2hRaw),
  };

  teamStatsCache.set(cacheKey, response);
  return response;
}
