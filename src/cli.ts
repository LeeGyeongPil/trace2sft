#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { convert } from './convert.js';
import { Trace2SftError } from './errors.js';
import { toJsonl } from './formats.js';
import { resolveLang, t } from './i18n/index.js';
import type { Lang } from './i18n/index.js';
import { loadMaskRules } from './mask.js';
import { readTraceFiles } from './read.js';
import { renderReportMarkdown } from './report.js';
import { DROP_REASONS } from './types.js';
import type { Dialect, OutputFormat, PlainTextPolicy, Report } from './types.js';

const OPTIONS = {
  from: { type: 'string' },
  format: { type: 'string' },
  out: { type: 'string' },
  valid: { type: 'string' },
  seed: { type: 'string' },
  mask: { type: 'string' },
  'max-chars': { type: 'string' },
  'plain-text': { type: 'string' },
  strict: { type: 'boolean' },
  lang: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const;

function usage(key: string, params: Record<string, string | number> = {}): Trace2SftError {
  return new Trace2SftError('E_USAGE', `${key} ${JSON.stringify(params)}`, { key, ...params });
}

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], option: string, dflt: T): T {
  if (value === undefined) return dflt;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw usage('usage.bad_value', { option, value, expected: allowed.join(' | ') });
}

function summary(report: Report, lang: Lang, title: string, outDir: string): string {
  const L: string[] = [t(lang, title), ''];
  L.push(`  ${t(lang, 'sum.candidates', { n: report.candidates })}`);
  L.push(`  ${t(lang, 'sum.skipped', { n: report.skipped })}`);
  L.push(`  ${t(lang, 'sum.kept', { kept: report.kept, train: report.train, valid: report.valid })}`);
  L.push(`  ${t(lang, 'sum.dropped', { n: report.dropped_total })}`);
  for (const r of DROP_REASONS) {
    const n = report.dropped[r];
    if (n !== undefined) L.push(`    ${r.padEnd(26)}${String(n).padStart(3)}  ${t(lang, `reason.${r}`)}`);
  }
  const masked = Object.entries(report.masked).map(([k, v]) => `${k} ${v}`);
  if (masked.length > 0) L.push(`  ${t(lang, 'sum.masked', { list: masked.join(', ') })}`);
  for (const w of report.warnings) L.push(`  ${t(lang, 'sum.warning', { text: t(lang, `warn.${w}`) })}`);
  L.push('', t(lang, 'sum.wrote', { dir: outDir }));
  return L.join('\n') + '\n';
}

async function run(argv: string[], env: NodeJS.ProcessEnv, out: (s: string) => void, lang: { current: Lang }): Promise<number> {
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  if (values.lang !== undefined && values.lang !== 'en' && values.lang !== 'ko') {
    throw usage('usage.bad_value', { option: 'lang', value: values.lang, expected: 'en | ko' });
  }
  lang.current = resolveLang(values.lang, env);

  if (values.version) {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
    out(`${pkg.version}\n`);
    return 0;
  }
  const command = positionals[0];
  if (values.help || command === undefined) {
    out(t(lang.current, 'help.text') + '\n');
    return 0;
  }
  if (command !== 'convert' && command !== 'demo') throw usage('usage.unknown_command', { command });

  const format: OutputFormat = oneOf(values.format, ['openai', 'hf'] as const, 'format', 'openai');
  const from = oneOf(values.from, ['auto', 'langfuse', 'langsmith', 'otlp'] as const, 'from', 'auto');
  const plainText: PlainTextPolicy = oneOf(values['plain-text'], ['keep', 'drop'] as const, 'plain-text', 'keep');
  const valid = values.valid === undefined ? 0 : Number(values.valid);
  if (!Number.isFinite(valid) || valid < 0 || valid > 0.5) {
    throw usage('usage.bad_value', { option: 'valid', value: values.valid ?? '', expected: '0 .. 0.5' });
  }
  let maxChars: number | undefined;
  if (values['max-chars'] !== undefined) {
    maxChars = Number(values['max-chars']);
    if (!Number.isInteger(maxChars) || maxChars < 1) {
      throw usage('usage.bad_value', { option: 'max-chars', value: values['max-chars'], expected: 'integer >= 1' });
    }
  }
  const mask = values.mask !== undefined ? loadMaskRules(values.mask) : undefined;

  let inputs: string[];
  if (command === 'demo') {
    const dir = new URL('./demo/', import.meta.url);
    inputs = ['observations_v2.jsonl.gz', 'runs.jsonl', 'chat-spans.json'].map((f) => fileURLToPath(new URL(f, dir)));
  } else {
    inputs = positionals.slice(1);
    if (inputs.length === 0) throw usage('usage.no_input');
  }

  const read = await readTraceFiles(inputs, { from: from as Dialect | 'auto', plainText });
  const result = convert(read, {
    format,
    valid,
    ...(values.seed !== undefined ? { seed: values.seed } : {}),
    ...(mask ? { mask } : {}),
    ...(maxChars !== undefined ? { maxChars } : {}),
  });

  const unusable = [...(read.emptyFiles ?? []), ...(read.noCandidateFiles ?? [])];
  if (read.candidates.length === 0) {
    throw new Trace2SftError('E_NO_CANDIDATES', `no model-call records found in: ${unusable.join(', ')}`, {
      files: unusable.length > 0 ? unusable.join(', ') : inputs.join(', '),
    });
  }
  for (const f of read.emptyFiles ?? []) process.stderr.write(`${t(lang.current, 'warn.file_empty', { file: f })}\n`);
  for (const f of read.noCandidateFiles ?? []) {
    process.stderr.write(`${t(lang.current, 'warn.file_no_candidates', { file: f })}\n`);
  }

  const outDir = values.out ?? (command === 'demo' ? './trace2sft-demo' : './trace2sft-out');
  try {
    mkdirSync(outDir, { recursive: true });
  } catch (e) {
    throw usage('usage.cannot_write', { dir: outDir, detail: (e as Error).message });
  }
  writeFileSync(join(outDir, 'train.jsonl'), toJsonl(result.train));
  if (valid > 0) writeFileSync(join(outDir, 'valid.jsonl'), toJsonl(result.valid));
  else rmSync(join(outDir, 'valid.jsonl'), { force: true });
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(result.report, null, 2) + '\n');
  writeFileSync(join(outDir, 'report.md'), renderReportMarkdown(result.report, lang.current));

  out(summary(result.report, lang.current, command === 'demo' ? 'sum.demo_title' : 'sum.convert_title', outDir));
  if (values.strict && result.report.invalid_total > 0) {
    out(t(lang.current, 'sum.strict_fail', { n: result.report.invalid_total }) + '\n');
    return 1;
  }
  return 0;
}

/** Read a valid `--lang en|ko` / `--lang=en|ko` from argv without parseArgs (last wins, stops at a bare `--`). */
function peekLang(argv: string[]): string | undefined {
  let found: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === '--') break;
    const v = a === '--lang' ? argv[i + 1] : a.startsWith('--lang=') ? a.slice('--lang='.length) : undefined;
    if (v === 'en' || v === 'ko') found = v;
  }
  return found;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // Resolve the language before parseArgs so parse errors also follow --lang.
  const lang = { current: resolveLang(peekLang(args), process.env) };
  try {
    process.exitCode = await run(args, process.env, (s) => process.stdout.write(s), lang);
  } catch (e) {
    const prefix = t(lang.current, 'err.prefix');
    if (e instanceof Trace2SftError) {
      const key = typeof e.params.key === 'string' ? e.params.key : `err.${e.code}`;
      process.stderr.write(`${prefix} [${e.code}]: ${t(lang.current, key, e.params)}\n`);
    } else if (e instanceof TypeError && (e as NodeJS.ErrnoException).code?.startsWith('ERR_PARSE_ARGS')) {
      process.stderr.write(`${prefix} [E_USAGE]: ${t(lang.current, 'usage.parse', { detail: e.message.replace(/\.$/, '') })}\n`);
    } else {
      process.stderr.write(`${prefix}: ${(e as Error).stack ?? String(e)}\n`);
    }
    process.exitCode = 2;
  }
}

await main();
