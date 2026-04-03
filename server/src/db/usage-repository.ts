import { getDatabase } from './database';

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Increment today's usage count for a given action. Returns the new count. */
export function incrementUsage(userId: number, actionType: string): number {
  const db = getDatabase();
  const date = todayUTC();
  db.prepare(`
    INSERT INTO usage_limits (user_id, action_type, date, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(user_id, action_type, date)
    DO UPDATE SET count = count + 1
  `).run(userId, actionType, date);

  const row = db.prepare(
    'SELECT count FROM usage_limits WHERE user_id = ? AND action_type = ? AND date = ?'
  ).get(userId, actionType, date) as { count: number } | undefined;

  return row?.count ?? 1;
}

/** Get today's usage count for a single action type. */
export function getUsageToday(userId: number, actionType: string): number {
  const db = getDatabase();
  const date = todayUTC();
  const row = db.prepare(
    'SELECT count FROM usage_limits WHERE user_id = ? AND action_type = ? AND date = ?'
  ).get(userId, actionType, date) as { count: number } | undefined;
  return row?.count ?? 0;
}

/** Get today's usage counts for all action types for a user. */
export function getUserUsageSummary(userId: number): Record<string, number> {
  const db = getDatabase();
  const date = todayUTC();
  const rows = db.prepare(
    'SELECT action_type, count FROM usage_limits WHERE user_id = ? AND date = ?'
  ).all(userId, date) as Array<{ action_type: string; count: number }>;

  const summary: Record<string, number> = {};
  for (const row of rows) {
    summary[row.action_type] = row.count;
  }
  return summary;
}

/** Get the count of saved coupons for a user. */
export function getSavedCouponCount(userId: number): number {
  const db = getDatabase();
  const row = db.prepare('SELECT COUNT(*) as count FROM coupons WHERE user_id = ?').get(userId) as { count: number };
  return row.count;
}
