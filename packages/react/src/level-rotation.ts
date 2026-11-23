import { createContext, useMemo } from "react";
import { Quaternion, type PerspectiveCamera } from "three";
import { levelCorrectionQuaternion, type PanoLevelCorrection } from "./level-correction";

export const HotspotLevelCorrectionContext = createContext<PanoLevelCorrection | undefined>(undefined);

export function useLevelRotation({ pitch = 0, roll = 0 }: PanoLevelCorrection = {}) {
  return useMemo(() => pitch || roll
    ? new Quaternion(...levelCorrectionQuaternion(pitch, roll))
    : null, [pitch, roll]);
}

/** Express a pane or portal camera in the same coordinates as the tile bounds. */
export function cameraInSourceSpace(
  camera: PerspectiveCamera,
  inverse: Quaternion | null,
  target: PerspectiveCamera,
): PerspectiveCamera {
  if (!inverse) return camera;
  target.copy(camera, false);
  camera.getWorldPosition(target.position).applyQuaternion(inverse);
  camera.getWorldQuaternion(target.quaternion).premultiply(inverse);
  return target;
}
