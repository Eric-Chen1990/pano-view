import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import type { GyroPose } from "./gyro-types";
import {
  GYRO_DISCONTINUITY_ANGLE_DEG,
  GYRO_DISCONTINUITY_SPEED_DEG_PER_S,
  GYRO_POSE_EPSILON,
} from "./gyro-types";

const DEVICE_FORWARD_CORRECTION = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  -Math.PI / 2,
);
const SCREEN_AXIS = new Vector3(0, 0, 1);
const LOOK_LOCAL = new Vector3(0, 0, -1);
const UP_LOCAL = new Vector3(0, 1, 0);

const scratchEuler = new Euler(0, 0, 0, "YXZ");
const scratchScreenCorrection = new Quaternion();
const scratchInvert = new Quaternion();
const scratchWithoutRoll = new Quaternion();
const scratchForward = new Vector3();
const scratchUp = new Vector3();
const scratchExpectedUp = new Vector3();

/** Pitch magnitude (degrees) at which yaw is taken from the previous sample. */
const ZENITH_PITCH_DEG = 89;

export type DeviceOrientationSample = {
  alpha: number;
  beta: number;
  gamma: number;
  compassHeading?: number;
};

export function getScreenOrientationAngle(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const angle = window.screen.orientation?.angle;
  if (Number.isFinite(angle)) {
    return angle;
  }

  const legacyAngle = (window as Window & { orientation?: number }).orientation;
  return Number.isFinite(legacyAngle) ? legacyAngle! : 0;
}

export function normalizeGyroYaw(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

export function shortestGyroYawDelta(from: number, to: number): number {
  return normalizeGyroYaw(to - from);
}

export function deviceOrientationToQuaternion(
  sample: DeviceOrientationSample,
  screenOrientation: number,
  target: Quaternion,
): Quaternion {
  const alpha = Number.isFinite(sample.compassHeading)
    ? 360 - sample.compassHeading!
    : sample.alpha;
  scratchEuler.set(
    MathUtils.degToRad(sample.beta),
    MathUtils.degToRad(alpha),
    MathUtils.degToRad(-sample.gamma),
    "YXZ",
  );
  scratchScreenCorrection.setFromAxisAngle(
    SCREEN_AXIS,
    -MathUtils.degToRad(screenOrientation),
  );

  return target
    .setFromEuler(scratchEuler)
    .multiply(DEVICE_FORWARD_CORRECTION)
    .multiply(scratchScreenCorrection)
    .normalize();
}

/**
 * Converts a device/camera quaternion into panorama yaw / pitch / roll.
 * Near the zenith, yaw is taken from `previousYaw` so the view does not spin.
 */
export function quaternionToGyroPose(
  quaternion: Quaternion,
  previousYaw?: number,
): GyroPose {
  scratchForward.copy(LOOK_LOCAL).applyQuaternion(quaternion);
  const pitchRad = Math.asin(MathUtils.clamp(scratchForward.y, -1, 1));
  const pitch = MathUtils.radToDeg(pitchRad);
  const nearZenith = Math.abs(pitch) >= ZENITH_PITCH_DEG;
  const yaw =
    nearZenith && previousYaw !== undefined
      ? previousYaw
      : MathUtils.radToDeg(Math.atan2(scratchForward.x, -scratchForward.z));

  scratchEuler.set(pitchRad, -MathUtils.degToRad(yaw), 0, "YXZ");
  scratchWithoutRoll.setFromEuler(scratchEuler);
  scratchUp.copy(UP_LOCAL).applyQuaternion(quaternion);
  scratchExpectedUp.copy(UP_LOCAL).applyQuaternion(scratchWithoutRoll);
  // Signed twist of the camera up around the look axis (matches YXZ euler.z).
  const look = scratchForward;
  const crossX =
    scratchUp.y * scratchExpectedUp.z - scratchUp.z * scratchExpectedUp.y;
  const crossY =
    scratchUp.z * scratchExpectedUp.x - scratchUp.x * scratchExpectedUp.z;
  const crossZ =
    scratchUp.x * scratchExpectedUp.y - scratchUp.y * scratchExpectedUp.x;
  const sinTwist = crossX * look.x + crossY * look.y + crossZ * look.z;
  const cosTwist = MathUtils.clamp(scratchExpectedUp.dot(scratchUp), -1, 1);
  const roll = MathUtils.radToDeg(Math.atan2(sinTwist, cosTwist));

  return {
    yaw: normalizeGyroYaw(yaw),
    pitch,
    roll,
  };
}

/** Legacy YXZ euler decomposition; kept for non-zenith parity tests. */
export function quaternionToGyroPoseEuler(quaternion: Quaternion): GyroPose {
  scratchEuler.setFromQuaternion(quaternion, "YXZ");
  return {
    yaw: MathUtils.radToDeg(-scratchEuler.y),
    pitch: MathUtils.radToDeg(scratchEuler.x),
    roll: MathUtils.radToDeg(scratchEuler.z),
  };
}

export function createRelativeCalibration(
  deviceQuaternion: Quaternion,
  yaw: number,
  pitch: number,
  target: Quaternion,
): Quaternion {
  scratchInvert.copy(deviceQuaternion).invert();
  scratchEuler.set(
    MathUtils.degToRad(pitch),
    MathUtils.degToRad(-yaw),
    0,
    "YXZ",
  );
  return target
    .setFromEuler(scratchEuler)
    .multiply(scratchInvert)
    .normalize();
}

export function applyGyroCalibration(
  deviceQuaternion: Quaternion,
  calibration: Quaternion,
  target: Quaternion,
  previousYaw?: number,
): GyroPose {
  return quaternionToGyroPose(
    target.copy(calibration).multiply(deviceQuaternion).normalize(),
    previousYaw,
  );
}

/** Shrink a touch pitch offset toward zero by the absolute device pitch change. */
export function reduceGyroPitchOffset(
  offset: number,
  pitchDelta: number,
): number {
  if (offset === 0 || pitchDelta === 0) {
    return offset;
  }
  const absDelta = Math.abs(pitchDelta);
  if (offset > 0) {
    return Math.max(0, offset - absDelta);
  }
  return Math.min(0, offset + absDelta);
}

/** Rewrite touch offsets so they match a hard-constrained view. */
export function reclaimGyroOffsets(
  poseYaw: number,
  posePitch: number,
  constrainedYaw: number,
  constrainedPitch: number,
): { yaw: number; pitch: number } {
  return {
    yaw: shortestGyroYawDelta(poseYaw, constrainedYaw),
    pitch: constrainedPitch - posePitch,
  };
}

export function gyroPoseAngleDelta(from: GyroPose, to: GyroPose): number {
  return Math.max(
    Math.abs(shortestGyroYawDelta(from.yaw, to.yaw)),
    Math.abs(to.pitch - from.pitch),
    Math.abs(shortestGyroYawDelta(from.roll, to.roll)),
  );
}

export function shouldReanchorGyro(
  angleDeltaDegrees: number,
  deltaSeconds: number,
): boolean {
  if (
    !(deltaSeconds > 0) ||
    angleDeltaDegrees <= GYRO_DISCONTINUITY_ANGLE_DEG
  ) {
    return false;
  }
  return (
    angleDeltaDegrees / deltaSeconds >= GYRO_DISCONTINUITY_SPEED_DEG_PER_S
  );
}

export function posesNearlyEqual(
  a: GyroPose,
  b: GyroPose,
  epsilon = GYRO_POSE_EPSILON,
): boolean {
  return (
    Math.abs(shortestGyroYawDelta(a.yaw, b.yaw)) < epsilon &&
    Math.abs(a.pitch - b.pitch) < epsilon &&
    Math.abs(a.roll - b.roll) < epsilon
  );
}
