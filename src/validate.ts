import type { ChatMessage, DropReason } from './types.js';

export interface ValidateOptions {
  /** Reject conversations longer than this many characters (content + tool arguments). */
  maxChars?: number;
}

function charCount(messages: ChatMessage[]): number {
  let n = 0;
  for (const m of messages) {
    n += m.content?.length ?? 0;
    for (const tc of m.tool_calls ?? []) n += tc.function.arguments.length;
  }
  return n;
}

/**
 * Check roles and tool call pairing. Returns the reason to drop the conversation,
 * or null when it is usable. A conversation may end with an assistant message that
 * carries tool_calls (a tool-calling training example); parallel calls may be
 * answered in any order.
 */
export function validateMessages(messages: ChatMessage[], opts: ValidateOptions = {}): DropReason | null {
  if (messages.length === 0) return 'no_assistant';

  for (const m of messages) {
    const hasCalls = (m.tool_calls?.length ?? 0) > 0;
    if (m.role !== 'tool' && !hasCalls && (m.content === null || m.content.trim() === '')) {
      return 'empty_message';
    }
  }

  const pending = new Set<string>();
  const seen = new Set<string>();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i] as ChatMessage;
    if (m.role === 'tool') {
      const id = m.tool_call_id;
      if (id !== undefined && pending.has(id)) {
        pending.delete(id);
        continue;
      }
      return id !== undefined && seen.has(id) ? 'tool_result_not_adjacent' : 'orphan_tool_result';
    }
    if (pending.size > 0) {
      const answeredLater = messages
        .slice(i)
        .some((x) => x.role === 'tool' && x.tool_call_id !== undefined && pending.has(x.tool_call_id));
      return answeredLater ? 'tool_result_not_adjacent' : 'missing_tool_result';
    }
    if (m.role === 'assistant') {
      for (const tc of m.tool_calls ?? []) {
        pending.add(tc.id);
        seen.add(tc.id);
      }
    }
  }
  if (pending.size > 0) {
    // Only the very last assistant message may leave calls unanswered.
    const last = messages[messages.length - 1] as ChatMessage;
    if (!(last.role === 'assistant' && (last.tool_calls?.length ?? 0) > 0)) return 'missing_tool_result';
  }

  if ((messages[messages.length - 1] as ChatMessage).role !== 'assistant') return 'no_assistant';
  if (opts.maxChars !== undefined && charCount(messages) > opts.maxChars) return 'too_long';
  return null;
}
