import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";
import { panoPositionToXYZ } from "./position-math";
import { MAX_HOTSPOT_PITCH, type HotspotCorners } from "./types";

const CORNER_RADIUS = DEFAULT_PANORAMA_RADIUS - 10;
const MIN_PLANE_DEPTH = 1;

type Point3 = [number, number, number];

function cross([ax, ay, az]: Point3, [bx, by, bz]: Point3): Point3 {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

function dot([ax, ay, az]: Point3, [bx, by, bz]: Point3): number {
  return ax * bx + ay * by + az * bz;
}

function subtract([ax, ay, az]: Point3, [bx, by, bz]: Point3): Point3 {
  return [ax - bx, ay - by, az - bz];
}

function scalePoint([x, y, z]: Point3, scale: number): Point3 {
  return [x * scale, y * scale, z * scale];
}

/** Solve for a planar parallelogram with one vertex on each corner ray. */
export function solveHotspotCorners(corners: HotspotCorners) {
  if (!Array.isArray(corners) || corners.length !== 4) return null;
  for (const corner of corners) {
    if (!Number.isFinite(corner?.yaw) || !Number.isFinite(corner?.pitch) ||
      Math.abs(corner.pitch) > MAX_HOTSPOT_PITCH) return null;
  }

  const a = panoPositionToXYZ(corners[0]);
  const b = panoPositionToXYZ(corners[1]);
  const c = panoPositionToXYZ(corners[2]);
  const d = panoPositionToXYZ(corners[3]);
  // Alternating cofactors give a*w0 + c*w2 = b*w1 + d*w3.
  // Positive weights enforce convex, clockwise winding on the viewing side.
  const crossCD = cross(c, d);
  const weights = [
    dot(b, crossCD),
    dot(a, crossCD),
    dot(a, cross(b, d)),
    dot(a, cross(b, c)),
  ] as const;
  if (weights.some((weight) => weight <= 1e-12)) return null;

  const scale = CORNER_RADIUS / Math.max(...weights);
  const vertices = [
    scalePoint(a, weights[0] * scale),
    scalePoint(b, weights[1] * scale),
    scalePoint(c, weights[2] * scale),
    scalePoint(d, weights[3] * scale),
  ] as const;
  const [topLeft, topRight, bottomRight, bottomLeft] = vertices;
  const center: Point3 = [
    (topLeft[0] + bottomRight[0]) * 0.5,
    (topLeft[1] + bottomRight[1]) * 0.5,
    (topLeft[2] + bottomRight[2]) * 0.5,
  ];
  const normal = cross(subtract(topRight, topLeft), subtract(bottomLeft, topLeft));
  const normalLength = Math.sqrt(dot(normal, normal));
  const unitNormal = scalePoint(normal, 1 / (normalLength || 1));
  if (Math.abs(dot(unitNormal, center)) < MIN_PLANE_DEPTH) return null;

  return { vertices, center };
}

export function validateHotspotCorners(corners: HotspotCorners): boolean {
  return solveHotspotCorners(corners) !== null;
}
