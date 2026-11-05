import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'betguess.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

let db: Database.Database;

/**
 * Ensures the database is initialized and all migrations are applied.
 */
export function initDatabase(): Database.Database {
  if (db) return db;

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    
    // Performance & Integrity Optimizations
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');

    applyMigrations();

    console.log('[DB] SQLite database initialized and migrated:', DB_PATH);
    return db;
  } catch (error) {
    console.error('[DB] Critical error during database initialization:', error);
    throw error;
  }
}

/**
 * Simple migration runner that applies SQL files from the migrations directory.
 */
function applyMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    try {
      db.exec(sql);
    } catch (e) {
      console.error(`[DB] Migration failed in ${file}:`, e);
      // In a production environment, you might want to stop the app here.
    }
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Please call initDatabase() first.');
  }
  return db;
}
