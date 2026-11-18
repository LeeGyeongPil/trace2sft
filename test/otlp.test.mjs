import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { convert, readTraceFiles } from '../dist/index.js';

const COMMITTED = 'fixtures/otlp/chat-spans.json';
const REGENERATED = '.cache/chat-spans.regenerated.json';

const spansOf = (path) =>
  JSON.parse(readFileSync(path, 'utf8')).resourceSpans.flatMap((r) => r.scopeSpans.flatMap((s) => s.spans));

async function counts(path) {
  return convert(await readTraceFiles([path], { from: 'otlp' })).report;
}

test('committed fixture parses', async () => {
  assert.equal(spansOf(COMMITTED).length, 3);
  const r = await counts(COMMITTED);
  assert.equal(r.kept, 1);
  assert.deepEqual(r.dropped, { unsupported_part: 1, prefix_of_longer: 1 });
});

// Runs only after `npm run gen:otlp` has produced the regenerated file.
test('regenerated fixture matches committed', { skip: !existsSync(REGENERATED) }, async () => {
  const a = spansOf(COMMITTED);
  const b = spansOf(REGENERATED);
  assert.equal(b.length, a.length);
  b.forEach((span, i) => {
    assert.deepEqual(span.attributes.map((x) => x.key), a[i].attributes.map((x) => x.key));
  });
  const r = await counts(REGENERATED);
  assert.equal(r.kept, 1);
  assert.deepEqual(r.dropped, { unsupported_part: 1, prefix_of_longer: 1 });
});
