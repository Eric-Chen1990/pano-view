import { normalizePanoPosition, panoPositionToXYZ } from "./hotspot/position-math";
import type { HotspotPosition } from "./hotspot/types";

/** Rigid correction of the panorama image in degrees. */
export type PanoLevelCorrection = { pitch?: number; roll?: number };

export function parseLevelCorrection(value: unknown): PanoLevelCorrection | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("levelCorrection: expected an object");

  const result: PanoLevelCorrection = {};
  for (const [axis, limit] of [["pitch", 90], ["roll", 180]] as const) {
    const angle = (value as Record<string, unknown>)[axis];
    if (angle === undefined) continue;
    if (typeof angle !== "number" || !Number.isFinite(angle) || Math.abs(angle) > limit)
      throw new Error(`levelCorrection.${axis}: expected a finite number from ${-limit} to ${limit}`);
    result[axis] = angle;
  }
  return result;
}

/** Rₓ(pitch) R_z(-roll), in the viewer's right-handed coordinate system. */
export function levelCorrectionQuaternion(pitch: number, roll: number): [number, number, number, number] {
  const halfPitch = pitch * Math.PI / 360;
  const halfRoll = -roll * Math.PI / 360;
  const sinPitch = Math.sin(halfPitch);
  const cosPitch = Math.cos(halfPitch);
  const sinRoll = Math.sin(halfRoll);
  const cosRoll = Math.cos(halfRoll);
  return [sinPitch * cosRoll, -sinPitch * sinRoll, cosPitch * sinRoll, cosPitch * cosRoll];
}

function transform(position: HotspotPosition, correction: PanoLevelCorrection | undefined, inverse: boolean) {
  const { pitch = 0, roll = 0 } = correction ?? {};
  if (!pitch && !roll) return normalizePanoPosition(position);
  const [x, y, z] = panoPositionToXYZ(position);
  const [qx, qy, qz, w] = levelCorrectionQuaternion(pitch, roll);
  const sign = inverse ? -1 : 1;
  const a = sign * qx, b = sign * qy, c = sign * qz;
  const tx = 2 * (b * z - c * y);
  const ty = 2 * (c * x - a * z);
  const tz = 2 * (a * y - b * x);
  const px = x + w * tx + b * tz - c * ty;
  const py = y + w * ty + c * tx - a * tz;
  const pz = z + w * tz + a * ty - b * tx;
  return normalizePanoPosition({
    yaw: Math.atan2(px, -pz) * 180 / Math.PI,
    pitch: Math.atan2(py, Math.hypot(px, pz)) * 180 / Math.PI,
  });
}

/** Convert an image-relative anchor into the leveled viewer's coordinates. */
export function toLeveledPanoPosition(position: HotspotPosition, correction?: PanoLevelCorrection): HotspotPosition {
  return transform(position, correction, false);
}

/** Convert a viewer direction into the panorama image's coordinates. */
export function toSourcePanoPosition(position: HotspotPosition, correction?: PanoLevelCorrection): HotspotPosition {
  return transform(position, correction, true);
}
