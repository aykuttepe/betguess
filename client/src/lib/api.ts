import { MatchIntelResponse, SportTotoProgram, TeamStatsResponse } from './types';
import { apiFetchJson } from './http';

const BASE_URL = '/api';

export async function fetchMatches(): Promise<SportTotoProgram> {
  return apiFetchJson<SportTotoProgram>(`${BASE_URL}/matches`, {}, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function refreshMatches(): Promise<SportTotoProgram> {
  return apiFetchJson<SportTotoProgram>(`${BASE_URL}/matches/refresh`, { method: 'POST' }, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export async function fetchMatchIntel(
  homeTeam: string,
  awayTeam: string,
  matchDate: string
): Promise<MatchIntelResponse> {
  const url = `${BASE_URL}/match-intel?homeTeam=${encodeURIComponent(homeTeam)}&awayTeam=${encodeURIComponent(awayTeam)}&matchDate=${encodeURIComponent(matchDate)}`;
  return apiFetchJson<MatchIntelResponse>(url, {}, {
    defaultError: 'Match detay verisi alinamadi',
    redirectOn401: true,
  });
}

export async function fetchTeamStats(eventId: number): Promise<TeamStatsResponse> {
  return apiFetchJson<TeamStatsResponse>(`${BASE_URL}/match-team-stats/${eventId}`, {}, {
    defaultError: 'Takim istatistikleri alinamadi',
    redirectOn401: true,
  });
}
