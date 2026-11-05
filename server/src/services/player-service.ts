import { CacheStore } from '../scraper/cache';
import { scrapePlayerDetail } from '../scraper/player-detail-scraper';
import { scrapeTeamDetail, scrapeTeamList } from '../scraper/team-detail-scraper';
import { LEAGUES, PlayerProfile, PlayerSearchResult, PlayerTransfer } from '../scraper/types';
import {
  fetchPlayerInfo,
  fetchPlayerTransferHistory,
  FootballApiNotFoundError,
} from './football-api';

const PLAYER_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 saat
const playerServiceCache = new CacheStore<PlayerProfile>(PLAYER_CACHE_TTL);
const playerIndexCache = new CacheStore<PlayerSearchResult[]>(24 * 60 * 60 * 1000);

function formatMarketValue(value?: number | null): string {
  if (typeof value !== 'number' || value <= 0) {
    return 'N/A';
  }

  if (value >= 1000000) {
    return `EUR ${(value / 1000000).toFixed(1)}M`;
  }

  return `EUR ${(value / 1000).toFixed(0)}K`;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

async function buildLeaguePlayerIndex(leagueId: string): Promise<PlayerSearchResult[]> {
  const cached = playerIndexCache.get(`players:${leagueId}`);
  if (cached) return cached;

  const league = LEAGUES.find((item) => item.id === leagueId);
  if (!league) {
    throw new FootballApiNotFoundError(`Lig bulunamadi: ${leagueId}`);
  }

  const teams = await scrapeTeamList(leagueId);
  const results: PlayerSearchResult[] = [];

  for (const team of teams) {
    try {
      const detail = await scrapeTeamDetail(team.teamId, team.teamSlug, leagueId);
      detail.players.forEach((player) => {
        const playerId = player.tmPlayerId || player.playerId || '';
        const playerSlug = player.tmPlayerSlug || player.playerSlug || '';
        if (!playerId || !playerSlug) return;

        results.push({
          playerId,
          playerSlug,
          source: 'tm',
          name: player.name,
          teamName: detail.teamName,
          teamId: team.teamId,
          teamSlug: team.teamSlug,
          league: leagueId,
          leagueLabel: league.label,
          position: player.position,
          age: player.age,
          nationality: player.nationality,
          marketValue: player.marketValue,
          shirtNumber: player.shirtNumber,
          status: player.status,
        });
      });
    } catch (error: any) {
      console.warn(`[PlayerSearch] ${team.name} kadrosu indekslenemedi: ${error.message}`);
    }
  }

  playerIndexCache.set(`players:${leagueId}`, results);
  return results;
}

async function searchLeaguePlayersIncremental(
  leagueId: string,
  q: string,
  limit: number
): Promise<PlayerSearchResult[]> {
  const cached = playerIndexCache.get(`players:${leagueId}`);
  if (cached) {
    return cached.filter((player) => normalizeKey(player.name).includes(q)).slice(0, limit);
  }

  const league = LEAGUES.find((item) => item.id === leagueId);
  if (!league) {
    throw new FootballApiNotFoundError(`Lig bulunamadi: ${leagueId}`);
  }

  const teams = await scrapeTeamList(leagueId);
  const matches: PlayerSearchResult[] = [];

  for (const team of teams) {
    try {
      const detail = await scrapeTeamDetail(team.teamId, team.teamSlug, leagueId);
      detail.players.forEach((player) => {
        if (!normalizeKey(player.name).includes(q)) return;
        const playerId = player.tmPlayerId || player.playerId || '';
        const playerSlug = player.tmPlayerSlug || player.playerSlug || '';
        if (!playerId || !playerSlug) return;

        matches.push({
          playerId,
          playerSlug,
          source: 'tm',
          name: player.name,
          teamName: detail.teamName,
          teamId: team.teamId,
          teamSlug: team.teamSlug,
          league: leagueId,
          leagueLabel: league.label,
          position: player.position,
          age: player.age,
          nationality: player.nationality,
          marketValue: player.marketValue,
          shirtNumber: player.shirtNumber,
          status: player.status,
        });
      });
      if (matches.length >= limit || (matches.length > 0 && q.length >= 3)) break;
    } catch (error: any) {
      console.warn(`[PlayerSearch] ${team.name} kadrosu aranamadı: ${error.message}`);
    }
  }

  return matches.slice(0, limit);
}

export async function searchPlayers(
  query = '',
  leagueId = '',
  limit = 30
): Promise<PlayerSearchResult[]> {
  const q = normalizeKey(query);
  const leagues = leagueId
    ? [leagueId]
    : ['super-lig', ...LEAGUES.map((league) => league.id).filter((id) => id !== 'super-lig')];
  const collected: PlayerSearchResult[] = [];

  for (const league of leagues) {
    if (q) {
      const before = collected.length;
      collected.push(...await searchLeaguePlayersIncremental(league, q, limit - collected.length));
      if (collected.length >= limit || (!leagueId && collected.length > before)) break;
      continue;
    }

    let index = playerIndexCache.get(`players:${league}`);
    if (!index && (q || collected.length === 0 || leagueId)) {
      index = await buildLeaguePlayerIndex(league);
    }
    if (!index) continue;

    const matches = q
      ? index.filter((player) => normalizeKey(player.name).includes(q))
      : index;
    collected.push(...matches);

    if (collected.length >= limit) break;
  }

  const seen = new Set<string>();
  return collected
    .filter((player) => {
      const key = `${player.source}:${player.playerId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export async function getPlayerDetail(
  playerId: string,
  playerSlug = '',
  source: 'tm' | 'sofa' = 'sofa'
): Promise<PlayerProfile> {
  if (source === 'tm') {
    if (!playerSlug) {
      throw new FootballApiNotFoundError(`Transfermarkt oyuncu slug eksik: ${playerId}`);
    }
    return scrapePlayerDetail(playerId, playerSlug);
  }

  const cacheKey = `player:sofa:${playerId}`;
  const cached = playerServiceCache.get(cacheKey);
  if (cached) return cached;

  const numericId = parseInt(playerId, 10);
  if (isNaN(numericId)) {
    throw new FootballApiNotFoundError(`Gecersiz oyuncu ID: ${playerId}`);
  }

  const [playerData, transferData] = await Promise.all([
    fetchPlayerInfo(numericId),
    fetchPlayerTransferHistory(numericId).catch(() => ({ transferHistory: [] })),
  ]);

  const player = playerData?.player || playerData || {};
  const transfers = Array.isArray(transferData?.transferHistory)
    ? transferData.transferHistory
    : [];

  const now = Date.now();
  const birthTs = player.dateOfBirthTimestamp;
  const age = typeof birthTs === 'number'
    ? Math.floor((now / 1000 - birthTs) / (365.25 * 24 * 3600))
    : 0;

  const stats = player.statistics || {};
  const transferHistory: PlayerTransfer[] = transfers.map((entry: any) => ({
    fromTeam: String(entry?.transferFrom?.name || entry?.fromTeamName || '-'),
    toTeam: String(entry?.transferTo?.name || entry?.toTeamName || '-'),
    transferDate: entry?.transferDate
      ? String(entry.transferDate)
      : entry?.timestamp
        ? new Date(entry.timestamp * 1000).toISOString()
        : '-',
    fee: entry?.transferFeeDescription
      ? String(entry.transferFeeDescription)
      : entry?.transferFee
        ? `EUR ${entry.transferFee}`
        : '-',
  }));

  const result: PlayerProfile = {
    name: String(player.name || ''),
    position: String(player.position || ''),
    age,
    nationality: String(player.country?.name || ''),
    marketValue: formatMarketValue(player.proposedMarketValue),
    currentClub: String(player.team?.name || ''),
    foot: String(player.preferredFoot || 'N/A'),
    height: typeof player.height === 'number' ? `${player.height} cm` : 'N/A',
    appearances: stats.appearances ?? 0,
    goals: stats.goals ?? 0,
    assists: stats.assists ?? 0,
    yellowCards: stats.yellowCards ?? 0,
    redCards: stats.redCards ?? 0,
    minutesPlayed: stats.minutesPlayed ?? 0,
    injuries: [],
    currentInjury: player.injured ? 'Sakatlık' : null,
    transferHistory,
    imageUrl: player.id
      ? `https://api.sofascore.app/api/v1/player/${player.id}/image`
      : undefined,
  };

  playerServiceCache.set(cacheKey, result);
  return result;
}

export function clearPlayerCache(playerId?: string): void {
  if (playerId) {
    playerServiceCache.clear(`player:sofa:${playerId}`);
  } else {
    playerServiceCache.clear();
    playerIndexCache.clear();
  }
}
