import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { run, readJson, tmp } from './helpers.mjs';

test('masks kept conversations and counts', () => {
  const out = tmp();
  const r = run(['demo', '--out', out, '--mask', 'fixtures/mask-rules.json', '--lang', 'en']);
  assert.equal(r.code, 0, r.stderr);
  for (const f of readdirSync(out)) {
    const text = readFileSync(join(out, f), 'utf8');
    assert.ok(!text.includes('alice@example.com'), `${f} leaks the email`);
    assert.ok(!text.includes('sk-test-'), `${f} leaks the token`);
  }
  assert.deepEqual(readJson(out, 'report.json').masked, { email: 1, bearer_token: 1 });
  assert.match(readFileSync(join(out, 'train.jsonl'), 'utf8'), /\[EMAIL\]/);
});

test('bad rule exits 2', () => {
  const r = run(['demo', '--out', tmp(), '--mask', 'fixtures/errors/bad-mask-rule.json', '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /E_BAD_MASK_RULE/);
  assert.match(r.stderr, /broken/);
});

test('rules that are not an array or lack fields exit 2', () => {
  const r = run(['demo', '--out', tmp(), '--mask', 'fixtures/langsmith/clean.jsonl', '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /E_BAD_MASK_RULE/);
});
