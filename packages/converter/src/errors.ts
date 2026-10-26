export type ConverterErrorCode =
  | "INVALID_OPTIONS"
  | "INPUT_NOT_FOUND"
  | "INVALID_IMAGE"
  | "UNSUPPORTED_IMAGE"
  | "INVALID_PROJECTION"
  | "PIXEL_LIMIT_EXCEEDED"
  | "SHARP_UNAVAILABLE"
  | "FFMPEG_UNAVAILABLE"
  | "FFMPEG_FAILED"
  | "OUTPUT_CONFLICT"
  | "IO_ERROR"
  | "CALLBACK_FAILED"
  | "ABORTED"
  | "TIMEOUT"
  | "INVALID_MANIFEST"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "INVALID_DZI"
  | "LEVEL_NOT_FOUND"
  | "TILE_MISSING"
  | "INVALID_TILE";

export class ConverterError extends Error {
  readonly code: ConverterErrorCode;
  readonly stage: string;

  constructor(
    code: ConverterErrorCode,
    message: string,
    stage = "validation",
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = "ConverterError";
    this.code = code;
    this.stage = stage;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      stage: this.stage,
      message: this.message,
    };
  }
}

export function failure(
  code: ConverterErrorCode,
  message: string,
  stage: string,
  cause: unknown,
): ConverterError {
  return cause instanceof ConverterError
    ? cause
    : new ConverterError(code, message, stage, cause);
}

export function positiveInteger(
  value: unknown,
  label: string,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > max
  ) {
    throw new ConverterError(
      "INVALID_OPTIONS",
      `${label} must be an integer between 1 and ${max}.`,
    );
  }
  return value;
}
