export type ErrorCode =
  | 'E_USAGE'
  | 'E_INPUT_PARSE'
  | 'E_UNKNOWN_DIALECT'
  | 'E_NO_IO_FIELDS'
  | 'E_BAD_MASK_RULE'
  | 'E_NO_CANDIDATES';

/** Error with a stable code. `params` feed the localized CLI message. */
export class Trace2SftError extends Error {
  readonly code: ErrorCode;
  readonly params: Record<string, string | number>;

  constructor(code: ErrorCode, message: string, params: Record<string, string | number> = {}) {
    super(message);
    this.name = 'Trace2SftError';
    this.code = code;
    this.params = params;
  }
}
