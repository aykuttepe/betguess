import { getDatabase } from './database';

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Predefined Tags ──────────────────────────────────────────────────────────

export const PREDEFINED_TAGS = [
  'Super Lig',
  'Premier League',
  'La Liga',
  'Serie A',
  'Bundesliga',
  'Ligue 1',
  'Sampiyonlar Ligi',
  'Kupon Analizi',
  'Canli Mac',
  'Istatistik',
  'Transfer',
  'Genel',
] as const;

export type ForumTag = typeof PREDEFINED_TAGS[number];

export interface TopicRow {
  id: number;
  user_id: number;
  title: string;
  body: string;
  image_path: string | null;
  tags: string; // JSON array string
  is_pinned: number;
  is_locked: number;
  view_count: number;
  comment_count: number;
  last_comment_at: string | null;
  created_at: string;
  updated_at: string;
  // joined
  username?: string;
  user_role?: string;
  user_title?: string | null;
}

export interface CommentRow {
  id: number;
  topic_id: number;
  user_id: number;
  parent_id: number | null;
  body: string;
  image_path: string | null;
  net_likes: number;
  created_at: string;
  updated_at: string;
  // joined
  username?: string;
  user_role?: string;
  user_title?: string | null;
}

export interface ReactionRow {
  id: number;
  user_id: number;
  comment_id: number;
  reaction_type: string;
  created_at: string;
}

export interface ReactionSummary {
  like: number;
  dislike: number;
  fire: number;
  heart: number;
  laugh: number;
  sad: number;
  angry: number;
}

export type ReactionType = 'like' | 'dislike' | 'fire' | 'heart' | 'laugh' | 'sad' | 'angry';

// ─── Topics ───────────────────────────────────────────────────────────────────

const TOPIC_SELECT = `
  SELECT t.*, u.username, u.role as user_role, u.title as user_title
  FROM forum_topics t
  JOIN users u ON u.id = t.user_id
`;

export type TopicSort = 'active' | 'popular' | 'newest' | 'oldest' | 'most_viewed' | 'most_liked';

const TOPIC_ORDER: Record<TopicSort, string> = {
  active:      't.is_pinned DESC, COALESCE(t.last_comment_at, t.created_at) DESC',
  popular:     't.is_pinned DESC, t.comment_count DESC, t.created_at DESC',
  newest:      't.is_pinned DESC, t.created_at DESC',
  oldest:      't.is_pinned DESC, t.created_at ASC',
  most_viewed: 't.is_pinned DESC, t.view_count DESC, t.created_at DESC',
  most_liked:  `t.is_pinned DESC, (SELECT COALESCE(SUM(CASE WHEN r.reaction_type = 'like' THEN 1 ELSE 0 END), 0) FROM forum_comment_reactions r JOIN forum_comments c ON c.id = r.comment_id WHERE c.topic_id = t.id) DESC, t.created_at DESC`,
};

export function listTopics(page = 1, limit = 20, search?: string, sort: TopicSort = 'active', tags?: string[], dateRange?: string): { topics: TopicRow[]; total: number } {
  const db = getDatabase();
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (search) {
    conditions.push('(t.title LIKE ? OR t.body LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (tags && tags.length > 0) {
    for (const tag of tags) {
      conditions.push('t.tags LIKE ?');
      params.push(`%"${tag}"%`);
    }
  }

  if (dateRange && dateRange !== 'all') {
    const ranges: Record<string, string> = {
      today: "datetime('now', '-1 day')",
      '7d':  "datetime('now', '-7 days')",
      '30d': "datetime('now', '-30 days')",
    };
    if (ranges[dateRange]) {
      conditions.push(`t.created_at >= ${ranges[dateRange]}`);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM forum_topics t ${where}`;
  const total = (db.prepare(countSql).get(...params) as { total: number }).total;

  const orderBy = TOPIC_ORDER[sort] || TOPIC_ORDER.active;
  const sql = `${TOPIC_SELECT} ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
  const topics = db.prepare(sql).all(...params, limit, offset) as TopicRow[];

  return { topics, total };
}

export function getTopicById(id: number): TopicRow | undefined {
  const db = getDatabase();
  return db.prepare(`${TOPIC_SELECT} WHERE t.id = ?`).get(id) as TopicRow | undefined;
}

export function incrementViewCount(id: number): void {
  const db = getDatabase();
  db.prepare('UPDATE forum_topics SET view_count = view_count + 1 WHERE id = ?').run(id);
}

export function createTopic(userId: number, title: string, body: string, imagePath: string | null = null, tags: string[] = []): TopicRow {
  const db = getDatabase();
  const validTags = tags.filter(t => (PREDEFINED_TAGS as readonly string[]).includes(t));
  const result = db.prepare(`
    INSERT INTO forum_topics (user_id, title, body, image_path, tags) VALUES (?, ?, ?, ?, ?)
  `).run(userId, title, body, imagePath, JSON.stringify(validTags));
  return getTopicById(result.lastInsertRowid as number)!;
}

export function updateTopic(id: number, title: string, body: string, tags?: string[]): void {
  const db = getDatabase();
  if (tags !== undefined) {
    const validTags = tags.filter(t => (PREDEFINED_TAGS as readonly string[]).includes(t));
    db.prepare(`UPDATE forum_topics SET title = ?, body = ?, tags = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(title, body, JSON.stringify(validTags), id);
  } else {
    db.prepare(`UPDATE forum_topics SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(title, body, id);
  }
}

export function deleteTopic(id: number): void {
  const db = getDatabase();
  db.prepare('DELETE FROM forum_topics WHERE id = ?').run(id);
}

export function togglePin(id: number): boolean {
  const db = getDatabase();
  const topic = db.prepare('SELECT is_pinned FROM forum_topics WHERE id = ?').get(id) as { is_pinned: number } | undefined;
  if (!topic) return false;
  const newVal = topic.is_pinned ? 0 : 1;
  db.prepare('UPDATE forum_topics SET is_pinned = ? WHERE id = ?').run(newVal, id);
  return newVal === 1;
}

export function toggleLock(id: number): boolean {
  const db = getDatabase();
  const topic = db.prepare('SELECT is_locked FROM forum_topics WHERE id = ?').get(id) as { is_locked: number } | undefined;
  if (!topic) return false;
  const newVal = topic.is_locked ? 0 : 1;
  db.prepare('UPDATE forum_topics SET is_locked = ? WHERE id = ?').run(newVal, id);
  return newVal === 1;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

const COMMENT_SELECT = `
  SELECT c.*, u.username, u.role as user_role, u.title as user_title
  FROM forum_comments c
  JOIN users u ON u.id = c.user_id
`;

export function listComments(topicId: number, sort: 'hype' | 'newest' | 'oldest' = 'hype'): CommentRow[] {
  const db = getDatabase();
  let orderBy: string;
  switch (sort) {
    case 'newest': orderBy = 'c.created_at DESC'; break;
    case 'oldest': orderBy = 'c.created_at ASC'; break;
    default: orderBy = 'c.net_likes DESC, c.created_at DESC'; break;
  }
  return db.prepare(`${COMMENT_SELECT} WHERE c.topic_id = ? ORDER BY ${orderBy}`).all(topicId) as CommentRow[];
}

export function getCommentById(id: number): CommentRow | undefined {
  const db = getDatabase();
  return db.prepare(`${COMMENT_SELECT} WHERE c.id = ?`).get(id) as CommentRow | undefined;
}

export function createComment(topicId: number, userId: number, body: string, parentId: number | null = null, imagePath: string | null = null): CommentRow {
  const db = getDatabase();
  const result = db.prepare(`
    INSERT INTO forum_comments (topic_id, user_id, parent_id, body, image_path) VALUES (?, ?, ?, ?, ?)
  `).run(topicId, userId, parentId, body, imagePath);

  // Update topic comment count and last_comment_at
  db.prepare(`
    UPDATE forum_topics SET comment_count = comment_count + 1, last_comment_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
  `).run(topicId);

  return getCommentById(result.lastInsertRowid as number)!;
}

export function updateComment(id: number, body: string): void {
  const db = getDatabase();
  db.prepare(`UPDATE forum_comments SET body = ?, updated_at = datetime('now') WHERE id = ?`).run(body, id);
}

export function deleteComment(id: number): void {
  const db = getDatabase();
  const comment = db.prepare('SELECT topic_id FROM forum_comments WHERE id = ?').get(id) as { topic_id: number } | undefined;
  if (!comment) return;

  db.prepare('DELETE FROM forum_comments WHERE id = ?').run(id);

  // Update topic comment count
  db.prepare(`
    UPDATE forum_topics SET comment_count = MAX(0, comment_count - 1), updated_at = datetime('now') WHERE id = ?
  `).run(comment.topic_id);
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export function toggleReaction(userId: number, commentId: number, reactionType: ReactionType): { added: boolean } {
  const db = getDatabase();

  const existing = db.prepare(
    'SELECT id FROM forum_reactions WHERE user_id = ? AND comment_id = ? AND reaction_type = ?'
  ).get(userId, commentId, reactionType);

  if (existing) {
    // Remove it
    db.prepare('DELETE FROM forum_reactions WHERE user_id = ? AND comment_id = ? AND reaction_type = ?')
      .run(userId, commentId, reactionType);

    // Update net_likes if like/dislike
    if (reactionType === 'like') {
      db.prepare('UPDATE forum_comments SET net_likes = net_likes - 1 WHERE id = ?').run(commentId);
    } else if (reactionType === 'dislike') {
      db.prepare('UPDATE forum_comments SET net_likes = net_likes + 1 WHERE id = ?').run(commentId);
    }

    return { added: false };
  }

  // For like/dislike, remove the opposite first
  if (reactionType === 'like' || reactionType === 'dislike') {
    const opposite = reactionType === 'like' ? 'dislike' : 'like';
    const hadOpposite = db.prepare(
      'SELECT id FROM forum_reactions WHERE user_id = ? AND comment_id = ? AND reaction_type = ?'
    ).get(userId, commentId, opposite);

    if (hadOpposite) {
      db.prepare('DELETE FROM forum_reactions WHERE user_id = ? AND comment_id = ? AND reaction_type = ?')
        .run(userId, commentId, opposite);
      // Undo opposite effect
      if (opposite === 'like') {
        db.prepare('UPDATE forum_comments SET net_likes = net_likes - 1 WHERE id = ?').run(commentId);
      } else {
        db.prepare('UPDATE forum_comments SET net_likes = net_likes + 1 WHERE id = ?').run(commentId);
      }
    }
  }

  // Add the reaction
  db.prepare('INSERT INTO forum_reactions (user_id, comment_id, reaction_type) VALUES (?, ?, ?)')
    .run(userId, commentId, reactionType);

  if (reactionType === 'like') {
    db.prepare('UPDATE forum_comments SET net_likes = net_likes + 1 WHERE id = ?').run(commentId);
  } else if (reactionType === 'dislike') {
    db.prepare('UPDATE forum_comments SET net_likes = net_likes - 1 WHERE id = ?').run(commentId);
  }

  return { added: true };
}

export function getReactionSummary(commentId: number): ReactionSummary {
  const db = getDatabase();
  const rows = db.prepare(
    'SELECT reaction_type, COUNT(*) as cnt FROM forum_reactions WHERE comment_id = ? GROUP BY reaction_type'
  ).all(commentId) as Array<{ reaction_type: string; cnt: number }>;

  const summary: ReactionSummary = { like: 0, dislike: 0, fire: 0, heart: 0, laugh: 0, sad: 0, angry: 0 };
  for (const r of rows) {
    if (r.reaction_type in summary) {
      (summary as any)[r.reaction_type] = r.cnt;
    }
  }
  return summary;
}

export function getUserReactions(userId: number, commentIds: number[]): Record<number, string[]> {
  if (commentIds.length === 0) return {};
  const db = getDatabase();
  const placeholders = commentIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT comment_id, reaction_type FROM forum_reactions WHERE user_id = ? AND comment_id IN (${placeholders})`
  ).all(userId, ...commentIds) as Array<{ comment_id: number; reaction_type: string }>;

  const result: Record<number, string[]> = {};
  for (const r of rows) {
    if (!result[r.comment_id]) result[r.comment_id] = [];
    result[r.comment_id].push(r.reaction_type);
  }
  return result;
}

// ─── User Forum Profile ──────────────────────────────────────────────────────

export interface UserForumProfile {
  id: number;
  username: string;
  role: string;
  title: string | null;
  createdAt: string;
  topicCount: number;
  commentCount: number;
  totalLikesReceived: number;
}

export function getUserForumProfile(userId: number): UserForumProfile | null {
  const db = getDatabase();
  const user = db.prepare('SELECT id, username, role, title, created_at FROM users WHERE id = ?')
    .get(userId) as { id: number; username: string; role: string; title: string | null; created_at: string } | undefined;
  if (!user) return null;

  const topicCount = (db.prepare('SELECT COUNT(*) as cnt FROM forum_topics WHERE user_id = ?').get(userId) as { cnt: number }).cnt;
  const commentCount = (db.prepare('SELECT COUNT(*) as cnt FROM forum_comments WHERE user_id = ?').get(userId) as { cnt: number }).cnt;

  // Total likes received on user's comments (sum of positive net_likes)
  const likesRow = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN net_likes > 0 THEN net_likes ELSE 0 END), 0) as total
    FROM forum_comments WHERE user_id = ?
  `).get(userId) as { total: number };

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    title: user.title,
    createdAt: user.created_at,
    topicCount,
    commentCount,
    totalLikesReceived: likesRow.total,
  };
}

export function getReactionSummaries(commentIds: number[]): Record<number, ReactionSummary> {
  if (commentIds.length === 0) return {};
  const db = getDatabase();
  const placeholders = commentIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT comment_id, reaction_type, COUNT(*) as cnt FROM forum_reactions WHERE comment_id IN (${placeholders}) GROUP BY comment_id, reaction_type`
  ).all(...commentIds) as Array<{ comment_id: number; reaction_type: string; cnt: number }>;

  const result: Record<number, ReactionSummary> = {};
  for (const cid of commentIds) {
    result[cid] = { like: 0, dislike: 0, fire: 0, heart: 0, laugh: 0, sad: 0, angry: 0 };
  }
  for (const r of rows) {
    if (result[r.comment_id] && r.reaction_type in result[r.comment_id]) {
      (result[r.comment_id] as any)[r.reaction_type] = r.cnt;
    }
  }
  return result;
}
