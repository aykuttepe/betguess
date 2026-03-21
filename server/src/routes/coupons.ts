import { Router } from 'express';
import { saveCoupon, getUserCoupons, deleteCoupon } from '../db/coupon-repository';
import { AuthRequest } from '../auth/types';

const router = Router();

router.post('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { type, week, data } = req.body;
    if (!type || !week || !data) {
      return res.status(400).json({ error: 'Missing required fields' });
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
    // Notice: we fetch all and let frontend group by week if needed, or filter
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
