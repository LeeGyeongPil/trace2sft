import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { run, tmp, DEMO_INPUTS } from './helpers.mjs';

test('error exit codes', () => {
  let r = run(['convert', 'fixtures/errors/langfuse-no-io.jsonl', '--out', tmp(), '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /E_NO_IO_FIELDS/);
  assert.match(r.stderr, /"io"/);

  r = run(['convert', 'fixtures/errors/unknown.json', '--out', tmp(), '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /E_UNKNOWN_DIALECT/);

  r = run(['convert', 'fixtures/errors/broken.jsonl', '--out', tmp(), '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /E_INPUT_PARSE/);
  assert.match(r.stderr, /broken\.jsonl/);
  assert.match(r.stderr, /line 2/);
});

test('strict exit code', () => {
  let r = run(['convert', ...DEMO_INPUTS, '--out', tmp(), '--strict', '--lang', 'en']);
  assert.equal(r.code, 1);
  assert.match(r.stdout, /strict: 4/);
  r = run(['convert', 'fixtures/langsmith/clean.jsonl', '--out', tmp(), '--strict', '--lang', 'en']);
  assert.equal(r.code, 0, r.stderr);
});

test('usage errors exit 2 with a fix hint', () => {
  let r = run(['convert', '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /E_USAGE.*at least one input/);
  r = run(['convert', 'x.jsonl', '--valid', '0.9', '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /--valid/);
  r = run(['bogus', '--lang', 'en']);
  assert.equal(r.code, 2);
  r = run(['convert', 'fixtures/nope.jsonl', '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /cannot read/);
  r = run(['convert', '--nope', '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /E_USAGE/);
});

test('--version prints the package version', () => {
  const r = run(['--version']);
  assert.equal(r.code, 0);
  assert.match(r.stdout, /^\d+\.\d+\.\d+/);
});

test('--max-chars and --from', () => {
  const out = tmp();
  const r = run(['convert', 'fixtures/langsmith/clean.jsonl', '--from', 'langsmith', '--max-chars', '10', '--out', out, '--lang', 'en']);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /too_long/);
});

test('empty or mismatched input fails with E_NO_CANDIDATES (also with --strict)', () => {
  const dir = tmp();
  const empty = join(dir, 'empty.jsonl');
  writeFileSync(empty, '');
  for (const extra of [[], ['--strict']]) {
    const r = run(['convert', empty, '--out', join(dir, 'o'), '--lang', 'en', ...extra]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /E_NO_CANDIDATES/);
    assert.match(r.stderr, /empty\.jsonl/);
  }
  let r = run(['convert', 'fixtures/langsmith/runs.jsonl', '--from', 'otlp', '--out', join(dir, 'o'), '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /E_NO_CANDIDATES/);
  r = run(['convert', empty, '--out', join(dir, 'o'), '--lang', 'ko']);
  assert.match(r.stderr, /모델 호출 기록을 찾지 못했습니다/);
  // one empty file next to a good one: warn, still succeed
  r = run(['convert', empty, 'fixtures/langsmith/clean.jsonl', '--out', join(dir, 'o2'), '--lang', 'en']);
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stderr, /empty\.jsonl: the file is empty/);
});

test('missing mask file and truncated .json report the real problem', () => {
  const dir = tmp();
  let r = run(['demo', '--mask', 'nope.json', '--out', dir, '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /E_USAGE.*cannot read mask rules file nope\.json/);
  assert.doesNotMatch(r.stderr, /E_BAD_MASK_RULE/);
  const bad = join(dir, 'trunc.json');
  writeFileSync(bad, '{\n  "resourceSpans": [\n');
  r = run(['convert', bad, '--out', dir, '--lang', 'en']);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /E_INPUT_PARSE.*trunc\.json: not valid JSON/);
  assert.doesNotMatch(r.stderr, /Each line/);
});

test('parseArgs errors follow --lang over the environment', () => {
  const ko = { LANG: 'ko_KR.UTF-8' };
  const en = { LANG: 'en_US.UTF-8' };
  let r = run(['convert', 'x.jsonl', '--bogus', '--lang', 'en'], ko);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /^error \[E_USAGE\]: Unknown option '--bogus'/);
  assert.match(r.stderr, /Run trace2sft --help\.\n$/);

  r = run(['convert', 'x.jsonl', '--max-chars', '-5', '--lang=en'], ko);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /^error \[E_USAGE\]: Option '--max-chars' argument is ambiguous/);
  assert.doesNotMatch(r.stderr, /\.\./);
  assert.match(r.stderr, /Run trace2sft --help\.\n$/);

  r = run(['convert', 'x.jsonl', '--bogus', '--lang', 'ko'], en);
  assert.equal(r.code, 2);
  assert.match(r.stderr, /^오류 \[E_USAGE\]: /);
  assert.match(r.stderr, /trace2sft --help 를 실행해 보세요\.\n$/);

  // Without --lang the environment still decides.
  r = run(['convert', 'x.jsonl', '--bogus'], ko);
  assert.match(r.stderr, /^오류 /);
});
