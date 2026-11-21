import type { PanoViewEasing, PanoViewerState } from "../types";

export type PanoLittlePlanetIntroOptions = {
  /** Time to show the opening view in milliseconds. Defaults to 500. */
  holdDuration?: number;
  /** Time to move to the normal view in milliseconds. Defaults to 3000. */
  duration?: number;
  /** Defaults to easeOutQuad. */
  easing?: PanoViewEasing | "easeOutQuad";
  /** Signed yaw travel in degrees, from -360 to 360. Defaults to 180. */
  yawRotation?: number;
  /** Starting pitch in degrees, from -90 (down) to 90 (up). Defaults to -90. */
  startPitch?: number;
  /** Opening planet size multiplier, from 0.5 to 2. Defaults to 1. */
  planetScale?: number;
};

function bounded(value: number | undefined, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function milliseconds(value: number | undefined, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function resolveLittlePlanetIntro(input: true | PanoLittlePlanetIntroOptions): Required<PanoLittlePlanetIntroOptions> {
  const options = input === true ? {} : input;
  return {
    holdDuration: milliseconds(options.holdDuration, 500),
    duration: milliseconds(options.duration, 3000),
    easing: options.easing === "linear" || options.easing === "easeInOutCubic" ? options.easing : "easeOutQuad",
    yawRotation: bounded(options.yawRotation, 180, -360, 360),
    startPitch: bounded(options.startPitch, -90, -90, 90),
    planetScale: bounded(options.planetScale, 1, 0.5, 2),
  };
}

export function sampleLittlePlanetIntro(
  elapsed: number,
  options: Required<PanoLittlePlanetIntroOptions>,
  landing: PanoViewerState,
) {
  const movingTime = elapsed - options.holdDuration;
  if (movingTime >= options.duration) return null;
  const progress = movingTime <= 0 ? 0 : movingTime / options.duration;
  let eased = progress;
  if (options.easing === "easeOutQuad") eased = 1 - (1 - progress) ** 2;
  if (options.easing === "easeInOutCubic") {
    eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
  }
  return {
    yaw: landing.yaw - options.yawRotation * (1 - eased),
    pitch: options.startPitch + (landing.pitch - options.startPitch) * eased,
    perspective: eased,
    // Blend into live image detail as the intro and perspective views converge.
    opacity: Math.min(1, (1 - progress) / 0.05),
  };
}
