import { getDatabase } from './database';

export interface CouponRow {
  id: number;
  user_id: number;
  type: string;
  week: string;
  data: string;
  created_at: string;
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

export function deleteCoupon(id: number, userId: number): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM coupons WHERE id = ? AND user_id = ?').run(id, userId);
  return result.changes > 0;
}
