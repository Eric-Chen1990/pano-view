import { MathUtils, Vector3 } from "three";
import { MAX_HOTSPOT_PITCH } from "./types";
import type { HotspotPosition } from "./types";

export function normalizePanoYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) {
    return 0;
  }
  return MathUtils.euclideanModulo(yaw + 180, 360) - 180;
}

export function clampPanoPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) {
    return 0;
  }
  return MathUtils.clamp(pitch, -MAX_HOTSPOT_PITCH, MAX_HOTSPOT_PITCH);
}

export function normalizePanoPosition(
  position: HotspotPosition,
): HotspotPosition {
  return {
    yaw: normalizePanoYaw(position.yaw),
    pitch: clampPanoPitch(position.pitch),
  };
}

export function panoPositionToVector3(
  position: HotspotPosition,
  radius = 1,
): Vector3 {
  const normalized = normalizePanoPosition(position);
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 1;
  const yaw = MathUtils.degToRad(normalized.yaw);
  const pitch = MathUtils.degToRad(normalized.pitch);
  const cosPitch = Math.cos(pitch);

  return new Vector3(
    cosPitch * Math.sin(yaw) * safeRadius,
    Math.sin(pitch) * safeRadius,
    -cosPitch * Math.cos(yaw) * safeRadius,
  );
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
