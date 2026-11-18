import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJson, run, tmp } from './helpers.mjs';

test('demo reproduces documented drop counts', () => {
  const out = tmp();
  const r = run(['demo', '--out', out, '--lang', 'en']);
  assert.equal(r.code, 0, r.stderr);
  const report = readJson(out, 'report.json');
  assert.equal(report.candidates, 11);
  assert.equal(report.kept, 4);
  assert.equal(report.skipped, 2);
  assert.deepEqual(report.dropped, {
    prefix_of_longer: 2,
    exact_duplicate: 1,
    no_assistant: 1,
    orphan_tool_result: 1,
    missing_tool_result: 1,
    unsupported_part: 1,
  });
  assert.ok(report.warnings.includes('fewer_than_10_examples'));
  assert.match(r.stdout, /kept 4/);
  for (const reason of Object.keys(report.dropped)) {
    assert.match(r.stdout, new RegExp(`^ +${reason} +\\d`, 'm'), reason);
  }
});
