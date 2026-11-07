import { createHash } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../db/database';

// Persistent fixed-window limits: per IP plus per account, across restarts/workers.
export function authRateLimit(action: string, accountLimit: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const digest = (value: string) => createHash('sha256').update(value).digest('hex');
    const keys: Array<[string, number]> = [[`${action}:ip:${digest(req.ip || 'unknown')}`, 30]];
    if (email) keys.push([`${action}:account:${digest(email)}`, accountLimit]);
    const db = getDatabase();
    const allowed = db.transaction(() => {
      db.prepare('DELETE FROM auth_rate_limits WHERE reset_at <= ?').run(now);
      for (const [key, limit] of keys) {
        const row = db.prepare('SELECT count FROM auth_rate_limits WHERE key = ?').get(key) as { count: number } | undefined;
        if (row && row.count >= limit) return false;
      }
      for (const [key] of keys) db.prepare(`INSERT INTO auth_rate_limits VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET count = count + 1`).run(key, now + 15 * 60 * 1000);
      return true;
    }).immediate();
    if (!allowed) {
      res.setHeader('Retry-After', '900');
      res.status(429).json({ error: 'Cok fazla deneme. Lutfen daha sonra tekrar deneyin.' });
      return;
    }
    next();
  };
}
