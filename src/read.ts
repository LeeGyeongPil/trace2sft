import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { readLangfuse } from './dialects/langfuse.js';
import { readLangSmith } from './dialects/langsmith.js';
import { readOtlp } from './dialects/otlp.js';
import { Trace2SftError } from './errors.js';
import type { Dialect, PlainTextPolicy, ReadOptions, ReadResult } from './types.js';

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Guess the export dialect from the first recognizable record. */
export function detectDialect(records: unknown[]): Dialect | undefined {
  for (const r of records) {
    if (!isRec(r)) continue;
    if ('resourceSpans' in r) return 'otlp';
    if ('run_type' in r) return 'langsmith';
    if ('trace_id' in r && typeof r.type === 'string') return 'langfuse';
  }
  return undefined;
}

/** Parse a JSON document, a JSON array, or JSON Lines text into records. */
export function parseRecords(text: string, file: string): unknown[] {
  const body = text.replace(/^﻿/, '');
  if (body.trim() === '') return [];
  let wholeError: Error | undefined;
  try {
    const whole: unknown = JSON.parse(body);
    return Array.isArray(whole) ? whole : [whole];
  } catch (e) {
    wholeError = e as Error;
  }
  // A .json file is one document: report its real parse error instead of the JSON Lines hint.
  if (/\.json$/i.test(file)) {
    throw new Trace2SftError(
      'E_INPUT_PARSE',
      `${file}: not valid JSON (${wholeError.message}). The file may be truncated; export it again.`,
      { key: 'err.E_INPUT_PARSE_DOC', file, line: 0, detail: wholeError.message },
    );
  }
  const records: unknown[] = [];
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] as string).trim();
    if (line === '') continue;
    try {
      records.push(JSON.parse(line));
    } catch (e) {
      throw new Trace2SftError(
        'E_INPUT_PARSE',
        `${file}: line ${i + 1} is not valid JSON (${(e as Error).message}). Each line of a .jsonl export must be one JSON object.`,
        { file, line: i + 1, detail: (e as Error).message },
      );
    }
  }
  return records;
}

/** Convert records of a known dialect into candidates (no file access). */
export function fromRecords(
  records: unknown[],
  dialect: Dialect,
  opts: { plainText?: PlainTextPolicy; file?: string } = {},
): ReadResult {
  const file = opts.file ?? '<memory>';
  const plain = opts.plainText ?? 'keep';
  if (dialect === 'langfuse') return readLangfuse(records, file, plain);
  if (dialect === 'langsmith') return readLangSmith(records, file, plain);
  return readOtlp(records, file);
}

/** Read export files (plain or gzip), detect the dialect per file and collect candidates. */
export async function readTraceFiles(paths: string[], opts: ReadOptions = {}): Promise<ReadResult> {
  const out: ReadResult = { candidates: [], skipped: 0 };
  for (const file of paths) {
    let buf: Buffer;
    try {
      buf = await readFile(file);
    } catch (e) {
      throw new Trace2SftError('E_USAGE', `Cannot read ${file}: ${(e as Error).message}`, {
        key: 'usage.cannot_read',
        file,
        detail: (e as Error).message,
      });
    }
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      try {
        buf = gunzipSync(buf);
      } catch (e) {
        throw new Trace2SftError('E_INPUT_PARSE', `${file}: cannot decompress gzip data (${(e as Error).message}).`, {
          file,
          line: 0,
          detail: (e as Error).message,
        });
      }
    }
    const records = parseRecords(buf.toString('utf8'), file);
    if (records.length === 0) {
      (out.emptyFiles ??= []).push(file);
      continue;
    }
    const dialect = opts.from && opts.from !== 'auto' ? opts.from : detectDialect(records);
    if (!dialect) {
      throw new Trace2SftError(
        'E_UNKNOWN_DIALECT',
        `${file}: cannot tell which export this is. Expected Langfuse observations (trace_id + type), ` +
          'LangSmith runs (run_type) or OTLP JSON (resourceSpans). Use --from to force a dialect.',
        { file },
      );
    }
    const part = fromRecords(records, dialect, {
      file,
      ...(opts.plainText ? { plainText: opts.plainText } : {}),
    });
    if (part.candidates.length === 0) (out.noCandidateFiles ??= []).push(file);
    out.candidates.push(...part.candidates);
    out.skipped += part.skipped;
  }
  return out;
}
