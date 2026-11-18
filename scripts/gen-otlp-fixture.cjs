// Regenerate the OTLP sample with the official OpenTelemetry JS SDK (versions pinned in package.json).
// Usage: npm run gen:otlp [-- <output path>]   (default .cache/chat-spans.regenerated.json, git-ignored)
// The committed fixtures/otlp/chat-spans.json came from this script; ids and timestamps differ per run.
const fs = require('node:fs');
const path = require('node:path');
const { TracerProvider, InMemorySpanExporter, SimpleSpanProcessor } = require('@opentelemetry/sdk-trace');
const { JsonTraceSerializer } = require('@opentelemetry/otlp-transformer');
const sc = require('@opentelemetry/semantic-conventions/incubating');

const exporter = new InMemorySpanExporter();
// SDK 3: the processor takes an options object, and export is async, hence forceFlush below.
const provider = new TracerProvider({ spanProcessors: [new SimpleSpanProcessor({ exporter })] });
const tracer = provider.getTracer('trace2sft-fixture');

const system = [{ type: 'text', content: 'You are a calculator assistant.' }];
const user1 = { role: 'user', parts: [{ type: 'text', content: 'What is 2 + 3?' }] };
const call1 = {
  role: 'assistant',
  parts: [{ type: 'tool_call', id: 'call_otel_1', name: 'add', arguments: { a: 2, b: 3 } }],
  finish_reason: 'tool_call',
};
const result1 = { role: 'tool', parts: [{ type: 'tool_call_response', id: 'call_otel_1', result: { sum: 5 } }] };
const answer1 = { role: 'assistant', parts: [{ type: 'text', content: '2 + 3 = 5.' }], finish_reason: 'stop' };
const imageUser = {
  role: 'user',
  parts: [
    { type: 'text', content: 'What is in this picture?' },
    { type: 'uri', modality: 'image', uri: 'https://example.com/cat.png' },
  ],
};
const imageAnswer = { role: 'assistant', parts: [{ type: 'text', content: 'A cat.' }], finish_reason: 'stop' };

function chat(conversation, input, output) {
  const span = tracer.startSpan('chat sample-model');
  span.setAttribute(sc.ATTR_GEN_AI_OPERATION_NAME, 'chat');
  span.setAttribute(sc.ATTR_GEN_AI_CONVERSATION_ID, conversation);
  span.setAttribute(sc.ATTR_GEN_AI_SYSTEM_INSTRUCTIONS, JSON.stringify(system));
  span.setAttribute(sc.ATTR_GEN_AI_INPUT_MESSAGES, JSON.stringify(input));
  span.setAttribute(sc.ATTR_GEN_AI_OUTPUT_MESSAGES, JSON.stringify(output));
  span.end();
}

chat('conv-1', [user1], [call1]); // turn 1: a prefix of turn 2
chat('conv-1', [user1, call1, result1], [answer1]); // turn 2: the complete conversation
chat('conv-2', [imageUser], [imageAnswer]); // contains an image part

(async () => {
  await provider.forceFlush();
  const spans = exporter.getFinishedSpans();
  if (spans.length === 0) {
    console.error('No spans were exported. Check SimpleSpanProcessor({ exporter }) and forceFlush().');
    process.exit(1);
  }
  const target = process.argv[2] || path.join('.cache', 'chat-spans.regenerated.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, Buffer.from(JsonTraceSerializer.serializeRequest(spans)));
  console.log(`wrote ${target} (${spans.length} spans)`);
})();
