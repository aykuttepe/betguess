import { getDatabase } from './database';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'comment_on_topic' | 'reply_to_comment' | 'like_on_comment';

export interface NotificationRow {
  id: number;
  user_id: number;
  type: NotificationType;
  actor_id: number;
  topic_id: number;
  comment_id: number | null;
  is_read: number;
  created_at: string;
  // joined
  actor_username?: string;
  topic_title?: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

const NOTIF_SELECT = `
  SELECT n.*, u.username as actor_username, t.title as topic_title
  FROM forum_notifications n
  JOIN users u ON u.id = n.actor_id
  JOIN forum_topics t ON t.id = n.topic_id
`;

// ─── Functions ────────────────────────────────────────────────────────────────

export function createNotification(
  userId: number,
  type: NotificationType,
  actorId: number,
  topicId: number,
  commentId: number | null
): void {
  // Don't notify yourself
  if (userId === actorId) return;

  const db = getDatabase();
  db.prepare(`
    INSERT INTO forum_notifications (user_id, type, actor_id, topic_id, comment_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, type, actorId, topicId, commentId);
}

export function getUnreadCount(userId: number): number {
  const db = getDatabase();
  const row = db.prepare(
    'SELECT COUNT(*) as cnt FROM forum_notifications WHERE user_id = ? AND is_read = 0'
  ).get(userId) as { cnt: number };
  return row.cnt;
}

export function listNotifications(
  userId: number,
  limit = 50,
  offset = 0
): { notifications: NotificationRow[]; total: number } {
  const db = getDatabase();

  const total = (db.prepare(
    'SELECT COUNT(*) as cnt FROM forum_notifications WHERE user_id = ?'
  ).get(userId) as { cnt: number }).cnt;

  const notifications = db.prepare(
    `${NOTIF_SELECT} WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT ? OFFSET ?`
  ).all(userId, limit, offset) as NotificationRow[];

  return { notifications, total };
}

export function markAsRead(notificationId: number, userId: number): void {
  const db = getDatabase();
  db.prepare(
    'UPDATE forum_notifications SET is_read = 1 WHERE id = ? AND user_id = ?'
  ).run(notificationId, userId);
}

export function markAllAsRead(userId: number): void {
  const db = getDatabase();
  db.prepare(
    'UPDATE forum_notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0'
  ).run(userId);
}
