#!/usr/bin/env node
// Blocking dependency gate (docs/QUALITY-GATES.md, Gate D).
// Usage: node scripts/audit-gate.mjs <server|client>
// Fails on any high/critical production advisory that is not listed, unexpired,
// in security/audit-exceptions.json. Moderate and lower are reported by npm only.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXCEPTIONS_PATH = join(REPO_ROOT, 'security', 'audit-exceptions.json');

const advisoryId = (url) => String(url ?? '').split('/').pop();

/** Pure decision: which blocking advisories are not covered by a valid exception. */
export function evaluate(report, exceptions, today) {
  const failures = [];
  const usedExceptions = new Set();
  const expired = exceptions.filter((e) => e.expires < today);

  for (const [pkg, vuln] of Object.entries(report.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      // String entries only point at another vulnerable package, which is checked on its own.
      if (typeof via === 'string' || !BLOCKING_SEVERITIES.has(via.severity)) continue;
      const id = advisoryId(via.url);
      const match = exceptions.find((e) => e.package === pkg && e.advisories.includes(id));
      if (match && match.expires >= today) {
        usedExceptions.add(match);
        continue;
      }
      failures.push({ pkg, id, severity: via.severity, title: via.title, expired: Boolean(match) });
    }
  }

  const unused = exceptions.filter((e) => !usedExceptions.has(e) && e.expires >= today);
  return { failures, expired, unused };
}

function runAudit(cwd) {
  const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], { cwd, encoding: 'utf8' });
  if (result.error) throw new Error(`npm audit could not start: ${result.error.message}`);
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm audit returned non-JSON output (exit ${result.status}): ${result.stderr.trim()}`);
  }
  // npm reports registry/network problems as {"error": {...}} rather than findings.
  if (report.error) throw new Error(`npm audit failed: ${report.error.summary ?? JSON.stringify(report.error)}`);
  return report;
}

function main(target) {
  if (!['server', 'client'].includes(target)) {
    console.error('Usage: node scripts/audit-gate.mjs <server|client>');
    return 2;
  }
  const exceptions = JSON.parse(readFileSync(EXCEPTIONS_PATH, 'utf8'))[target] ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const { failures, expired, unused } = evaluate(runAudit(join(REPO_ROOT, target)), exceptions, today);

  for (const e of unused) console.log(`::warning::${target}: exception for ${e.package} matched nothing; remove it.`);
  for (const e of expired) console.log(`::error::${target}: exception for ${e.package} expired on ${e.expires}.`);
  for (const f of failures) {
    const why = f.expired ? 'exception expired' : 'not in security/audit-exceptions.json';
    console.log(`::error::${target}: ${f.severity} ${f.pkg} ${f.id} (${why}) — ${f.title}`);
  }

  if (failures.length > 0 || expired.length > 0) return 1;
  console.log(`${target}: no unaccepted high/critical production advisories.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = main(process.argv[2]);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
