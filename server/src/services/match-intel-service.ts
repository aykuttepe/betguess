import { CacheStore } from '../scraper/cache';
import {
  fetchMatchDetail,
  fetchMatchStatistics,
  fetchMatchIncidents,
  fetchMatchLineups,
  FootballApiNotFoundError,
  FootballApiUpstreamError,
} from './football-api';
import { resolveEventId } from './event-resolver';

// Re-export error types with backward-compatible names
export { FootballApiNotFoundError as MatchIntelNotFoundError } from './football-api';
export { FootballApiUpstreamError as MatchIntelUpstreamError } from './football-api';

// --- Types (mevcut client arayuzleriyle uyumlu) ---

export type AbsenteeStatus = 'injury' | 'suspension' | 'missing' | 'unknown';
export type CardType = 'yellow' | 'red' | 'second_yellow' | 'unknown';

export interface MatchIntelEventMeta {
  eventId: number;
  tournament: string;
  category: string;
  status: string;
  startTimestamp: number;
  startDateIso: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface MatchIntelStatisticItem {
  name: string;
  home: string | number | null;
  away: string | number | null;
  homeValue: number | null;
  awayValue: number | null;
  compareCode: number | null;
  valueType: string | null;
  statisticsType: string | null;
}

export interface MatchIntelStatisticsGroup {
  period: string;
  groupName: string;
  items: MatchIntelStatisticItem[];
}

export interface MatchIntelCardIncident {
  id: number | null;
  minute: number | null;
  addedTime: number | null;
  team: 'home' | 'away' | 'unknown';
  cardType: CardType;
  playerName: string;
  reason: string | null;
}

export interface MatchIntelAbsentee {
  side: 'home' | 'away';
  playerId: number | null;
  playerName: string;
  position: string;
  status: AbsenteeStatus;
  reasonCode: number | null;
  description: string | null;
  expectedEndDate: string | null;
}

export interface MatchIntelResponse {
  eventMeta: MatchIntelEventMeta;
  statisticsGroups: MatchIntelStatisticsGroup[];
  cards: MatchIntelCardIncident[];
  absentees: MatchIntelAbsentee[];
  raw: {
    event: any;
    statistics: any;
    incidents: any;
    lineups: any;
  };
}

// --- Cache ---

const EVENT_CACHE_TTL = 5 * 60 * 1000; // 5 dk
const intelCache = new CacheStore<MatchIntelResponse>(EVENT_CACHE_TTL);

// --- Transform helpers ---

const INJURY_KEYWORDS = [
  'injury', 'hamstring', 'knee', 'calf', 'ankle', 'muscle', 'foot',
  'achilles', 'groin', 'back', 'illness', 'virus', 'flu', 'tear',
  'rupture', 'strain', 'sprain', 'fracture',
];

const SUSPENSION_REASON_CODES = new Set([3, 11, 13]);

function getEventMeta(eventRaw: any): MatchIntelEventMeta {
  const event = eventRaw?.event || eventRaw || {};

  return {
    eventId: typeof event?.id === 'number' ? event.id : 0,
    tournament: String(event?.tournament?.name || event?.tournament?.uniqueTournament?.name || ''),
    category: String(event?.tournament?.category?.name || ''),
    status: String(event?.status?.description || event?.status?.type || 'unknown'),
    startTimestamp: typeof event?.startTimestamp === 'number' ? event.startTimestamp : 0,
    startDateIso:
      typeof event?.startTimestamp === 'number'
        ? new Date(event.startTimestamp * 1000).toISOString()
        : '',
    homeTeam: String(event?.homeTeam?.name || ''),
    awayTeam: String(event?.awayTeam?.name || ''),
    homeScore: typeof event?.homeScore?.current === 'number' ? event.homeScore.current : null,
    awayScore: typeof event?.awayScore?.current === 'number' ? event.awayScore.current : null,
  };
}

function normalizeStatistics(statisticsRaw: any): MatchIntelStatisticsGroup[] {
  const periods = Array.isArray(statisticsRaw?.statistics) ? statisticsRaw.statistics : [];
  const groups: MatchIntelStatisticsGroup[] = [];

  for (const periodBlock of periods) {
    const period = String(periodBlock?.period || 'ALL');
    const blockGroups = Array.isArray(periodBlock?.groups) ? periodBlock.groups : [];
    for (const group of blockGroups) {
      const groupName = String(group?.groupName || 'Unknown');
      const itemsRaw = Array.isArray(group?.statisticsItems) ? group.statisticsItems : [];
      const items: MatchIntelStatisticItem[] = itemsRaw.map((item: any) => ({
        name: String(item?.name || ''),
        home: item?.home ?? null,
        away: item?.away ?? null,
        homeValue: typeof item?.homeValue === 'number' ? item.homeValue : null,
        awayValue: typeof item?.awayValue === 'number' ? item.awayValue : null,
        compareCode: typeof item?.compareCode === 'number' ? item.compareCode : null,
        valueType: item?.valueType ? String(item.valueType) : null,
        statisticsType: item?.statisticsType ? String(item.statisticsType) : null,
      }));
      groups.push({ period, groupName, items });
    }
  }

  return groups;
}

function cardTypeFromIncident(incident: any): CardType {
  const cls = String(incident?.incidentClass || '').toLowerCase();
  if (cls === 'yellow') return 'yellow';
  if (cls === 'red') return 'red';
  if (cls === 'yellowred' || cls === 'secondyellow') return 'second_yellow';
  return 'unknown';
}

function extractCards(incidentsRaw: any): MatchIntelCardIncident[] {
  const incidents = Array.isArray(incidentsRaw?.incidents) ? incidentsRaw.incidents : [];
  const cards = incidents.filter(
    (incident: any) => String(incident?.incidentType).toLowerCase() === 'card'
  );

  return cards.map((incident: any) => ({
    id: typeof incident?.id === 'number' ? incident.id : null,
    minute: typeof incident?.time === 'number' ? incident.time : null,
    addedTime: typeof incident?.addedTime === 'number' ? incident.addedTime : null,
    team:
      typeof incident?.isHome === 'boolean'
        ? incident.isHome
          ? 'home'
          : 'away'
        : 'unknown',
    cardType: cardTypeFromIncident(incident),
    playerName: String(incident?.playerName || incident?.player?.name || '').trim(),
    reason: incident?.reason ? String(incident.reason) : null,
  }));
}

function classifyAbsenteeStatus(missingPlayer: any): AbsenteeStatus {
  const reasonCode =
    typeof missingPlayer?.reason === 'number' ? missingPlayer.reason : null;
  const description = String(missingPlayer?.description || '').toLowerCase();

  if (
    description.includes('suspension') ||
    (reasonCode !== null && SUSPENSION_REASON_CODES.has(reasonCode))
  ) {
    return 'suspension';
  }

  if (
    reasonCode === 1 ||
    INJURY_KEYWORDS.some((keyword) => description.includes(keyword))
  ) {
    return 'injury';
  }

  if (String(missingPlayer?.type || '').toLowerCase() === 'missing') {
    return 'missing';
  }

  return 'unknown';
}

function extractAbsentees(lineupsRaw: any): MatchIntelAbsentee[] {
  const output: MatchIntelAbsentee[] = [];
  const sides: Array<'home' | 'away'> = ['home', 'away'];

  for (const side of sides) {
    const missingPlayers = Array.isArray(lineupsRaw?.[side]?.missingPlayers)
      ? lineupsRaw[side].missingPlayers
      : [];
    for (const mp of missingPlayers) {
      output.push({
        side,
        playerId: typeof mp?.player?.id === 'number' ? mp.player.id : null,
        playerName: String(mp?.player?.name || '').trim(),
        position: String(mp?.player?.position || '').trim(),
        status: classifyAbsenteeStatus(mp),
        reasonCode: typeof mp?.reason === 'number' ? mp.reason : null,
        description: mp?.description ? String(mp.description) : null,
        expectedEndDate: mp?.expectedEndDate ? String(mp.expectedEndDate) : null,
      });
    }
  }

  return output;
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

export async function getMatchIntel(
  homeTeam: string,
  awayTeam: string,
  matchDate: string
): Promise<MatchIntelResponse> {
  const eventId = await resolveEventId(homeTeam, awayTeam, matchDate);

  const cacheKey = `intel:${eventId}`;
  const cached = intelCache.get(cacheKey);
  if (cached) return cached;

  const [eventRaw, statisticsRaw, incidentsRaw, lineupsRaw] = await Promise.all([
    fetchMatchDetail(eventId),
    fetchOptional(() => fetchMatchStatistics(eventId), { statistics: [] }),
    fetchOptional(() => fetchMatchIncidents(eventId), { incidents: [] }),
    fetchOptional(() => fetchMatchLineups(eventId), {}),
  ]);

  const response: MatchIntelResponse = {
    eventMeta: getEventMeta(eventRaw),
    statisticsGroups: normalizeStatistics(statisticsRaw),
    cards: extractCards(incidentsRaw),
    absentees: extractAbsentees(lineupsRaw),
    raw: {
      event: eventRaw,
      statistics: statisticsRaw,
      incidents: incidentsRaw,
      lineups: lineupsRaw,
    },
  };

  intelCache.set(cacheKey, response);
  return response;
}

export const __testables = {
  classifyAbsenteeStatus,
  extractCards,
};

