import { apiFetchJson } from './http';
import { UsageStatus } from './subscription-types';

export async function apiGetUsageStatus(): Promise<UsageStatus> {
  return apiFetchJson<UsageStatus>('/api/auth/usage-status');
}

export interface TierFeature {
  id: string;
  label: string;
  value: string;
}

export interface TierInfo {
  id: string;
  name: string;
  price: number | null;
  features: TierFeature[];
}

export async function apiGetTiers(): Promise<{ tiers: TierInfo[] }> {
  return apiFetchJson<{ tiers: TierInfo[] }>('/api/auth/tiers');
}
