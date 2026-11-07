import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as database from '../db/database';
import { saveOtp, verifyOtp, createUser, findById } from '../db/user-repository';
import { setSubscriptionSystemActive } from '../db/settings-repository';
import { requireUsageLimit } from '../middleware/usage-limit';
import { authRateLimit, userRateLimit } from '../middleware/auth-rate-limit';
import { kolonCountLimit } from '../routes/kolons';
import { MAX_KOLON_COUNT, validateKolonInputs } from '../services/kolon-generation';
import { effectiveTier } from './subscription-policy';
import { allowedOrigins, corsPolicy } from './cors-policy';
import { AuthUser, AuthRequest } from './types';
import { Response } from 'express';
import express from 'express';
import { trustedProxyAddresses } from './proxy-policy';

function fixture() {
  const db = database.initDatabase(':memory:');
  const row = createUser('test@example.com', 'testuser', 'old-password-hash');
  const user: AuthUser = { id: row.id, email: row.email, username: row.username, role: 'user', title: null,
    subscriptionTier: 'free', subscriptionExpiresAt: null, isActive: true, phoneNumber: null, phoneVerified: false };
  return { db, user, close() { db.close(); } };
}

// Free-tier user without a database, for pure policy checks.
function f0(): AuthUser {
  return { id: 1, email: 'free@example.com', username: 'free', role: 'user', title: null,
    subscriptionTier: 'free', subscriptionExpiresAt: null, isActive: true, phoneNumber: null, phoneVerified: false };
}

function response() {
  const res = Object.assign(new EventEmitter(), {
    statusCode: 200, writableFinished: false, body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    setHeader(_key: string, _value: string) {},
    cookie(_name: string, _value: string, _options: unknown) {},
    clearCookie(_name: string, _options: unknown) {},
  });
  return res;
}

// Runs every layer of a real auth route (middleware + handler) until one stops calling next().
async function runAuthRoute(method: string, path: string, req: Partial<AuthRequest>) {
  process.env.JWT_SECRET ??= randomBytes(32).toString('hex'); // auth-service validates it on import
  const { default: router } = await import('../routes/auth');
  const route = router.stack.find((layer: any) => layer.route?.path === path && layer.route.methods[method])!.route!;
  const res = response();
  for (const layer of route.stack) {
    let advanced = false;
    await layer.handle(req as AuthRequest, res as unknown as Response, () => { advanced = true; });
    if (!advanced) break;
  }
  return res;
}

function proxyRequest(app: ReturnType<typeof express>, peer: string, forwardedFor?: string): AuthRequest {
  const req = Object.create(app.request) as AuthRequest;
  Object.assign(req, { app, socket: { remoteAddress: peer }, connection: { remoteAddress: peer },
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {} });
  return req;
}

test('proxy trust requires explicit addresses and ignores spoofed forwarding headers', () => {
  assert.equal(trustedProxyAddresses(''), false);
  for (const value of ['true', '1', '0.0.0.0/0', '::/0', 'invalid', '127.0.0.1/33', '127.0.0.1,']) {
    assert.throws(() => trustedProxyAddresses(value));
  }
  const app = express();
  app.set('trust proxy', trustedProxyAddresses('127.0.0.1,::1'));
  assert.equal(proxyRequest(app, '127.0.0.1', '198.51.100.10').ip, '198.51.100.10');
  assert.equal(proxyRequest(app, '::ffff:127.0.0.1', '198.51.100.11').ip, '198.51.100.11');
  assert.equal(proxyRequest(app, '127.0.0.1', '203.0.113.99, 198.51.100.10').ip, '198.51.100.10');
  assert.equal(proxyRequest(app, '198.51.100.10', '203.0.113.99').ip, '198.51.100.10');
  assert.equal(proxyRequest(app, '127.0.0.1').ip, '127.0.0.1');
  app.set('trust proxy', false);
  assert.equal(proxyRequest(app, '127.0.0.1', '198.51.100.10').ip, '127.0.0.1');
});

test('clients behind the same trusted proxy have separate IP rate-limit buckets', () => {
  const f = fixture();
  try {
    const app = express();
    app.set('trust proxy', trustedProxyAddresses('127.0.0.1'));
    const middleware = authRateLimit('proxy-reset', 5);
    let calls = 0;
    const send = (peer: string, forwarded: string, email: string) => {
      const req = proxyRequest(app, peer, forwarded);
      req.body = { email };
      const res = response();
      middleware(req, res as unknown as Response, () => { calls++; });
      return res.statusCode;
    };
    for (let i = 0; i < 30; i++) {
      assert.equal(send('127.0.0.1', '198.51.100.10', `a${i}@example.com`), 200);
    }
    assert.equal(send('127.0.0.1', '198.51.100.10', 'blocked@example.com'), 429);
    assert.equal(send('127.0.0.1', '198.51.100.11', 'other@example.com'), 200);
    // An external caller cannot reset its bucket by changing X-Forwarded-For.
    assert.equal(send('198.51.100.10', '203.0.113.99', 'spoof@example.com'), 429);
    assert.equal(calls, 31);
  } finally { f.close(); }
});

test('fresh schema, defaults and repeat migration are valid', () => {
  const db = new Database(':memory:');
  database.migrateDatabase(db);
  database.migrateDatabase(db);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  assert.equal((db.prepare('SELECT value FROM app_settings').get() as {value: string}).value, '0');
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get() as {n: number}).n, 2);
  db.close();
});

test('legacy user and OTP schema upgrade preserves records', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, username TEXT, password_hash TEXT,
    role TEXT DEFAULT 'user', title TEXT, subscription_tier TEXT DEFAULT 'free', subscription_expires_at TEXT,
    is_active INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT);
    INSERT INTO users (id,email,username,password_hash) VALUES (1,'a@b.c','legacy','hash');
    CREATE TABLE otp_codes (id INTEGER PRIMARY KEY, phone_number TEXT, code TEXT, expires_at TEXT, created_at TEXT);
    INSERT INTO otp_codes VALUES (1,'905551234567','123456','2099-01-01',NULL);`);
  database.migrateDatabase(db);
  assert.equal((db.prepare('SELECT username FROM users').get() as {username: string}).username, 'legacy');
  assert.equal((db.prepare('SELECT target_key FROM otp_codes').get() as {target_key: string}).target_key, '905551234567');
  db.close();
});

test('migration failure rolls back all schema changes and restores foreign keys', () => {
  const db = new Database(':memory:');
  db.exec('CREATE TABLE otp_codes (id INTEGER PRIMARY KEY)');
  assert.throws(() => database.migrateDatabase(db));
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='users'").get(), undefined);
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
  db.close();
});

test('OTP allows five attempts, consumes success and isolates purposes', () => {
  const f = fixture();
  try {
    saveOtp('account', '123456', 5, 'password_reset');
    for (let i = 0; i < 5; i++) assert.equal(verifyOtp('account', '000000', 'password_reset'), false);
    assert.equal(verifyOtp('account', '123456', 'password_reset'), false);
    saveOtp('account', '123456', 5, 'password_reset');
    assert.equal(verifyOtp('account', '123456', 'phone_verification'), false);
    assert.equal(verifyOtp('account', '123456', 'password_reset'), true);
    assert.equal(verifyOtp('account', '123456', 'password_reset'), false);
  } finally { f.close(); }
});

test('JWT token kinds, signature checks, password revocation and legacy rejection', async () => {
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const auth = await import('./auth-service');
  const f = fixture();
  try {
    const tokens = auth.generateTokens(f.user);
    assert.equal(auth.verifyAccessToken(tokens.accessToken).userId, f.user.id);
    assert.equal(auth.verifyRefreshToken(tokens.refreshToken).userId, f.user.id);
    assert.throws(() => auth.verifyAccessToken(jwt.sign({ userId: f.user.id }, process.env.JWT_SECRET!)));
    assert.throws(() => auth.verifyAccessToken(jwt.sign({ userId: f.user.id, type: 'access' }, 'different-secret')));
    assert.throws(() => auth.verifyAccessToken(tokens.refreshToken));
    assert.throws(() => auth.verifyRefreshToken(tokens.accessToken));
    f.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run('new-password-hash', f.user.id);
    assert.throws(() => auth.verifyAccessToken(tokens.accessToken));
    assert.throws(() => auth.verifyRefreshToken(tokens.refreshToken));
    assert.ok(findById(f.user.id));
  } finally { f.close(); }
});

test('JWT secret is mandatory at startup', () => {
  // The subprocess must register the same TS loader when this suite runs via tsx.
  const args = ['--import', 'tsx', '-e', `require(${JSON.stringify(require.resolve('./auth-service'))})`];
  for (const secret of ['', 'too-short']) {
    const result = spawnSync(process.execPath, args,
      { env: { ...process.env, JWT_SECRET: secret }, encoding: 'utf8', timeout: 10000 });
    assert.ifError(result.error);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /JWT_SECRET must contain at least 32 bytes/);
  }
  const valid = spawnSync(process.execPath, args,
    { env: { ...process.env, JWT_SECRET: randomBytes(32).toString('hex') }, encoding: 'utf8', timeout: 10000 });
  assert.ifError(valid.error);
  assert.equal(valid.status, 0, valid.stderr);
});

test('expired or malformed paid subscriptions use free tier', () => {
  for (const value of ['2000-01-01 00:00:00', '2000-01-01T00:00:00Z', 'bad-date']) {
    assert.equal(effectiveTier({ subscriptionTier: 'premium', subscriptionExpiresAt: value }), 'free');
  }
  assert.equal(effectiveTier({ subscriptionTier: 'pro', subscriptionExpiresAt: '2099-01-01T00:00:00+03:00' }), 'pro');
});

test('failed responses refund quota, parallel requests reserve the last slot', () => {
  const f = fixture();
  try {
    setSubscriptionSystemActive(true);
    const middleware = requireUsageLimit('test', { free: 1, pro: 2, premium: -1 });
    const req = { user: f.user } as AuthRequest;
    const first = response(); let calls = 0;
    middleware(req, first as unknown as Response, () => { calls++; });
    const blocked = response();
    middleware(req, blocked as unknown as Response, () => { calls++; });
    assert.equal(calls, 1); assert.equal(blocked.statusCode, 429);
    first.statusCode = 400; first.emit('finish'); first.emit('close');
    const retry = response();
    middleware(req, retry as unknown as Response, () => { calls++; });
    assert.equal(calls, 2);
    retry.writableFinished = true; retry.emit('finish'); retry.emit('close');
    const next = response(); middleware(req, next as unknown as Response, () => { calls++; });
    assert.equal(next.statusCode, 429);
    setSubscriptionSystemActive(false);
    middleware(req, response() as unknown as Response, () => { calls++; });
    assert.equal(calls, 3);
  } finally { f.close(); }
});

test('account reset rate limit survives different client IPs', () => {
  const f = fixture();
  try {
    const middleware = authRateLimit('reset', 5); let calls = 0;
    for (let i = 0; i < 6; i++) {
      const res = response();
      middleware({ body: { email: 'TEST@example.com' }, ip: `ip-${i}` } as AuthRequest,
        res as unknown as Response, () => { calls++; });
      assert.equal(res.statusCode, i === 5 ? 429 : 200);
    }
    assert.equal(calls, 5);
  } finally { f.close(); }
});

test('per-user rate limit ignores IP, isolates users and applies to admins', () => {
  const f = fixture();
  try {
    const middleware = userRateLimit('kolon-test', 3, 60 * 1000); let calls = 0;
    const admin = { ...f.user, role: 'admin' as const };
    for (let i = 0; i < 4; i++) {
      const res = response();
      middleware({ user: admin, ip: `ip-${i}` } as AuthRequest, res as unknown as Response, () => { calls++; });
      assert.equal(res.statusCode, i === 3 ? 429 : 200);
    }
    const other = response();
    middleware({ user: { ...f.user, id: f.user.id + 1 } } as AuthRequest, other as unknown as Response, () => { calls++; });
    assert.equal(other.statusCode, 200);
    const anonymous = response();
    middleware({} as AuthRequest, anonymous as unknown as Response, () => { calls++; });
    assert.equal(anonymous.statusCode, 401);
    assert.equal(calls, 4);
  } finally { f.close(); }
});

test('login: 10 failures per account across IPs, cleared by a successful login', async () => {
  const f = fixture();
  try {
    f.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash('right-password', 4), f.user.id);
    let ip = 0;
    const attempt = (password: string) => runAuthRoute('post', '/login',
      { body: { email: 'Test@Example.com ', password }, ip: `198.51.100.${ip++}` });
    for (let i = 0; i < 9; i++) assert.equal((await attempt('wrong')).statusCode, 401);
    assert.equal((await attempt('right-password')).statusCode, 200);
    for (let i = 0; i < 10; i++) assert.equal((await attempt('wrong')).statusCode, 401);
    const blocked = await attempt('right-password');
    assert.equal(blocked.statusCode, 429);
  } finally { f.close(); }
});

test('login and register are capped per IP', async () => {
  const f = fixture();
  try {
    for (let i = 0; i < 31; i++) {
      const res = await runAuthRoute('post', '/login', { body: { email: `user${i}@example.com`, password: 'x' }, ip: '203.0.113.5' });
      assert.equal(res.statusCode, i === 30 ? 429 : 401);
    }
    for (let i = 0; i < 11; i++) {
      const res = await runAuthRoute('post', '/register', { body: { email: `new${i}@example.com` }, ip: '203.0.113.6' });
      assert.equal(res.statusCode, i === 10 ? 429 : 400);
    }
  } finally { f.close(); }
});

test('OTP sends are capped at 3 per user across send paths; profile saves without a phone change are not', async () => {
  const f = fixture();
  try {
    const auth = await import('./auth-service');
    const cookies = { access_token: auth.generateTokens(f.user).accessToken };
    const statuses = [
      (await runAuthRoute('post', '/send-verification-otp', { cookies, body: {} })).statusCode,
      (await runAuthRoute('post', '/update-phone', { cookies, body: { phoneNumber: '1' } })).statusCode,
      (await runAuthRoute('patch', '/profile', { cookies, body: { phoneNumber: '05551234567' } })).statusCode,
      (await runAuthRoute('post', '/send-verification-otp', { cookies, body: {} })).statusCode,
    ];
    assert.deepEqual(statuses.map(status => status === 429), [false, false, false, true]);
    const usernameOnly = await runAuthRoute('patch', '/profile', { cookies, body: { username: 'renamed' } });
    assert.notEqual(usernameOnly.statusCode, 429);
  } finally { f.close(); }
});

test('kolon count limit: free capped at 10,000; trial mode and admins use the technical ceiling', () => {
  const pro = { ...f0(), subscriptionTier: 'pro' as const };
  assert.equal(kolonCountLimit(f0(), true), 10000);
  assert.equal(kolonCountLimit(pro, true), 50000);
  assert.equal(kolonCountLimit({ ...pro, subscriptionExpiresAt: '2000-01-01T00:00:00Z' }, true), 10000);
  assert.equal(kolonCountLimit({ ...f0(), role: 'admin' }, true), MAX_KOLON_COUNT);
  assert.equal(kolonCountLimit(f0(), false), MAX_KOLON_COUNT);
  // 3^9 = 19,683 exceeds the free cap; 3^8 = 6,561 fits.
  const picks = (n: number) => Array.from({ length: n }, (_, i) => ({ matchNumber: i + 1, outcomes: ['1', 'X', '2'] }));
  assert.throws(() => validateKolonInputs(picks(9), kolonCountLimit(f0(), true)));
  assert.equal(validateKolonInputs(picks(8), kolonCountLimit(f0(), true)).length, 8);
});

test('CORS permits only exact configured origins', () => {
  const origins = allowedOrigins('https://betguess.mytepeapi.com.tr');
  const policy = corsPolicy(origins);
  assert.equal(typeof policy.origin, 'function');
  if (typeof policy.origin === 'function') {
    for (const origin of ['https://evil.test', 'https://betguess.mytepeapi.com.tr.evil.test', undefined]) {
      policy.origin(origin, (_err, allowed) => assert.equal(allowed, false));
    }
    policy.origin('https://betguess.mytepeapi.com.tr', (_err, allowed) => assert.equal(allowed, true));
  }
});

test('subscription middleware honors global toggle and expired tiers', async () => {
  const { requireSubscription } = await import('./auth-middleware');
  const { generateTokens } = await import('./auth-service');
  const f = fixture();
  try {
    f.db.prepare("UPDATE users SET subscription_tier = 'premium', subscription_expires_at = '2000-01-01' WHERE id = ?").run(f.user.id);
    const req = { cookies: { access_token: generateTokens(f.user).accessToken } } as unknown as AuthRequest;
    const middleware = requireSubscription('pro'); let calls = 0;
    setSubscriptionSystemActive(false);
    middleware(req, response() as unknown as Response, () => { calls++; });
    assert.equal(calls, 1);
    setSubscriptionSystemActive(true);
    const denied = response();
    middleware(req, denied as unknown as Response, () => { calls++; });
    assert.equal(calls, 1); assert.equal(denied.statusCode, 403);
  } finally { f.close(); }
});

test('reset route rejects short passwords without consuming OTP and revokes sessions after success', async () => {
  const { default: router } = await import('../routes/auth');
  const auth = await import('./auth-service');
  const f = fixture();
  try {
    f.db.prepare('UPDATE users SET phone_number = ? WHERE id = ?').run('905551234567', f.user.id);
    const oldTokens = auth.generateTokens(f.user);
    const key = 'password_reset:test@example.com:905551234567';
    saveOtp(key, '123456', 5, 'password_reset');
    const route = router.stack.find((layer: any) => layer.route?.path === '/reset-password')!.route;
    assert.ok(route);
    const handler = route.stack[route.stack.length - 1].handle;
    const req = { body: { email: f.user.email, phoneNumber: '05551234567', code: '123456', newPassword: 'abc' } } as unknown as AuthRequest;
    const short = response();
    await handler(req, short as unknown as Response, () => {});
    assert.equal(short.statusCode, 400);
    assert.equal((f.db.prepare('SELECT attempts FROM otp_codes').get() as {attempts: number}).attempts, 0);
    req.body.newPassword = 'correct-new-password';
    const success = response();
    await handler(req, success as unknown as Response, () => {});
    assert.equal(success.statusCode, 200);
    assert.equal(f.db.prepare('SELECT id FROM otp_codes').get(), undefined);
    assert.throws(() => auth.verifyAccessToken(oldTokens.accessToken));
    assert.throws(() => auth.verifyRefreshToken(oldTokens.refreshToken));
  } finally { f.close(); }
});
