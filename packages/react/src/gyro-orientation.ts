import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import type { GyroPose } from "./gyro-types";

const DEVICE_FORWARD_CORRECTION = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  -Math.PI / 2,
);
const SCREEN_AXIS = new Vector3(0, 0, 1);

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

export function deviceOrientationToQuaternion(
  sample: DeviceOrientationSample,
  screenOrientation: number,
): Quaternion {
  const alpha = Number.isFinite(sample.compassHeading)
    ? 360 - sample.compassHeading!
    : sample.alpha;
  const deviceEuler = new Euler(
    MathUtils.degToRad(sample.beta),
    MathUtils.degToRad(alpha),
    MathUtils.degToRad(-sample.gamma),
    "YXZ",
  );
  const screenCorrection = new Quaternion().setFromAxisAngle(
    SCREEN_AXIS,
    -MathUtils.degToRad(screenOrientation),
  );

  return new Quaternion()
    .setFromEuler(deviceEuler)
    .multiply(DEVICE_FORWARD_CORRECTION)
    .multiply(screenCorrection)
    .normalize();
}

export function quaternionToGyroPose(quaternion: Quaternion): GyroPose {
  const euler = new Euler().setFromQuaternion(quaternion, "YXZ");
  return {
    yaw: MathUtils.radToDeg(-euler.y),
    pitch: MathUtils.radToDeg(euler.x),
    roll: MathUtils.radToDeg(euler.z),
  };
}

export function createRelativeCalibration(
  deviceQuaternion: Quaternion,
  yaw: number,
  pitch: number,
): Quaternion {
  const targetQuaternion = new Quaternion().setFromEuler(
    new Euler(
      MathUtils.degToRad(pitch),
      MathUtils.degToRad(-yaw),
      0,
      "YXZ",
    ),
  );
  return targetQuaternion
    .multiply(deviceQuaternion.clone().invert())
    .normalize();
}

export function applyGyroCalibration(
  deviceQuaternion: Quaternion,
  calibration: Quaternion,
): GyroPose {
  return quaternionToGyroPose(
    calibration.clone().multiply(deviceQuaternion).normalize(),
  );
}
