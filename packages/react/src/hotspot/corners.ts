import { MathUtils, Quaternion, Vector3 } from "three";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";
import { panoPositionToVector3, vector3ToPanoPosition } from "./coordinates";
import { MAX_HOTSPOT_PITCH, type HotspotCorners, type HotspotPosition } from "./types";

const CORNER_RADIUS = DEFAULT_PANORAMA_RADIUS - 10;
const MIN_PLANE_DEPTH = 1;

/** Solve for a planar parallelogram with one vertex on each corner ray. */
export function fitHotspotCorners(corners: HotspotCorners) {
  if (!Array.isArray(corners) || corners.length !== 4) return null;
  for (const corner of corners) {
    if (!Number.isFinite(corner?.yaw) || !Number.isFinite(corner?.pitch) ||
      Math.abs(corner.pitch) > MAX_HOTSPOT_PITCH) return null;
  }
  const [a, b, c, d] = corners.map((corner) => panoPositionToVector3(corner)) as [Vector3, Vector3, Vector3, Vector3];
  const cross = new Vector3();
  const determinant = (u: Vector3, v: Vector3, w: Vector3) =>
    u.dot(cross.crossVectors(v, w));
  // The alternating cofactors give a*w0 + c*w2 = b*w1 + d*w3.
  // Positive weights also enforce convex, clockwise winding on the viewing side.
  const weights = [determinant(b, c, d), determinant(a, c, d), determinant(a, b, d), determinant(a, b, c)];
  if (weights.some((weight) => weight <= 1e-12)) return null;
  const scale = CORNER_RADIUS / Math.max(...weights);
  const vertices = [a.multiplyScalar(weights[0]! * scale), b.multiplyScalar(weights[1]! * scale),
    c.multiplyScalar(weights[2]! * scale), d.multiplyScalar(weights[3]! * scale)] as const;
  const center = a.clone().add(c).multiplyScalar(0.5);
  const normal = cross.crossVectors(b.clone().sub(a), d.clone().sub(a)).normalize();
  if (Math.abs(normal.dot(center)) < MIN_PLANE_DEPTH) return null;
  return { vertices, center };
}

export function validateHotspotCorners(corners: HotspotCorners): boolean {
  return fitHotspotCorners(corners) !== null;
}

export function getHotspotCornerCenter(corners: HotspotCorners): HotspotPosition | null {
  const fit = fitHotspotCorners(corners);
  return fit ? vector3ToPanoPosition(fit.center) : null;
}

/** Place the handle beyond an edge. The optional minimum gap is in degrees. */
export function getHotspotRotationHandle(
  corners: HotspotCorners,
  edge: "top" | "bottom" = "top",
  minimumGap = 0,
): HotspotPosition | null {
  const fit = fitHotspotCorners(corners);
  if (!fit) return null;
  const [start, end] = edge === "top" ? [0, 1] as const : [2, 3] as const;
  const edgeCenter = fit.vertices[start].clone().lerp(fit.vertices[end], 0.5);
  const handle = fit.center.clone().lerp(edgeCenter, 1.4);
  const edgeDirection = edgeCenter.normalize();
  const gap = MathUtils.degToRad(Number.isFinite(minimumGap) ? Math.max(0, minimumGap) : 0);
  if (handle.angleTo(edgeDirection) >= gap) return vector3ToPanoPosition(handle);

  const axis = fit.center.normalize();
  const angle = Math.min(axis.angleTo(edgeDirection) + gap, Math.PI - 1e-6);
  const tangent = edgeDirection.projectOnPlane(axis).normalize();
  return vector3ToPanoPosition(axis.multiplyScalar(Math.cos(angle)).addScaledVector(tangent, Math.sin(angle)));
}

function rotateCorners(corners: HotspotCorners, quaternion: Quaternion): HotspotCorners {
  const rotate = (corner: HotspotPosition) =>
    vector3ToPanoPosition(panoPositionToVector3(corner).applyQuaternion(quaternion));
  return [rotate(corners[0]), rotate(corners[1]), rotate(corners[2]), rotate(corners[3])];
}

export function moveHotspotCorners(
  corners: HotspotCorners,
  from: HotspotPosition,
  to: HotspotPosition,
): HotspotCorners {
  if (from.yaw === to.yaw && from.pitch === to.pitch) return corners;
  return rotateCorners(corners, new Quaternion().setFromUnitVectors(
    panoPositionToVector3(from),
    panoPositionToVector3(to),
  ));
}

export function rotateHotspotCorners(corners: HotspotCorners, degrees: number): HotspotCorners {
  const fit = fitHotspotCorners(corners);
  if (!fit || !Number.isFinite(degrees) || degrees % 360 === 0) return corners;
  return rotateCorners(corners, new Quaternion().setFromAxisAngle(
    fit.center.normalize(),
    MathUtils.degToRad(degrees % 360),
  ));
}

export function getHotspotCornerRotation(
  center: HotspotPosition,
  from: HotspotPosition,
  to: HotspotPosition,
): number {
  const axis = panoPositionToVector3(center);
  const start = panoPositionToVector3(from).projectOnPlane(axis);
  const end = panoPositionToVector3(to).projectOnPlane(axis);
  if (start.lengthSq() < 1e-12 || end.lengthSq() < 1e-12) return 0;
  return MathUtils.radToDeg(Math.atan2(axis.dot(new Vector3().crossVectors(start, end)), start.dot(end)));
}
