import { Router, Response } from 'express';
import { AuthRequest } from '../auth/types';
import { KOLON_LIMITS, TIER_LIMITS_CONFIG, effectiveTier } from '../auth/subscription-policy';
import { isSubscriptionSystemActive } from '../db/settings-repository';
import { requireUsageLimit } from '../middleware/usage-limit';
import { generateKolons, validateKolonInputs, KolonInputError } from '../services/kolon-generation';

const router = Router();
router.post('/kolons/generate', requireUsageLimit('kolon_generate', TIER_LIMITS_CONFIG.kolon_generate),
  (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const tierLimit = KOLON_LIMITS[effectiveTier(user)];
      const maxCount = user.role === 'admin' || !isSubscriptionSystemActive() || tierLimit === -1 ? 500000 : tierLimit;
      const inputs = validateKolonInputs(req.body?.inputs, maxCount);
      res.json({ kolonlar: generateKolons(inputs) });
    } catch (error) {
      if (error instanceof KolonInputError) { res.status(400).json({ error: error.message }); return; }
      console.error('[Kolon] Generation failed:', error);
      res.status(500).json({ error: 'Kolonlar olusturulamadi.' });
    }
  });
export default router;
