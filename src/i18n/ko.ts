import type { en } from './en.js';

/** 한국어 메시지 표. 키는 en.ts 와 정확히 같아야 한다. */
export const ko: Record<keyof typeof en, string> = {
  'help.text': `trace2sft - LLM 관측 도구 내보내기를 검증된 파인튜닝용 chat JSONL 로 바꿉니다

사용법:
  trace2sft convert <입력...> [옵션]   내보낸 파일(.jsonl, .json, .gz) 변환
  trace2sft demo [옵션]                동봉된 샘플 내보내기 변환
  trace2sft --help | --version

옵션:
  --from <방언>         auto(기본) | langfuse | langsmith | otlp
  --format <형식>       openai(기본) | hf
  --out <폴더>          출력 폴더(기본 ./trace2sft-out, demo: ./trace2sft-demo)
  --valid <0..0.5>      valid.jsonl 로 보낼 대화 묶음 비율(기본 0)
  --seed <문자열>       결정적 분할용 시드(기본 trace2sft)
  --mask <rules.json>   정규식 마스킹 규칙: [{name, pattern, flags?, replace}]
  --max-chars <n>       n자보다 긴 대화 제외
  --plain-text <정책>   keep(기본) | drop: Langfuse 행의 평문 input/output 처리
  --strict              유효하지 않아 제외된 대화가 있으면 종료 코드 1
  --lang <en|ko>        화면 언어(환경 변수 TRACE2SFT_LANG, 그다음 LC_ALL/LC_MESSAGES/LANG)

종료 코드: 0 정상, 1 --strict 에서 유효하지 않은 대화 발견, 2 사용법·입력 오류.`,
  'sum.demo_title': 'trace2sft 데모 (샘플 데이터, 키 불필요)',
  'sum.convert_title': 'trace2sft 변환',
  'sum.candidates': '후보 {n}',
  'sum.skipped': '건너뜀 {n} (모델 호출이 아닌 기록)',
  'sum.kept': '유지 {kept} (train {train}, valid {valid})',
  'sum.dropped': '제외 {n}:',
  'sum.masked': '마스킹: {list}',
  'sum.warning': '경고: {text}',
  'sum.wrote': '쓴 위치 {dir}',
  'sum.strict_fail': 'strict: 유효하지 않아 제외된 대화 {n}건',
  'err.prefix': '오류',
  'err.E_USAGE': '{detail}',
  'err.E_INPUT_PARSE': '{file}: {line}번째 줄이 올바른 JSON 이 아닙니다({detail}). .jsonl 내보내기는 한 줄에 JSON 객체 하나여야 합니다.',
  'err.E_UNKNOWN_DIALECT': '{file}: 어떤 내보내기인지 알 수 없습니다. Langfuse 관측(trace_id + type), LangSmith run(run_type), OTLP JSON(resourceSpans) 중 하나여야 합니다. --from 으로 방언을 지정하세요.',
  'err.E_NO_IO_FIELDS': '{file}: 메시지 본문이 없습니다. Langfuse 는 내보내기에서 "io" 필드 그룹(과 "tools")을 켜고, OpenTelemetry 는 메시지 내용 캡처를 켠 뒤 다시 내보내세요.',
  'err.E_BAD_MASK_RULE': '마스킹 규칙 {index}({name})이 올바르지 않습니다: {detail}. 규칙마다 name, pattern(올바른 정규식), replace 가 필요합니다.',
  'err.E_INPUT_PARSE_DOC': '{file}: 올바른 JSON 이 아닙니다({detail}). 파일이 잘렸을 수 있으니 다시 내보내세요.',
  'err.E_NO_CANDIDATES': '모델 호출 기록을 찾지 못했습니다: {files}. 내보내기 파일이 비어 있지 않은지, --from 이 파일과 맞는지 확인하세요(--from auto 로 시도).',
  'warn.file_empty': '경고: {file}: 파일이 비어 있어 읽은 내용이 없습니다',
  'warn.file_no_candidates': '경고: {file}: 모델 호출 기록을 찾지 못했습니다. 내보내기 파일이나 --from 값을 확인하세요',
  'usage.cannot_read_mask': '마스킹 규칙 파일 {file} 을(를) 읽을 수 없습니다: {detail}',
  'usage.cannot_read': '{file} 을(를) 읽을 수 없습니다: {detail}',
  'usage.unknown_command': '알 수 없는 명령 "{command}". trace2sft --help 를 실행해 보세요.',
  'usage.no_input': 'convert 에는 입력 파일이 하나 이상 필요합니다. 예: trace2sft convert export.jsonl.gz --out data/',
  'usage.bad_value': '--{option} 값 "{value}" 이(가) 올바르지 않습니다. 기대값: {expected}.',
  'usage.cannot_write': '출력 폴더 {dir} 에 쓸 수 없습니다: {detail}',
  'usage.parse': '{detail}. trace2sft --help 를 실행해 보세요.',
  'reason.no_assistant': '대화가 어시스턴트 메시지로 끝나지 않음',
  'reason.orphan_tool_result': '앞선 도구 호출이 없는 tool 메시지',
  'reason.missing_tool_result': '짝이 되는 tool 결과가 없는 도구 호출',
  'reason.tool_result_not_adjacent': '도구 결과가 호출과 다른 메시지로 떨어져 있음',
  'reason.empty_message': '내용이 빈 메시지가 있음',
  'reason.unsupported_part': '비텍스트 내용(이미지·오디오 등)은 학습에 쓸 수 없음',
  'reason.too_long': '--max-chars 보다 김',
  'reason.unparseable_io': 'input/output 을 메시지로 해석할 수 없음',
  'reason.prefix_of_longer': '같은 묶음의 더 긴 대화의 앞부분(이전 턴)',
  'reason.exact_duplicate': '앞선 대화와 완전히 같음',
  'warn.fewer_than_10_examples': '유지된 예시가 10개 미만입니다. OpenAI 파인튜닝은 최소 10개가 필요합니다(2026-11-18 확인)',
  'warn.synthesized_tool_call_ids': 'id 없는 도구 호출에 결정적 id 를 만들어 넣었습니다',
  'report.title': '변환 보고서',
  'report.metric': '항목',
  'report.count': '건수',
  'report.candidates': '후보 대화',
  'report.skipped': '건너뜀(모델 호출 아님)',
  'report.kept': '유지',
  'report.train': 'Train',
  'report.valid': 'Valid',
  'report.dropped': '제외',
  'report.dropped_heading': '사유별 제외',
  'report.nothing_dropped': '제외된 것이 없습니다.',
  'report.reason': '사유',
  'report.meaning': '뜻',
  'report.examples': '예시 원본 id',
  'report.masked_heading': '마스킹한 값',
  'report.warnings_heading': '경고',
};
