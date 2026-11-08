import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { migrateDatabase } from './database';

// Mirrors the schema observed in the production backup; all records are synthetic.
function legacyFixture() {
  const db = new Database(':memory:');
  migrateDatabase(db);
  db.exec(`
    INSERT INTO users (id, email, username, password_hash) VALUES
      (1, 'one@example.com', 'one', 'hash'), (2, 'two@example.com', 'two', 'hash'),
      (3, 'three@example.com', 'three', 'hash');
    DELETE FROM schema_migrations WHERE version = 1;
    DROP TABLE friendships;
    CREATE TABLE friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT, requester_id INTEGER NOT NULL, addressee_id INTEGER NOT NULL,
      user_low_id INTEGER NOT NULL, user_high_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now')),
      responded_at TEXT DEFAULT NULL, updated_at TEXT DEFAULT (datetime('now')),
      CHECK(requester_id <> addressee_id), CHECK(user_low_id < user_high_id),
      CHECK(status IN ('pending', 'accepted')),
      FOREIGN KEY(requester_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(addressee_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(user_low_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(user_high_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX idx_friendships_pair ON friendships(user_low_id, user_high_id);
    INSERT INTO friendships (id, requester_id, addressee_id, user_low_id, user_high_id, status, created_at, responded_at)
      VALUES (7, 1, 2, 1, 2, 'accepted', '2026-01-01', '2026-01-02'),
             (8, 3, 2, 2, 3, 'pending', '2026-02-01', NULL);
  `);
  return db;
}

test('legacy friendship requests retain IDs and accepted pairs become reciprocal edges', () => {
  const db = legacyFixture();
  try {
    db.pragma('foreign_keys = OFF');
    db.exec("INSERT INTO forum_notifications (user_id,type,actor_id,friend_request_id) VALUES (2,'friend_request',3,8)");
    const original = db.prepare('SELECT * FROM friendships ORDER BY id').all();
    migrateDatabase(db);
    assert.deepEqual(db.prepare('SELECT * FROM friendships_legacy ORDER BY id').all(), original);
    assert.deepEqual(db.prepare('SELECT user_id,friend_id,created_at FROM friendships ORDER BY user_id').all(), [
      { user_id: 1, friend_id: 2, created_at: '2026-01-01' },
      { user_id: 2, friend_id: 1, created_at: '2026-01-01' },
    ]);
    assert.deepEqual(db.prepare('SELECT id,requester_id,recipient_id,status,responded_at FROM friend_requests ORDER BY id').all(), [
      { id: 7, requester_id: 1, recipient_id: 2, status: 'accepted', responded_at: '2026-01-02' },
      { id: 8, requester_id: 3, recipient_id: 2, status: 'pending', responded_at: null },
    ]);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
    migrateDatabase(db);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM friendships').get() as { n: number }).n, 2);
  } finally { db.close(); }
});

test('conflicting legacy request IDs abort the upgrade and preserve both datasets', () => {
  const db = legacyFixture();
  try {
    db.exec("INSERT INTO friend_requests (id,requester_id,recipient_id) VALUES (7,1,3)");
    const before = db.prepare('SELECT * FROM friendships ORDER BY id').all();
    assert.throws(() => migrateDatabase(db), /identifiers conflict/);
    assert.deepEqual(db.prepare('SELECT * FROM friendships ORDER BY id').all(), before);
    assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name='friendships_legacy'").get(), undefined);
    assert.equal((db.prepare('SELECT recipient_id FROM friend_requests WHERE id=7').get() as { recipient_id: number }).recipient_id, 3);
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  } finally { db.close(); }
});
