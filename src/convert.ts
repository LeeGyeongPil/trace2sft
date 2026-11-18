import { dedupe } from './dedupe.js';
import { formatRow } from './formats.js';
import { applyMask } from './mask.js';
import { buildReport } from './report.js';
import { splitByGroup } from './split.js';
import { validateMessages } from './validate.js';
import type { Candidate, ConvertOptions, ConvertResult, DropReason, ReadResult } from './types.js';

/** validate -> dedupe -> mask -> split -> format. Pure and deterministic. */
export function convert(input: ReadResult, opts: ConvertOptions = {}): ConvertResult {
  const format = opts.format ?? 'openai';
  const drops: { reason: DropReason; id: string }[] = [];
  const valid: Candidate[] = [];

  for (const c of input.candidates) {
    const reason =
      c.preDrop ?? validateMessages(c.messages, opts.maxChars !== undefined ? { maxChars: opts.maxChars } : {});
    if (reason) drops.push({ reason, id: c.source.id });
    else valid.push(c);
  }

  const dd = dedupe(valid);
  for (const d of dd.dropped) drops.push({ reason: d.reason, id: d.candidate.source.id });

  let kept = dd.kept;
  let masked: Record<string, number> = {};
  if (opts.mask && opts.mask.length > 0) {
    const m = applyMask(kept, opts.mask);
    kept = m.candidates;
    masked = m.counts;
  }

  const split = splitByGroup(kept, opts.valid ?? 0, opts.seed ?? 'trace2sft');
  const report = buildReport({
    format,
    candidates: input.candidates,
    skipped: input.skipped,
    kept,
    train: split.train.length,
    valid: split.valid.length,
    drops,
    masked,
  });
  return {
    train: split.train.map((c) => formatRow(c, format)),
    valid: split.valid.map((c) => formatRow(c, format)),
    report,
  };
}
