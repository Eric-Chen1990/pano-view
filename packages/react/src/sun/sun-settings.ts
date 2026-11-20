import { MathUtils, type PerspectiveCamera, type Vector3 } from "three";
import { normalizePanoPosition } from "../hotspot/position-math";
import type { HotspotPosition } from "../hotspot/types";

export type PanoSunProps = {
  /** Absolute panorama direction in degrees. */
  position: HotspotPosition;
  enabled?: boolean;
  /** Overall strength, from 0 to 1. */
  intensity?: number;
  /** Angular diameter of the disc in degrees. */
  angularSize?: number;
  /** Angular diameter of the glow, from 1 to 60 degrees. */
  glowAngularSize?: number;
  /** Angular diameter of the ray coverage, from 1 to 50 degrees. */
  raysAngularSize?: number;
  /** Hex color for the glow, rays, and lens flare. */
  color?: string;
  /** Disc strength, from 0 to 1. */
  disc?: number;
  /** Glow strength, from 0 to 1. */
  glow?: number;
  /** Ray strength, from 0 to 1. */
  rays?: number;
  /** Lens flare strength for the non-stereo view, from 0 to 1. */
  flare?: number;
};

function clamp(value: number | undefined, fallback: number, min = 0, max = 1) {
  return value === undefined || !Number.isFinite(value)
    ? fallback
    : MathUtils.clamp(value, min, max);
}

export function resolveSun({
  position, enabled = true, intensity, angularSize, glowAngularSize, raysAngularSize,
  color, disc, glow, rays, flare,
}: PanoSunProps) {
  if (!enabled || !Number.isFinite(position.yaw) || !Number.isFinite(position.pitch)) {
    return null;
  }
  const strength = clamp(intensity, 1);
  const layers = {
    disc: strength * clamp(disc, 1),
    glow: strength * clamp(glow, 0.55),
    rays: strength * clamp(rays, 0.18),
    flare: strength * clamp(flare, 0.22),
  };
  if (!layers.disc && !layers.glow && !layers.rays && !layers.flare) return null;

  const size = clamp(angularSize, 1.2, 0.2, 6);
  return {
    position: normalizePanoPosition(position),
    angularSize: size,
    glowAngularSize: clamp(glowAngularSize, Math.min(42, size * 18), 1, 60),
    raysAngularSize: clamp(raysAngularSize, Math.min(34, size * 13), 1, 50),
    color: color && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color) ? color : "#fff4de",
    ...layers,
  };
}

/** Projects the sun into the current view and returns the lens flare's edge fade. */
export function projectSunFlare(center: Vector3, camera: PerspectiveCamera, projected: Vector3) {
  projected.copy(center).applyMatrix4(camera.matrixWorldInverse);
  if (projected.z >= -camera.near) return 0;
  projected.applyMatrix4(camera.projectionMatrix);
  const edge = Math.max(Math.abs(projected.x), Math.abs(projected.y));
  return 1 - MathUtils.smoothstep(edge, 0.72, 1.12);
}
