import { Trace2SftError } from '../errors.js';
import { normalizeTools } from '../normalize.js';
import type { PlainTextPolicy, ReadResult } from '../types.js';
import { buildMessages, isObj, parseJsonish, toCandidate } from './shared.js';

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** Langfuse `observations_v2` rows (one row per observation). Only GENERATION rows are model calls. */
export function readLangfuse(records: unknown[], file: string, plainText: PlainTextPolicy): ReadResult {
  const rows = records.filter(isObj);
  if (!rows.some((r) => 'input' in r || 'output' in r)) {
    throw new Trace2SftError(
      'E_NO_IO_FIELDS',
      `${file}: the Langfuse export has no "input"/"output" columns. Enable the "io" field group ` +
        '(and "tools" for tool definitions) in the export settings and export again.',
      { file },
    );
  }
  const result: ReadResult = { candidates: [], skipped: 0 };
  for (const r of rows) {
    if (r.type !== 'GENERATION') {
      result.skipped++;
      continue;
    }
    const id = str(r.id) ?? '?';
    const built = buildMessages(parseJsonish(r.input), parseJsonish(r.output), plainText);
    const tools = normalizeTools(r.tool_definitions);
    result.candidates.push(
      toCandidate(
        {
          source: { file, id, dialect: 'langfuse' },
          group: str(r.session_id) ?? str(r.trace_id) ?? id,
          ...(tools ? { tools } : {}),
        },
        built,
      ),
    );
  }
  return result;
}
