import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector2, Vector3, type Object3D } from "three";
import type { PanoViewerState } from "../types";
import type { HotspotPosition } from "./types";
import { portalOutline } from "./portal-geometry";

export const DEFAULT_PORTAL_VIEW: PanoViewerState = { yaw: 0, pitch: 0, fov: 75 };
export const PORTAL_PREVIEW_PIXELS = 512 * 512;
export const PORTAL_LOAD_TIMEOUT_MS = 12_000;

export type PortalAperture = {
  corners: Vector2[];
  bounds: { x: number; y: number; width: number; height: number };
  focus: Vector2;
  area: number;
  zoom: number;
};

function clipPolygon(points: Vector2[], axis: "x" | "y", edge: number, sign: number) {
  return points.flatMap((point, index) => {
    const previous = points[(index + points.length - 1) % points.length]!;
    const inside = sign * (point[axis] - edge) >= 0;
    const wasInside = sign * (previous[axis] - edge) >= 0;
    const intersection = inside === wasInside ? [] : [
      previous.clone().lerp(point, (edge - previous[axis]) / (point[axis] - previous[axis])),
    ];
    return inside ? [...intersection, point] : intersection;
  });
}

const rectangularOutline = portalOutline("rectangle");

/** The aperture is measured in viewport UVs with the origin at the lower left. */
export function projectPortal(
  mesh: Object3D, camera: PerspectiveCamera, outline: readonly Vector2[] = rectangularOutline,
): PortalAperture | null {
  mesh.updateWorldMatrix(true, false);
  const corners: Vector2[] = [];
  for (const { x, y } of outline) {
    const view = new Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    if (view.z >= -camera.near) return null;
    view.applyMatrix4(camera.projectionMatrix);
    corners.push(new Vector2(view.x * 0.5 + 0.5, view.y * 0.5 + 0.5));
  }
  let clipped = clipPolygon(corners, "x", 0, 1);
  clipped = clipPolygon(clipped, "x", 1, -1);
  clipped = clipPolygon(clipped, "y", 0, 1);
  clipped = clipPolygon(clipped, "y", 1, -1);
  const area = Math.abs(clipped.reduce((sum, point, index) =>
    sum + point.cross(clipped[(index + 1) % clipped.length]!), 0)) / 2;
  if (area < 1e-8) return null;
  const x = Math.min(...clipped.map((point) => point.x));
  const y = Math.min(...clipped.map((point) => point.y));
  const width = Math.max(...clipped.map((point) => point.x)) - x;
  const height = Math.max(...clipped.map((point) => point.y)) - y;
  const focus = clipped.reduce((center, point) => center.add(point), new Vector2()).divideScalar(clipped.length);
  const distance = Math.min(...corners.map((corner, index) => {
    const edge = corners[(index + 1) % corners.length]!.clone().sub(corner);
    return Math.abs(edge.cross(focus.clone().sub(corner))) / edge.length();
  }));
  return { corners, bounds: { x, y, width, height }, focus, area, zoom: Math.SQRT1_2 / distance * 1.05 };
}

const viewEuler = new Euler(0, 0, 0, "YXZ");

export function portalViewRotation(view: HotspotPosition, out: Quaternion) {
  return out.setFromEuler(viewEuler.set(MathUtils.degToRad(view.pitch), MathUtils.degToRad(-view.yaw), 0));
}

export function portalCameraRotation(
  source: Quaternion, door: HotspotPosition, destination: HotspotPosition, out: Quaternion,
) {
  const relative = portalViewRotation(door, new Quaternion()).invert().multiply(source).normalize();
  // The viewer rotates at a fixed origin. Pure reprojection would keep every
  // point on the aperture mapped to the same destination ray as the user pans.
  return portalViewRotation(destination, out).multiply(
    new Quaternion().slerp(relative, 0.65),
  ).multiply(relative);
}

export function portalPreviewFov(sourceFov: number, destinationFov: number) {
  const focalRatio = Math.tan(MathUtils.degToRad(sourceFov / 2)) /
    Math.tan(MathUtils.degToRad(DEFAULT_PORTAL_VIEW.fov / 2));
  const tangent = Math.tan(MathUtils.degToRad(destinationFov / 2)) * (focalRatio ** 1.5);
  return MathUtils.clamp(MathUtils.radToDeg(2 * Math.atan(tangent)), 1, 179);
}

export function portalTargetSize(width: number, height: number, maxPixels: number) {
  const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
  return [Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale))] as const;
}
