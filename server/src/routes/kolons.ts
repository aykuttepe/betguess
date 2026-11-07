import { Router, Response } from 'express';
import { AuthRequest, AuthUser } from '../auth/types';
import { KOLON_LIMITS, TIER_LIMITS_CONFIG, effectiveTier } from '../auth/subscription-policy';
import { isSubscriptionSystemActive } from '../db/settings-repository';
import { requireUsageLimit } from '../middleware/usage-limit';
import { userRateLimit } from '../middleware/auth-rate-limit';
import { generateKolons, validateKolonInputs, KolonInputError, MAX_KOLON_COUNT } from '../services/kolon-generation';

// Worst case (~470k kolons) measured at ~110 ms CPU and ~39 MB JSON per request; throttle every user.
const KOLON_REQUESTS_PER_MINUTE = 10;

export function kolonCountLimit(user: AuthUser, subscriptionActive = isSubscriptionSystemActive()): number {
  const tierLimit = KOLON_LIMITS[effectiveTier(user)];
  return user.role === 'admin' || !subscriptionActive || tierLimit === -1 ? MAX_KOLON_COUNT : tierLimit;
}

const router = Router();
router.post('/kolons/generate',
  userRateLimit('kolon_generate', KOLON_REQUESTS_PER_MINUTE, 60 * 1000),
  requireUsageLimit('kolon_generate', TIER_LIMITS_CONFIG.kolon_generate),
  (req: AuthRequest, res: Response) => {
    try {
      const maxCount = kolonCountLimit(req.user!);
      const inputs = validateKolonInputs(req.body?.inputs, maxCount);
      res.json({ kolonlar: generateKolons(inputs) });
    } catch (error) {
      if (error instanceof KolonInputError) { res.status(400).json({ error: error.message }); return; }
      console.error('[Kolon] Generation failed:', error);
      res.status(500).json({ error: 'Kolonlar olusturulamadi.' });
    }
  });
export default router;
