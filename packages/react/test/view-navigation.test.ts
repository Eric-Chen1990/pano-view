import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_NAVIGATION_ACCELERATION,
  DEFAULT_NAVIGATION_DECELERATION,
  DEFAULT_NAVIGATION_MAX_DURATION,
  DEFAULT_NAVIGATION_MIN_DURATION,
  DEFAULT_NAVIGATION_SPEED,
  FLY_OUT_MAX_HORIZONTAL_FOV,
  FLY_OUT_MAX_TAN_RATIO,
  FLY_OUT_VIEWPORT_THRESHOLD,
  flyOutFovCap,
  navigationRotationLength,
  navigationZoomUnits,
  resolveFlyOutPeakFov,
  resolveNavigationPlan,
  resolveTrapezoidProfile,
  sampleNavigationFov,
  sampleNavigationProgress,
} from "../src/view-navigation";

const fovLimits = { min: 30, max: 100 };

test("narrower FOV yields a longer automatic duration for the same turn", () => {
  const fromWide = { yaw: 0, pitch: 0, fov: 90 };
  const fromNarrow = { yaw: 0, pitch: 0, fov: 30 };
  const target = { yaw: 120, pitch: 0, fov: 90 };
  const wide = resolveNavigationPlan({
    from: fromWide,
    target: { ...target, fov: 90 },
    yawDelta: 120,
    fovLimits,
  });
  const narrow = resolveNavigationPlan({
    from: fromNarrow,
    target: { ...target, fov: 30 },
    yawDelta: 120,
    fovLimits,
  });
  assert.ok(narrow.duration > wide.duration);
  assert.equal(wide.peakFov, null);
});

test("zoom duration depends on the zoom ratio, not the degree difference", () => {
  const from = { yaw: 0, pitch: 0, fov: 40 };
  const double = resolveNavigationPlan({
    from,
    target: { yaw: 0, pitch: 0, fov: 80 },
    yawDelta: 0,
    fovLimits,
  });
  const sameRatioElsewhere = resolveNavigationPlan({
    from: { yaw: 0, pitch: 0, fov: 30 },
    target: { yaw: 0, pitch: 0, fov: 60 },
    yawDelta: 0,
    fovLimits,
  });
  assert.equal(navigationZoomUnits(40, 80), 1);
  assert.equal(navigationZoomUnits(30, 60), 1);
  assert.equal(double.duration, sameRatioElsewhere.duration);
  assert.ok(double.duration >= DEFAULT_NAVIGATION_MIN_DURATION);
});

test("explicit duration wins over reduced motion and automatic speed", () => {
  const from = { yaw: 0, pitch: 0, fov: 75 };
  const target = { yaw: 180, pitch: 0, fov: 75 };
  const plan = resolveNavigationPlan({
    from,
    target,
    yawDelta: 180,
    options: { duration: 650, speed: 0.1 },
    defaults: { speed: 0.1, maxDuration: 5000 },
    fovLimits,
    reducedMotion: true,
  });
  assert.equal(plan.duration, 650);
});

test("reduced motion jumps when duration is omitted", () => {
  const plan = resolveNavigationPlan({
    from: { yaw: 0, pitch: 0, fov: 75 },
    target: { yaw: 90, pitch: 0, fov: 75 },
    yawDelta: 90,
    fovLimits,
    reducedMotion: true,
  });
  assert.deepEqual(plan, {
    duration: 0,
    peakFov: null,
    profile: { kind: "jump" },
  });
});

test("per-call speed overrides viewer defaults; invalid speed falls back", () => {
  const from = { yaw: 0, pitch: 0, fov: 75 };
  const target = { yaw: 90, pitch: 0, fov: 75 };
  const slow = resolveNavigationPlan({
    from,
    target,
    yawDelta: 90,
    options: { speed: 0.8 },
    defaults: { speed: 3 },
    fovLimits,
  });
  const fastDefault = resolveNavigationPlan({
    from,
    target,
    yawDelta: 90,
    defaults: { speed: 3 },
    fovLimits,
  });
  const invalid = resolveNavigationPlan({
    from,
    target,
    yawDelta: 90,
    options: { speed: -1 },
    defaults: { speed: Number.NaN },
    fovLimits,
  });
  assert.ok(slow.duration > fastDefault.duration);
  assert.equal(
    invalid.duration,
    resolveNavigationPlan({
      from,
      target,
      yawDelta: 90,
      defaults: { speed: DEFAULT_NAVIGATION_SPEED },
      fovLimits,
    }).duration,
  );
});

test("automatic durations clamp to min and max", () => {
  const tiny = resolveNavigationPlan({
    from: { yaw: 0, pitch: 0, fov: 90 },
    target: { yaw: 1, pitch: 0, fov: 90 },
    yawDelta: 1,
    defaults: { minDuration: 400, maxDuration: 800 },
    fovLimits,
  });
  const huge = resolveNavigationPlan({
    from: { yaw: 0, pitch: 0, fov: 30 },
    target: { yaw: 180, pitch: 0, fov: 30 },
    yawDelta: 180,
    defaults: { speed: 0.2, minDuration: 400, maxDuration: 800 },
    fovLimits,
  });
  assert.equal(tiny.duration, 400);
  assert.equal(huge.duration, 800);
  assert.ok(DEFAULT_NAVIGATION_MIN_DURATION <= DEFAULT_NAVIGATION_MAX_DURATION);
});

test("flyOut widens mid-path for long narrow turns and leaves short turns alone", () => {
  const from = { yaw: 0, pitch: 0, fov: 30 };
  const target = { yaw: 180, pitch: 0, fov: 30 };
  const rotation = navigationRotationLength(from, target, 180);
  assert.ok(rotation / 30 > FLY_OUT_VIEWPORT_THRESHOLD);

  const withFlyOut = resolveNavigationPlan({
    from,
    target,
    yawDelta: 180,
    options: { flyOut: true },
    fovLimits,
  });
  const without = resolveNavigationPlan({
    from,
    target,
    yawDelta: 180,
    options: { flyOut: false },
    fovLimits,
  });
  assert.ok(withFlyOut.peakFov != null);
  assert.ok(withFlyOut.peakFov! > 30);
  assert.ok(withFlyOut.peakFov! <= fovLimits.max);
  assert.equal(without.peakFov, null);
  assert.ok(withFlyOut.duration <= without.duration);

  const short = resolveFlyOutPeakFov(20, 30, 30, fovLimits);
  assert.equal(short, null);

  assert.equal(sampleNavigationFov(30, 30, 0, withFlyOut.peakFov), 30);
  assert.equal(sampleNavigationFov(30, 30, 1, withFlyOut.peakFov), 30);
  const mid = sampleNavigationFov(30, 30, 0.5, withFlyOut.peakFov);
  assert.ok(Math.abs(mid - withFlyOut.peakFov!) < 1e-6);
});

const tanHalf = (degrees: number) => Math.tan((degrees * Math.PI) / 360);
const horizontalFov = (vertical: number, aspect: number) =>
  (2 * Math.atan(tanHalf(vertical) * aspect) * 180) / Math.PI;

test("flyOut limits edge stretch instead of pulling back to the FOV limit", () => {
  // Look-to-hotspot in the Playground: about 151° at 60° → 55°.
  const peak = resolveFlyOutPeakFov(151, 60, 55, fovLimits);
  assert.ok(peak != null);
  assert.ok(peak! < 80, `peak ${peak} should stay far below the 100° limit`);
  assert.ok(
    tanHalf(peak!) <= tanHalf(60) * FLY_OUT_MAX_TAN_RATIO + 1e-9,
  );
});

test("flyOut caps horizontal FOV for the viewport aspect", () => {
  const aspect = 16 / 9;
  const peak = resolveFlyOutPeakFov(170, 55, 55, fovLimits, aspect);
  assert.ok(peak != null);
  assert.ok(horizontalFov(peak!, aspect) <= FLY_OUT_MAX_HORIZONTAL_FOV + 1e-6);
  assert.ok(flyOutFovCap(55, aspect) <= flyOutFovCap(55, undefined));
});

test("flyOut is skipped when the viewport is already wider than the horizontal cap", () => {
  // 60° vertical at 2.5:1 is already about 111° horizontal.
  assert.equal(resolveFlyOutPeakFov(151, 60, 55, fovLimits, 3), null);
});

test("flyOut FOV curve respects from and to when they differ", () => {
  const peak = 80;
  assert.equal(sampleNavigationFov(40, 60, 0, peak), 40);
  assert.equal(sampleNavigationFov(40, 60, 1, peak), 60);
  const mid = sampleNavigationFov(40, 60, 0.5, peak);
  assert.ok(Math.abs(mid - peak) < 1e-6);
});

test("viewer flyOut default applies when the call omits flyOut", () => {
  const plan = resolveNavigationPlan({
    from: { yaw: 0, pitch: 0, fov: 30 },
    target: { yaw: 180, pitch: 0, fov: 30 },
    yawDelta: 180,
    defaults: { flyOut: true },
    fovLimits,
  });
  assert.ok(plan.peakFov != null);
});

test("zero automatic motion resolves to an immediate jump", () => {
  const plan = resolveNavigationPlan({
    from: { yaw: 10, pitch: 5, fov: 70 },
    target: { yaw: 10, pitch: 5, fov: 70 },
    yawDelta: 0,
    fovLimits,
  });
  assert.deepEqual(plan, {
    duration: 0,
    peakFov: null,
    profile: { kind: "jump" },
  });
});

test("the default profile accelerates from rest and decelerates longer before stopping", () => {
  const plan = resolveNavigationPlan({
    from: { yaw: 0, pitch: 0, fov: 60 },
    target: { yaw: 150, pitch: 0, fov: 60 },
    yawDelta: 150,
    fovLimits,
  });
  assert.equal(plan.profile.kind, "trapezoid");
  if (plan.profile.kind !== "trapezoid") return;
  assert.ok(plan.profile.accelEnd > 0);
  assert.ok(plan.profile.cruiseEnd < 1);
  assert.ok(plan.profile.cruiseEnd - plan.profile.accelEnd > 0);
  assert.ok(1 - plan.profile.cruiseEnd > plan.profile.accelEnd);
  const early = sampleNavigationProgress(0.05, plan.profile);
  assert.ok(early < 0.02, "the first moments cover less than a constant speed");
  const step = plan.profile.accelEnd / 5;
  const rampStart = sampleNavigationProgress(step, plan.profile);
  const rampMiddle =
    sampleNavigationProgress(3 * step, plan.profile) -
    sampleNavigationProgress(2 * step, plan.profile);
  assert.ok(rampStart < rampMiddle, "acceleration eases in instead of starting at full rate");
  const tail = 1 - sampleNavigationProgress(0.98, plan.profile);
  assert.ok(tail > 0 && tail < 0.02, "the last moments are slower than a constant speed");
  assert.equal(sampleNavigationProgress(0, plan.profile), 0);
  assert.equal(sampleNavigationProgress(1, plan.profile), 1);
  assert.equal(DEFAULT_NAVIGATION_ACCELERATION, 1.2);
  assert.equal(DEFAULT_NAVIGATION_DECELERATION, 0.8);
});

test("a short move never reaches cruise speed", () => {
  const { profile } = resolveTrapezoidProfile(0.2, DEFAULT_NAVIGATION_SPEED, 3, 2);
  assert.equal(profile.kind, "trapezoid");
  if (profile.kind !== "trapezoid") return;
  assert.equal(profile.cruiseDistance, 0);
  assert.ok(profile.accelDistance > 0);
  assert.ok(profile.accelDistance < 1);
});

test("zero acceleration starts at cruise speed and zero deceleration does not slow down", () => {
  const noAccel = resolveTrapezoidProfile(2, 1, 0, 2);
  assert.equal(noAccel.profile.kind, "trapezoid");
  if (noAccel.profile.kind !== "trapezoid") return;
  assert.equal(noAccel.profile.accelEnd, 0);
  assert.ok(noAccel.profile.cruiseEnd < 1);

  const noDecel = resolveTrapezoidProfile(2, 1, 2, 0);
  assert.equal(noDecel.profile.kind, "trapezoid");
  if (noDecel.profile.kind !== "trapezoid") return;
  assert.equal(noDecel.profile.cruiseEnd, 1);
});

test("invalid acceleration falls back, and an explicit curve bypasses the speed profile", () => {
  const fallback = resolveNavigationPlan({
    from: { yaw: 0, pitch: 0, fov: 75 },
    target: { yaw: 90, pitch: 0, fov: 75 },
    yawDelta: 90,
    options: { acceleration: -5 },
    defaults: { deceleration: Number.NaN },
    fovLimits,
  });
  const builtin = resolveNavigationPlan({
    from: { yaw: 0, pitch: 0, fov: 75 },
    target: { yaw: 90, pitch: 0, fov: 75 },
    yawDelta: 90,
    fovLimits,
  });
  assert.equal(fallback.duration, builtin.duration);
  assert.deepEqual(fallback.profile, builtin.profile);

  const linear = resolveNavigationPlan({
    from: { yaw: 0, pitch: 0, fov: 75 },
    target: { yaw: 90, pitch: 0, fov: 75 },
    yawDelta: 90,
    options: { easing: "linear" },
    fovLimits,
  });
  assert.deepEqual(linear.profile, { kind: "linear" });
  assert.equal(sampleNavigationProgress(0.25, linear.profile), 0.25);
});
