import { MathUtils, Vector3, type Camera } from "three";
import { panoPositionToVector3 } from "./coordinates";
import type { HotspotPosition } from "./types";

const LOOK_DIR = new Vector3();
const SOURCE_DIR = new Vector3();
const RIGHT_DIR = new Vector3();

export function clampAudioVolume(volume: number | undefined): number {
  if (!Number.isFinite(volume)) {
    return 1;
  }
  return Math.max(0, Math.min(volume!, 1));
}

export function clampLookRange(range: number | undefined): number {
  if (!Number.isFinite(range)) {
    return 360;
  }
  return Math.max(0, range!);
}

/**
 * Volume falloff from look-away angle. `range > 180` disables attenuation
 * (the default 360 matches a full-sphere look-to range).
 */
export function lookRangeGain(angleDegrees: number, range: number): number {
  if (range > 180) {
    return 1;
  }
  if (range <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(1, 1 - angleDegrees / range));
}

export function audioSpatialFromView(
  camera: Camera,
  position: HotspotPosition,
  range: number,
): { pan: number; gain: number } {
  camera.getWorldDirection(LOOK_DIR);
  SOURCE_DIR.copy(panoPositionToVector3(position)).normalize();
  const angleDegrees = MathUtils.radToDeg(
    Math.acos(MathUtils.clamp(LOOK_DIR.dot(SOURCE_DIR), -1, 1)),
  );
  RIGHT_DIR.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const pan = MathUtils.clamp(
    Math.atan2(SOURCE_DIR.dot(RIGHT_DIR), SOURCE_DIR.dot(LOOK_DIR)) / (Math.PI / 2),
    -1,
    1,
  );
  return {
    pan,
    gain: lookRangeGain(angleDegrees, range),
  };
}
