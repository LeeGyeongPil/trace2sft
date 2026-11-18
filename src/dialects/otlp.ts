import { Trace2SftError } from '../errors.js';
import { newCtx, normalizeMessages, normalizeSystem, normalizeTools } from '../normalize.js';
import type { ReadResult, Candidate, ChatMessage } from '../types.js';
import { isObj } from './shared.js';

/** OTel GenAI attribute names, kept in one place (semantic conventions v1.38, Development status). */
export const ATTR = {
  operation: 'gen_ai.operation.name',
  input: 'gen_ai.input.messages',
  output: 'gen_ai.output.messages',
  system: 'gen_ai.system_instructions',
  tools: 'gen_ai.tool.definitions',
  conversation: 'gen_ai.conversation.id',
} as const;

const CHAT_OPS = new Set(['chat', 'generate_content', 'text_completion']);

function attrMap(attrs: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!Array.isArray(attrs)) return out;
  for (const a of attrs) {
    if (!isObj(a) || typeof a.key !== 'string' || !isObj(a.value)) continue;
    const v = a.value;
    out[a.key] = v.stringValue ?? v.intValue ?? v.boolValue ?? v.doubleValue;
  }
  return out;
}

/** Message attributes are JSON strings (or already structured when the exporter allows it). */
function jsonAttr(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch {
    return undefined;
  }
}

/** OTLP JSON documents (`resourceSpans[].scopeSpans[].spans[]`) with gen_ai message attributes. */
export function readOtlp(records: unknown[], file: string): ReadResult {
  const result: ReadResult = { candidates: [], skipped: 0 };
  let chatSpans = 0;
  let withContent = 0;

  for (const doc of records) {
    if (!isObj(doc) || !Array.isArray(doc.resourceSpans)) continue;
    for (const rs of doc.resourceSpans) {
      for (const ss of isObj(rs) && Array.isArray(rs.scopeSpans) ? rs.scopeSpans : []) {
        for (const span of isObj(ss) && Array.isArray(ss.spans) ? ss.spans : []) {
          if (!isObj(span)) continue;
          const a = attrMap(span.attributes);
          if (typeof a[ATTR.operation] !== 'string' || !CHAT_OPS.has(a[ATTR.operation] as string)) {
            result.skipped++;
            continue;
          }
          chatSpans++;
          if (a[ATTR.input] !== undefined || a[ATTR.output] !== undefined) withContent++;
          result.candidates.push(spanToCandidate(span, a, file));
        }
      }
    }
  }

  if (chatSpans > 0 && withContent === 0) {
    throw new Trace2SftError(
      'E_NO_IO_FIELDS',
      `${file}: the chat spans carry no gen_ai.input.messages / gen_ai.output.messages attributes. ` +
        'Message content capture is opt-in in OpenTelemetry GenAI instrumentation; enable it and record again.',
      { file },
    );
  }
  return result;
}

function spanToCandidate(span: Record<string, unknown>, a: Record<string, unknown>, file: string): Candidate {
  const spanId = typeof span.spanId === 'string' ? span.spanId : '?';
  const traceId = typeof span.traceId === 'string' ? span.traceId : spanId;
  const conv = typeof a[ATTR.conversation] === 'string' && a[ATTR.conversation] !== '' ? (a[ATTR.conversation] as string) : traceId;
  const ctx = newCtx();
  const messages: ChatMessage[] = [];
  let bad = false;

  const sysRaw = jsonAttr(a[ATTR.system]);
  if (a[ATTR.system] !== undefined && sysRaw === undefined) bad = true;
  const sys = normalizeSystem(sysRaw, ctx);
  if (sys) messages.push(sys);

  for (const key of [ATTR.input, ATTR.output] as const) {
    if (a[key] === undefined) continue;
    const arr = jsonAttr(a[key]);
    if (!Array.isArray(arr)) bad = true;
    else messages.push(...normalizeMessages(arr, ctx));
  }

  const c: Candidate = { source: { file, id: spanId, dialect: 'otlp' }, group: conv, messages };
  const tools = normalizeTools(jsonAttr(a[ATTR.tools]));
  if (tools) c.tools = tools;
  if (bad) c.preDrop = 'unparseable_io';
  else if (ctx.unsupported) c.preDrop = 'unsupported_part';
  if (ctx.synthesized > 0) c.synthesizedIds = ctx.synthesized;
  return c;
}
