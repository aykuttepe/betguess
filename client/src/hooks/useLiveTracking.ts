import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchCurrentLiveProgram, LiveProgram } from '../lib/live-tracking-api';

const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

export function useLiveTracking(enabled: boolean) {
  const [liveProgram, setLiveProgram] = useState<LiveProgram | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFirstLoad = useRef(true);

  const refetch = useCallback(async () => {
    if (isFirstLoad.current) setLoading(true);
    setError(null);
    try {
      const data = await fetchCurrentLiveProgram();
      setLiveProgram(data);
      isFirstLoad.current = false;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    refetch();

    intervalRef.current = setInterval(refetch, POLL_INTERVAL_MS);

    const handleFocus = () => {
      refetch();
    };
    const handleBlur = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleBlur();
      } else {
        refetch();
        intervalRef.current = setInterval(refetch, POLL_INTERVAL_MS);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, refetch]);

  return { liveProgram, loading, error, refetch };
}
