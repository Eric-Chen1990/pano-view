export type PanoDataErrorCode =
  | "INVALID_OPTIONS"
  | "FETCH_FAILED"
  | "HTTP_ERROR"
  | "INVALID_JSON"
  | "INVALID_CONFIG"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "UNSUPPORTED_PROJECTION"
  | "INVALID_PROJECT"
  | "INVALID_REFERENCE"
  | "ABORTED";

export class PanoDataError extends Error {
  readonly code: PanoDataErrorCode;
  readonly status?: number;
  readonly sceneId?: string;
  readonly field?: string;
  readonly cause?: unknown;
  constructor(
    code: PanoDataErrorCode,
    message: string,
    details: {
      status?: number;
      sceneId?: string;
      field?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message);
    this.name = "PanoDataError";
    this.code = code;
    Object.assign(this, details);
  }
}

export function aborted(signal?: AbortSignal | null): void {
  if (signal?.aborted)
    throw new PanoDataError("ABORTED", "Loading was cancelled");
}
