import { t } from './i18n/index.js';
import type { Lang } from './i18n/index.js';
import { DROP_REASONS, DUPLICATE_REASONS } from './types.js';
import type { Candidate, Dialect, DropReason, OutputFormat, Report } from './types.js';

export interface ReportInput {
  format: OutputFormat;
  candidates: Candidate[];
  skipped: number;
  kept: Candidate[];
  train: number;
  valid: number;
  drops: { reason: DropReason; id: string }[];
  masked: Record<string, number>;
}

export function buildReport(i: ReportInput): Report {
  const dropped: Report['dropped'] = {};
  const examples: Report['examples'] = {};
  for (const reason of DROP_REASONS) {
    const list = i.drops.filter((d) => d.reason === reason);
    if (list.length === 0) continue;
    dropped[reason] = list.length;
    examples[reason] = list.slice(0, 5).map((d) => d.id);
  }
  const dialects: Report['dialects'] = {};
  for (const c of i.candidates) dialects[c.source.dialect as Dialect] = (dialects[c.source.dialect as Dialect] ?? 0) + 1;

  const dropped_total = i.drops.length;
  const invalid_total = i.drops.filter((d) => !DUPLICATE_REASONS.includes(d.reason)).length;
  const warnings: string[] = [];
  if (i.kept.length < 10) warnings.push('fewer_than_10_examples');
  if (i.kept.some((c) => (c.synthesizedIds ?? 0) > 0)) warnings.push('synthesized_tool_call_ids');

  return {
    format: i.format,
    candidates: i.candidates.length,
    skipped: i.skipped,
    kept: i.kept.length,
    train: i.train,
    valid: i.valid,
    dropped,
    dropped_total,
    invalid_total,
    examples,
    masked: i.masked,
    dialects,
    warnings,
  };
}

/** Human-readable report in English or Korean. */
export function renderReportMarkdown(report: Report, lang: Lang): string {
  const L: string[] = [];
  L.push(`# ${t(lang, 'report.title')}`, '');
  L.push(`| ${t(lang, 'report.metric')} | ${t(lang, 'report.count')} |`, '|---|---:|');
  L.push(`| ${t(lang, 'report.candidates')} | ${report.candidates} |`);
  L.push(`| ${t(lang, 'report.skipped')} | ${report.skipped} |`);
  L.push(`| ${t(lang, 'report.kept')} | ${report.kept} |`);
  L.push(`| ${t(lang, 'report.train')} | ${report.train} |`);
  L.push(`| ${t(lang, 'report.valid')} | ${report.valid} |`);
  L.push(`| ${t(lang, 'report.dropped')} | ${report.dropped_total} |`, '');

  L.push(`## ${t(lang, 'report.dropped_heading')}`, '');
  const reasons = DROP_REASONS.filter((r) => report.dropped[r] !== undefined);
  if (reasons.length === 0) {
    L.push(t(lang, 'report.nothing_dropped'), '');
  } else {
    L.push(`| ${t(lang, 'report.reason')} | ${t(lang, 'report.count')} | ${t(lang, 'report.meaning')} | ${t(lang, 'report.examples')} |`);
    L.push('|---|---:|---|---|');
    for (const r of reasons) {
      const ex = (report.examples[r] ?? []).map((e) => `\`${e}\``).join(', ');
      L.push(`| \`${r}\` | ${report.dropped[r]} | ${t(lang, `reason.${r}`)} | ${ex} |`);
    }
    L.push('');
  }

  const maskKeys = Object.keys(report.masked);
  if (maskKeys.length > 0) {
    L.push(`## ${t(lang, 'report.masked_heading')}`, '');
    for (const k of maskKeys) L.push(`- \`${k}\`: ${report.masked[k]}`);
    L.push('');
  }
  if (report.warnings.length > 0) {
    L.push(`## ${t(lang, 'report.warnings_heading')}`, '');
    for (const w of report.warnings) L.push(`- \`${w}\`: ${t(lang, `warn.${w}`)}`);
    L.push('');
  }
  return L.join('\n');
}
