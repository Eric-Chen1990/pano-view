import { MathUtils, Quaternion, Vector3 } from "three";
import { panoPositionToVector3, vector3ToPanoPosition } from "./coordinates";
import { solveHotspotCorners } from "./corner-geometry";
import type { HotspotCorners, HotspotPosition } from "./types";

export { validateHotspotCorners } from "./corner-geometry";

export function fitHotspotCorners(corners: HotspotCorners) {
  const fit = solveHotspotCorners(corners);
  if (!fit) return null;
  const [a, b, c, d] = fit.vertices;
  return {
    vertices: [new Vector3(...a), new Vector3(...b), new Vector3(...c), new Vector3(...d)] as const,
    center: new Vector3(...fit.center),
  };
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
