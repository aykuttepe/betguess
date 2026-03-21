import fs from 'fs';
import path from 'path';
import { HistoricalProgram } from './history-types';

const CACHE_DIR = path.join(__dirname, '../../.cache');
const HISTORY_FILE = path.join(CACHE_DIR, 'history.json');

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

export function readHistory(): HistoricalProgram[] {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeHistory(programs: HistoricalProgram[]): void {
  ensureCacheDir();
  const sorted = [...programs].sort((a, b) => b.programNo - a.programNo);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(sorted), 'utf8');
}

export function getStoredProgramNos(): Set<number> {
  return new Set(readHistory().map((p) => p.programNo));
}
