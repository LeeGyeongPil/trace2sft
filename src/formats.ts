import type { Candidate, ChatMessage, OutputFormat } from './types.js';

function parseObject(s: string): unknown {
  try {
    const v: unknown = JSON.parse(s);
    return typeof v === 'object' && v !== null ? v : s;
  } catch {
    return s;
  }
}

/** One dataset row. `openai`: arguments are JSON strings. `hf`: arguments are objects, tool messages carry `name`. */
export function formatRow(c: Candidate, format: OutputFormat): object {
  const names = new Map<string, string>();
  for (const m of c.messages) for (const tc of m.tool_calls ?? []) names.set(tc.id, tc.function.name);

  const messages = c.messages.map((m: ChatMessage) => {
    const out: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.tool_calls) {
      out.tool_calls = m.tool_calls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: format === 'hf' ? parseObject(tc.function.arguments) : tc.function.arguments,
        },
      }));
    }
    if (m.tool_call_id !== undefined) out.tool_call_id = m.tool_call_id;
    if (format === 'hf' && m.role === 'tool' && m.tool_call_id !== undefined) {
      const name = names.get(m.tool_call_id);
      if (name !== undefined) out.name = name;
    }
    return out;
  });
  return c.tools ? { messages, tools: c.tools } : { messages };
}

export function toJsonl(rows: object[]): string {
  return rows.length === 0 ? '' : rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
}
