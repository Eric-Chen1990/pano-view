import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AUTO_ROTATE_RESTORE_MIN_DURATION_SECONDS,
  autoRotateRestoreDuration,
  fovScaledYawSpeed,
  sampleRestoreFov,
  stepAutoRotateSpeed,
} from "../src/auto-rotate-motion";

test("stepAutoRotateSpeed ramps from zero toward the target", () => {
  assert.equal(stepAutoRotateSpeed(0, 18, 18, 0.5), 9);
  assert.equal(stepAutoRotateSpeed(9, 18, 18, 0.5), 18);
  assert.equal(stepAutoRotateSpeed(18, 18, 18, 0.5), 18);
});

test("stepAutoRotateSpeed decelerates when the target slows", () => {
  assert.equal(stepAutoRotateSpeed(18, 6, 18, 0.5), 9);
  assert.equal(stepAutoRotateSpeed(9, 6, 18, 0.5), 6);
});

test("stepAutoRotateSpeed reverses through zero", () => {
  assert.equal(stepAutoRotateSpeed(18, -18, 18, 1), 0);
  assert.equal(stepAutoRotateSpeed(0, -18, 18, 1), -18);
});

test("stepAutoRotateSpeed snaps when acceleration is zero", () => {
  assert.equal(stepAutoRotateSpeed(0, 18, 0, 1), 18);
  assert.equal(stepAutoRotateSpeed(18, -12, 0, 0.1), -12);
});

test("fovScaledYawSpeed scales with current FOV", () => {
  assert.equal(fovScaledYawSpeed(18, 75, 75), 18);
  assert.equal(fovScaledYawSpeed(18, 37.5, 75), 9);
  assert.equal(fovScaledYawSpeed(18, 150, 75), 36);
  assert.equal(fovScaledYawSpeed(-12, 50, 100), -6);
});

test("fovScaledYawSpeed falls back for invalid FOV", () => {
  assert.equal(fovScaledYawSpeed(18, 0, 75), 18);
  assert.equal(fovScaledYawSpeed(18, 40, 0), 18);
});

test("autoRotateRestoreDuration matches the ramp with a floor", () => {
  assert.equal(
    autoRotateRestoreDuration(18, 18),
    AUTO_ROTATE_RESTORE_MIN_DURATION_SECONDS,
  );
  assert.equal(
    autoRotateRestoreDuration(18, 0),
    AUTO_ROTATE_RESTORE_MIN_DURATION_SECONDS,
  );
  assert.equal(
    autoRotateRestoreDuration(9, 90),
    AUTO_ROTATE_RESTORE_MIN_DURATION_SECONDS,
  );
  assert.equal(autoRotateRestoreDuration(36, 12), 3);
});

test("sampleRestoreFov hits the endpoints and eases in between", () => {
  assert.equal(sampleRestoreFov(40, 75, 0, 1), 40);
  assert.equal(sampleRestoreFov(40, 75, 1, 1), 75);
  const mid = sampleRestoreFov(40, 75, 0.5, 1);
  assert.ok(mid > 40 && mid < 75);
  assert.equal(mid, 57.5);
  assert.equal(sampleRestoreFov(40, 75, 2, 0), 75);
});
