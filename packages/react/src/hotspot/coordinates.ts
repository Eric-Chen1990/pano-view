import { MathUtils, Vector3 } from "three";
import { normalizePanoPosition, normalizePanoYaw, panoPositionToXYZ } from "./position-math";
import type { HotspotPosition } from "./types";

export { clampPanoPitch, normalizePanoPosition, normalizePanoYaw } from "./position-math";

export function panoPositionToVector3(
  position: HotspotPosition,
  radius = 1,
): Vector3 {
  return new Vector3(...panoPositionToXYZ(position, radius));
}

export function vector3ToPanoPosition(
  vector: Pick<Vector3, "x" | "y" | "z">,
): HotspotPosition {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (!Number.isFinite(length) || length === 0) {
    return { yaw: 0, pitch: 0 };
  }

  return normalizePanoPosition({
    yaw: MathUtils.radToDeg(Math.atan2(vector.x, -vector.z)),
    pitch: MathUtils.radToDeg(
      Math.asin(MathUtils.clamp(vector.y / length, -1, 1)),
    ),
  });
}

/** Move `origin` by the yaw/pitch delta from `from` to `to`, keeping the grabbed point fixed. */
export function translateHotspotPosition(
  origin: HotspotPosition,
  from: HotspotPosition,
  to: HotspotPosition,
): HotspotPosition {
  return normalizePanoPosition({
    yaw: origin.yaw + normalizePanoYaw(to.yaw - from.yaw),
    pitch: origin.pitch + (to.pitch - from.pitch),
  });
}
