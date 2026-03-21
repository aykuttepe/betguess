import axios from 'axios';
import { CacheStore } from '../scraper/cache';

const SOFASCORE_BASE_URL = 'https://api.sofascore.com/api/v1';
const SCHEDULE_CACHE_TTL_MS = 10 * 60 * 1000;
const EVENT_CACHE_TTL_MS = 5 * 60 * 1000;

const TEAM_STATS_CACHE_TTL_MS = 15 * 60 * 1000;

const scheduleCache = new CacheStore<any[]>(SCHEDULE_CACHE_TTL_MS);
const eventIntelCache = new CacheStore<MatchIntelResponse>(EVENT_CACHE_TTL_MS);
const teamStatsCache = new CacheStore<TeamStatsResponse>(TEAM_STATS_CACHE_TTL_MS);

const SOFASCORE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
  Referer: 'https://www.sofascore.com/',
  Origin: 'https://www.sofascore.com',
};

const STOPWORDS = new Set([
  'as',
  'a',
  's',
  'a.s',
  'a.s.',
  'as.',
  'fk',
  'f',
  'k',
  'f.k',
  'f.k.',
  'fc',
  'cf',
  'ac',
  'sk',
  'jk',
  'kulubu',
  'kulubu',
]);

const INJURY_KEYWORDS = [
  'injury',
  'hamstring',
  'knee',
  'calf',
  'ankle',
  'muscle',
  'foot',
  'achilles',
  'groin',
  'back',
  'illness',
  'virus',
  'flu',
  'tear',
  'rupture',
  'strain',
  'sprain',
  'fracture',
];

const SUSPENSION_REASON_CODES = new Set([3, 11, 13]);

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

// --- Team Stats types ---

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

export class MatchIntelNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchIntelNotFoundError';
  }
}

export class MatchIntelUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchIntelUpstreamError';
  }
}

interface SofaEvent {
  id: number;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
}

function parseMatchDate(matchDate: string): string {
  const parts = matchDate.split('.');
  if (parts.length !== 3) {
    throw new MatchIntelNotFoundError(`Gecersiz tarih formati: ${matchDate}`);
  }

  const [day, month, year] = parts;
  if (!day || !month || !year) {
    throw new MatchIntelNotFoundError(`Gecersiz tarih formati: ${matchDate}`);
  }

  const iso = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new MatchIntelNotFoundError(`Gecersiz tarih formati: ${matchDate}`);
  }
  return iso;
}

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

function findBestEvent(events: SofaEvent[], homeTeam: string, awayTeam: string): SofaEvent | null {
  let best: SofaEvent | null = null;
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

async function fetchSofa(path: string): Promise<any> {
  try {
    const url = `${SOFASCORE_BASE_URL}${path}`;
    const { data } = await axios.get(url, {
      headers: SOFASCORE_HEADERS,
      timeout: 25000,
    });
    return data;
  } catch (error: any) {
    const status = error.response?.status;
    const reason = error.response?.data?.error?.reason || error.response?.data?.error?.message;
    if (status === 404) {
      throw new MatchIntelNotFoundError(reason || 'SofaScore verisi bulunamadi.');
    }
    throw new MatchIntelUpstreamError(reason || 'SofaScore verisi alinamadi.');
  }
}
async function fetchSofaOptional(path: string, fallbackValue: any): Promise<any> {
  try {
    return await fetchSofa(path);
  } catch (error: any) {
    if (error instanceof MatchIntelNotFoundError) {
      return fallbackValue;
    }
    throw error;
  }
}

async function fetchScheduledEvents(dateIso: string): Promise<SofaEvent[]> {
  const cacheKey = `scheduled:${dateIso}`;
  const cached = scheduleCache.get(cacheKey);
  if (cached) {
    return cached as SofaEvent[];
  }

  const data = await fetchSofa(`/sport/football/scheduled-events/${dateIso}`);
  const events = Array.isArray(data?.events) ? (data.events as SofaEvent[]) : [];
  scheduleCache.set(cacheKey, events);
  return events;
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
  const cards = incidents.filter((incident: any) => String(incident?.incidentType).toLowerCase() === 'card');

  return cards.map((incident: any) => ({
    id: typeof incident?.id === 'number' ? incident.id : null,
    minute: typeof incident?.time === 'number' ? incident.time : null,
    addedTime: typeof incident?.addedTime === 'number' ? incident.addedTime : null,
    team: typeof incident?.isHome === 'boolean' ? (incident.isHome ? 'home' : 'away') : 'unknown',
    cardType: cardTypeFromIncident(incident),
    playerName: String(incident?.playerName || incident?.player?.name || '').trim(),
    reason: incident?.reason ? String(incident.reason) : null,
  }));
}

function classifyAbsenteeStatus(missingPlayer: any): AbsenteeStatus {
  const reasonCode = typeof missingPlayer?.reason === 'number' ? missingPlayer.reason : null;
  const description = String(missingPlayer?.description || '').toLowerCase();

  if (
    description.includes('suspension') ||
    (reasonCode !== null && SUSPENSION_REASON_CODES.has(reasonCode))
  ) {
    return 'suspension';
  }

  if (reasonCode === 1 || INJURY_KEYWORDS.some((keyword) => description.includes(keyword))) {
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

function getEventMeta(eventRaw: any): MatchIntelEventMeta {
  const event = eventRaw?.event || {};

  return {
    eventId: typeof event?.id === 'number' ? event.id : 0,
    tournament: String(event?.tournament?.name || ''),
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

export async function getMatchIntel(
  homeTeam: string,
  awayTeam: string,
  matchDate: string
): Promise<MatchIntelResponse> {
  const dateIso = parseMatchDate(matchDate);
  const scheduledEvents = await fetchScheduledEvents(dateIso);
  if (scheduledEvents.length === 0) {
    throw new MatchIntelNotFoundError('Bu tarih icin SofaScore mac verisi bulunamadi.');
  }

  const bestEvent = findBestEvent(scheduledEvents, homeTeam, awayTeam);
  if (!bestEvent || !bestEvent.id) {
    throw new MatchIntelNotFoundError(
      `SofaScore'da eslesen mac bulunamadi: ${homeTeam} vs ${awayTeam} (${matchDate})`
    );
  }

  const cacheKey = `event:${bestEvent.id}`;
  const cached = eventIntelCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const [eventRaw, statisticsRaw, incidentsRaw, lineupsRaw] = await Promise.all([
    fetchSofa(`/event/${bestEvent.id}`),
    fetchSofaOptional(`/event/${bestEvent.id}/statistics`, { statistics: [] }),
    fetchSofaOptional(`/event/${bestEvent.id}/incidents`, { incidents: [] }),
    fetchSofaOptional(`/event/${bestEvent.id}/lineups`, {}),
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

  eventIntelCache.set(cacheKey, response);
  return response;
}

// --- Team Stats extraction ---

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
  const events = Array.isArray(h2hRaw?.teamDuel?.events) ? h2hRaw.teamDuel.events : [];
  return events.slice(0, 10).map((evt: any) => ({
    eventId: evt.id ?? 0,
    date: typeof evt.startTimestamp === 'number'
      ? new Date(evt.startTimestamp * 1000).toISOString()
      : '',
    homeTeam: String(evt.homeTeam?.name || ''),
    awayTeam: String(evt.awayTeam?.name || ''),
    homeScore: typeof evt.homeScore?.current === 'number' ? evt.homeScore.current : null,
    awayScore: typeof evt.awayScore?.current === 'number' ? evt.awayScore.current : null,
    tournament: String(evt.tournament?.name || ''),
  }));
}

function extractRecentMatches(recentRaw: any, teamId: number): RecentMatch[] {
  const events = Array.isArray(recentRaw?.events) ? recentRaw.events : [];
  return events.slice(0, 6).map((evt: any) => {
    const isHome = evt.homeTeam?.id === teamId;
    const hs = typeof evt.homeScore?.current === 'number' ? evt.homeScore.current : null;
    const as_ = typeof evt.awayScore?.current === 'number' ? evt.awayScore.current : null;

    let result: 'W' | 'D' | 'L' = 'D';
    if (hs !== null && as_ !== null) {
      if (hs === as_) result = 'D';
      else if (isHome) result = hs > as_ ? 'W' : 'L';
      else result = as_ > hs ? 'W' : 'L';
    }

    return {
      eventId: evt.id ?? 0,
      date: typeof evt.startTimestamp === 'number'
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

export async function getTeamStats(eventId: number): Promise<TeamStatsResponse> {
  const cacheKey = `teamstats:${eventId}`;
  const cached = teamStatsCache.get(cacheKey);
  if (cached) return cached;

  const eventRaw = await fetchSofa(`/event/${eventId}`);
  const event = eventRaw?.event;
  if (!event) {
    throw new MatchIntelNotFoundError('Event bulunamadi.');
  }

  const homeTeamId: number = event.homeTeam?.id;
  const awayTeamId: number = event.awayTeam?.id;
  const tournamentId: number | undefined = event.tournament?.uniqueTournament?.id;
  const seasonId: number | undefined = event.season?.id;

  if (!homeTeamId || !awayTeamId) {
    throw new MatchIntelNotFoundError('Takim bilgileri bulunamadi.');
  }

  const standingsPath = tournamentId && seasonId
    ? `/unique-tournament/${tournamentId}/season/${seasonId}/standings/total`
    : null;

  const [standingsRaw, h2hRaw, homeRecentRaw, awayRecentRaw] = await Promise.all([
    standingsPath
      ? fetchSofaOptional(standingsPath, { standings: [] })
      : Promise.resolve({ standings: [] }),
    fetchSofaOptional(`/event/${eventId}/h2h`, { teamDuel: { events: [] } }),
    fetchSofaOptional(`/team/${homeTeamId}/events/last/0`, { events: [] }),
    fetchSofaOptional(`/team/${awayTeamId}/events/last/0`, { events: [] }),
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

export const __testables = {
  parseMatchDate,
  normalizeTeamName,
  teamSimilarity,
  findBestEvent,
  extractCards,
  classifyAbsenteeStatus,
};

