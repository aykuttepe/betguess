import { Response, NextFunction } from 'express';
import { AuthRequest, SubscriptionTier } from '../auth/types';
import { getUsageToday, incrementUsage } from '../db/usage-repository';

export interface TierLimits {
  free: number;   // 0 = blocked entirely
  pro: number;    // -1 = unlimited
  premium: number;
}

/**
 * Middleware factory that enforces daily usage limits per subscription tier.
 *
 * Limit values:
 *   0  → feature is blocked for this tier (returns 403)
 *  -1  → unlimited usage (still tracked for analytics)
 *  >0  → daily limit; returns 429 when exceeded
 *
 * Admin users bypass all limits.
 */
export function requireUsageLimit(actionType: string, limits: TierLimits) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Oturum gerekli.' });
      return;
    }

    // Admin bypass
    if (user.role === 'admin') {
      incrementUsage(user.id, actionType);
      next();
      return;
    }

    const tier = user.subscriptionTier as SubscriptionTier;
    const limit = limits[tier];

    // Feature blocked for this tier
    if (limit === 0) {
      const suggestedTier = tier === 'free' ? 'pro' : 'premium';
      res.status(403).json({
        error: 'Bu ozellik aboneliginiz kapsaminda degildir.',
        requiredTier: suggestedTier,
        feature: actionType,
      });
      return;
    }

    // Unlimited
    if (limit === -1) {
      incrementUsage(user.id, actionType);
      next();
      return;
    }

    // Check daily limit
    const currentCount = getUsageToday(user.id, actionType);
    if (currentCount >= limit) {
      const suggestedTier = tier === 'free' ? 'pro' : tier === 'pro' ? 'premium' : 'premium';
      res.status(429).json({
        error: `Gunluk ${actionType} limitinize ulastiniz (${currentCount}/${limit}).`,
        limit,
        used: currentCount,
        requiredTier: suggestedTier,
        feature: actionType,
      });
      return;
    }

    incrementUsage(user.id, actionType);
    next();
  };
}
