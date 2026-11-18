import { readFileSync } from 'node:fs';
import { Trace2SftError } from './errors.js';
import type { Candidate, MaskRule } from './types.js';

function bad(index: number, name: string, detail: string): Trace2SftError {
  return new Trace2SftError(
    'E_BAD_MASK_RULE',
    `Mask rule #${index + 1}${name ? ` "${name}"` : ''} is invalid: ${detail}. ` +
      'Each rule needs "name", "pattern" (a valid JavaScript regular expression) and "replace".',
    { index: index + 1, name, detail },
  );
}

/** Validate mask rules; every pattern must compile. */
export function parseMaskRules(raw: unknown): MaskRule[] {
  if (!Array.isArray(raw)) throw bad(0, '', 'the rules file must contain a JSON array');
  return raw.map((r: unknown, i): MaskRule => {
    if (typeof r !== 'object' || r === null) throw bad(i, '', 'rule must be an object');
    const o = r as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name : '';
    if (name === '') throw bad(i, name, 'missing "name"');
    if (typeof o.pattern !== 'string') throw bad(i, name, 'missing "pattern"');
    if (typeof o.replace !== 'string') throw bad(i, name, 'missing "replace"');
    const flags = typeof o.flags === 'string' ? o.flags : '';
    try {
      new RegExp(o.pattern, flags.includes('g') ? flags : flags + 'g');
    } catch (e) {
      throw bad(i, name, (e as Error).message);
    }
    return flags ? { name, pattern: o.pattern, flags, replace: o.replace } : { name, pattern: o.pattern, replace: o.replace };
  });
}

export function loadMaskRules(path: string): MaskRule[] {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    throw new Trace2SftError('E_USAGE', `Cannot read mask rules file ${path}: ${(e as Error).message}`, {
      key: 'usage.cannot_read_mask',
      file: path,
      detail: (e as Error).message,
    });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Trace2SftError('E_BAD_MASK_RULE', `Mask rules file ${path} is not valid JSON: ${(e as Error).message}`, {
      index: 0,
      name: path,
      detail: (e as Error).message,
    });
  }
  return parseMaskRules(raw);
}

/** Apply rules to every string in the candidates; returns masked copies and per-rule counts. */
export function applyMask(
  candidates: Candidate[],
  rules: MaskRule[],
): { candidates: Candidate[]; counts: Record<string, number> } {
  const compiled = rules.map((r) => ({
    rule: r,
    re: new RegExp(r.pattern, r.flags?.includes('g') ? r.flags : (r.flags ?? '') + 'g'),
  }));
  const counts: Record<string, number> = {};
  const mask = (text: string): string => {
    let out = text;
    for (const { rule, re } of compiled) {
      const n = out.match(re)?.length ?? 0;
      if (n > 0) {
        counts[rule.name] = (counts[rule.name] ?? 0) + n;
        out = out.replace(re, rule.replace);
      }
    }
    return out;
  };
  const masked = candidates.map((c) => ({
    ...c,
    messages: c.messages.map((m) => {
      const copy = { ...m };
      if (copy.content !== null) copy.content = mask(copy.content);
      if (copy.tool_calls) {
        copy.tool_calls = copy.tool_calls.map((tc) => ({
          ...tc,
          function: { ...tc.function, arguments: mask(tc.function.arguments) },
        }));
      }
      return copy;
    }),
  }));
  return { candidates: masked, counts };
}
