import {
  TopicListResponse,
  TopicDetailResponse,
  ForumTopic,
  ForumComment,
  ReactionResponse,
  ReactionType,
  CommentSort,
  TopicSort,
  UserForumProfile,
  NotificationListResponse,
} from './forum-types';
import { apiFetchJson } from './http';

const BASE = '/api/forum';

async function forumFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  return apiFetchJson<T>(url, options, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

// ─── Topics ───────────────────────────────────────────────────────────────────

export async function apiListTopics(page = 1, limit = 20, search?: string, sort: TopicSort = 'active', tags?: string[], dateRange?: string): Promise<TopicListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
  if (search) params.set('search', search);
  if (tags?.length) params.set('tag', tags.join(','));
  if (dateRange && dateRange !== 'all') params.set('dateRange', dateRange);
  return forumFetch<TopicListResponse>(`${BASE}/topics?${params}`);
}

export async function apiGetTopic(id: number, sort: CommentSort = 'hype'): Promise<TopicDetailResponse> {
  return forumFetch<TopicDetailResponse>(`${BASE}/topics/${id}?sort=${sort}`);
}

export async function apiCreateTopic(title: string, body: string, image?: File, tags?: string[]): Promise<{ topic: ForumTopic }> {
  const fd = new FormData();
  fd.append('title', title);
  fd.append('body', body);
  if (image) fd.append('image', image);
  if (tags && tags.length > 0) fd.append('tags', JSON.stringify(tags));

  return forumFetch<{ topic: ForumTopic }>(`${BASE}/topics`, {
    method: 'POST',
    body: fd,
  });
}

export async function apiUpdateTopic(id: number, title: string, body: string, tags?: string[]): Promise<{ topic: ForumTopic }> {
  return forumFetch<{ topic: ForumTopic }>(`${BASE}/topics/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, body, tags }),
  });
}

export async function apiDeleteTopic(id: number): Promise<void> {
  await forumFetch(`${BASE}/topics/${id}`, { method: 'DELETE' });
}

export async function apiTogglePin(id: number): Promise<{ pinned: boolean }> {
  return forumFetch<{ pinned: boolean }>(`${BASE}/topics/${id}/pin`, { method: 'POST' });
}

export async function apiToggleLock(id: number): Promise<{ locked: boolean }> {
  return forumFetch<{ locked: boolean }>(`${BASE}/topics/${id}/lock`, { method: 'POST' });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function apiCreateComment(topicId: number, body: string, parentId?: number, image?: File): Promise<{ comment: ForumComment }> {
  const fd = new FormData();
  fd.append('body', body);
  if (parentId) fd.append('parentId', String(parentId));
  if (image) fd.append('image', image);

  return forumFetch<{ comment: ForumComment }>(`${BASE}/topics/${topicId}/comments`, {
    method: 'POST',
    body: fd,
  });
}

export async function apiUpdateComment(id: number, body: string): Promise<{ comment: ForumComment }> {
  return forumFetch<{ comment: ForumComment }>(`${BASE}/comments/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ body }),
  });
}

export async function apiDeleteComment(id: number): Promise<void> {
  await forumFetch(`${BASE}/comments/${id}`, { method: 'DELETE' });
}

// ─── User Profile Card ────────────────────────────────────────────────────────

export async function apiGetUserForumProfile(userId: number): Promise<UserForumProfile> {
  const data = await forumFetch<{ profile: UserForumProfile }>(`${BASE}/users/${userId}/profile`);
  return data.profile;
}

// ─── Reactions ────────────────────────────────────────────────────────────────

export async function apiToggleReaction(commentId: number, reactionType: ReactionType): Promise<ReactionResponse> {
  return forumFetch<ReactionResponse>(`${BASE}/comments/${commentId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ reactionType }),
  });
}

export async function apiToggleTopicReaction(topicId: number, reactionType: ReactionType): Promise<ReactionResponse> {
  return forumFetch<ReactionResponse>(`${BASE}/topics/${topicId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ reactionType }),
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function apiGetUnreadCount(): Promise<{ count: number }> {
  return forumFetch<{ count: number }>(`${BASE}/notifications/unread-count`);
}

export async function apiGetNotifications(limit = 50, offset = 0): Promise<NotificationListResponse> {
  return forumFetch<NotificationListResponse>(`${BASE}/notifications?limit=${limit}&offset=${offset}`);
}

export async function apiMarkNotificationRead(id: number): Promise<void> {
  await forumFetch(`${BASE}/notifications/${id}/read`, { method: 'POST' });
}

export async function apiMarkAllNotificationsRead(): Promise<void> {
  await forumFetch(`${BASE}/notifications/read-all`, { method: 'POST' });
}
