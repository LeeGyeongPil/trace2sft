import assert from 'node:assert/strict';
import { test } from 'node:test';
import { convert, fromRecords, readTraceFiles } from '../dist/index.js';
import { run, tmp, readText, DEMO_INPUTS } from './helpers.mjs';

test('hf arguments are objects', async () => {
  const input = await readTraceFiles(DEMO_INPUTS);
  const openai = convert(input, { format: 'openai' }).train;
  const hf = convert(input, { format: 'hf' }).train;
  const oc = openai[0].messages[1].tool_calls[0];
  const hc = hf[0].messages[1].tool_calls[0];
  assert.equal(oc.function.arguments, '{"a":2,"b":3}');
  assert.equal(typeof hc.function.arguments, 'object');
  assert.deepEqual(hc.function.arguments, { a: 2, b: 3 });
  assert.equal(hf[0].messages[2].role, 'tool');
  assert.equal(hf[0].messages[2].name, 'add');
  assert.equal(openai[0].messages[2].name, undefined);
  assert.ok(Array.isArray(hf[0].tools));
});

test('--format hf writes hf rows from the CLI', () => {
  const out = tmp();
  assert.equal(run(['demo', '--out', out, '--format', 'hf', '--lang', 'en']).code, 0);
  assert.equal(JSON.parse(readText(out, 'train.jsonl').split('\n')[0]).messages[1].tool_calls[0].function.arguments.a, 2);
});

test('gzip and plain Langfuse files give the same result', async () => {
  const gz = await readTraceFiles(['fixtures/langfuse/observations_v2.jsonl.gz']);
  const plain = await readTraceFiles(['fixtures/langfuse/observations_v2.jsonl']);
  const strip = (r) => r.candidates.map((c) => ({ ...c, source: { ...c.source, file: '' } }));
  assert.deepEqual(strip(gz), strip(plain));
});
