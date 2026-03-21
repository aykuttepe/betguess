export type Outcome = '1' | 'X' | '2';

export interface SportTotoMatch {
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  matchTime: string;
  preferences: {
    home: number;
    draw: number;
    away: number;
  };
}

export interface SportTotoProgram {
  weekLabel: string;
  matches: SportTotoMatch[];
  fetchedAt: string;
}

export type Selections = Map<number, Outcome[]>;

export interface Kolon {
  id: number;
  predictions: Outcome[];
}

export interface KolonFilters {
  maxConsecutive: number;        // Ardisik ayni sonuc limiti (0 = devre disi)
  min1: number;                  // Minimum "1" sayisi
  max1: number;                  // Maksimum "1" sayisi
  minX: number;                  // Minimum "X" sayisi
  maxX: number;                  // Maksimum "X" sayisi
  min2: number;                  // Minimum "2" sayisi
  max2: number;                  // Maksimum "2" sayisi
}

export interface SequenceFilter {
  matchNumber: number;
  outcomes: Outcome[];
}

export type SequenceFilters = Record<number, Outcome[]>;

export const DEFAULT_FILTERS: KolonFilters = {
  maxConsecutive: 0,
  min1: 0,
  max1: 15,
  minX: 0,
  maxX: 15,
  min2: 0,
  max2: 15,
};

export const DEFAULT_SEQUENCE_FILTERS: SequenceFilters = {};

export type MatchIntelCardType = 'yellow' | 'red' | 'second_yellow' | 'unknown';
export type MatchIntelAbsenteeStatus = 'injury' | 'suspension' | 'missing' | 'unknown';

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
  cardType: MatchIntelCardType;
  playerName: string;
  reason: string | null;
}

export interface MatchIntelAbsentee {
  side: 'home' | 'away';
  playerId: number | null;
  playerName: string;
  position: string;
  status: MatchIntelAbsenteeStatus;
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

// --- History Analysis types ---

export interface HistoricalMatch {
  matchNo: number;
  homeTeam: string;
  awayTeam: string;
  result: Outcome;
  score: string;
}

export interface HistoricalProgram {
  programNo: number;
  startDate: string;
  endDate: string;
  matchCount: number;
  matches: HistoricalMatch[];
  distribution: { count1: number; countX: number; count2: number };
  maxConsecutive: number;
}

export interface DistributionStats {
  avg: number;
  min: number;
  max: number;
  median: number;
  stdDev: number;
}

export interface HistoryAnalysis {
  programCount: number;
  analyzedFrom: string;
  analyzedTo: string;
  distribution: {
    home: DistributionStats;
    draw: DistributionStats;
    away: DistributionStats;
  };
  consecutiveStats: {
    avgMax: number;
    minMax: number;
    maxMax: number;
    medianMax: number;
  };
  suggestedFilters: KolonFilters;
  programs: HistoricalProgram[];
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