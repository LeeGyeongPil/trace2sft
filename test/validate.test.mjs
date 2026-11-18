import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateMessages } from '../dist/index.js';
import { call, msg } from './helpers.mjs';

test('tool pairing', () => {
  const user = msg('user', 'go');
  const callsA = msg('assistant', null, { tool_calls: [call('A')] });
  const toolA = msg('tool', 'ok', { tool_call_id: 'A' });
  const done = msg('assistant', 'done');

  // tool result with no preceding call
  assert.equal(validateMessages([user, toolA, done]), 'orphan_tool_result');
  // call never answered before the next message
  assert.equal(validateMessages([user, callsA, done]), 'missing_tool_result');
  // another message between the call and its result
  assert.equal(validateMessages([user, callsA, msg('user', 'hm'), toolA, done]), 'tool_result_not_adjacent');
  // ending on an assistant tool call is a valid training example
  assert.equal(validateMessages([user, callsA]), null);
  // parallel calls answered in reverse order
  const parallel = msg('assistant', null, { tool_calls: [call('A'), call('B')] });
  assert.equal(
    validateMessages([user, parallel, msg('tool', 'b', { tool_call_id: 'B' }), toolA, done]),
    null,
  );
});

test('roles, empty messages and length', () => {
  assert.equal(validateMessages([]), 'no_assistant');
  assert.equal(validateMessages([msg('user', 'hi')]), 'no_assistant');
  assert.equal(validateMessages([msg('user', 'hi'), msg('assistant', '  ')]), 'empty_message');
  assert.equal(validateMessages([msg('user', 'hi'), msg('assistant', 'yo')]), null);
  assert.equal(validateMessages([msg('user', 'hello'), msg('assistant', 'yo')], { maxChars: 6 }), 'too_long');
});

test('partially answered parallel calls are missing a result', () => {
  const parallel = msg('assistant', null, { tool_calls: [call('A'), call('B')] });
  const m = [msg('user', 'x'), parallel, msg('tool', 'a', { tool_call_id: 'A' })];
  assert.equal(validateMessages(m), 'missing_tool_result');
});
