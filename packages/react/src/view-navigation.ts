import type {
  PanoViewEasing,
  PanoViewNavigationDefaults,
  PanoViewNavigationOptions,
  PanoViewerState,
} from "./types";

/** Peak viewport heights per second during the cruise portion. */
export const DEFAULT_NAVIGATION_SPEED = 0.8;
/** Viewport heights per second squared while leaving rest. Reaches the default speed in about 0.7s. */
export const DEFAULT_NAVIGATION_ACCELERATION = 1.2;
/** Viewport heights per second squared while stopping. Gentler than the start, so the default speed takes 1s to stop. */
export const DEFAULT_NAVIGATION_DECELERATION = 0.8;
export const DEFAULT_NAVIGATION_MIN_DURATION = 300;
export const DEFAULT_NAVIGATION_MAX_DURATION = 5000;
/** Trigger fly-out when the turn spans more than this many viewports at the narrower FOV. */
export const FLY_OUT_VIEWPORT_THRESHOLD = 1.5;
/**
 * Max growth of tan(fov / 2) over the wider endpoint. Edge stretch in a
 * rectilinear view scales with this tangent, so the cap holds for any aspect.
 */
export const FLY_OUT_MAX_TAN_RATIO = 1.3;
/** Fly-out never widens the horizontal FOV past this, given a known aspect. */
export const FLY_OUT_MAX_HORIZONTAL_FOV = 120;
/** Skip fly-out bumps too small to matter. */
const FLY_OUT_MIN_BUMP = 2;

export type NavigationFovLimits = {
  min: number;
  max: number;
};

/** How path progress advances over the navigation duration. */
export type NavigationProfile =
  | { kind: "jump" }
  | { kind: "linear" }
  | { kind: "easeInOutCubic" }
  | {
      kind: "trapezoid";
      /** Time fraction where acceleration ends and cruise begins. */
      accelEnd: number;
      /** Time fraction where cruise ends and deceleration begins. */
      cruiseEnd: number;
      /** Share of the path covered while accelerating. */
      accelDistance: number;
      /** Share of the path covered at cruise speed. */
      cruiseDistance: number;
    };

export type NavigationPlan = {
  duration: number;
  peakFov: number | null;
  profile: NavigationProfile;
};

export type ResolveNavigationPlanArgs = {
  from: PanoViewerState;
  target: PanoViewerState;
  yawDelta: number;
  options?: PanoViewNavigationOptions;
  defaults?: PanoViewNavigationDefaults;
  fovLimits: NavigationFovLimits;
  /** Viewport width / height, used to cap the horizontal FOV during fly-out. */
  aspect?: number;
  reducedMotion?: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Undefined means the default trapezoid: accelerate from rest, then decelerate to a stop. */
function resolveEasing(
  options: PanoViewNavigationOptions | undefined,
  defaults: PanoViewNavigationDefaults | undefined,
): PanoViewEasing | undefined {
  if (options?.easing === "linear" || options?.easing === "easeInOutCubic") {
    return options.easing;
  }
  if (defaults?.easing === "linear" || defaults?.easing === "easeInOutCubic") {
    return defaults.easing;
  }
  return undefined;
}

function resolveRate(
  value: number | undefined,
  fallback: number,
): number {
  if (value === 0) return 0;
  return Number.isFinite(value) && value! > 0 ? value! : fallback;
}

function resolveSpeed(
  options: PanoViewNavigationOptions | undefined,
  defaults: PanoViewNavigationDefaults | undefined,
): number {
  if (Number.isFinite(options?.speed) && options!.speed! > 0) {
    return options!.speed!;
  }
  if (Number.isFinite(defaults?.speed) && defaults!.speed! > 0) {
    return defaults!.speed!;
  }
  return DEFAULT_NAVIGATION_SPEED;
}

function resolveBound(
  value: number | undefined,
  fallback: number,
): number {
  return Number.isFinite(value) && value! >= 0 ? value! : fallback;
}

function easingPeakFactor(easing: PanoViewEasing | undefined): number {
  return easing === "easeInOutCubic" ? 1.5 : 1;
}

const JUMP_PROFILE: NavigationProfile = { kind: "jump" };

/**
 * Accelerate from rest to `speed`, cruise, then decelerate to a stop.
 * A rate of 0 skips that ramp. Short moves never reach `speed`.
 */
export function resolveTrapezoidProfile(
  distance: number,
  speed: number,
  acceleration: number,
  deceleration: number,
): { duration: number; profile: NavigationProfile } {
  if (!(distance > 0) || !(speed > 0)) {
    return { duration: 0, profile: JUMP_PROFILE };
  }
  const accel = acceleration > 0 ? acceleration : Number.POSITIVE_INFINITY;
  const decel = deceleration > 0 ? deceleration : Number.POSITIVE_INFINITY;
  const rampDistance = (velocity: number, rate: number) =>
    Number.isFinite(rate) ? (velocity * velocity) / (2 * rate) : 0;

  let peak = speed;
  let accelDistance = rampDistance(peak, accel);
  let decelDistance = rampDistance(peak, decel);
  if (accelDistance + decelDistance > distance) {
    const denom =
      (Number.isFinite(accel) ? 1 / (2 * accel) : 0) +
      (Number.isFinite(decel) ? 1 / (2 * decel) : 0);
    if (denom === 0) {
      return {
        duration: distance / speed,
        profile: {
          kind: "trapezoid",
          accelEnd: 0,
          cruiseEnd: 1,
          accelDistance: 0,
          cruiseDistance: 1,
        },
      };
    }
    peak = Math.sqrt(distance / denom);
    accelDistance = rampDistance(peak, accel);
    decelDistance = Math.max(0, distance - accelDistance);
  }

  const cruiseDistance = Math.max(0, distance - accelDistance - decelDistance);
  const accelTime = Number.isFinite(accel) ? peak / accel : 0;
  const decelTime = Number.isFinite(decel) ? peak / decel : 0;
  const cruiseTime = peak > 0 ? cruiseDistance / peak : 0;
  const duration = accelTime + cruiseTime + decelTime;
  if (!(duration > 0)) {
    return { duration: 0, profile: JUMP_PROFILE };
  }
  return {
    duration,
    profile: {
      kind: "trapezoid",
      accelEnd: accelTime / duration,
      cruiseEnd: (accelTime + cruiseTime) / duration,
      accelDistance: accelDistance / distance,
      cruiseDistance: cruiseDistance / distance,
    },
  };
}

/** Path fraction at a time fraction. Starts and ends at rest for the default profile. */
export function sampleNavigationProgress(
  timeFraction: number,
  profile: NavigationProfile,
): number {
  const u = clamp(timeFraction, 0, 1);
  if (u === 0) return 0;
  if (u === 1 || profile.kind === "jump") return 1;
  if (profile.kind === "linear") return u;
  if (profile.kind === "easeInOutCubic") {
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  }
  const { accelEnd, cruiseEnd, accelDistance, cruiseDistance } = profile;
  if (u <= accelEnd) {
    const x = accelEnd > 0 ? u / accelEnd : 1;
    // Sine ramp: acceleration starts and ends at 0, and speed meets the cruise.
    return accelDistance * (x - Math.sin(Math.PI * x) / Math.PI);
  }
  if (u <= cruiseEnd) {
    const span = cruiseEnd - accelEnd;
    const x = span > 0 ? (u - accelEnd) / span : 1;
    return accelDistance + cruiseDistance * x;
  }
  const span = 1 - cruiseEnd;
  const x = span > 0 ? (u - cruiseEnd) / span : 1;
  const decelDistance = 1 - accelDistance - cruiseDistance;
  return (
    accelDistance +
    cruiseDistance +
    decelDistance * (x + Math.sin(Math.PI * x) / Math.PI)
  );
}

/** Path length in degrees, respecting the animation's yawDelta. */
export function navigationRotationLength(
  from: PanoViewerState,
  target: PanoViewerState,
  yawDelta: number,
): number {
  const meanPitch = (from.pitch + target.pitch) / 2;
  const pitchDelta = target.pitch - from.pitch;
  const cosPitch = Math.cos((meanPitch * Math.PI) / 180);
  return Math.sqrt((yawDelta * cosPitch) ** 2 + pitchDelta ** 2);
}

/** One FOV doubling or halving counts as one unit. */
export function navigationZoomUnits(fromFov: number, toFov: number): number {
  if (!(fromFov > 0) || !(toFov > 0)) {
    return 0;
  }
  return Math.abs(Math.log(toFov / fromFov)) / Math.LN2;
}

/**
 * FOV along a navigation with optional mid-path fly-out.
 * Starts at fromFov, ends at toFov, and is widest at the midpoint when peakFov is set.
 */
export function sampleNavigationFov(
  fromFov: number,
  toFov: number,
  progress: number,
  peakFov: number | null,
): number {
  const t = clamp(progress, 0, 1);
  if (t === 0) {
    return fromFov;
  }
  if (t === 1) {
    return toFov;
  }
  const lerp = fromFov + (toFov - fromFov) * t;
  if (peakFov == null) {
    return lerp;
  }
  const midLerp = fromFov + (toFov - fromFov) * 0.5;
  return lerp + (peakFov - midLerp) * Math.sin(Math.PI * t);
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

/** Widest vertical FOV fly-out may reach from the wider endpoint. */
export function flyOutFovCap(
  baselineFov: number,
  aspect: number | undefined,
): number {
  const ratioCap = toDegrees(
    2 * Math.atan(Math.tan(toRadians(baselineFov) / 2) * FLY_OUT_MAX_TAN_RATIO),
  );
  if (!(Number.isFinite(aspect) && aspect! > 0)) {
    return ratioCap;
  }
  const horizontalCap = toDegrees(
    2 *
      Math.atan(
        Math.tan(toRadians(FLY_OUT_MAX_HORIZONTAL_FOV) / 2) / aspect!,
      ),
  );
  return Math.min(ratioCap, horizontalCap);
}

export function resolveFlyOutPeakFov(
  rotationLength: number,
  fromFov: number,
  toFov: number,
  fovLimits: NavigationFovLimits,
  aspect?: number,
): number | null {
  const narrowFov = Math.min(fromFov, toFov);
  if (!(narrowFov > 0) || !(rotationLength > 0)) {
    return null;
  }
  if (rotationLength / narrowFov <= FLY_OUT_VIEWPORT_THRESHOLD) {
    return null;
  }
  const required = rotationLength / FLY_OUT_VIEWPORT_THRESHOLD;
  const baseline = Math.max(fromFov, toFov);
  const peak = clamp(
    Math.min(Math.max(required, baseline), flyOutFovCap(baseline, aspect)),
    fovLimits.min,
    fovLimits.max,
  );
  const midLerp = (fromFov + toFov) / 2;
  if (peak < baseline || peak - midLerp < FLY_OUT_MIN_BUMP) {
    return null;
  }
  return peak;
}

export function resolveNavigationPlan({
  from,
  target,
  yawDelta,
  options,
  defaults,
  fovLimits,
  aspect,
  reducedMotion = false,
}: ResolveNavigationPlanArgs): NavigationPlan {
  const easing = resolveEasing(options, defaults);
  const flyOut = options?.flyOut ?? defaults?.flyOut ?? false;
  const rotationLength = navigationRotationLength(from, target, yawDelta);
  const peakFov = flyOut
    ? resolveFlyOutPeakFov(rotationLength, from.fov, target.fov, fovLimits, aspect)
    : null;
  const speed = resolveSpeed(options, defaults);
  const acceleration = resolveRate(
    options?.acceleration ?? defaults?.acceleration,
    DEFAULT_NAVIGATION_ACCELERATION,
  );
  const deceleration = resolveRate(
    options?.deceleration ?? defaults?.deceleration,
    DEFAULT_NAVIGATION_DECELERATION,
  );

  const effectiveFov = peakFov ?? Math.min(from.fov, target.fov);
  const rotationViewports =
    rotationLength / Math.max(effectiveFov > 0 ? effectiveFov : 1, 1e-6);
  const zoomUnits =
    peakFov != null
      ? navigationZoomUnits(from.fov, peakFov) +
        navigationZoomUnits(peakFov, target.fov)
      : navigationZoomUnits(from.fov, target.fov);
  const motion = Math.max(rotationViewports, zoomUnits);
  const trapezoid = resolveTrapezoidProfile(motion, speed, acceleration, deceleration);
  const profile: NavigationProfile =
    easing === "linear"
      ? { kind: "linear" }
      : easing === "easeInOutCubic"
        ? { kind: "easeInOutCubic" }
        : trapezoid.profile;

  if (
    options?.duration !== undefined &&
    Number.isFinite(options.duration) &&
    options.duration >= 0
  ) {
    return {
      duration: options.duration,
      peakFov: options.duration === 0 ? null : peakFov,
      profile: options.duration === 0 ? JUMP_PROFILE : profile,
    };
  }

  if (reducedMotion || !(motion > 0)) {
    return { duration: 0, peakFov: null, profile: JUMP_PROFILE };
  }

  const minDuration = resolveBound(
    defaults?.minDuration,
    DEFAULT_NAVIGATION_MIN_DURATION,
  );
  const maxDuration = Math.max(
    minDuration,
    resolveBound(defaults?.maxDuration, DEFAULT_NAVIGATION_MAX_DURATION),
  );
  const naturalMs =
    profile.kind === "trapezoid"
      ? trapezoid.duration * 1000
      : (motion * easingPeakFactor(easing) / speed) * 1000;

  if (!Number.isFinite(naturalMs) || !(naturalMs > 0)) {
    return { duration: 0, peakFov: null, profile: JUMP_PROFILE };
  }

  return {
    duration: clamp(naturalMs, minDuration, maxDuration),
    peakFov,
    profile,
  };
}

export function prefersReducedMotion(
  media: { matches: boolean } | null | undefined = globalThis.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ),
): boolean {
  return media?.matches === true;
}
