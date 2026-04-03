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
      topic_id INTEGER NOT NULL,
      comment_id INTEGER,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
      FOREIGN KEY(comment_id) REFERENCES forum_comments(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_forum_notif_user ON forum_notifications(user_id, is_read, created_at DESC);
  `);

  // Migration: Add reaction_type column to forum_notifications if not exists
  const notifInfo = db.prepare("PRAGMA table_info(forum_notifications)").all() as Array<{ name: string }>;
  if (!notifInfo.some(col => col.name === 'reaction_type')) {
    db.exec(`ALTER TABLE forum_notifications ADD COLUMN reaction_type TEXT DEFAULT NULL`);
    console.log('[Dev] Migrated: Added reaction_type to forum_notifications');
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
