import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth/types';
import { effectiveTier } from '../auth/subscription-policy';
import { isSubscriptionSystemActive } from '../db/settings-repository';
import { getDatabase } from '../db/database';

export interface TierLimits { free: number; pro: number; premium: number; }

export function requireUsageLimit(actionType: string, limits: TierLimits) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) { res.status(401).json({ error: 'Oturum gerekli.' }); return; }
    if (user.role === 'admin' || !isSubscriptionSystemActive()) { next(); return; }
    const tier = effectiveTier(user);
    const limit = limits[tier];
    if (limit === 0) {
      res.status(403).json({ error: 'Bu ozellik aboneliginiz kapsaminda degildir.', requiredTier: tier === 'free' ? 'pro' : 'premium', feature: actionType });
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const db = getDatabase();
    // Reserve atomically so parallel requests cannot all pass the last available slot.
    const used = db.transaction(() => {
      const row = db.prepare('SELECT count FROM usage_limits WHERE user_id = ? AND action_type = ? AND date = ?')
        .get(user.id, actionType, date) as { count: number } | undefined;
      const count = row?.count ?? 0;
      if (limit !== -1 && count >= limit) return count;
      db.prepare(`INSERT INTO usage_limits (user_id, action_type, date, count) VALUES (?, ?, ?, 1)
        ON CONFLICT(user_id, action_type, date) DO UPDATE SET count = count + 1`).run(user.id, actionType, date);
      return -1;
    }).immediate();
    if (used !== -1) {
      res.status(429).json({ error: 'Gunluk kullanim limitine ulastiniz.', limit, used, requiredTier: tier === 'free' ? 'pro' : 'premium', feature: actionType });
      return;
    }
    let settled = false;
    const settle = (success: boolean) => {
      if (settled) return;
      settled = true;
      if (!success) db.prepare(`UPDATE usage_limits SET count = MAX(0, count - 1)
        WHERE user_id = ? AND action_type = ? AND date = ?`).run(user.id, actionType, date);
    };
    res.once('finish', () => settle(res.statusCode >= 200 && res.statusCode < 300));
    res.once('close', () => settle(res.writableFinished && res.statusCode >= 200 && res.statusCode < 300));
    try { next(); } catch (error) { settle(false); throw error; }
  };
}
