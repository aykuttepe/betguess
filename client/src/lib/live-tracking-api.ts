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

export async function fetchCurrentLiveProgram(): Promise<LiveProgram> {
  const res = await fetch('/api/live-tracking/program/current', { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Bilinmeyen hata' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchLiveProgram(pno: number): Promise<LiveProgram> {
  const res = await fetch(`/api/live-tracking/program/${pno}`, { credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Bilinmeyen hata' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
