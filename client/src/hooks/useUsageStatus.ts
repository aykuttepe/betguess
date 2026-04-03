import { useState, useEffect, useCallback } from 'react';
import { UsageStatus } from '../lib/subscription-types';
import { apiGetUsageStatus } from '../lib/subscription-api';
import { useAuth } from '../contexts/AuthContext';

export interface UseUsageStatusReturn {
  data: UsageStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Returns false if action is blocked (limit=0) or used>=limit */
  canUse: (actionType: string) => boolean;
  /** Returns remaining uses, or Infinity if unlimited (-1), or 0 if blocked */
  getRemainingCount: (actionType: string) => number;
}

export function useUsageStatus(): UseUsageStatusReturn {
  const { user } = useAuth();
  const [data, setData] = useState<UsageStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    apiGetUsageStatus()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const canUse = useCallback((actionType: string): boolean => {
    if (!data) return true; // optimistic while loading
    const limit = data.limits[actionType];
    if (!limit) return true;
    if (limit.limit === 0) return false;   // blocked
    if (limit.limit === -1) return true;   // unlimited
    return limit.used < limit.limit;
  }, [data]);

  const getRemainingCount = useCallback((actionType: string): number => {
    if (!data) return Infinity;
    const limit = data.limits[actionType];
    if (!limit) return Infinity;
    if (limit.limit === 0) return 0;
    if (limit.limit === -1) return Infinity;
    return Math.max(0, limit.limit - limit.used);
  }, [data]);

  return { data, loading, error, refresh: fetch, canUse, getRemainingCount };
}
