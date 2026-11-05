import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'betguess.db');

let db: Database.Database;

export function initDatabase(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
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

    CREATE TABLE IF NOT EXISTS friendships (
      user_id INTEGER NOT NULL,
      friend_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(user_id, friend_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(friend_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);
  `);

  // Migration: Add phone_number and phone_verified if they don't exist
  const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const hasPhone = tableInfo.some(col => col.name === 'phone_number');
  const hasPhoneVerified = tableInfo.some(col => col.name === 'phone_verified');

  if (!hasPhone) {
    db.exec(`ALTER TABLE users ADD COLUMN phone_number TEXT`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number)`);
    console.log('[Dev] Migrated: Added phone_number to users');
  }
  if (!hasPhoneVerified) {
    db.exec(`ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0`);
    console.log('[Dev] Migrated: Added phone_verified to users');
  }

  db.exec(`DROP INDEX IF EXISTS idx_users_phone`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone_number);
  `);

  const otpTableInfo = db.prepare("PRAGMA table_info(otp_codes)").all() as Array<{ name: string }>;
  const hasTargetKey = otpTableInfo.some(col => col.name === 'target_key');
  const hasPurpose = otpTableInfo.some(col => col.name === 'purpose');

  if (!hasTargetKey) {
    db.exec(`ALTER TABLE otp_codes ADD COLUMN target_key TEXT`);
    db.exec(`UPDATE otp_codes SET target_key = phone_number WHERE target_key IS NULL`);
  }

  if (!hasPurpose) {
    db.exec(`ALTER TABLE otp_codes ADD COLUMN purpose TEXT DEFAULT 'phone_verification'`);
    db.exec(`UPDATE otp_codes SET purpose = 'phone_verification' WHERE purpose IS NULL`);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_otp_target_purpose ON otp_codes(target_key, purpose)`);

  // ─── Forum tables ───────────────────────────────────────────────────────────
  db.exec(`
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
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_forum_topics_user ON forum_topics(user_id);
    CREATE INDEX IF NOT EXISTS idx_forum_topics_pinned ON forum_topics(is_pinned DESC, last_comment_at DESC);

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
  `);

  // Migration: Add tags column to forum_topics if not exists
  const topicInfo = db.prepare("PRAGMA table_info(forum_topics)").all() as Array<{ name: string }>;
  if (!topicInfo.some(col => col.name === 'tags')) {
    db.exec(`ALTER TABLE forum_topics ADD COLUMN tags TEXT DEFAULT '[]'`);
    console.log('[Dev] Migrated: Added tags to forum_topics');
  }

  // Migration: Add view_count column to forum_topics if not exists
  if (!topicInfo.some(col => col.name === 'view_count')) {
    db.exec(`ALTER TABLE forum_topics ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0`);
    console.log('[Dev] Migrated: Added view_count to forum_topics');
  }

  // Migration: Add net_likes to forum_topics if not exists
  if (!topicInfo.some(col => col.name === 'net_likes')) {
    db.exec(`ALTER TABLE forum_topics ADD COLUMN net_likes INTEGER NOT NULL DEFAULT 0`);
    console.log('[Dev] Migrated: Added net_likes to forum_topics');
  }

  // Topic reactions table
  db.exec(`
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
  `);

  // ─── Notifications table ─────────────────────────────────────────────────────
  db.exec(`
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
  `);

  // Migration: make notifications generic enough for forum, friend, and coupon events.
  const notifInfo = db.prepare("PRAGMA table_info(forum_notifications)").all() as Array<{ name: string; notnull: number }>;
  const topicColumn = notifInfo.find(col => col.name === 'topic_id');
  const hasReactionType = notifInfo.some(col => col.name === 'reaction_type');
  const needsGenericNotificationMigration =
    topicColumn?.notnull === 1 ||
    !notifInfo.some(col => col.name === 'friend_request_id') ||
    !notifInfo.some(col => col.name === 'coupon_id') ||
    !hasReactionType;

  if (needsGenericNotificationMigration) {
    const reactionSelect = hasReactionType ? 'reaction_type' : 'NULL AS reaction_type';
    db.exec(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE IF NOT EXISTS forum_notifications_next (
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

      INSERT INTO forum_notifications_next (
        id, user_id, type, actor_id, topic_id, comment_id, reaction_type, is_read, created_at
      )
      SELECT id, user_id, type, actor_id, topic_id, comment_id, ${reactionSelect}, is_read, created_at
      FROM forum_notifications;

      DROP TABLE forum_notifications;
      ALTER TABLE forum_notifications_next RENAME TO forum_notifications;
      CREATE INDEX IF NOT EXISTS idx_forum_notif_user ON forum_notifications(user_id, is_read, created_at DESC);

      PRAGMA foreign_keys = ON;
    `);
    console.log('[Dev] Migrated: Generalized forum_notifications table');
  }

  // ─── App settings table (key-value runtime config) ─────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Default: subscription system OFF (for launch / tanıtım period)
  db.exec(`INSERT OR IGNORE INTO app_settings (key, value) VALUES ('subscription_system_active', '0')`);

  // ─── Usage limits table (subscription tier daily quotas) ──────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, action_type, date),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_usage_limits_lookup
      ON usage_limits(user_id, action_type, date);
  `);

  console.log('[DB] SQLite veritabani hazir:', DB_PATH);
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Veritabani henuz baslatilmadi. Once initDatabase() cagirin.');
  }
  return db;
}
