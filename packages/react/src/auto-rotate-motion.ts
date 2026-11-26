/** Cap demand-mode wake deltas so the first frame after idle does not jump. */
export const AUTO_ROTATE_MAX_FRAME_DELTA_SECONDS = 1 / 30;

/** Floor for FOV restore when acceleration is 0 or the ramp is very short. */
export const AUTO_ROTATE_RESTORE_MIN_DURATION_SECONDS = 2;

/** Default idle wait after user interaction or completed navigation. */
export const AUTO_ROTATE_DEFAULT_RESUME_DELAY_MS = 3000;

export type AutoRotateHoldInput = {
  at: number;
  reason: "user" | "navigation";
} | null;

/**
 * How long AutoRotate should wait before starting or resuming.
 * Returns 0 when rotation may proceed, remaining milliseconds while waiting,
 * or `"stopped"` when user interaction permanently pauses until re-enable.
 * `resumeDelay === false` only stops after user holds; navigation uses the
 * default delay.
 */
export function autoRotateResumeWait(
  hold: AutoRotateHoldInput,
  enabledAt: number,
  now: number,
  resumeDelay: number | false | undefined,
): number | "stopped" {
  if (!hold || !(hold.at > enabledAt)) {
    return 0;
  }

  if (resumeDelay === false) {
    if (hold.reason === "user") {
      return "stopped";
    }
    const remaining =
      AUTO_ROTATE_DEFAULT_RESUME_DELAY_MS - Math.max(0, now - hold.at);
    return remaining > 0 ? remaining : 0;
  }

  const delayMs =
    Number.isFinite(resumeDelay) && resumeDelay! >= 0
      ? resumeDelay!
      : AUTO_ROTATE_DEFAULT_RESUME_DELAY_MS;
  const remaining = delayMs - Math.max(0, now - hold.at);
  return remaining > 0 ? remaining : 0;
}

/**
 * Moves a signed speed toward a signed target at a constant acceleration.
 * Acceleration of 0 snaps immediately to the target.
 */
export function stepAutoRotateSpeed(
  current: number,
  target: number,
  acceleration: number,
  deltaSeconds: number,
): number {
  if (!(acceleration > 0) || !(deltaSeconds > 0)) {
    return target;
  }
  const delta = target - current;
  if (delta === 0) {
    return target;
  }
  const step = acceleration * deltaSeconds;
  if (Math.abs(delta) <= step) {
    return target;
  }
  return current + Math.sign(delta) * step;
}

/**
 * Scales a reference-FOV yaw speed so screen-space motion stays consistent
 * across zoom levels. Invalid FOV values fall back to the unscaled speed.
 */
export function fovScaledYawSpeed(
  speed: number,
  currentFov: number,
  referenceFov: number,
): number {
  if (!(referenceFov > 0) || !(currentFov > 0) || !Number.isFinite(speed)) {
    return Number.isFinite(speed) ? speed : 0;
  }
  return speed * (currentFov / referenceFov);
}

/**
 * Duration of the FOV restore ease, matching the speed ramp when possible.
 */
export function autoRotateRestoreDuration(
  speed: number,
  acceleration: number,
): number {
  const magnitude = Math.abs(speed);
  if (!(magnitude > 0)) {
    return AUTO_ROTATE_RESTORE_MIN_DURATION_SECONDS;
  }
  if (!(acceleration > 0)) {
    return AUTO_ROTATE_RESTORE_MIN_DURATION_SECONDS;
  }
  return Math.max(
    AUTO_ROTATE_RESTORE_MIN_DURATION_SECONDS,
    magnitude / acceleration,
  );
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/**
 * FOV along a restore ease from `fromFov` to `toFov`.
 * Uses smoothstep so the change starts and ends gently.
 */
export function sampleRestoreFov(
  fromFov: number,
  toFov: number,
  elapsedSeconds: number,
  durationSeconds: number,
): number {
  if (!(durationSeconds > 0)) {
    return toFov;
  }
  const progress = smoothstep(elapsedSeconds / durationSeconds);
  return fromFov + (toFov - fromFov) * progress;
}
