export type GyroTouchMode =
  | "off"
  | "horizontaloffset"
  | "full"
  | "disablegyro";

export type GyroPose = {
  yaw: number;
  pitch: number;
  roll: number;
};

/** Degrees; shared by Gyro and the view runtime so idle noise does not dirty frames. */
export const GYRO_POSE_EPSILON = 0.02;

/** Minimum pose jump (degrees) before a sensor discontinuity can re-anchor. */
export const GYRO_DISCONTINUITY_ANGLE_DEG = 15;

/** Angular speed (degrees per second) that counts as a sensor discontinuity. */
export const GYRO_DISCONTINUITY_SPEED_DEG_PER_S = 1200;
