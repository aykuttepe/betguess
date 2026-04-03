export type MatchStatus = 'finished' | 'in_progress' | 'not_started';

export interface LiveMatch {
  matchNo: number;
  homeTeam: string;
  awayTeam: string;
  result: '1' | 'X' | '2' | null;
  score: string | null;
  status: MatchStatus;
}

export interface LiveProgram {
  programNo: number;
  totalMatches: number;
  finishedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  matches: LiveMatch[];
  fetchedAt: string;
}
