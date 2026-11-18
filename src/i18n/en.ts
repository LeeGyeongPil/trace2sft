/** English message table. Korean (ko.ts) must define exactly the same keys. */
export const en = {
  'help.text': `trace2sft - turn LLM observability exports into validated fine-tuning chat JSONL

Usage:
  trace2sft convert <input...> [options]   convert exports (.jsonl, .json, .gz)
  trace2sft demo [options]                 convert the bundled sample exports
  trace2sft --help | --version

Options:
  --from <dialect>      auto (default) | langfuse | langsmith | otlp
  --format <format>     openai (default) | hf
  --out <dir>           output directory (default ./trace2sft-out, demo: ./trace2sft-demo)
  --valid <0..0.5>      share of conversation groups for valid.jsonl (default 0)
  --seed <text>         seed for the deterministic split (default trace2sft)
  --mask <rules.json>   regex masking rules: [{name, pattern, flags?, replace}]
  --max-chars <n>       drop conversations longer than n characters
  --plain-text <p>      keep (default) | drop: plain-text input/output of Langfuse rows
  --strict              exit 1 if any conversation is dropped as invalid
  --lang <en|ko>        message language (env TRACE2SFT_LANG, then LC_ALL/LC_MESSAGES/LANG)

Exit codes: 0 ok, 1 --strict found invalid conversations, 2 usage or input error.`,
  'sum.demo_title': 'trace2sft demo (sample data, no keys needed)',
  'sum.convert_title': 'trace2sft convert',
  'sum.candidates': 'candidates {n}',
  'sum.skipped': 'skipped {n} (records that are not model calls)',
  'sum.kept': 'kept {kept} (train {train}, valid {valid})',
  'sum.dropped': 'dropped {n}:',
  'sum.masked': 'masked: {list}',
  'sum.warning': 'warning: {text}',
  'sum.wrote': 'wrote {dir}',
  'sum.strict_fail': 'strict: {n} conversation(s) dropped as invalid',
  'err.prefix': 'error',
  'err.E_USAGE': '{detail}',
  'err.E_INPUT_PARSE': '{file}: line {line} is not valid JSON ({detail}). Each line of a .jsonl export must be one JSON object.',
  'err.E_UNKNOWN_DIALECT': '{file}: cannot tell which export this is. Expected Langfuse observations (trace_id + type), LangSmith runs (run_type) or OTLP JSON (resourceSpans). Use --from to force a dialect.',
  'err.E_NO_IO_FIELDS': '{file}: no message content found. For Langfuse enable the "io" field group (and "tools") in the export; for OpenTelemetry enable message content capture; then export again.',
  'err.E_BAD_MASK_RULE': 'mask rule {index} ({name}) is invalid: {detail}. Each rule needs name, pattern (valid regular expression) and replace.',
  'err.E_INPUT_PARSE_DOC': '{file}: not valid JSON ({detail}). The file may be truncated; export it again.',
  'err.E_NO_CANDIDATES': 'no model-call records found in: {files}. Check that the export is not empty and that --from matches the file (try --from auto).',
  'warn.file_empty': 'warning: {file}: the file is empty; nothing was read from it',
  'warn.file_no_candidates': 'warning: {file}: no model-call records found; check the export or the --from value',
  'usage.cannot_read_mask': 'cannot read mask rules file {file}: {detail}',
  'usage.cannot_read': 'cannot read {file}: {detail}',
  'usage.unknown_command': 'unknown command "{command}". Run trace2sft --help.',
  'usage.no_input': 'convert needs at least one input file. Example: trace2sft convert export.jsonl.gz --out data/',
  'usage.bad_value': 'invalid value "{value}" for --{option}; expected {expected}.',
  'usage.cannot_write': 'cannot write to output directory {dir}: {detail}',
  'usage.parse': '{detail}. Run trace2sft --help.',
  'reason.no_assistant': 'conversation does not end with an assistant message',
  'reason.orphan_tool_result': 'tool message without a preceding tool call',
  'reason.missing_tool_result': 'tool call without a matching tool result',
  'reason.tool_result_not_adjacent': 'tool result separated from its call by another message',
  'reason.empty_message': 'a message has empty content',
  'reason.unsupported_part': 'non-text content (image, audio, ...) cannot be trained on',
  'reason.too_long': 'longer than --max-chars',
  'reason.unparseable_io': 'input/output could not be parsed as messages',
  'reason.prefix_of_longer': 'earlier turn of a longer conversation in the same group',
  'reason.exact_duplicate': 'identical to an earlier conversation',
  'warn.fewer_than_10_examples': 'fewer than 10 examples kept; OpenAI fine-tuning needs at least 10 (checked 2026-11-18)',
  'warn.synthesized_tool_call_ids': 'some tool calls had no id; deterministic ids were generated',
  'report.title': 'Conversion report',
  'report.metric': 'Metric',
  'report.count': 'Count',
  'report.candidates': 'Candidate conversations',
  'report.skipped': 'Skipped (not model calls)',
  'report.kept': 'Kept',
  'report.train': 'Train',
  'report.valid': 'Valid',
  'report.dropped': 'Dropped',
  'report.dropped_heading': 'Dropped, by reason',
  'report.nothing_dropped': 'Nothing was dropped.',
  'report.reason': 'Reason',
  'report.meaning': 'Meaning',
  'report.examples': 'Example source ids',
  'report.masked_heading': 'Masked values',
  'report.warnings_heading': 'Warnings',
} as const;
