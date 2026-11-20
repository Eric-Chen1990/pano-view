import { MAX_HOTSPOT_PITCH, type HotspotPosition } from "./types";

const POLE_EPSILON_DEGREES = 1e-6;
const DEG_TO_RAD = Math.PI / 180;

export function normalizePanoYaw(yaw: number): number {
  if (!Number.isFinite(yaw)) {
    return 0;
  }
  return (((yaw + 180) % 360 + 360) % 360) - 180;
}

export function clampPanoPitch(pitch: number): number {
  if (!Number.isFinite(pitch)) {
    return 0;
  }
  const clamped = Math.max(-MAX_HOTSPOT_PITCH, Math.min(MAX_HOTSPOT_PITCH, pitch));
  return Math.abs(clamped) >= MAX_HOTSPOT_PITCH - POLE_EPSILON_DEGREES
    ? Math.sign(clamped) * MAX_HOTSPOT_PITCH
    : clamped;
}

export function normalizePanoPosition(position: HotspotPosition): HotspotPosition {
  const pitch = clampPanoPitch(position.pitch);
  return {
    yaw: Math.abs(pitch) === MAX_HOTSPOT_PITCH ? 0 : normalizePanoYaw(position.yaw),
    pitch,
  };
}

export function panoPositionToXYZ(
  position: HotspotPosition,
  radius = 1,
): [number, number, number] {
  const normalized = normalizePanoPosition(position);
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 1;
  const yaw = normalized.yaw * DEG_TO_RAD;
  const pitch = normalized.pitch * DEG_TO_RAD;
  const cosPitch = Math.cos(pitch);

  return [
    cosPitch * Math.sin(yaw) * safeRadius,
    Math.sin(pitch) * safeRadius,
    -cosPitch * Math.cos(yaw) * safeRadius,
  ];
}
