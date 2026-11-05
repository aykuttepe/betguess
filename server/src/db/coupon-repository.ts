import { getDatabase } from './database';

export interface CouponRow {
  id: number;
  user_id: number;
  type: string;
  week: string;
  data: string;
  created_at: string;
}

export interface SharedCouponRow extends CouponRow {
  share_id: number;
  sender_id: number;
  sender_username: string;
  sender_email: string;
  shared_at: string;
  share_message: string | null;
}

export function saveCoupon(userId: number, type: string, week: string, data: any): CouponRow {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO coupons (user_id, type, week, data)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(userId, type, week, JSON.stringify(data));
  return getCouponById(result.lastInsertRowid as number)!;
}

export function getCouponById(id: number): CouponRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM coupons WHERE id = ?').get(id) as CouponRow | undefined;
}

export function getUserCoupons(userId: number, type?: string): CouponRow[] {
  const db = getDatabase();
  if (type) {
    return db.prepare('SELECT * FROM coupons WHERE user_id = ? AND type = ? ORDER BY created_at DESC').all(userId, type) as CouponRow[];
  }
  return db.prepare('SELECT * FROM coupons WHERE user_id = ? ORDER BY created_at DESC').all(userId) as CouponRow[];
}

export function shareCouponWithUser(
  couponId: number,
  senderId: number,
  recipientId: number,
  message: string | null = null,
): number {
  const db = getDatabase();
  const coupon = db.prepare('SELECT id FROM coupons WHERE id = ? AND user_id = ?').get(couponId, senderId);

  if (!coupon) {
    throw new Error('Coupon not found or unauthorized');
  }

  db.prepare(`
    INSERT OR REPLACE INTO coupon_shares (coupon_id, sender_id, recipient_id, message, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `).run(couponId, senderId, recipientId, message);

  const row = db.prepare(`
    SELECT id FROM coupon_shares
    WHERE coupon_id = ? AND sender_id = ? AND recipient_id = ?
  `).get(couponId, senderId, recipientId) as { id: number };

  return row.id;
}

export function getSharedCouponsForUser(userId: number): SharedCouponRow[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT
      c.id,
      c.user_id,
      c.type,
      c.week,
      c.data,
      c.created_at,
      s.id AS share_id,
      s.sender_id,
      u.username AS sender_username,
      u.email AS sender_email,
      s.created_at AS shared_at,
      s.message AS share_message
    FROM coupon_shares s
    INNER JOIN coupons c ON c.id = s.coupon_id
    INNER JOIN users u ON u.id = s.sender_id
    WHERE s.recipient_id = ?
    ORDER BY s.created_at DESC
  `).all(userId) as SharedCouponRow[];
}

export function deleteCoupon(id: number, userId: number): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM coupons WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}
