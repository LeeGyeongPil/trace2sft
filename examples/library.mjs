// Minimal library use: read export files, convert, print the summary.
import { convert, readTraceFiles, toJsonl } from 'trace2sft';

const files = [
  new URL('../fixtures/langfuse/observations_v2.jsonl.gz', import.meta.url).pathname,
  new URL('../fixtures/langsmith/runs.jsonl', import.meta.url).pathname,
  new URL('../fixtures/otlp/chat-spans.json', import.meta.url).pathname,
];

const input = await readTraceFiles(files); // dialect is detected per file
const { train, report } = convert(input, { format: 'openai' });

console.log(`kept=${report.kept} dropped=${report.dropped_total} skipped=${report.skipped}`);
console.log(toJsonl(train).split('\n')[0]?.slice(0, 80), '...');
