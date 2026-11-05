import { SystemKupon } from './system-generator';
import { SportTotoMatch } from './types';

export interface SavedCouponPayload {
  version: 2;
  kupons: SystemKupon[];
  matches: SportTotoMatch[];
  savedAt: string;
  snapshot?: CouponSnapshot;
}

export interface ParsedCouponPayload {
  kupons: SystemKupon[];
  matches: SportTotoMatch[];
  snapshot: CouponSnapshot | null;
}

export interface CouponSnapshot {
  url: string;
  fileName: string;
  createdAt: string;
  format: 'svg';
}

function normalizeKupons(value: unknown): SystemKupon[] {
  return Array.isArray(value) ? (value as SystemKupon[]) : [];
}

function normalizeMatches(value: unknown): SportTotoMatch[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as Partial<SportTotoMatch>;
      const matchNumber = Number(row.matchNumber);
      if (!Number.isInteger(matchNumber)) {
        return null;
      }

      return {
        matchNumber,
        homeTeam: String(row.homeTeam || ''),
        awayTeam: String(row.awayTeam || ''),
        matchDate: String(row.matchDate || ''),
        matchTime: String(row.matchTime || ''),
        preferences: {
          home: Number(row.preferences?.home) || 0,
          draw: Number(row.preferences?.draw) || 0,
          away: Number(row.preferences?.away) || 0,
        },
      };
    })
    .filter((item): item is SportTotoMatch => item !== null);
}

function normalizeSnapshot(value: unknown): CouponSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Partial<CouponSnapshot>;
  if (!row.url || typeof row.url !== 'string') {
    return null;
  }

  return {
    url: row.url,
    fileName: String(row.fileName || ''),
    createdAt: String(row.createdAt || ''),
    format: 'svg',
  };
}

export function buildCouponPayload(kupons: SystemKupon[], matches: SportTotoMatch[]): SavedCouponPayload {
  return {
    version: 2,
    kupons,
    matches: normalizeMatches(matches),
    savedAt: new Date().toISOString(),
  };
}

export function parseCouponPayload(data: string): ParsedCouponPayload {
  try {
    const parsed = JSON.parse(data) as unknown;

    if (Array.isArray(parsed)) {
      return {
        kupons: normalizeKupons(parsed),
        matches: [],
        snapshot: null,
      };
    }

    if (parsed && typeof parsed === 'object') {
      const payload = parsed as { kupons?: unknown; matches?: unknown; snapshot?: unknown };
      return {
        kupons: normalizeKupons(payload.kupons),
        matches: normalizeMatches(payload.matches),
        snapshot: normalizeSnapshot(payload.snapshot),
      };
    }

    return { kupons: [], matches: [], snapshot: null };
  } catch {
    return { kupons: [], matches: [], snapshot: null };
  }
}
