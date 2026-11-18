// Copy the sample exports next to the compiled CLI so `npx trace2sft demo` works from the npm package.
import { cpSync, mkdirSync } from 'node:fs';

mkdirSync('dist/demo', { recursive: true });
for (const [src, dst] of [
  ['fixtures/langfuse/observations_v2.jsonl.gz', 'observations_v2.jsonl.gz'],
  ['fixtures/langsmith/runs.jsonl', 'runs.jsonl'],
  ['fixtures/otlp/chat-spans.json', 'chat-spans.json'],
  ['fixtures/mask-rules.json', 'mask-rules.json'],
]) {
  cpSync(src, `dist/demo/${dst}`);
}
