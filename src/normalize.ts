import { createHash } from 'node:crypto';
import type { ChatMessage, ToolCall, ToolDefinition } from './types.js';

type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Mutable state shared while normalizing one conversation. */
export interface NormalizeCtx {
  unsupported: boolean;
  synthesized: number;
  ordinal: number;
}

export const newCtx = (): NormalizeCtx => ({ unsupported: false, synthesized: 0, ordinal: 0 });

const ROLES: Record<string, ChatMessage['role']> = {
  system: 'system',
  developer: 'system',
  user: 'user',
  human: 'user',
  assistant: 'assistant',
  ai: 'assistant',
  tool: 'tool',
};

function stringifyArgs(args: unknown): string {
  if (typeof args === 'string') return args;
  if (args === undefined || args === null) return '{}';
  return JSON.stringify(args);
}

function makeCall(id: unknown, name: unknown, args: unknown, ctx: NormalizeCtx): ToolCall {
  const argStr = stringifyArgs(args);
  const nm = typeof name === 'string' ? name : '';
  if (nm === '') ctx.unsupported = true;
  const ord = ctx.ordinal++;
  let callId = typeof id === 'string' && id !== '' ? id : '';
  if (callId === '') {
    callId = 'call_' + createHash('sha256').update(`${ord}:${nm}:${argStr}`).digest('hex').slice(0, 12);
    ctx.synthesized++;
  }
  return { id: callId, type: 'function', function: { name: nm, arguments: argStr } };
}

function textOf(block: Obj): string | undefined {
  if (typeof block.text === 'string') return block.text;
  if (typeof block.content === 'string') return block.content;
  return undefined;
}

/** Tool result payloads: strings stay, text blocks are joined, objects become JSON. */
function resultText(raw: unknown, ctx: NormalizeCtx): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    const texts: string[] = [];
    for (const b of raw) {
      if (typeof b === 'string') texts.push(b);
      else if (isObj(b) && b.type === 'text' && typeof b.text === 'string') texts.push(b.text);
      else ctx.unsupported = true;
    }
    return texts.join('\n');
  }
  return JSON.stringify(raw);
}

const TEXT_TYPES = new Set(['text', 'input_text', 'output_text']);

/**
 * Normalize one provider message (OpenAI, Anthropic content blocks or OTel parts)
 * into zero or more OpenAI-style messages. A user message carrying tool_result
 * blocks becomes tool messages first, then the remaining user text.
 */
export function normalizeMessage(raw: unknown, ctx: NormalizeCtx): ChatMessage[] {
  if (!isObj(raw)) {
    ctx.unsupported = true;
    return [];
  }
  const roleRaw = typeof raw.role === 'string' ? raw.role : typeof raw.type === 'string' ? raw.type : '';
  const role = ROLES[roleRaw];
  if (!role) {
    ctx.unsupported = true;
    return [];
  }

  const texts: string[] = [];
  const calls: ToolCall[] = [];
  const results: ChatMessage[] = [];

  const collect = (content: unknown): void => {
    if (content === undefined || content === null) return;
    if (typeof content === 'string') {
      texts.push(content);
      return;
    }
    if (!Array.isArray(content)) {
      ctx.unsupported = true;
      return;
    }
    for (const part of content) {
      if (typeof part === 'string') {
        texts.push(part);
      } else if (!isObj(part)) {
        ctx.unsupported = true;
      } else if (typeof part.type === 'string' && TEXT_TYPES.has(part.type)) {
        const t = textOf(part);
        if (t === undefined) ctx.unsupported = true;
        else texts.push(t);
      } else if (part.type === 'tool_use') {
        calls.push(makeCall(part.id, part.name, part.input, ctx));
      } else if (part.type === 'tool_call') {
        calls.push(makeCall(part.id, part.name, part.arguments, ctx));
      } else if (part.type === 'tool_result') {
        results.push(toolMessage(part.tool_use_id, resultText(part.content, ctx)));
      } else if (part.type === 'tool_call_response') {
        results.push(toolMessage(part.id, resultText(part.result, ctx)));
      } else {
        ctx.unsupported = true; // image, audio, uri, blob, reasoning ...
      }
    }
  };

  collect(raw.parts ?? raw.content);

  if (Array.isArray(raw.tool_calls)) {
    for (const tc of raw.tool_calls) {
      if (isObj(tc) && isObj(tc.function)) calls.push(makeCall(tc.id, tc.function.name, tc.function.arguments, ctx));
      else ctx.unsupported = true;
    }
  }

  const out: ChatMessage[] = [...results];

  if (role === 'tool' && results.length === 0) {
    const id = typeof raw.tool_call_id === 'string' ? raw.tool_call_id : undefined;
    out.push(toolMessage(id, texts.join('\n')));
    return out;
  }
  if (results.length > 0 && texts.length === 0 && calls.length === 0) return out;

  const msg: ChatMessage = {
    role,
    content: texts.length > 0 ? texts.join('\n') : calls.length > 0 ? null : '',
  };
  if (calls.length > 0) msg.tool_calls = calls;
  out.push(msg);
  return out;
}

function toolMessage(id: unknown, content: string): ChatMessage {
  const m: ChatMessage = { role: 'tool', content };
  if (typeof id === 'string' && id !== '') m.tool_call_id = id;
  return m;
}

export function normalizeMessages(raw: unknown[], ctx: NormalizeCtx): ChatMessage[] {
  return raw.flatMap((m) => normalizeMessage(m, ctx));
}

/** OTel `gen_ai.system_instructions` (parts or string) or Anthropic `system` -> one system message. */
export function normalizeSystem(raw: unknown, ctx: NormalizeCtx): ChatMessage | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const wrapped = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw : [raw];
  const msgs = normalizeMessage({ role: 'system', content: wrapped }, ctx);
  const first = msgs[0];
  if (!first || first.content === null || first.content === '') return null;
  return first;
}

/** OpenAI-, Anthropic- and OTel-style tool definitions -> OpenAI tool definitions. */
export function normalizeTools(raw: unknown): ToolDefinition[] | undefined {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (!Array.isArray(value)) return undefined;
  const out: ToolDefinition[] = [];
  for (const t of value) {
    if (!isObj(t)) continue;
    const src = isObj(t.function) ? t.function : t;
    if (typeof src.name !== 'string' || src.name === '') continue;
    const fn: ToolDefinition['function'] = { name: src.name };
    if (typeof src.description === 'string') fn.description = src.description;
    const params = src.parameters ?? src.input_schema ?? src.inputSchema;
    if (params !== undefined) fn.parameters = params;
    out.push({ type: 'function', function: fn });
  }
  return out.length > 0 ? out : undefined;
}

export type Parsed =
  | { kind: 'empty' }
  | { kind: 'plain'; text: string }
  | { kind: 'json'; value: unknown };

/** Langfuse stores input/output as strings that may or may not be JSON. */
export function parseJsonish(v: unknown): Parsed {
  if (v === undefined || v === null) return { kind: 'empty' };
  if (typeof v === 'string') {
    if (v.trim() === '') return { kind: 'empty' };
    try {
      const parsed: unknown = JSON.parse(v);
      if (typeof parsed === 'object' && parsed !== null) return { kind: 'json', value: parsed };
    } catch {
      /* plain text */
    }
    return { kind: 'plain', text: v };
  }
  return { kind: 'json', value: v };
}

/** Extract the input messages (and an optional system prompt) from a parsed input value. */
export function splitInput(value: unknown): { messages: unknown[]; system?: unknown } | null {
  if (Array.isArray(value)) {
    // LangChain sometimes nests: [[m, m]]
    if (value.length === 1 && Array.isArray(value[0])) return { messages: value[0] as unknown[] };
    return { messages: value };
  }
  if (isObj(value)) {
    if (Array.isArray(value.messages)) {
      const nested = value.messages.length === 1 && Array.isArray(value.messages[0]);
      const messages = nested ? (value.messages[0] as unknown[]) : value.messages;
      return value.system !== undefined ? { messages, system: value.system } : { messages };
    }
    if (typeof value.role === 'string') return { messages: [value] };
  }
  return null;
}

/** Extract output messages from the shapes providers and frameworks emit. null = unrecognized. */
export function splitOutput(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    if (value.every((x) => isObj(x) && typeof x.role === 'string')) return value;
    if (value.length === 1 && Array.isArray(value[0])) return splitOutput(value[0]);
    return null;
  }
  if (!isObj(value)) return null;
  if (Array.isArray(value.messages)) return value.messages;
  if (Array.isArray(value.choices)) {
    return value.choices.map((c: unknown) =>
      isObj(c) && isObj(c.message) ? c.message : { role: 'assistant', content: isObj(c) ? c.text : undefined },
    );
  }
  if (Array.isArray(value.generations)) {
    const flat = (value.generations as unknown[]).flat() as unknown[];
    return flat.map((g) =>
      isObj(g) && isObj(g.message) ? g.message : { role: 'assistant', content: isObj(g) ? g.text : undefined },
    );
  }
  if (typeof value.role === 'string') return [value];
  if (typeof value.output === 'string') return [{ role: 'assistant', content: value.output }];
  if ('content' in value || 'tool_calls' in value) return [{ role: 'assistant', ...value }];
  return null;
}
