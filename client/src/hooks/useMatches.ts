import { useState, useEffect, useCallback, useRef } from 'react';
import { SportTotoProgram } from '../lib/types';
import { fetchMatches, refreshMatches } from '../lib/api';

const STORAGE_KEY = 'betguess:matches-cache';

function readCachedProgram(): SportTotoProgram | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as SportTotoProgram;
    if (!parsed?.weekLabel || !Array.isArray(parsed.matches)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeCachedProgram(program: SportTotoProgram): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(program));
}

export function useMatches() {
  const initialProgram = readCachedProgram();
  const programRef = useRef<SportTotoProgram | null>(initialProgram);
  const [program, setProgram] = useState<SportTotoProgram | null>(initialProgram);
  const [loading, setLoading] = useState(initialProgram === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyProgram = useCallback((data: SportTotoProgram) => {
    programRef.current = data;
    writeCachedProgram(data);
    setProgram(data);
  }, []);

  const load = useCallback(async () => {
    const hasProgram = programRef.current !== null;

    if (hasProgram) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const data = await fetchMatches();
      applyProgram(data);
    } catch (err: any) {
      const message = err.message || 'Maclar yuklenemedi';
      if (programRef.current) {
        setError('Guncel veri alinamadi. Son kayitli program gosteriliyor.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyProgram]);

  const refresh = useCallback(async () => {
    const hasProgram = programRef.current !== null;

    if (hasProgram) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    try {
      const data = await refreshMatches();
      applyProgram(data);
    } catch (err: any) {
      const message = err.message || 'Maclar yenilenemedi';
      if (programRef.current) {
        setError(`${message} Son kayitli program gosteriliyor.`);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyProgram]);

  useEffect(() => {
    void load();
  }, [load]);

  return { program, loading, refreshing, error, refresh };
}
