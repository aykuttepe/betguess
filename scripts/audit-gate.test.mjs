import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from './audit-gate.mjs';

const TODAY = '2026-11-08';
const advisory = (id, severity) => ({ url: `https://github.com/advisories/${id}`, severity, title: id });
const report = (vulnerabilities) => ({ vulnerabilities });
const exception = (pkg, advisories, expires = '2027-01-01') => ({ package: pkg, advisories, expires });

test('passes when there are no findings', () => {
  assert.deepEqual(evaluate(report({}), [], TODAY), { failures: [], expired: [], unused: [] });
});

test('fails on an unlisted high or critical advisory', () => {
  const r = report({ a: { via: [advisory('GHSA-1', 'high')] }, b: { via: [advisory('GHSA-2', 'critical')] } });
  assert.deepEqual(evaluate(r, [], TODAY).failures.map((f) => f.id), ['GHSA-1', 'GHSA-2']);
});

test('ignores moderate/low advisories and propagated string entries', () => {
  const r = report({ a: { via: [advisory('GHSA-1', 'moderate'), advisory('GHSA-2', 'low'), 'b'] } });
  assert.equal(evaluate(r, [], TODAY).failures.length, 0);
});

test('accepts a listed advisory only for the same package', () => {
  const r = report({ a: { via: [advisory('GHSA-1', 'high')] }, b: { via: [advisory('GHSA-1', 'high')] } });
  const { failures } = evaluate(r, [exception('a', ['GHSA-1'])], TODAY);
  assert.deepEqual(failures.map((f) => f.pkg), ['b']);
});

test('a new advisory on an excepted package still fails', () => {
  const r = report({ a: { via: [advisory('GHSA-1', 'high'), advisory('GHSA-NEW', 'high')] } });
  assert.deepEqual(evaluate(r, [exception('a', ['GHSA-1'])], TODAY).failures.map((f) => f.id), ['GHSA-NEW']);
});

test('an expired exception fails even when it matches', () => {
  const r = report({ a: { via: [advisory('GHSA-1', 'high')] } });
  const result = evaluate(r, [exception('a', ['GHSA-1'], '2026-11-07')], TODAY);
  assert.equal(result.failures[0].expired, true);
  assert.equal(result.expired.length, 1);
});

test('an exception is valid through its expiry date', () => {
  const r = report({ a: { via: [advisory('GHSA-1', 'high')] } });
  assert.equal(evaluate(r, [exception('a', ['GHSA-1'], TODAY)], TODAY).failures.length, 0);
});

test('reports exceptions that no longer match anything', () => {
  const stale = exception('gone', ['GHSA-9']);
  assert.deepEqual(evaluate(report({}), [stale], TODAY).unused, [stale]);
});
