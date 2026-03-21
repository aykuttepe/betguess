import fs from 'fs';
import path from 'path';
import { SportTotoProgram } from './types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class CacheStore<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private ttl: number;

  constructor(ttlMs: number) {
    this.ttl = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.ttl) {
      return entry.data;
    }
    if (entry) {
      this.cache.delete(key);
    }
    return null;
  }

  peek(key: string): T | null {
    return this.cache.get(key)?.data ?? null;
  }

  set(key: string, data: T): void {
    this.setWithTimestamp(key, data, Date.now());
  }

  setWithTimestamp(key: string, data: T, timestamp: number): void {
    this.cache.set(key, { data, timestamp });
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

const CACHE_TTL = 30 * 60 * 1000;
const CACHE_DIR = path.join(__dirname, '../../.cache');
const MATCHES_CACHE_FILE = path.join(CACHE_DIR, 'matches.json');
const matchesCache = new CacheStore<SportTotoProgram>(CACHE_TTL);

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readPersistedMatches(): CacheEntry<SportTotoProgram> | null {
  try {
    if (!fs.existsSync(MATCHES_CACHE_FILE)) {
      return null;
    }

    const raw = fs.readFileSync(MATCHES_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as CacheEntry<SportTotoProgram>;

    if (!parsed?.data || !parsed.timestamp || !Array.isArray(parsed.data.matches)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writePersistedMatches(data: SportTotoProgram): void {
  ensureCacheDir();
  const entry: CacheEntry<SportTotoProgram> = {
    data,
    timestamp: Date.now(),
  };
  fs.writeFileSync(MATCHES_CACHE_FILE, JSON.stringify(entry), 'utf8');
}

function hydrateMatches(entry: CacheEntry<SportTotoProgram>): SportTotoProgram {
  matchesCache.setWithTimestamp('matches', entry.data, entry.timestamp);
  return entry.data;
}

export function getCached(): SportTotoProgram | null {
  const memoryCached = matchesCache.get('matches');
  if (memoryCached) {
    return memoryCached;
  }

  const persisted = readPersistedMatches();
  if (!persisted) {
    return null;
  }

  if (Date.now() - persisted.timestamp >= CACHE_TTL) {
    return null;
  }

  return hydrateMatches(persisted);
}

export function getStaleCached(): SportTotoProgram | null {
  const memoryCached = matchesCache.peek('matches');
  if (memoryCached) {
    return memoryCached;
  }

  const persisted = readPersistedMatches();
  if (!persisted) {
    return null;
  }

  return hydrateMatches(persisted);
}

export function setCache(data: SportTotoProgram): void {
  matchesCache.set('matches', data);
  writePersistedMatches(data);
}

export function clearCache(): void {
  matchesCache.clear('matches');
  if (fs.existsSync(MATCHES_CACHE_FILE)) {
    fs.rmSync(MATCHES_CACHE_FILE, { force: true });
  }
}

export const standingsCache = new CacheStore<any>(60 * 60 * 1000);
export const teamValuesCache = new CacheStore<any>(6 * 60 * 60 * 1000);
export const teamListCache = new CacheStore<any>(24 * 60 * 60 * 1000);
export const teamDetailCache = new CacheStore<any>(2 * 60 * 60 * 1000);
export const playerDetailCache = new CacheStore<any>(2 * 60 * 60 * 1000);
export const aiCache = new CacheStore<string>(30 * 60 * 1000);
