import type { WebVRFrameRate } from "./types";

export function clampWebVRFoveation(
  value: number | undefined,
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * Maps a developer frame-rate preference into a value accepted by
 * `@pmndrs/xr` `setFrameRate`. Numeric Hz picks the closest entry from the
 * rates the store passes into the callback.
 */
export function resolveWebVRFrameRateOption(
  frameRate: WebVRFrameRate | undefined,
): "low" | "mid" | "high" | ((rates: ArrayLike<number>) => number | false) | undefined {
  if (frameRate === undefined) {
    return undefined;
  }
  if (frameRate === "low" || frameRate === "mid" || frameRate === "high") {
    return frameRate;
  }
  if (typeof frameRate !== "number" || !Number.isFinite(frameRate)) {
    return undefined;
  }
  const target = frameRate;
  return (rates: ArrayLike<number>) => {
    if (rates.length === 0) {
      return false;
    }
    let best = rates[0]!;
    let bestDelta = Math.abs(best - target);
    for (let i = 1; i < rates.length; i += 1) {
      const candidate = rates[i]!;
      const delta = Math.abs(candidate - target);
      if (delta < bestDelta) {
        best = candidate;
        bestDelta = delta;
      }
    }
    return best;
  };
}
