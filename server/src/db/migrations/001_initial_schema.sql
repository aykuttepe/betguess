-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  title TEXT DEFAULT NULL,
  subscription_tier TEXT NOT NULL DEFAULT 'free',
  subscription_expires_at TEXT DEFAULT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Coupons Table
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  week TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_coupons_user_id ON coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_week ON coupons(week);

-- Coupon Shares Table
CREATE TABLE IF NOT EXISTS coupon_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  message TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(coupon_id, sender_id, recipient_id),
  FOREIGN KEY(coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_coupon_shares_recipient ON coupon_shares(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_shares_coupon ON coupon_shares(coupon_id);

-- Friend Requests Table
CREATE TABLE IF NOT EXISTS friend_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL,
  recipient_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now')),
  responded_at TEXT DEFAULT NULL,
  UNIQUE(requester_id, recipient_id),
  FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient ON friend_requests(recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests(requester_id, status, created_at DESC);

-- Friendships Table
CREATE TABLE IF NOT EXISTS friendships (
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY(user_id, friend_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);

-- OTP Codes Table
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  target_key TEXT,
  purpose TEXT DEFAULT 'phone_verification'
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_target_purpose ON otp_codes(target_key, purpose);

-- Forum Topics Table
CREATE TABLE IF NOT EXISTS forum_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_path TEXT DEFAULT NULL,
  is_pinned INTEGER NOT NULL DEFAULT 0,
  is_locked INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  last_comment_at TEXT DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  tags TEXT DEFAULT '[]',
  view_count INTEGER NOT NULL DEFAULT 0,
  net_likes INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_forum_topics_user ON forum_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_topics_pinned ON forum_topics(is_pinned DESC, last_//comment_at DESC);

-- Forum Comments Table
CREATE TABLE IF NOT EXISTS forum_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  parent_id INTEGER DEFAULT NULL,
  body TEXT NOT NULL,
  image_path TEXT DEFAULT NULL,
  net_likes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(parent_id) REFERENCES forum_comments(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_forum_comments_topic ON forum_comments(topic_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_parent ON forum_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_hype ON forum_comments(topic_id, net_likes DESC);

-- Forum Reactions Table
CREATE TABLE IF NOT EXISTS forum_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  comment_id INTEGER NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, comment_id, reaction_type),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(comment_id) REFERENCES forum_comments(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_comment ON forum_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_forum_reactions_user_comment ON forum_reactions(user_id, comment_id);

-- Forum Topic Reactions Table
CREATE TABLE IF NOT EXISTS forum_topic_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic_id INTEGER NOT NULL,
  reaction_type TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, topic_id, reaction_type),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_forum_topic_reactions_topic ON forum_topic_reactions(topic_id);
CREATE INDEX IF NOT EXISTS idx_forum_topic_reactions_user ON forum_topic_reactions(user_id, topic_id);

-- Notifications Table
CREATE TABLE IF NOT EXISTS forum_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  topic_id INTEGER,
  comment_id INTEGER,
  friend_request_id INTEGER,
  coupon_id INTEGER,
  reaction_type TEXT DEFAULT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  FOREIGN KEY(comment_id) REFERENCES forum_comments(id) ON DELETE SET NULL,
  FOREIGN KEY(friend_request_id) REFERENCES friend_requests(id) ON DELETE SET NULL,
  FOREIGN KEY(coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_forum_notif_user ON forum_notifications(user_id, is_read, created_at DESC);

-- App Settings Table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Usage Limits Table
CREATE TABLE IF NOT EXISTS usage_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, action_type, date),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_usage_limits_lookup ON usage_limits(user_id, action_type, date);
