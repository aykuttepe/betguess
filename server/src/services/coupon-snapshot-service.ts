import fs from 'fs';
import path from 'path';

type Outcome = '1' | 'X' | '2';

interface SnapshotMatch {
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  matchTime: string;
  preferences?: {
    home?: number;
    draw?: number;
    away?: number;
  };
}

interface SnapshotKupon {
  selections?: Record<string, string[]>;
}

interface SnapshotPayload {
  kupons?: SnapshotKupon[];
  matches?: SnapshotMatch[];
  snapshot?: {
    url: string;
    fileName: string;
    createdAt: string;
    format: 'svg';
  };
}

const SNAPSHOT_DIR = path.join(__dirname, '../../uploads/coupon-snapshots');

function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMatches(value: unknown): SnapshotMatch[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item): SnapshotMatch | null => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as Partial<SnapshotMatch>;
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
          home: asNumber(row.preferences?.home),
          draw: asNumber(row.preferences?.draw),
          away: asNumber(row.preferences?.away),
        },
      };
    })
    .filter((item): item is SnapshotMatch => item !== null);
}

function normalizeKupons(value: unknown): SnapshotKupon[] {
  return Array.isArray(value) ? (value as SnapshotKupon[]) : [];
}

function getSelectedOutcomes(kupons: SnapshotKupon[], matchNumber: number): Set<Outcome> {
  const selected = new Set<Outcome>();

  for (const kupon of kupons) {
    const outcomes = kupon.selections?.[String(matchNumber)];
    if (!Array.isArray(outcomes)) {
      continue;
    }

    for (const outcome of outcomes) {
      if (outcome === '1' || outcome === 'X' || outcome === '2') {
        selected.add(outcome);
      }
    }
  }

  return selected;
}

function renderOutcomeChip(
  x: number,
  y: number,
  label: Outcome,
  percent: number,
  selected: boolean,
): string {
  const fill = selected ? '#10b981' : '#111827';
  const stroke = selected ? '#34d399' : '#334155';
  const text = selected ? '#ffffff' : '#cbd5e1';

  return `
    <rect x="${x}" y="${y}" width="78" height="34" rx="8" fill="${fill}" stroke="${stroke}" />
    <text x="${x + 16}" y="${y + 22}" font-size="15" font-weight="800" fill="${text}">${label}</text>
    <text x="${x + 40}" y="${y + 22}" font-size="13" font-weight="700" fill="${text}">%${Math.round(percent)}</text>
  `;
}

function renderSnapshotSvg(matches: SnapshotMatch[], kupons: SnapshotKupon[], week: string): string {
  const width = 880;
  const headerHeight = 76;
  const rowHeight = 56;
  const height = headerHeight + matches.length * rowHeight + 24;

  const rows = matches.map((match, index) => {
    const y = headerHeight + index * rowHeight;
    const prefs = match.preferences || {};
    const selected = getSelectedOutcomes(kupons, match.matchNumber);

    return `
      <rect x="18" y="${y}" width="${width - 36}" height="${rowHeight - 7}" rx="8" fill="${index % 2 === 0 ? '#172033' : '#111827'}" stroke="#263244" />
      <text x="40" y="${y + 31}" font-size="15" font-weight="800" fill="#94a3b8">${match.matchNumber}</text>
      <text x="82" y="${y + 22}" font-size="16" font-weight="800" fill="#f8fafc">${escapeXml(match.homeTeam)}</text>
      <text x="82" y="${y + 41}" font-size="15" font-weight="700" fill="#cbd5e1">${escapeXml(match.awayTeam)}</text>
      <text x="352" y="${y + 31}" font-size="13" fill="#94a3b8">${escapeXml(match.matchDate)} ${escapeXml(match.matchTime)}</text>
      ${renderOutcomeChip(520, y + 7, '1', prefs.home || 0, selected.has('1'))}
      ${renderOutcomeChip(612, y + 7, 'X', prefs.draw || 0, selected.has('X'))}
      ${renderOutcomeChip(704, y + 7, '2', prefs.away || 0, selected.has('2'))}
    `;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#0b1120" />
  <rect x="18" y="18" width="${width - 36}" height="42" rx="8" fill="#111827" stroke="#263244" />
  <text x="40" y="45" font-size="18" font-weight="900" fill="#34d399">${escapeXml(week || 'Kupon Snapshot')}</text>
  ${rows}
</svg>`;
}

export function attachCouponSnapshot(data: unknown, userId: number, week: string): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const payload = data as SnapshotPayload;
  const matches = normalizeMatches(payload.matches);
  if (matches.length === 0) {
    return data;
  }

  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  const kupons = normalizeKupons(payload.kupons);
  const fileName = `coupon-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.svg`;
  const filePath = path.join(SNAPSHOT_DIR, fileName);
  const svg = renderSnapshotSvg(matches, kupons, week);

  fs.writeFileSync(filePath, svg, 'utf8');

  return {
    ...payload,
    snapshot: {
      url: `/uploads/coupon-snapshots/${fileName}`,
      fileName,
      createdAt: new Date().toISOString(),
      format: 'svg',
    },
  };
}
