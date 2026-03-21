import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../auth/types';
import { requireAuth, optionalAuth } from '../auth/auth-middleware';
import {
  listTopics, getTopicById, createTopic, updateTopic, deleteTopic,
  togglePin, toggleLock,
  listComments, getCommentById, createComment, updateComment, deleteComment,
  toggleReaction, getReactionSummaries, getUserReactions, ReactionType, TopicSort,
  PREDEFINED_TAGS, getUserForumProfile, incrementViewCount,
} from '../db/forum-repository';
import {
  createNotification, getUnreadCount, listNotifications,
  markAsRead, markAllAsRead,
} from '../db/notification-repository';

const router = Router();

// ─── Multer config ────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../../uploads/forum');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyalari yuklenebilir (jpg, png, gif, webp).'));
    }
  },
});

const VALID_REACTIONS: ReactionType[] = ['like', 'dislike', 'fire', 'heart', 'laugh', 'sad', 'angry'];

function paramId(req: AuthRequest): number {
  return parseInt(req.params.id as string);
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function formatTopic(t: any) {
  return {
    id: t.id,
    userId: t.user_id,
    title: t.title,
    body: t.body,
    imagePath: t.image_path,
    tags: parseTags(t.tags),
    isPinned: t.is_pinned === 1,
    isLocked: t.is_locked === 1,
    viewCount: t.view_count ?? 0,
    commentCount: t.comment_count,
    lastCommentAt: t.last_comment_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    username: t.username,
    userRole: t.user_role,
    userTitle: t.user_title,
  };
}

function formatComment(c: any, reactions: any = null, userReactions: string[] = []) {
  return {
    id: c.id,
    topicId: c.topic_id,
    userId: c.user_id,
    parentId: c.parent_id,
    body: c.body,
    imagePath: c.image_path,
    netLikes: c.net_likes,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    username: c.username,
    userRole: c.user_role,
    userTitle: c.user_title,
    reactions: reactions || { like: 0, dislike: 0, fire: 0, heart: 0, laugh: 0, sad: 0, angry: 0 },
    userReactions: userReactions,
  };
}

// ─── Tags ─────────────────────────────────────────────────────────────────────

// GET /tags — public (predefined tag list)
router.get('/tags', (_req: AuthRequest, res: Response) => {
  res.json({ tags: PREDEFINED_TAGS });
});

// ─── User Profile Card ───────────────────────────────────────────────────────

// GET /users/:id/profile — public (forum profile card data)
router.get('/users/:id/profile', (_req: AuthRequest, res: Response) => {
  const userId = parseInt(_req.params.id as string);
  if (!userId || isNaN(userId)) {
    res.status(400).json({ error: 'Gecersiz kullanici ID.' });
    return;
  }
  const profile = getUserForumProfile(userId);
  if (!profile) {
    res.status(404).json({ error: 'Kullanici bulunamadi.' });
    return;
  }
  res.json({ profile });
});

// ─── Topics ───────────────────────────────────────────────────────────────────

// GET /topics — public
router.get('/topics', optionalAuth as any, (req: AuthRequest, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const search = (req.query.search as string) || undefined;
  const tagParam = (req.query.tag as string) || undefined;
  const tags = tagParam ? tagParam.split(',').map(t => t.trim()).filter(Boolean) : undefined;
  const validSorts: TopicSort[] = ['active', 'popular', 'newest', 'oldest', 'most_viewed', 'most_liked'];
  const sort = validSorts.includes(req.query.sort as TopicSort) ? (req.query.sort as TopicSort) : 'active';
  const validDateRanges = ['today', '7d', '30d', 'all'];
  const dateRange = validDateRanges.includes(req.query.dateRange as string) ? (req.query.dateRange as string) : undefined;

  const { topics, total } = listTopics(page, limit, search, sort, tags, dateRange);
  res.json({
    topics: topics.map(formatTopic),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /topics/:id — public
router.get('/topics/:id', optionalAuth as any, (req: AuthRequest, res: Response) => {
  const topic = getTopicById(paramId(req));
  if (!topic) {
    res.status(404).json({ error: 'Konu bulunamadi.' });
    return;
  }

  // Increment view count
  incrementViewCount(topic.id);
  topic.view_count = (topic.view_count ?? 0) + 1;

  const sort = (req.query.sort as 'hype' | 'newest' | 'oldest') || 'hype';
  const comments = listComments(topic.id, sort);
  const commentIds = comments.map(c => c.id);
  const reactionSummaries = getReactionSummaries(commentIds);
  const userReactions = req.user ? getUserReactions(req.user.id, commentIds) : {};

  res.json({
    topic: formatTopic(topic),
    comments: comments.map(c => formatComment(c, reactionSummaries[c.id], userReactions[c.id] || [])),
  });
});

// POST /topics — auth required
router.post('/topics', requireAuth as any, upload.single('image'), (req: AuthRequest, res: Response) => {
  const { title, body } = req.body;

  if (!title || !title.trim()) {
    res.status(400).json({ error: 'Baslik gereklidir.' });
    return;
  }
  if (!body || !body.trim()) {
    res.status(400).json({ error: 'Icerik gereklidir.' });
    return;
  }
  if (title.trim().length > 200) {
    res.status(400).json({ error: 'Baslik en fazla 200 karakter olabilir.' });
    return;
  }

  const imagePath = req.file ? `/uploads/forum/${req.file.filename}` : null;
  let tags: string[] = [];
  try {
    tags = req.body.tags ? JSON.parse(req.body.tags) : [];
  } catch { tags = []; }
  const topic = createTopic(req.user!.id, title.trim(), body.trim(), imagePath, tags);
  res.status(201).json({ topic: formatTopic(topic) });
});

// PUT /topics/:id — owner or admin
router.put('/topics/:id', requireAuth as any, (req: AuthRequest, res: Response) => {
  const topic = getTopicById(paramId(req));
  if (!topic) {
    res.status(404).json({ error: 'Konu bulunamadi.' });
    return;
  }
  if (topic.user_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Bu islemi yapmaya yetkiniz yok.' });
    return;
  }

  const { title, body, tags } = req.body;
  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: 'Baslik ve icerik gereklidir.' });
    return;
  }

  updateTopic(topic.id, title.trim(), body.trim(), Array.isArray(tags) ? tags : undefined);
  const updated = getTopicById(topic.id)!;
  res.json({ topic: formatTopic(updated) });
});

// DELETE /topics/:id — owner or admin
router.delete('/topics/:id', requireAuth as any, (req: AuthRequest, res: Response) => {
  const topic = getTopicById(paramId(req));
  if (!topic) {
    res.status(404).json({ error: 'Konu bulunamadi.' });
    return;
  }
  if (topic.user_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Bu islemi yapmaya yetkiniz yok.' });
    return;
  }

  deleteTopic(topic.id);
  res.json({ message: 'Konu silindi.' });
});

// POST /topics/:id/pin — admin only
router.post('/topics/:id/pin', requireAuth as any, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Bu islemi yapmaya yetkiniz yok.' });
    return;
  }
  const topic = getTopicById(paramId(req));
  if (!topic) {
    res.status(404).json({ error: 'Konu bulunamadi.' });
    return;
  }
  const pinned = togglePin(topic.id);
  res.json({ pinned });
});

// POST /topics/:id/lock — admin only
router.post('/topics/:id/lock', requireAuth as any, (req: AuthRequest, res: Response) => {
  if (req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Bu islemi yapmaya yetkiniz yok.' });
    return;
  }
  const topic = getTopicById(paramId(req));
  if (!topic) {
    res.status(404).json({ error: 'Konu bulunamadi.' });
    return;
  }
  const locked = toggleLock(topic.id);
  res.json({ locked });
});

// ─── Comments ─────────────────────────────────────────────────────────────────

// POST /topics/:id/comments — auth required
router.post('/topics/:id/comments', requireAuth as any, upload.single('image'), (req: AuthRequest, res: Response) => {
  const topic = getTopicById(paramId(req));
  if (!topic) {
    res.status(404).json({ error: 'Konu bulunamadi.' });
    return;
  }
  if (topic.is_locked) {
    res.status(403).json({ error: 'Bu konu kilitlenmis. Yorum yapilamaz.' });
    return;
  }

  const { body, parentId } = req.body;
  if (!body || !body.trim()) {
    res.status(400).json({ error: 'Yorum icerigi gereklidir.' });
    return;
  }

  const parsedParentId = parentId ? parseInt(parentId) : null;
  const imagePath = req.file ? `/uploads/forum/${req.file.filename}` : null;
  const comment = createComment(topic.id, req.user!.id, body.trim(), parsedParentId, imagePath);

  // ─── Notification triggers ───
  const actorId = req.user!.id;
  if (parsedParentId) {
    // Reply → notify parent comment author
    const parentComment = getCommentById(parsedParentId);
    if (parentComment) {
      createNotification(parentComment.user_id, 'reply_to_comment', actorId, topic.id, comment.id);
    }
    // Also notify topic owner (if different from parent author)
    if (!parentComment || parentComment.user_id !== topic.user_id) {
      createNotification(topic.user_id, 'comment_on_topic', actorId, topic.id, comment.id);
    }
  } else {
    // Direct comment → notify topic owner
    createNotification(topic.user_id, 'comment_on_topic', actorId, topic.id, comment.id);
  }

  res.status(201).json({
    comment: formatComment(comment, { like: 0, dislike: 0, fire: 0, heart: 0, laugh: 0, sad: 0, angry: 0 }, []),
  });
});

// PUT /comments/:id — owner or admin
router.put('/comments/:id', requireAuth as any, (req: AuthRequest, res: Response) => {
  const comment = getCommentById(paramId(req));
  if (!comment) {
    res.status(404).json({ error: 'Yorum bulunamadi.' });
    return;
  }
  if (comment.user_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Bu islemi yapmaya yetkiniz yok.' });
    return;
  }

  const { body } = req.body;
  if (!body?.trim()) {
    res.status(400).json({ error: 'Yorum icerigi gereklidir.' });
    return;
  }

  updateComment(comment.id, body.trim());
  const updated = getCommentById(comment.id)!;
  res.json({ comment: formatComment(updated) });
});

// DELETE /comments/:id — owner or admin
router.delete('/comments/:id', requireAuth as any, (req: AuthRequest, res: Response) => {
  const comment = getCommentById(paramId(req));
  if (!comment) {
    res.status(404).json({ error: 'Yorum bulunamadi.' });
    return;
  }
  if (comment.user_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Bu islemi yapmaya yetkiniz yok.' });
    return;
  }

  deleteComment(comment.id);
  res.json({ message: 'Yorum silindi.' });
});

// ─── Reactions ────────────────────────────────────────────────────────────────

// POST /comments/:id/reactions — auth required
router.post('/comments/:id/reactions', requireAuth as any, (req: AuthRequest, res: Response) => {
  const comment = getCommentById(paramId(req));
  if (!comment) {
    res.status(404).json({ error: 'Yorum bulunamadi.' });
    return;
  }

  const { reactionType } = req.body;
  if (!reactionType || !VALID_REACTIONS.includes(reactionType)) {
    res.status(400).json({ error: 'Gecersiz reaksiyon tipi.' });
    return;
  }

  const result = toggleReaction(req.user!.id, comment.id, reactionType as ReactionType);

  // Notify on like (only when adding, not removing)
  if (reactionType === 'like' && result.added) {
    createNotification(comment.user_id, 'like_on_comment', req.user!.id, comment.topic_id, comment.id);
  }

  const summaries = getReactionSummaries([comment.id]);
  const userReactions = getUserReactions(req.user!.id, [comment.id]);

  res.json({
    ...result,
    reactions: summaries[comment.id],
    userReactions: userReactions[comment.id] || [],
    netLikes: getCommentById(comment.id)!.net_likes,
  });
});

// ─── Notifications ────────────────────────────────────────────────────────────

// GET /notifications/unread-count — auth required
router.get('/notifications/unread-count', requireAuth as any, (req: AuthRequest, res: Response) => {
  const count = getUnreadCount(req.user!.id);
  res.json({ count });
});

// GET /notifications — auth required
router.get('/notifications', requireAuth as any, (req: AuthRequest, res: Response) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
  const { notifications, total } = listNotifications(req.user!.id, limit, offset);

  res.json({
    notifications: notifications.map(n => ({
      id: n.id,
      type: n.type,
      actorUsername: n.actor_username,
      topicId: n.topic_id,
      topicTitle: n.topic_title,
      commentId: n.comment_id,
      isRead: n.is_read === 1,
      createdAt: n.created_at,
    })),
    total,
  });
});

// POST /notifications/:id/read — auth required
router.post('/notifications/:id/read', requireAuth as any, (req: AuthRequest, res: Response) => {
  markAsRead(paramId(req), req.user!.id);
  res.json({ ok: true });
});

// POST /notifications/read-all — auth required
router.post('/notifications/read-all', requireAuth as any, (req: AuthRequest, res: Response) => {
  markAllAsRead(req.user!.id);
  res.json({ ok: true });
});

export default router;
