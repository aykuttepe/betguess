import { CacheStore } from '../scraper/cache';
import {
  TeamListItem,
  TeamValue,
  TeamValuesData,
  TeamDetail,
  PlayerStats,
} from '../scraper/types';
import { getLeagueMapping } from './tournament-map';
import {
  fetchTournamentStandings,
  fetchTeamInfo,
  fetchTeamPlayers,
  FootballApiNotFoundError,
} from './football-api';

const TEAM_LIST_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 saat
const TEAM_DETAIL_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 saat
const TEAM_VALUES_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 saat

const teamListServiceCache = new CacheStore<TeamListItem[]>(TEAM_LIST_CACHE_TTL);
const teamDetailServiceCache = new CacheStore<TeamDetail>(TEAM_DETAIL_CACHE_TTL);
const teamValuesServiceCache = new CacheStore<TeamValuesData>(TEAM_VALUES_CACHE_TTL);

const LEAGUE_LABELS: Record<string, string> = {
  'super-lig': 'Süper Lig',
  'premier-league': 'Premier League',
  'la-liga': 'La Liga',
  'serie-a': 'Serie A',
  'bundesliga': 'Bundesliga',
  'ligue-1': 'Ligue 1',
  '1-lig': '1. Lig',
};

function formatMarketValue(value?: number | null): string {
  if (typeof value !== 'number' || value <= 0) {
    return 'N/A';
  }

  if (value >= 1000000000) {
    return `EUR ${(value / 1000000000).toFixed(2)}B`;
  }

  if (value >= 1000000) {
    return `EUR ${(value / 1000000).toFixed(1)}M`;
  }

  return `EUR ${(value / 1000).toFixed(0)}K`;
}

function getPlayerAge(player: any, nowSeconds: number): number {
  const ts = player?.dateOfBirthTimestamp;
  if (typeof ts !== 'number') {
    return 0;
  }

  return Math.floor((nowSeconds - ts) / (365.25 * 24 * 3600));
}

function countForeignPlayers(playersList: any[], teamCountry: string): number {
  if (!teamCountry) {
    return 0;
  }

  return playersList.filter((entry: any) => {
    const playerCountry = String(entry?.player?.country?.name || '').trim();
    return playerCountry && playerCountry !== teamCountry;
  }).length;
}

function extractStandingMetrics(standingsData: any, teamId: number): {
  totalMatches: number;
  pointsPerGame: number;
} {
  const tables = Array.isArray(standingsData?.standings) ? standingsData.standings : [];
  const rows = tables.length > 0 && Array.isArray(tables[0]?.rows) ? tables[0].rows : [];
  const row = rows.find((item: any) => item?.team?.id === teamId);

  if (!row) {
    return { totalMatches: 0, pointsPerGame: 0 };
  }

  const totalMatches = row.matches ?? 0;
  const points = row.points ?? 0;

  return {
    totalMatches,
    pointsPerGame: totalMatches > 0 ? Math.round((points / totalMatches) * 100) / 100 : 0,
  };
}

export async function getTeamList(leagueId: string): Promise<TeamListItem[]> {
  const cacheKey = `teamlist:${leagueId}`;
  const cached = teamListServiceCache.get(cacheKey);
  if (cached) return cached;

  const mapping = await getLeagueMapping(leagueId);
  if (!mapping) {
    throw new FootballApiNotFoundError(`Lig bulunamadi: ${leagueId}`);
  }

  const { tournamentId, seasonId } = mapping;
  const data = await fetchTournamentStandings(tournamentId, seasonId, 'total');

  const tables = Array.isArray(data?.standings) ? data.standings : [];
  const rows = tables.length > 0 && Array.isArray(tables[0]?.rows) ? tables[0].rows : [];

  const teams: TeamListItem[] = rows.map((row: any) => ({
    name: String(row.team?.name || ''),
    teamId: String(row.team?.id || ''),
    teamSlug: String(row.team?.slug || ''),
  }));

  teamListServiceCache.set(cacheKey, teams);
  return teams;
}

export async function getTeamDetail(
  teamId: string,
  teamSlug: string,
  league: string
): Promise<TeamDetail> {
  const cacheKey = `detail:${teamId}:${league}`;
  const cached = teamDetailServiceCache.get(cacheKey);
  if (cached) return cached;

  const numericId = parseInt(teamId, 10);
  if (isNaN(numericId)) {
    throw new FootballApiNotFoundError(`Gecersiz takim ID: ${teamId}`);
  }

  const mapping = await getLeagueMapping(league);
  const standingsData = mapping
    ? await fetchTournamentStandings(mapping.tournamentId, mapping.seasonId, 'total').catch(() => null)
    : null;

  const [teamData, playersData] = await Promise.all([
    fetchTeamInfo(numericId),
    fetchTeamPlayers(numericId),
  ]);

  const team = teamData?.team || teamData || {};
  const playersList = Array.isArray(playersData?.players) ? playersData.players : [];
  const now = Math.floor(Date.now() / 1000);
  const ages = playersList
    .map((entry: any) => getPlayerAge(entry.player, now))
    .filter((age: number) => age > 0);

  const avgAge = ages.length > 0
    ? Math.round((ages.reduce((sum: number, age: number) => sum + age, 0) / ages.length) * 10) / 10
    : 0;
  const standingMetrics = extractStandingMetrics(standingsData, numericId);

  const players: PlayerStats[] = playersList.map((entry: any) => {
    const player = entry.player || {};
    const stats = entry.statistics || {};

    return {
      name: String(player.name || ''),
      position: String(player.position || ''),
      age: getPlayerAge(player, now),
      nationality: String(player.country?.name || ''),
      appearances: stats.appearances ?? 0,
      goals: stats.goals ?? 0,
      assists: stats.assists ?? 0,
      yellowCards: stats.yellowCards ?? 0,
      secondYellows: stats.yellowRedCards ?? 0,
      redCards: stats.redCards ?? 0,
      minutesPlayed: stats.minutesPlayed ?? 0,
      marketValue: formatMarketValue(player.proposedMarketValue),
      playerId: String(player.id || ''),
      playerSlug: String(player.slug || ''),
      currentInjury: player.injured ? 'Sakatlık' : null,
    };
  });

  const result: TeamDetail = {
    teamName: String(team.name || ''),
    league,
    leagueLabel: LEAGUE_LABELS[league] || league,
    teamId: String(team.id || teamId),
    teamSlug: String(team.slug || teamSlug || ''),
    teamCountry: String(team.country?.name || ''),
    logoUrl: numericId ? `/api/football/teams/${numericId}/image` : undefined,
    squadSize: playersList.length,
    avgAge,
    totalValue: formatMarketValue(team.proposedMarketValue),
    pointsPerGame: standingMetrics.pointsPerGame,
    totalMatches: standingMetrics.totalMatches,
    players,
    fetchedAt: new Date().toISOString(),
  };

  teamDetailServiceCache.set(cacheKey, result);
  return result;
}

export async function getTeamValues(leagueId: string): Promise<TeamValuesData> {
  const cacheKey = `values:${leagueId}`;
  const cached = teamValuesServiceCache.get(cacheKey);
  if (cached) return cached;

  const mapping = await getLeagueMapping(leagueId);
  if (!mapping) {
    throw new FootballApiNotFoundError(`Lig bulunamadi: ${leagueId}`);
  }

  const { tournamentId, seasonId } = mapping;
  const data = await fetchTournamentStandings(tournamentId, seasonId, 'total');

  const tables = Array.isArray(data?.standings) ? data.standings : [];
  const rows = tables.length > 0 && Array.isArray(tables[0]?.rows) ? tables[0].rows : [];

  const teams: TeamValue[] = await Promise.all(
    rows.map(async (row: any) => {
      const numericId = row.team?.id;
      if (typeof numericId !== 'number') {
        return {
          team: String(row.team?.name || ''),
          squadSize: 0,
          avgAge: 0,
          foreignPlayers: 0,
          totalValue: 'N/A',
        };
      }

      try {
        const [teamData, playersData] = await Promise.all([
          fetchTeamInfo(numericId),
          fetchTeamPlayers(numericId),
        ]);

        const team = teamData?.team || teamData || {};
        const playersList = Array.isArray(playersData?.players) ? playersData.players : [];
        const now = Math.floor(Date.now() / 1000);
        const ages = playersList
          .map((entry: any) => getPlayerAge(entry.player, now))
          .filter((age: number) => age > 0);

        return {
          team: String(team.name || row.team?.name || ''),
          squadSize: playersList.length,
          avgAge: ages.length > 0
            ? Math.round((ages.reduce((sum: number, age: number) => sum + age, 0) / ages.length) * 10) / 10
            : 0,
          foreignPlayers: countForeignPlayers(playersList, String(team.country?.name || '')),
          totalValue: formatMarketValue(team.proposedMarketValue),
        };
      } catch {
        return {
          team: String(row.team?.name || ''),
          squadSize: 0,
          avgAge: 0,
          foreignPlayers: 0,
          totalValue: 'N/A',
        };
      }
    })
  );

  const result: TeamValuesData = {
    league: leagueId,
    leagueLabel: LEAGUE_LABELS[leagueId] || leagueId,
    teams,
    fetchedAt: new Date().toISOString(),
  };

  teamValuesServiceCache.set(cacheKey, result);
  return result;
}

export function clearTeamDetailCache(teamId?: string): void {
  if (teamId) {
    teamDetailServiceCache.clear();
  } else {
    teamDetailServiceCache.clear();
  }
}

export function clearTeamValuesCache(leagueId?: string): void {
  if (leagueId) {
    teamValuesServiceCache.clear(`values:${leagueId}`);
  } else {
    teamValuesServiceCache.clear();
  }
}


