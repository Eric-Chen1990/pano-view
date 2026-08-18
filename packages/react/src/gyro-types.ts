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
