import { getDatabase } from './database';

/**
 * Simple key-value settings store for runtime configuration.
 */

export function getSetting(key: string): string | null {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO app_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

// ─── Subscription System Toggle ─────────────────────────────────────────────

const SUBSCRIPTION_ACTIVE_KEY = 'subscription_system_active';

export function isSubscriptionSystemActive(): boolean {
  const val = getSetting(SUBSCRIPTION_ACTIVE_KEY);
  return val === '1';
}

export function setSubscriptionSystemActive(active: boolean): void {
  setSetting(SUBSCRIPTION_ACTIVE_KEY, active ? '1' : '0');
}
