import { normalizeTools } from '../normalize.js';
import type { PlainTextPolicy, ReadResult } from '../types.js';
import { buildMessages, isObj, parseJsonish, toCandidate } from './shared.js';

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** LangSmith runs. Only `run_type: "llm"` runs are model calls. */
export function readLangSmith(records: unknown[], file: string, plainText: PlainTextPolicy): ReadResult {
  const result: ReadResult = { candidates: [], skipped: 0 };
  for (const r of records) {
    if (!isObj(r) || r.run_type !== 'llm') {
      result.skipped++;
      continue;
    }
    const id = str(r.id) ?? '?';
    const inputs = isObj(r.inputs) ? r.inputs : {};
    const extra = isObj(r.extra) ? r.extra : {};
    const meta = isObj(extra.metadata) ? extra.metadata : {};
    const invocation = isObj(extra.invocation_params) ? extra.invocation_params : {};
    const group =
      str(meta.thread_id) ?? str(meta.session_id) ?? str(meta.conversation_id) ?? str(r.trace_id) ?? id;
    const tools = normalizeTools(inputs.tools ?? invocation.tools);
    const built = buildMessages(parseJsonish(r.inputs), parseJsonish(r.outputs), plainText);
    result.candidates.push(
      toCandidate({ source: { file, id, dialect: 'langsmith' }, group, ...(tools ? { tools } : {}) }, built),
    );
  }
  return result;
}
