import assert from "node:assert/strict";
import { test } from "node:test";
import { Euler, MathUtils, Quaternion } from "three";
import {
  applyGyroCalibration,
  createRelativeCalibration,
  gyroPoseAngleDelta,
  posesNearlyEqual,
  quaternionToGyroPose,
  quaternionToGyroPoseEuler,
  reclaimGyroOffsets,
  reduceGyroPitchOffset,
  shouldReanchorGyro,
  shortestGyroYawDelta,
} from "../src/gyro-orientation";
import {
  GYRO_DISCONTINUITY_ANGLE_DEG,
  GYRO_DISCONTINUITY_SPEED_DEG_PER_S,
  GYRO_POSE_EPSILON,
} from "../src/gyro-types";

function poseFromYawPitchRoll(
  yaw: number,
  pitch: number,
  roll: number,
): Quaternion {
  return new Quaternion().setFromEuler(
    new Euler(
      MathUtils.degToRad(pitch),
      MathUtils.degToRad(-yaw),
      MathUtils.degToRad(roll),
      "YXZ",
    ),
  );
}

test("relative calibration restores the activation yaw and pitch", () => {
  const device = poseFromYawPitchRoll(40, -12, 18);
  const calibration = createRelativeCalibration(
    device,
    -25,
    8,
    new Quaternion(),
  );
  const pose = applyGyroCalibration(
    device,
    calibration,
    new Quaternion(),
  );
  assert.ok(Math.abs(shortestGyroYawDelta(pose.yaw, -25)) < 1e-6);
  assert.ok(Math.abs(pose.pitch - 8) < 1e-6);
});

test("look-vector pose matches YXZ euler away from the zenith", () => {
  for (const [yaw, pitch, roll] of [
    [0, 0, 0],
    [45, -20, 10],
    [-120, 35, -25],
    [179, -60, 5],
    [-5, 70, 40],
  ] as const) {
    const quaternion = poseFromYawPitchRoll(yaw, pitch, roll);
    const look = quaternionToGyroPose(quaternion);
    const euler = quaternionToGyroPoseEuler(quaternion);
    assert.ok(
      Math.abs(shortestGyroYawDelta(look.yaw, euler.yaw)) < 1e-4,
      `yaw ${yaw}`,
    );
    assert.ok(Math.abs(look.pitch - euler.pitch) < 1e-4, `pitch ${pitch}`);
    assert.ok(Math.abs(look.roll - euler.roll) < 1e-4, `roll ${roll}`);
  }
});

test("near the zenith yaw stays on the previous sample", () => {
  const zenith = poseFromYawPitchRoll(12, 89.5, 30);
  const withHistory = quaternionToGyroPose(zenith, 12);
  assert.ok(Math.abs(shortestGyroYawDelta(withHistory.yaw, 12)) < 1e-9);
  assert.ok(Math.abs(withHistory.pitch - 89.5) < 1e-6);
  const nadir = poseFromYawPitchRoll(-40, -89.5, 0);
  assert.ok(
    Math.abs(shortestGyroYawDelta(quaternionToGyroPose(nadir, -40).yaw, -40)) <
      1e-9,
  );
});

test("full-mode pitch offset shrinks by absolute device pitch change", () => {
  assert.equal(reduceGyroPitchOffset(30, 10), 20);
  assert.equal(reduceGyroPitchOffset(30, -10), 20);
  assert.equal(reduceGyroPitchOffset(-30, 10), -20);
  assert.equal(reduceGyroPitchOffset(-30, -10), -20);
  assert.equal(reduceGyroPitchOffset(5, 10), 0);
  assert.equal(reduceGyroPitchOffset(-5, -10), 0);
  assert.equal(reduceGyroPitchOffset(0, 12), 0);
});

test("clamped views reclaim touch offsets to the visible pose", () => {
  assert.deepEqual(reclaimGyroOffsets(70, 80, 70, 90), {
    yaw: 0,
    pitch: 10,
  });
  assert.ok(
    Math.abs(reclaimGyroOffsets(170, 0, -170, 0).yaw - 20) < 1e-9,
  );
  assert.deepEqual(reclaimGyroOffsets(10, 5, 25, -2), {
    yaw: 15,
    pitch: -7,
  });
});

test("discontinuity reanchor needs both a large jump and high angular speed", () => {
  assert.equal(shouldReanchorGyro(10, 1 / 60), false);
  assert.equal(
    shouldReanchorGyro(GYRO_DISCONTINUITY_ANGLE_DEG, 1 / 60),
    false,
  );
  assert.equal(shouldReanchorGyro(20, 1 / 60), true);
  assert.equal(
    shouldReanchorGyro(20, 20 / (GYRO_DISCONTINUITY_SPEED_DEG_PER_S - 1)),
    false,
  );
  assert.equal(shouldReanchorGyro(20, 0), false);
});

test("pose equality uses the shared gyro epsilon", () => {
  const base = { yaw: 0, pitch: 0, roll: 0 };
  assert.equal(
    posesNearlyEqual(base, {
      yaw: GYRO_POSE_EPSILON / 2,
      pitch: 0,
      roll: 0,
    }),
    true,
  );
  assert.equal(
    posesNearlyEqual(base, {
      yaw: GYRO_POSE_EPSILON * 2,
      pitch: 0,
      roll: 0,
    }),
    false,
  );
  assert.ok(gyroPoseAngleDelta(base, { yaw: 20, pitch: 5, roll: -2 }) === 20);
});
