import { getDatabase } from './database';

export interface FriendUser {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface FriendRequestRow {
  id: number;
  requester_id: number;
  recipient_id: number;
  requester_username: string;
  recipient_username: string;
  status: string;
  created_at: string;
  responded_at: string | null;
}

export interface UserSearchResult {
  id: number;
  username: string;
  relationship: 'none' | 'friend' | 'incoming' | 'outgoing' | 'self';
}

export function areFriends(userId: number, friendId: number): boolean {
  const db = getDatabase();
  const row = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?')
    .get(userId, friendId);
  return Boolean(row);
}

export function searchUsersForFriends(userId: number, query: string): UserSearchResult[] {
  const db = getDatabase();
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const rows = db.prepare(`
    SELECT id, username
    FROM users
    WHERE is_active = 1
      AND (username LIKE ? OR email LIKE ?)
    ORDER BY username ASC
    LIMIT 12
  `).all(`%${normalized}%`, `%${normalized.toLowerCase()}%`) as Array<{ id: number; username: string }>;

  return rows.map((row) => {
    if (row.id === userId) {
      return { ...row, relationship: 'self' };
    }

    if (areFriends(userId, row.id)) {
      return { ...row, relationship: 'friend' };
    }

    const outgoing = db.prepare(`
      SELECT 1 FROM friend_requests
      WHERE requester_id = ? AND recipient_id = ? AND status = 'pending'
    `).get(userId, row.id);

    if (outgoing) {
      return { ...row, relationship: 'outgoing' };
    }

    const incoming = db.prepare(`
      SELECT 1 FROM friend_requests
      WHERE requester_id = ? AND recipient_id = ? AND status = 'pending'
    `).get(row.id, userId);

    if (incoming) {
      return { ...row, relationship: 'incoming' };
    }

    return { ...row, relationship: 'none' };
  });
}

export function listFriends(userId: number): FriendUser[] {
  const db = getDatabase();
  return db.prepare(`
    SELECT u.id, u.username, u.email, f.created_at
    FROM friendships f
    INNER JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ?
    ORDER BY u.username ASC
  `).all(userId) as FriendUser[];
}

export function listFriendRequests(userId: number): { incoming: FriendRequestRow[]; outgoing: FriendRequestRow[] } {
  const db = getDatabase();
  const baseSelect = `
    SELECT
      fr.id,
      fr.requester_id,
      fr.recipient_id,
      requester.username AS requester_username,
      recipient.username AS recipient_username,
      fr.status,
      fr.created_at,
      fr.responded_at
    FROM friend_requests fr
    INNER JOIN users requester ON requester.id = fr.requester_id
    INNER JOIN users recipient ON recipient.id = fr.recipient_id
  `;

  const incoming = db.prepare(`
    ${baseSelect}
    WHERE fr.recipient_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(userId) as FriendRequestRow[];

  const outgoing = db.prepare(`
    ${baseSelect}
    WHERE fr.requester_id = ? AND fr.status = 'pending'
    ORDER BY fr.created_at DESC
  `).all(userId) as FriendRequestRow[];

  return { incoming, outgoing };
}

export function sendFriendRequest(requesterId: number, recipientId: number): number {
  if (requesterId === recipientId) {
    throw new Error('Kendinize arkadaslik istegi gonderemezsiniz.');
  }

  if (areFriends(requesterId, recipientId)) {
    throw new Error('Bu kullanici zaten arkadasiniz.');
  }

  const db = getDatabase();
  const incoming = db.prepare(`
    SELECT 1 FROM friend_requests
    WHERE requester_id = ? AND recipient_id = ? AND status = 'pending'
  `).get(recipientId, requesterId);

  if (incoming) {
    throw new Error('Bu kullanicidan zaten gelen bir istek var. Gelen isteklerden kabul edin.');
  }

  db.prepare(`
    INSERT INTO friend_requests (requester_id, recipient_id, status, created_at, responded_at)
    VALUES (?, ?, 'pending', datetime('now'), NULL)
    ON CONFLICT(requester_id, recipient_id) DO UPDATE SET
      status = 'pending',
      created_at = datetime('now'),
      responded_at = NULL
  `).run(requesterId, recipientId);

  const row = db.prepare(`
    SELECT id FROM friend_requests
    WHERE requester_id = ? AND recipient_id = ?
  `).get(requesterId, recipientId) as { id: number };

  return row.id;
}

export function respondToFriendRequest(
  requestId: number,
  recipientId: number,
  action: 'accept' | 'decline',
): { requester_id: number; recipient_id: number } {
  const db = getDatabase();
  const request = db.prepare(`
    SELECT * FROM friend_requests
    WHERE id = ? AND recipient_id = ? AND status = 'pending'
  `).get(requestId, recipientId) as { requester_id: number; recipient_id: number } | undefined;

  if (!request) {
    throw new Error('Arkadaslik istegi bulunamadi.');
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE friend_requests
      SET status = ?, responded_at = datetime('now')
      WHERE id = ?
    `).run(action === 'accept' ? 'accepted' : 'declined', requestId);

    if (action === 'accept') {
      db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)')
        .run(request.requester_id, request.recipient_id);
      db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id) VALUES (?, ?)')
        .run(request.recipient_id, request.requester_id);
    }
  });

  tx();
  return request;
}

export function removeFriend(userId: number, friendId: number): void {
  const db = getDatabase();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(userId, friendId);
    db.prepare('DELETE FROM friendships WHERE user_id = ? AND friend_id = ?').run(friendId, userId);
  });

  tx();
}
