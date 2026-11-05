import { Router } from 'express';
import {
  deleteCoupon,
  getSharedCouponsForUser,
  getUserCoupons,
  saveCoupon,
  shareCouponWithUser,
} from '../db/coupon-repository';
import { AuthRequest, SubscriptionTier } from '../auth/types';
import { getSavedCouponCount } from '../db/usage-repository';
import { isSubscriptionSystemActive } from '../db/settings-repository';
import { findByUsernameOrEmail } from '../db/user-repository';
import { areFriends } from '../db/friend-repository';
import { createNotification } from '../db/notification-repository';
import { attachCouponSnapshot } from '../services/coupon-snapshot-service';

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

    const dataWithSnapshot = attachCouponSnapshot(data, userId, week);
    const coupon = saveCoupon(userId, type, week, dataWithSnapshot);
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

router.get('/shared-with-me', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    res.json(getSharedCouponsForUser(userId));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/share', (req: AuthRequest, res) => {
  try {
    const senderId = req.user?.id;
    if (!senderId) return res.status(401).json({ error: 'Unauthorized' });

    const couponId = parseInt(req.params.id as string, 10);
    if (isNaN(couponId)) return res.status(400).json({ error: 'Invalid ID' });

    const recipientInput = String(req.body.recipient || '').trim();
    const message = typeof req.body.message === 'string' && req.body.message.trim()
      ? req.body.message.trim().slice(0, 500)
      : null;

    if (!recipientInput) {
      return res.status(400).json({ error: 'Paylasilacak kullanici adi veya e-posta gerekli.' });
    }

    const recipient = findByUsernameOrEmail(recipientInput);
    if (!recipient || recipient.is_active !== 1) {
      return res.status(404).json({ error: 'Kullanici bulunamadi.' });
    }

    if (recipient.id === senderId) {
      return res.status(400).json({ error: 'Kuponu kendinize paylasamazsiniz.' });
    }

    if (!areFriends(senderId, recipient.id)) {
      return res.status(403).json({ error: 'Kupon paylasmak icin once arkadas olmalisiniz.' });
    }

    shareCouponWithUser(couponId, senderId, recipient.id, message);
    createNotification(recipient.id, 'coupon_shared', senderId, null, null, null, {
      couponId,
    });
    res.json({ success: true, recipient: { id: recipient.id, username: recipient.username } });
  } catch (err: any) {
    if (err.message === 'Coupon not found or unauthorized') {
      return res.status(404).json({ error: 'Kupon bulunamadi veya yetkiniz yok.' });
    }

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
