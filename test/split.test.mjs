import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convert } from '../dist/index.js';
import { cand, msg, run, tmp, DEMO_INPUTS } from './helpers.mjs';

function synthetic() {
  const list = [];
  for (let g = 0; g < 200; g++) {
    for (let k = 0; k < 2; k++) list.push(cand(`c${g}-${k}`, `group-${g}`, [msg('user', `q ${g} ${k}`), msg('assistant', `a ${g} ${k}`)]));
  }
  return { candidates: list, skipped: 0 };
}

const groupOf = (row) => /q (\d+) /.exec(row.messages[0].content)[1];

test('deterministic', () => {
  const dirs = [tmp(), tmp()];
  for (const d of dirs) assert.equal(run(['convert', ...DEMO_INPUTS, '--out', d, '--valid', '0.3', '--lang', 'en']).code, 0);
  for (const f of ['train.jsonl', 'valid.jsonl', 'report.json']) {
    assert.equal(readFileSync(join(dirs[0], f), 'utf8'), readFileSync(join(dirs[1], f), 'utf8'), f);
  }
});

test('no group leak', () => {
  const r = convert(synthetic(), { valid: 0.2 });
  const trainGroups = new Set(r.train.map(groupOf));
  const validGroups = new Set(r.valid.map(groupOf));
  for (const g of validGroups) assert.ok(!trainGroups.has(g), `group ${g} on both sides`);
  const ratio = r.valid.length / (r.valid.length + r.train.length);
  assert.ok(ratio >= 0.1 && ratio <= 0.3, `ratio ${ratio}`);
});

test('seed changes split', () => {
  const a = convert(synthetic(), { valid: 0.2, seed: 'a' }).valid.map(groupOf).join();
  const b = convert(synthetic(), { valid: 0.2, seed: 'b' }).valid.map(groupOf).join();
  assert.notEqual(a, b);
});
