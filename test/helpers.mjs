import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CLI = 'dist/cli.js';
export const DEMO_INPUTS = [
  'fixtures/langfuse/observations_v2.jsonl.gz',
  'fixtures/langsmith/runs.jsonl',
  'fixtures/otlp/chat-spans.json',
];

export const tmp = () => mkdtempSync(join(tmpdir(), 't2s-'));

/** Run the built CLI with a clean environment (no inherited LANG). */
export function run(args, env = {}) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, ...env },
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

export const readJson = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));
export const readText = (dir, file) => readFileSync(join(dir, file), 'utf8');

export const msg = (role, content, extra = {}) => ({ role, content, ...extra });
export const call = (id, name = 'f', args = '{}') => ({ id, type: 'function', function: { name, arguments: args } });
export const cand = (id, group, messages) => ({ source: { file: 'mem', id, dialect: 'langsmith' }, group, messages });
