import { Router } from 'express';
import { saveCoupon, getUserCoupons, deleteCoupon } from '../db/coupon-repository';
import { AuthRequest, SubscriptionTier } from '../auth/types';
import { getSavedCouponCount } from '../db/usage-repository';
import { isSubscriptionSystemActive } from '../db/settings-repository';

const COUPON_LIMITS: Record<SubscriptionTier, number> = {
  free: 3,
  pro: 20,
  premium: -1, // unlimited
};

const router = Router();

router.post('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { type, week, data } = req.body;
    if (!type || !week || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check coupon save limit (only when subscription system is active)
    if (isSubscriptionSystemActive() && req.user?.role !== 'admin') {
      const tier = (req.user?.subscriptionTier || 'free') as SubscriptionTier;
      const limit = COUPON_LIMITS[tier];
      if (limit !== -1) {
        const currentCount = getSavedCouponCount(userId);
        if (currentCount >= limit) {
          return res.status(403).json({
            error: `Kupon kaydetme limitinize ulastiniz (${currentCount}/${limit}).`,
            requiredTier: tier === 'free' ? 'pro' : 'premium',
            limit,
            used: currentCount,
            feature: 'saved_coupons',
          });
        }
      }
    }

    const coupon = saveCoupon(userId, type, week, data);
    res.json(coupon);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const type = req.query.type as string | undefined;
    const coupons = getUserCoupons(userId, type);
    res.json(coupons);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = parseInt(req.params.id as string);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

    const success = deleteCoupon(id, userId);
    if (!success) {
      return res.status(404).json({ error: 'Coupon not found or unauthorized' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
