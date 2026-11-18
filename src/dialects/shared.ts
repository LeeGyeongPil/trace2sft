import { isObj, newCtx, normalizeMessages, normalizeSystem, parseJsonish, splitInput, splitOutput } from '../normalize.js';
import type { NormalizeCtx, Parsed } from '../normalize.js';
import type { Candidate, ChatMessage, PlainTextPolicy } from '../types.js';

export { isObj };

export interface Built {
  messages: ChatMessage[];
  preDrop?: Candidate['preDrop'];
  synthesized: number;
}

/**
 * Turn an (input, output) pair of raw values into normalized messages.
 * Plain-text input becomes a user message and plain-text output an assistant
 * message unless the policy is "drop".
 */
export function buildMessages(
  input: Parsed,
  output: Parsed,
  plainText: PlainTextPolicy,
  extraSystem?: unknown,
): Built {
  const ctx: NormalizeCtx = newCtx();
  const messages: ChatMessage[] = [];
  let preDrop: Candidate['preDrop'];

  if (input.kind === 'plain') {
    if (plainText === 'drop') preDrop = 'unparseable_io';
    else messages.push({ role: 'user', content: input.text });
  } else if (input.kind === 'json') {
    const split = splitInput(input.value);
    if (!split) preDrop = 'unparseable_io';
    else {
      const sys = normalizeSystem(split.system ?? extraSystem, ctx);
      if (sys) messages.push(sys);
      messages.push(...normalizeMessages(split.messages, ctx));
    }
  } else if (extraSystem !== undefined) {
    const sys = normalizeSystem(extraSystem, ctx);
    if (sys) messages.push(sys);
  }

  if (output.kind === 'plain') {
    if (plainText === 'drop') preDrop = preDrop ?? 'unparseable_io';
    else messages.push({ role: 'assistant', content: output.text });
  } else if (output.kind === 'json') {
    const out = splitOutput(output.value);
    if (!out) preDrop = preDrop ?? 'unparseable_io';
    else messages.push(...normalizeMessages(out, ctx));
  }

  if (!preDrop && ctx.unsupported) preDrop = 'unsupported_part';
  return preDrop ? { messages, preDrop, synthesized: ctx.synthesized } : { messages, synthesized: ctx.synthesized };
}

export { parseJsonish };

export function toCandidate(
  base: Pick<Candidate, 'source' | 'group' | 'tools'>,
  built: Built,
): Candidate {
  const c: Candidate = { source: base.source, group: base.group, messages: built.messages };
  if (base.tools) c.tools = base.tools;
  if (built.preDrop) c.preDrop = built.preDrop;
  if (built.synthesized > 0) c.synthesizedIds = built.synthesized;
  return c;
}
