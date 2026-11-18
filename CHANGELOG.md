# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-18

### Added
- `trace2sft convert` and `trace2sft demo` commands.
- Readers for Langfuse `observations_v2` rows (JSONL, JSON array, gzip), LangSmith runs and OTLP JSON with `gen_ai.*` message attributes.
- Normalization of OpenAI, Anthropic content-block and OTel parts messages into OpenAI chat messages.
- Validation of tool call pairing and roles, prefix and exact duplicate removal, regex masking, deterministic group-level train/valid split.
- `openai` and `hf` output formats, `report.json` and `report.md` (English and Korean), `--strict` exit code.
- ESM library API with TypeScript declarations.
- Empty files or a `--from` value that does not match the content fail with `E_NO_CANDIDATES` (exit 2, also with `--strict`); a single empty file next to good ones prints a warning.
- Clear errors for a missing `--mask` file (`E_USAGE`) and for a truncated `.json` document (real JSON parse error).
