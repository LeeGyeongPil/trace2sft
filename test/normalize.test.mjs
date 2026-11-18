import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromRecords } from '../dist/index.js';
import { newCtx, normalizeMessage, normalizeTools } from '../dist/normalize.js';

test('anthropic blocks', () => {
  const ctx = newCtx();
  const assistant = normalizeMessage(
    { role: 'assistant', content: [{ type: 'text', text: 'calling' }, { type: 'tool_use', id: 'tu_1', name: 'add', input: { a: 2, b: 3 } }] },
    ctx,
  );
  assert.equal(assistant.length, 1);
  assert.equal(assistant[0].content, 'calling');
  assert.equal(assistant[0].tool_calls[0].id, 'tu_1');
  assert.equal(assistant[0].tool_calls[0].function.arguments, '{"a":2,"b":3}');

  const user = normalizeMessage(
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: [{ type: 'text', text: '5' }] }, { type: 'text', text: 'thanks' }] },
    ctx,
  );
  assert.deepEqual(user, [
    { role: 'tool', content: '5', tool_call_id: 'tu_1' },
    { role: 'user', content: 'thanks' },
  ]);
  assert.equal(ctx.unsupported, false);
});

test('otel parts', () => {
  const span = (attrs) => ({
    resourceSpans: [{ scopeSpans: [{ spans: [{ traceId: 't', spanId: 's', attributes: Object.entries(attrs).map(([key, v]) => ({ key, value: { stringValue: v } })) }] }] }],
  });
  const r = fromRecords(
    [
      span({
        'gen_ai.operation.name': 'chat',
        'gen_ai.system_instructions': JSON.stringify([{ type: 'text', content: 'Be brief.' }]),
        'gen_ai.input.messages': JSON.stringify([
          { role: 'user', parts: [{ type: 'text', content: 'hi' }] },
          { role: 'assistant', parts: [{ type: 'tool_call', id: 'c1', name: 'f', arguments: { x: 1 } }] },
          { role: 'tool', parts: [{ type: 'tool_call_response', id: 'c1', result: { ok: true } }] },
        ]),
        'gen_ai.output.messages': JSON.stringify([{ role: 'assistant', parts: [{ type: 'text', content: 'ok' }], finish_reason: 'stop' }]),
      }),
    ],
    'otlp',
  );
  const [c] = r.candidates;
  assert.equal(c.messages[0].role, 'system');
  assert.equal(c.messages[0].content, 'Be brief.');
  assert.equal(c.messages[2].tool_calls[0].function.arguments, '{"x":1}');
  assert.deepEqual(c.messages[3], { role: 'tool', content: '{"ok":true}', tool_call_id: 'c1' });
  assert.equal(c.group, 't');
  assert.equal(c.preDrop, undefined);
});

test('tool definitions from Anthropic and OTel shapes', () => {
  const tools = normalizeTools([{ name: 'a', description: 'd', input_schema: { type: 'object' } }, { type: 'function', name: 'b', parameters: {} }]);
  assert.deepEqual(tools.map((t) => t.function.name), ['a', 'b']);
  assert.deepEqual(tools[0].function.parameters, { type: 'object' });
});

test('missing tool call ids are synthesized deterministically', () => {
  const rec = { id: 'r', run_type: 'llm', inputs: { messages: [{ role: 'user', content: 'x' }] }, outputs: { messages: [{ role: 'assistant', tool_calls: [{ function: { name: 'f', arguments: '{}' } }] }] } };
  const a = fromRecords([rec], 'langsmith').candidates[0];
  const b = fromRecords([rec], 'langsmith').candidates[0];
  assert.match(a.messages[1].tool_calls[0].id, /^call_[0-9a-f]{12}$/);
  assert.equal(a.messages[1].tool_calls[0].id, b.messages[1].tool_calls[0].id);
  assert.equal(a.synthesizedIds, 1);
});

test('plain text policy and unsupported parts', () => {
  const row = { id: 'x', trace_id: 't', type: 'GENERATION', input: 'hello', output: 'world' };
  assert.equal(fromRecords([row], 'langfuse', { plainText: 'keep' }).candidates[0].messages.length, 2);
  assert.equal(fromRecords([row], 'langfuse', { plainText: 'drop' }).candidates[0].preDrop, 'unparseable_io');
  const img = { id: 'y', trace_id: 't', type: 'GENERATION', input: JSON.stringify([{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'x' } }] }]), output: 'a' };
  assert.equal(fromRecords([img], 'langfuse').candidates[0].preDrop, 'unsupported_part');
});

test('chat spans without message attributes raise E_NO_IO_FIELDS', () => {
  const attributes = [{ key: 'gen_ai.operation.name', value: { stringValue: 'chat' } }];
  const doc = { resourceSpans: [{ scopeSpans: [{ spans: [{ spanId: 's', traceId: 't', attributes }] }] }] };
  assert.throws(() => fromRecords([doc], 'otlp'), { code: 'E_NO_IO_FIELDS' });
});
