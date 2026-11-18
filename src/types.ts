/** Source dialects trace2sft can read. */
export type Dialect = 'langfuse' | 'langsmith' | 'otlp';

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** A chat message in OpenAI chat shape (the internal normal form). */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: { name: string; description?: string; parameters?: unknown };
}

/** Why a candidate conversation was left out of the dataset. */
export type DropReason =
  | 'no_assistant'
  | 'orphan_tool_result'
  | 'missing_tool_result'
  | 'tool_result_not_adjacent'
  | 'empty_message'
  | 'unsupported_part'
  | 'too_long'
  | 'unparseable_io'
  | 'prefix_of_longer'
  | 'exact_duplicate';

/** Fixed order used everywhere reasons are listed (keeps output deterministic). */
export const DROP_REASONS: readonly DropReason[] = [
  'no_assistant',
  'orphan_tool_result',
  'missing_tool_result',
  'tool_result_not_adjacent',
  'empty_message',
  'unsupported_part',
  'too_long',
  'unparseable_io',
  'prefix_of_longer',
  'exact_duplicate',
];

/** Reasons that mean the record itself is broken (used by --strict). */
export const DUPLICATE_REASONS: readonly DropReason[] = ['prefix_of_longer', 'exact_duplicate'];

export interface Candidate {
  source: { file: string; id: string; dialect: Dialect };
  /** Conversation key: conversation/session/thread id, falling back to the trace id. */
  group: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  /** Set by a dialect reader when the record cannot become a conversation. */
  preDrop?: DropReason;
  /** How many tool call ids had to be synthesized. */
  synthesizedIds?: number;
}

export type PlainTextPolicy = 'keep' | 'drop';
export type OutputFormat = 'openai' | 'hf';

export interface ReadOptions {
  from?: Dialect | 'auto';
  plainText?: PlainTextPolicy;
}

export interface ReadResult {
  candidates: Candidate[];
  /** Records that are not model calls (spans, chains, ...). */
  skipped: number;
  /** Files that contained no records at all (empty exports). */
  emptyFiles?: string[];
  /** Files that had records but no model-call conversations. */
  noCandidateFiles?: string[];
}

export interface MaskRule {
  name: string;
  pattern: string;
  flags?: string;
  replace: string;
}

export interface ConvertOptions {
  format?: OutputFormat;
  /** Fraction of conversation groups for the validation split, 0..0.5. Default 0. */
  valid?: number;
  seed?: string;
  mask?: MaskRule[];
  maxChars?: number;
}

export interface Report {
  format: OutputFormat;
  candidates: number;
  skipped: number;
  kept: number;
  train: number;
  valid: number;
  dropped: Partial<Record<DropReason, number>>;
  dropped_total: number;
  /** Dropped for broken content (everything except duplicates). */
  invalid_total: number;
  /** Up to 5 source record ids per reason. */
  examples: Partial<Record<DropReason, string[]>>;
  masked: Record<string, number>;
  dialects: Partial<Record<Dialect, number>>;
  warnings: string[];
}

export interface ConvertResult {
  train: object[];
  valid: object[];
  report: Report;
}
