'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const Database = require('../server/node_modules/better-sqlite3');
const { promote } = require('./promote-security-patch.cjs');

function fixture(failMigration = false) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'betguess-promotion-test-'));
  const live = path.join(temp, 'live');
  const stage = path.join(temp, 'stage');
  for (const [base, label] of [[live, 'old'], [stage, 'new']]) {
    for (const name of ['server/src', 'server/dist/db', 'server/node_modules', 'server/data', 'client/dist']) {
      fs.mkdirSync(path.join(base, name), { recursive: true });
    }
    fs.writeFileSync(path.join(base, 'server/src/marker'), label);
    fs.writeFileSync(path.join(base, 'server/dist/index.js'), label);
    fs.writeFileSync(path.join(base, 'client/dist/index.html'), label);
    for (const file of ['package.json', 'package-lock.json', 'tsconfig.json']) {
      fs.writeFileSync(path.join(base, 'server', file), '{}');
    }
  }
  for (const dep of ['dotenv', 'better-sqlite3']) {
    fs.symlinkSync(path.resolve(__dirname, '../server/node_modules', dep), path.join(stage, 'server/node_modules', dep), 'dir');
  }
  const secret = randomBytes(32).toString('hex');
  fs.writeFileSync(path.join(live, 'server/.env'), `JWT_SECRET=${secret}\nTRUST_PROXY=127.0.0.1,::1\n`, { mode: 0o600 });
  const dbFile = path.join(live, 'server/data/betguess.db');
  const db = new Database(dbFile);
  db.exec("CREATE TABLE keep (id INTEGER PRIMARY KEY, value TEXT); INSERT INTO keep VALUES (1,'preserved')");
  db.close();
  fs.writeFileSync(path.join(stage, 'server/dist/db/database.js'), `exports.migrateDatabase = db => {
    db.exec('CREATE TABLE patch_test (id INTEGER)');
    ${failMigration ? "throw new Error('Simulated migration failure');" : ''}
  };`);
  const calls = [], logs = [];
  return { live, stage, backupRoot: path.join(temp, 'backups'), dbFile, secret, calls, logs,
    runPm2(args, env) {
      calls.push({ args, env });
      if (args[0] === 'jlist') return JSON.stringify([{ name: 'betguess', pm2_env: {
        status: 'online', pm_exec_path: path.join(live, 'server/dist/index.js'),
      } }]);
      return '';
    },
    checkHealth: async () => {}, log: message => logs.push(message),
    close() { fs.rmSync(temp, { recursive: true, force: true }); },
  };
}

test('check mode does not stop the process or create backups', async () => {
  const f = fixture();
  try {
    await promote(f);
    assert.deepEqual(f.calls.map(c => c.args), [['jlist']]);
    assert.equal(fs.existsSync(f.backupRoot), false);
    assert.equal(fs.readFileSync(path.join(f.live, 'server/dist/index.js'), 'utf8'), 'old');
  } finally { f.close(); }
});

test('successful promotion replaces code, retains data and sends config through environment only', async () => {
  const f = fixture();
  try {
    await promote({ ...f, checkOnly: false });
    assert.equal(fs.readFileSync(path.join(f.live, 'server/dist/index.js'), 'utf8'), 'new');
    assert.equal(fs.readFileSync(path.join(f.live, 'client/dist/index.html'), 'utf8'), 'new');
    const db = new Database(f.dbFile);
    try {
      assert.equal(db.prepare('SELECT value FROM keep').get().value, 'preserved');
      assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='patch_test'").get());
    } finally { db.close(); }
    const restart = f.calls.find(call => call.args[0] === 'restart');
    assert.equal(restart.env.JWT_SECRET, f.secret);
    assert.equal(f.logs.join('\n').includes(f.secret), false);
    const backup = path.join(f.backupRoot, fs.readdirSync(f.backupRoot)[0]);
    assert.ok(fs.existsSync(path.join(backup, 'previous/server/dist/index.js')));
    assert.ok(fs.existsSync(path.join(backup, 'betguess.db')));
  } finally { f.close(); }
});

for (const failure of ['migration', 'health']) {
  test(`${failure} failure restores old code and the pre-migration database`, async () => {
    const f = fixture(failure === 'migration');
    try {
      await assert.rejects(promote({ ...f, checkOnly: false, checkHealth: async () => {
        if (fs.readFileSync(path.join(f.live, 'server/dist/index.js'), 'utf8') === 'new') {
          throw new Error('Simulated health failure');
        }
      } }), /Previous release restored/);
      assert.equal(fs.readFileSync(path.join(f.live, 'server/dist/index.js'), 'utf8'), 'old');
      assert.equal(fs.readFileSync(path.join(f.live, 'client/dist/index.html'), 'utf8'), 'old');
      const db = new Database(f.dbFile);
      try {
        assert.equal(db.prepare('SELECT value FROM keep').get().value, 'preserved');
        assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='patch_test'").get(), undefined);
        assert.equal(db.pragma('integrity_check', { simple: true }), 'ok');
      } finally { db.close(); }
      assert.equal(f.logs.join('\n').includes(f.secret), false);
    } finally { f.close(); }
  });
}
