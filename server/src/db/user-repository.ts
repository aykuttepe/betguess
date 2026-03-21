import { getDatabase } from './database';

export interface UserRow {
  id: number;
  email: string;
  username: string;
  password_hash: string;
  role: string;
  title: string | null;
  subscription_tier: string;
  subscription_expires_at: string | null;
  is_active: number;
  phone_number: string | null;
  phone_verified: number;
  created_at: string;
  updated_at: string;
}

export function createUser(email: string, username: string, passwordHash: string, role = 'user', phoneNumber: string | null = null): UserRow {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO users (email, username, password_hash, role, phone_number)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(email.toLowerCase().trim(), username.trim(), passwordHash, role, phoneNumber);
  return findById(result.lastInsertRowid as number)!;
}

export function findByEmail(email: string): UserRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as UserRow | undefined;
}

export function findByPhone(phoneNumber: string): UserRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM users WHERE phone_number = ?').get(phoneNumber.trim()) as UserRow | undefined;
}

export function findById(id: number): UserRow | undefined {
  const db = getDatabase();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function emailExists(email: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.toLowerCase().trim());
  return !!row;
}

export function usernameExists(username: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username.trim());
  return !!row;
}

export function phoneExists(phoneNumber: string): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT 1 FROM users WHERE phone_number = ?').get(phoneNumber.trim());
  return !!row;
}

export function getUserCount(): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  return row.count;
}

export function updateRole(userId: number, role: string): void {
  const db = getDatabase();
  db.prepare('UPDATE users SET role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(role, userId);
}

export function updateTitle(userId: number, title: string | null): void {
  const db = getDatabase();
  db.prepare('UPDATE users SET title = ?, updated_at = datetime(\'now\') WHERE id = ?').run(title, userId);
}

export function updateSubscription(userId: number, tier: string, expiresAt: string | null): void {
  const db = getDatabase();
  db.prepare('UPDATE users SET subscription_tier = ?, subscription_expires_at = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(tier, expiresAt, userId);
}

export function setActive(userId: number, isActive: boolean): void {
  const db = getDatabase();
  db.prepare('UPDATE users SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?').run(isActive ? 1 : 0, userId);
}

export function listUsers(): UserRow[] {
  const db = getDatabase();
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserRow[];
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
  freeCount: number;
  proCount: number;
  premiumCount: number;
  recentUsers: Array<{ id: number; username: string; email: string; role: string; createdAt: string }>;
}

export function getStats(): AdminStats {
  const db = getDatabase();

  const totals = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(is_active)  AS active,
      SUM(CASE WHEN role = 'admin'   THEN 1 ELSE 0 END) AS admins,
      SUM(CASE WHEN subscription_tier = 'free'    THEN 1 ELSE 0 END) AS free_cnt,
      SUM(CASE WHEN subscription_tier = 'pro'     THEN 1 ELSE 0 END) AS pro_cnt,
      SUM(CASE WHEN subscription_tier = 'premium' THEN 1 ELSE 0 END) AS premium_cnt
    FROM users
  `).get() as { total: number; active: number; admins: number; free_cnt: number; pro_cnt: number; premium_cnt: number };

  const recent = db.prepare(
    `SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5`
  ).all() as Array<{ id: number; username: string; email: string; role: string; created_at: string }>;

  return {
    totalUsers: totals.total ?? 0,
    activeUsers: totals.active ?? 0,
    adminCount: totals.admins ?? 0,
    freeCount: totals.free_cnt ?? 0,
    proCount: totals.pro_cnt ?? 0,
    premiumCount: totals.premium_cnt ?? 0,
    recentUsers: recent.map(r => ({ id: r.id, username: r.username, email: r.email, role: r.role, createdAt: r.created_at })),
  };
}

export interface UserDetail {
  id: number;
  email: string;
  username: string;
  role: string;
  title: string | null;
  subscriptionTier: string;
  subscriptionExpiresAt: string | null;
  isActive: boolean;
  phoneNumber: string | null;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
  couponCount: number;
  lastCouponAt: string | null;
}

export function getUserDetail(userId: number): UserDetail | null {
  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!user) return null;

  const couponStats = db.prepare(`
    SELECT COUNT(*) AS count, MAX(created_at) AS last_at
    FROM coupons WHERE user_id = ?
  `).get(userId) as { count: number; last_at: string | null };

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    title: user.title,
    subscriptionTier: user.subscription_tier,
    subscriptionExpiresAt: user.subscription_expires_at,
    isActive: user.is_active === 1,
    phoneNumber: user.phone_number,
    phoneVerified: user.phone_verified === 1,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    couponCount: couponStats.count ?? 0,
    lastCouponAt: couponStats.last_at,
  };
}

export function getLatestUsers(limit = 5): Array<{ username: string; created_at: string }> {
  const db = getDatabase();
  return db.prepare(
    `SELECT username, created_at FROM users ORDER BY created_at DESC LIMIT ?`
  ).all(limit) as Array<{ username: string; created_at: string }>;
}

export function markPhoneVerified(userId: number): void {
  const db = getDatabase();
  db.prepare('UPDATE users SET phone_verified = 1, updated_at = datetime(\'now\') WHERE id = ?').run(userId);
}

export function saveOtp(targetKey: string, code: string, lifetimeMinutes = 5, purpose = 'phone_verification', phoneNumber: string | null = null): void {
  const db = getDatabase();

  db.prepare('DELETE FROM otp_codes WHERE target_key = ? AND purpose = ?').run(targetKey, purpose);

  db.prepare(`
    INSERT INTO otp_codes (phone_number, target_key, purpose, code, expires_at)
    VALUES (?, ?, ?, ?, datetime('now', '+${lifetimeMinutes} minutes'))
  `).run(phoneNumber ?? targetKey, targetKey, purpose, code);
}

export function verifyOtp(targetKey: string, code: string, purpose = 'phone_verification'): boolean {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT * FROM otp_codes 
    WHERE target_key = ? AND purpose = ? AND code = ? AND expires_at > datetime('now')
  `).get(targetKey, purpose, code);

  if (result) {
    db.prepare('DELETE FROM otp_codes WHERE target_key = ? AND purpose = ?').run(targetKey, purpose);
    return true;
  }
  return false;
}
