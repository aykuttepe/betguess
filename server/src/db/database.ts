import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { applyLegacySchema } from './legacy-schema';

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'betguess.db');
let db: Database.Database | undefined;

export function migrateDatabase(connection: Database.Database): void {
  // Foreign-key mode must change outside a transaction for legacy table rebuilds.
  connection.pragma('foreign_keys = OFF');
  try {
    connection.transaction(() => {
      connection.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)');
      if (!connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 1').get()) {
        applyLegacySchema(connection);
        connection.prepare('INSERT INTO schema_migrations VALUES (?)').run(1);
      }
      if (!connection.prepare('SELECT 1 FROM schema_migrations WHERE version = 2').get()) {
        connection.exec(`ALTER TABLE otp_codes ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
          CREATE TABLE auth_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);`);
        connection.prepare('INSERT INTO schema_migrations VALUES (?)').run(2);
      }
      if ((connection.pragma('foreign_key_check') as unknown[]).length) {
        throw new Error('Database migration failed foreign_key_check');
      }
    })();
  } finally {
    connection.pragma('foreign_keys = ON');
  }
}

// An explicit filename lets integration tests use the real repositories in isolation.
export function initDatabase(filename = DB_PATH): Database.Database {
  if (db?.open) return db;
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const connection = new Database(filename);
  try {
    connection.pragma('journal_mode = WAL');
    migrateDatabase(connection);
    db = connection;
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}

export function getDatabase(): Database.Database {
  if (!db?.open) throw new Error('Database not initialized. Please call initDatabase() first.');
  return db;
}
