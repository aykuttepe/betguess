import { CacheStore } from '../scraper/cache';
import { PlayerProfile, PlayerTransfer } from '../scraper/types';
import {
  fetchPlayerInfo,
  fetchPlayerTransferHistory,
  FootballApiNotFoundError,
} from './football-api';

const PLAYER_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 saat
const playerServiceCache = new CacheStore<PlayerProfile>(PLAYER_CACHE_TTL);

function formatMarketValue(value?: number | null): string {
  if (typeof value !== 'number' || value <= 0) {
    return 'N/A';
  }

  if (value >= 1000000) {
    return `EUR ${(value / 1000000).toFixed(1)}M`;
  }

  return `EUR ${(value / 1000).toFixed(0)}K`;
}

export async function getPlayerDetail(
  playerId: string,
  _playerSlug?: string
): Promise<PlayerProfile> {
  const cacheKey = `player:${playerId}`;
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
    playerServiceCache.clear(`player:${playerId}`);
  } else {
    playerServiceCache.clear();
  }
}
