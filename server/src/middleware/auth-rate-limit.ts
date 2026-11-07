import { createHash } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/database';
import { AuthRequest } from '../auth/types';

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

// Fixed-window counters in SQLite: atomic, and shared across restarts/workers.
function consume(keys: Array<[string, number]>, windowMs: number): boolean {
  const now = Date.now();
  const db = getDatabase();
  return db.transaction(() => {
    db.prepare('DELETE FROM auth_rate_limits WHERE reset_at <= ?').run(now);
    for (const [key, limit] of keys) {
      const row = db.prepare('SELECT count FROM auth_rate_limits WHERE key = ?').get(key) as { count: number } | undefined;
      if (row && row.count >= limit) return false;
    }
    for (const [key] of keys) db.prepare(`INSERT INTO auth_rate_limits VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET count = count + 1`).run(key, now + windowMs);
    return true;
  }).immediate();
}

function reject(res: Response, windowMs: number): void {
  res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
  res.status(429).json({ error: 'Cok fazla deneme. Lutfen daha sonra tekrar deneyin.' });
}

// Per IP plus per account (request body email).
export function authRateLimit(action: string, accountLimit: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const keys: Array<[string, number]> = [[`${action}:ip:${digest(req.ip || 'unknown')}`, 30]];
    if (email) keys.push([`${action}:account:${digest(email)}`, accountLimit]);
    if (!consume(keys, DEFAULT_WINDOW_MS)) { reject(res, DEFAULT_WINDOW_MS); return; }
    next();
  };
}

// Per authenticated user; applies regardless of role or subscription toggle (technical abuse limit).
export function userRateLimit(action: string, limit: number, windowMs = DEFAULT_WINDOW_MS) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: 'Oturum gerekli.' }); return; }
    if (!consume([[`${action}:user:${userId}`, limit]], windowMs)) { reject(res, windowMs); return; }
    next();
  };
}
