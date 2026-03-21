export const FORUM_TAGS = [
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

export type ForumTag = typeof FORUM_TAGS[number];

export interface ForumTopic {
  id: number;
  userId: number;
  title: string;
  body: string;
  imagePath: string | null;
  tags: string[];
  isPinned: boolean;
  isLocked: boolean;
  viewCount: number;
  commentCount: number;
  lastCommentAt: string | null;
  createdAt: string;
  updatedAt: string;
  username: string;
  userRole: string;
  userTitle: string | null;
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

export interface ForumComment {
  id: number;
  topicId: number;
  userId: number;
  parentId: number | null;
  body: string;
  imagePath: string | null;
  netLikes: number;
  createdAt: string;
  updatedAt: string;
  username: string;
  userRole: string;
  userTitle: string | null;
  reactions: ReactionSummary;
  userReactions: string[];
}

export interface TopicListResponse {
  topics: ForumTopic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TopicDetailResponse {
  topic: ForumTopic;
  comments: ForumComment[];
}

export interface ReactionResponse {
  added: boolean;
  reactions: ReactionSummary;
  userReactions: string[];
  netLikes: number;
}

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

export type CommentSort = 'hype' | 'newest' | 'oldest';

export type TopicSort = 'active' | 'popular' | 'newest' | 'oldest' | 'most_viewed' | 'most_liked';

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType = 'comment_on_topic' | 'reply_to_comment' | 'like_on_comment';

export interface ForumNotification {
  id: number;
  type: NotificationType;
  actorUsername: string;
  topicId: number;
  topicTitle: string;
  commentId: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: ForumNotification[];
  total: number;
}
