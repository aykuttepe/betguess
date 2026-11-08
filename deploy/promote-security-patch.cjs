'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const serverItems = ['src', 'dist', 'node_modules', 'package.json', 'package-lock.json', 'tsconfig.json'];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function pm2(args, env) {
  return execFileSync('pm2', args, { encoding: 'utf8', env: env || process.env,
    stdio: args[0] === 'jlist' ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
}
async function health() {
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:3002/api/health', { signal: AbortSignal.timeout(2000) });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch {}
    await pause(1000);
  }
  throw new Error('Local health check failed.');
}

async function promote({ live, stage, backupRoot, checkOnly = true, runPm2 = pm2, checkHealth = health, log = console.log }) {
  const liveServer = path.join(live, 'server');
  const stageServer = path.join(stage, 'server');
  let processInfo;
  try {
    processInfo = JSON.parse(runPm2(['jlist'])).find(item => item.name === 'betguess');
  } catch { throw new Error('Cannot read PM2 process metadata.'); }
  if (!processInfo || processInfo.pm2_env.status !== 'online' ||
      processInfo.pm2_env.pm_exec_path !== path.join(liveServer, 'dist/index.js')) {
    throw new Error('PM2 name/status/script does not match the expected live application.');
  }
  for (const base of [liveServer, stageServer]) {
    for (const item of serverItems) {
      if (!fs.existsSync(path.join(base, item))) throw new Error(`Missing artifact: ${base}/${item}`);
    }
  }
  for (const base of [live, stage]) {
    if (!fs.existsSync(path.join(base, 'client/dist/index.html'))) throw new Error('Missing client build.');
  }
  const dotenv = require(path.join(stageServer, 'node_modules/dotenv'));
  const Database = require(path.join(stageServer, 'node_modules/better-sqlite3'));
  const settings = dotenv.parse(fs.readFileSync(path.join(liveServer, '.env')));
  if (!settings.JWT_SECRET || Buffer.byteLength(settings.JWT_SECRET.trim()) < 32 ||
      settings.TRUST_PROXY !== '127.0.0.1,::1') throw new Error('JWT_SECRET/TRUST_PROXY configuration is not ready.');
  const databaseFile = path.join(liveServer, 'data/betguess.db');
  const probe = new Database(databaseFile, { readonly: true, fileMustExist: true });
  probe.close();
  log('Preflight: OK (PM2, artifacts, database, secret length and trusted proxies).');
  if (checkOnly) return;

  fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  const backup = fs.mkdtempSync(path.join(backupRoot, 'publish-'));
  fs.chmodSync(backup, 0o700);
  const candidate = path.join(backup, 'candidate');
  fs.mkdirSync(path.join(candidate, 'server'), { recursive: true });
  fs.mkdirSync(path.join(candidate, 'client'), { recursive: true });
  // Prepare before stopping the service. Do not copy staged test databases or .env.
  for (const item of serverItems) {
    fs.cpSync(path.join(stageServer, item), path.join(candidate, 'server', item), { recursive: true, verbatimSymlinks: true });
  }
  fs.cpSync(path.join(stage, 'client/dist'), path.join(candidate, 'client/dist'), { recursive: true, verbatimSymlinks: true });
  const previous = path.join(backup, 'previous');
  fs.mkdirSync(path.join(previous, 'server'), { recursive: true });
  fs.mkdirSync(path.join(previous, 'client'), { recursive: true });
  fs.copyFileSync(path.join(liveServer, '.env'), path.join(backup, 'release.env'));
  fs.chmodSync(path.join(backup, 'release.env'), 0o600);
  const savedDb = path.join(backup, 'betguess.db');
  const moved = [];
  let stopAttempted = false;
  let databaseBackedUp = false;
  const runtimeEnv = { ...process.env, JWT_SECRET: settings.JWT_SECRET, TRUST_PROXY: settings.TRUST_PROXY };
  const swap = relative => {
    const oldFile = path.join(live, relative);
    const saved = path.join(previous, relative);
    fs.renameSync(oldFile, saved);
    moved.push(relative);
    fs.renameSync(path.join(candidate, relative), oldFile);
  };
  log(`Rollback directory: ${backup}`);
  try {
    stopAttempted = true;
    runPm2(['stop', 'betguess']);
    const source = new Database(databaseFile, { readonly: true, fileMustExist: true });
    try { await source.backup(savedDb); } finally { source.close(); }
    const verification = new Database(savedDb, { readonly: true, fileMustExist: true });
    try {
      if (verification.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Fresh database backup failed integrity check.');
    } finally { verification.close(); }
    databaseBackedUp = true;
    for (const item of serverItems) swap(`server/${item}`);
    swap('client/dist');
    const { migrateDatabase } = require(path.join(liveServer, 'dist/db/database.js'));
    const connection = new Database(databaseFile, { fileMustExist: true });
    try {
      migrateDatabase(connection);
      if (connection.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Migrated database failed integrity check.');
    } finally { connection.close(); }
    runPm2(['restart', 'betguess', '--update-env'], runtimeEnv);
    await checkHealth();
    log('Release: OK. Local health: OK. Previous files and database backup retained.');
  } catch (error) {
    log(`Release failed: ${error.message}. Starting rollback.`);
    try {
      if (stopAttempted) runPm2(['stop', 'betguess']);
      for (const relative of moved.reverse()) {
        const current = path.join(live, relative);
        const failed = path.join(backup, 'failed', relative);
        fs.mkdirSync(path.dirname(failed), { recursive: true });
        if (fs.existsSync(current)) fs.renameSync(current, failed);
        fs.renameSync(path.join(previous, relative), current);
      }
      if (databaseBackedUp) {
        // Restore through SQLite's backup API; never overwrite a live WAL file by copying.
        execFileSync('python3', ['-c',
          'import sqlite3,sys\nfrom pathlib import Path\nwith sqlite3.connect(Path(sys.argv[1]).as_uri()+"?mode=ro",uri=True) as source:\n with sqlite3.connect(sys.argv[2]) as target:\n  source.backup(target)\n  assert target.execute("PRAGMA integrity_check").fetchone()[0] == "ok"', savedDb, databaseFile]);
      }
      if (stopAttempted) {
        runPm2(['restart', 'betguess', '--update-env'], runtimeEnv);
        await checkHealth();
      }
      log('Rollback: OK. Previous release restored.');
    } catch (rollbackError) {
      throw new Error(`Rollback failed: ${rollbackError.message}. Recovery artifacts: ${backup}`);
    }
    throw new Error(`Release not applied. Previous release restored. Recovery artifacts: ${backup}`);
  }
}

module.exports = { promote };
if (require.main === module) {
  const mode = process.argv[2];
  if (!['--check', '--apply'].includes(mode)) {
    console.error('Usage: node promote-security-patch.cjs --check | --apply');
    process.exitCode = 1;
  } else {
    promote({ live: '/home/tepe/betguess', stage: '/home/tepe/betguess-staging/security-proxy-fix',
      backupRoot: '/home/tepe/betguess-backups', checkOnly: mode === '--check' })
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
