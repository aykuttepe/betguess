export type TotoOutcome = '1' | 'X' | '2';

export interface HistoricalMatch {
  matchNo: number;
  homeTeam: string;
  awayTeam: string;
  result: TotoOutcome;
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
  fetchedAt: string;
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
  suggestedFilters: {
    min1: number;
    max1: number;
    minX: number;
    maxX: number;
    min2: number;
    max2: number;
    maxConsecutive: number;
  };
  programs: HistoricalProgram[];
}
