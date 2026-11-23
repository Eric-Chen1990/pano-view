import { Euler, Quaternion, Vector3 } from "three";
import { panoPositionToXYZ } from "../hotspot/position-math";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";
import { CUBE_FACES, getFaceTransform } from "../tile/face-layout";

export type PanoGridProjection = "sphere" | "cube";

export const DEFAULT_PANO_GRID_DIVISIONS = 8;
export const MIN_SPHERE_GRID_DIVISIONS = 2;
export const MAX_PANO_GRID_DIVISIONS = 64;
export const MIN_CUBE_GRID_DIVISIONS = 1;

/**
 * Sphere angular step matching one cube-face span (~90°).
 * `divisions` cells across 90° → full longitude count is `4 * divisions`.
 */
export function sphereMeridianCount(divisions: number): number {
  return 4 * clampDivisions("sphere", divisions);
}

export function sphereParallelCount(divisions: number): number {
  // Pole-to-pole cells: half the longitude count so pitch step matches yaw step.
  return 2 * clampDivisions("sphere", divisions);
}

export function sphereYawStepDegrees(divisions: number): number {
  return 90 / clampDivisions("sphere", divisions);
}

const faceQuaternionCache = new Map<(typeof CUBE_FACES)[number], Quaternion>();
const scratchLocal = new Vector3();
const scratchWorld = new Vector3();
const scratchEuler = new Euler();

function clampDivisions(
  projection: PanoGridProjection,
  divisions: number,
): number {
  const min =
    projection === "sphere" ? MIN_SPHERE_GRID_DIVISIONS : MIN_CUBE_GRID_DIVISIONS;
  if (!Number.isFinite(divisions)) {
    return DEFAULT_PANO_GRID_DIVISIONS;
  }
  return Math.max(min, Math.min(MAX_PANO_GRID_DIVISIONS, Math.round(divisions)));
}

function resolveRadius(radius: number | undefined): number {
  if (!Number.isFinite(radius) || radius === undefined || radius <= 0) {
    return DEFAULT_PANORAMA_RADIUS;
  }
  return radius;
}

function getCachedFaceQuaternion(face: (typeof CUBE_FACES)[number]): Quaternion {
  const cached = faceQuaternionCache.get(face);
  if (cached) {
    return cached;
  }
  const transform = getFaceTransform(face);
  const quaternion = new Quaternion().setFromEuler(
    scratchEuler.set(...transform.rotation, "XYZ"),
  );
  faceQuaternionCache.set(face, quaternion);
  return quaternion;
}

function pushSegment(
  positions: number[],
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
) {
  positions.push(ax, ay, az, bx, by, bz);
}

function pushLocalFacePoint(
  positions: number[],
  face: (typeof CUBE_FACES)[number],
  radius: number,
  x: number,
  y: number,
) {
  const transform = getFaceTransform(face, radius);
  const quaternion = getCachedFaceQuaternion(face);
  scratchLocal.set(x, y, 0).applyQuaternion(quaternion);
  scratchWorld
    .set(transform.position[0], transform.position[1], transform.position[2])
    .add(scratchLocal);
  positions.push(scratchWorld.x, scratchWorld.y, scratchWorld.z);
}

function pushLocalFaceSegment(
  positions: number[],
  face: (typeof CUBE_FACES)[number],
  radius: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  pushLocalFacePoint(positions, face, radius, ax, ay);
  pushLocalFacePoint(positions, face, radius, bx, by);
}

/** Build cube-face grid segments. Shared face borders are drawn once. */
export function createCubeGridPositions(
  divisions: number,
  radius = DEFAULT_PANORAMA_RADIUS,
): Float64Array {
  const n = clampDivisions("cube", divisions);
  const r = resolveRadius(radius);
  const positions: number[] = [];
  const step = (2 * r) / n;

  for (const face of CUBE_FACES) {
    for (let i = 1; i < n; i++) {
      const t = -r + step * i;
      pushLocalFaceSegment(positions, face, r, -r, t, r, t);
      pushLocalFaceSegment(positions, face, r, t, -r, t, r);
    }
  }

  // Twelve unique cube edges (shared face borders).
  const corners: Array<[number, number, number]> = [
    [-r, -r, -r],
    [r, -r, -r],
    [r, r, -r],
    [-r, r, -r],
    [-r, -r, r],
    [r, -r, r],
    [r, r, r],
    [-r, r, r],
  ];
  const edges: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  for (const [a, b] of edges) {
    const [ax, ay, az] = corners[a];
    const [bx, by, bz] = corners[b];
    pushSegment(positions, ax, ay, az, bx, by, bz);
  }

  return Float64Array.from(positions);
}

function pushPanoPoint(
  positions: number[],
  yaw: number,
  pitch: number,
  radius: number,
) {
  const [x, y, z] = panoPositionToXYZ({ yaw, pitch }, radius);
  positions.push(x, y, z);
}

/** Build sphere longitude/latitude grid segments. */
export function createSphereGridPositions(
  divisions: number,
  radius = DEFAULT_PANORAMA_RADIUS,
): Float64Array {
  const n = clampDivisions("sphere", divisions);
  const r = resolveRadius(radius);
  const positions: number[] = [];
  const meridians = sphereMeridianCount(n);
  const yawStep = sphereYawStepDegrees(n);
  const pitchStep = yawStep;
  // Dense enough that screen-space strokes stay smooth under foreshortening.
  const meridianSegments = Math.max(sphereParallelCount(n) * 4, 48);
  const parallelSegments = Math.max(meridians * 2, 64);

  for (let i = 0; i < meridians; i++) {
    const yaw = -180 + yawStep * i;
    for (let s = 0; s < meridianSegments; s++) {
      const pitchA = -90 + (180 * s) / meridianSegments;
      const pitchB = -90 + (180 * (s + 1)) / meridianSegments;
      pushPanoPoint(positions, yaw, pitchA, r);
      pushPanoPoint(positions, yaw, pitchB, r);
    }
  }

  for (let pitch = -90 + pitchStep; pitch < 90 - 1e-9; pitch += pitchStep) {
    for (let s = 0; s < parallelSegments; s++) {
      const yawA = -180 + (360 * s) / parallelSegments;
      const yawB = -180 + (360 * (s + 1)) / parallelSegments;
      pushPanoPoint(positions, yawA, pitch, r);
      pushPanoPoint(positions, yawB, pitch, r);
    }
  }

  return Float64Array.from(positions);
}

export function createPanoGridPositions(
  projection: PanoGridProjection,
  divisions: number,
  radius = DEFAULT_PANORAMA_RADIUS,
): Float64Array {
  return projection === "cube"
    ? createCubeGridPositions(divisions, radius)
    : createSphereGridPositions(divisions, radius);
}

export function clampPanoGridDivisions(
  projection: PanoGridProjection,
  divisions: number,
): number {
  return clampDivisions(projection, divisions);
}

export function countGridSegments(positions: ArrayLike<number>): number {
  return positions.length / 6;
}
