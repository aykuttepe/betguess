import { HistoryAnalysis } from './types';
import { apiFetchJson } from './http';

const BASE_URL = '/api';

export async function fetchHistoryAnalysis(
  count = 50,
): Promise<HistoryAnalysis> {
  return apiFetchJson<HistoryAnalysis>(`${BASE_URL}/history/analysis?count=${count}`, {}, {
    defaultError: 'Gecmis veri alinamadi',
    redirectOn401: true,
  });
}

export async function refreshHistory(count = 10): Promise<HistoryAnalysis> {
  return apiFetchJson<HistoryAnalysis>(`${BASE_URL}/history/refresh`, {
    method: 'POST',
    body: JSON.stringify({ count }),
  }, {
    defaultError: 'Gecmis veri yenilenemedi',
    redirectOn401: true,
  });
}
