import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

test('zero runtime deps and pack contents', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.equal(pkg.bin.trace2sft, 'dist/cli.js');
  assert.ok(pkg.engines.node);

  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { encoding: 'utf8' });
  const files = JSON.parse(out)[0].files.map((f) => f.path);
  const expected = ['dist/index.js', 'dist/index.d.ts', 'dist/cli.js', 'LICENSE', 'package.json'];
  // README.md is written at release time; check it as soon as it exists.
  if (existsSync('README.md')) expected.push('README.md');
  for (const f of expected) assert.ok(files.includes(f), `missing ${f}`);
  assert.ok(files.includes('dist/demo/observations_v2.jsonl.gz'), 'demo data must ship for `npx trace2sft demo`');
  assert.ok(!files.some((f) => f.startsWith('fixtures/') || f.startsWith('test/')), 'fixtures/test must not ship');
});
