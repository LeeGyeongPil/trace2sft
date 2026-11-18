import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dedupe } from '../dist/dedupe.js';
import { call, cand, msg } from './helpers.mjs';

const u = msg('user', 'q');
const a = msg('assistant', null, { tool_calls: [call('c1')] });
const t = msg('tool', 'r', { tool_call_id: 'c1' });
const fin = msg('assistant', 'done');

test('prefix within group', () => {
  // finish_reason is a provider extra and must not break the comparison
  const short = cand('short', 'g', [u, { ...a, finish_reason: 'tool_call' }]);
  const long = cand('long', 'g', [u, a, t, fin]);
  const r = dedupe([short, long]);
  assert.deepEqual(r.kept.map((c) => c.source.id), ['long']);
  assert.deepEqual(r.dropped.map((d) => [d.candidate.source.id, d.reason]), [['short', 'prefix_of_longer']]);
});

test('prefix across groups kept', () => {
  const r = dedupe([cand('short', 'g1', [u, a]), cand('long', 'g2', [u, a, t, fin])]);
  assert.equal(r.kept.length, 2);
  assert.equal(r.dropped.length, 0);
});

test('exact duplicate keeps first', () => {
  const r = dedupe([cand('first', 'g1', [u, fin]), cand('second', 'g2', [u, fin])]);
  assert.deepEqual(r.kept.map((c) => c.source.id), ['first']);
  assert.deepEqual(r.dropped.map((d) => [d.candidate.source.id, d.reason]), [['second', 'exact_duplicate']]);
});

test('2000 candidates dedupe quickly', () => {
  const list = [];
  for (let i = 0; i < 2000; i++) list.push(cand(`c${i}`, `g${i % 50}`, [msg('user', `q${i}`), fin]));
  const start = Date.now();
  const r = dedupe(list);
  assert.equal(r.kept.length, 2000);
  assert.ok(Date.now() - start < 5000);
});
