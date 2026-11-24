import {
  Camera,
  MathUtils,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import type { HotspotMode, HotspotScaleMode, HotspotTooltipPlacement } from "./types";

const point = new Vector3();
const normal = new Vector3();
const up = new Vector3();
const right = new Vector3();
const scale = new Vector3();
const rotation = new Quaternion();
const basis = new Matrix4();
const cameraRight = new Vector3();
const cameraUp = new Vector3();
const cameraRotation = new Quaternion();

function setTooltipAnchorPoint(anchor: Object3D, mode: HotspotMode) {
  anchor.getWorldPosition(point);
  const radius = point.length();
  if (mode === "surface" && radius > 0) point.multiplyScalar(990 / radius);
}

export function tooltipReferenceSlope(referenceFov: number) {
  const fov = MathUtils.clamp(Number.isFinite(referenceFov) ? referenceFov : 75, 1, 179);
  return Math.tan(MathUtils.degToRad(fov) / 2);
}

export function setTooltipWorldFrame(
  anchor: Object3D,
  camera: Camera,
  height: number,
  mode: HotspotMode,
  scaleMode: HotspotScaleMode,
  referenceFov: number,
) {
  setTooltipAnchorPoint(anchor, mode);
  const distance = point.distanceTo(camera.getWorldPosition(normal));
  const depth = -normal.copy(point).applyMatrix4(camera.matrixWorldInverse).z;
  const unit =
    mode === "billboard" && scaleMode === "fixed"
      ? (2 * Math.max(0, depth)) /
        (Math.max(1, height) * camera.projectionMatrix.elements[5]!)
      : (2 * distance * tooltipReferenceSlope(referenceFov)) / Math.max(1, height);
  if (mode === "surface") {
    normal.copy(point).normalize().negate();
    up.set(0, 1, 0).addScaledVector(normal, -normal.y);
    if (up.lengthSq() < 1e-8)
      up.set(0, 0, 1).addScaledVector(normal, -normal.z);
    up.normalize();
    right.crossVectors(up, normal).normalize();
    rotation.setFromRotationMatrix(basis.makeBasis(right, up, normal));
  } else camera.getWorldQuaternion(rotation);
  return { depth, unit };
}

/** A tooltip owns its world transform; hotspot aspect ratio and rotation never leak in. */
export function tooltipWorldMatrix(
  target: Matrix4,
  anchor: Object3D,
  camera: Camera,
  height: number,
  mode: HotspotMode,
  scaleMode: HotspotScaleMode,
  referenceFov: number,
): Matrix4 {
  const { unit } = setTooltipWorldFrame(anchor, camera, height, mode, scaleMode, referenceFov);
  return target.compose(point, rotation, scale.setScalar(unit));
}

export function spatialTooltipWorldMatrix(
  target: Matrix4,
  anchor: Object3D,
  camera: Camera,
  viewportHeight: number,
  { mode, scaleMode, referenceFov, placement, offset }: {
    mode: HotspotMode;
    scaleMode: HotspotScaleMode;
    referenceFov: number;
    placement: HotspotTooltipPlacement;
    offset: number;
  },
  { width, height, textureWidth, textureHeight }: {
    width: number;
    height: number;
    textureWidth: number;
    textureHeight: number;
  },
): Matrix4 | null {
  // The anchor has already been placed at the center view's projected edge.
  const { depth, unit } = setTooltipWorldFrame(anchor, camera, viewportHeight, mode, scaleMode, referenceFov);
  const projectionY = camera.projectionMatrix.elements[5]!;
  if (!Number.isFinite(depth) || depth <= 0 || !Number.isFinite(projectionY) || projectionY <= 0) {
    return null;
  }
  const gap = offset * (2 * depth) / (Math.max(1, viewportHeight) * projectionY);
  const x = placement === "left" ? -1 : placement === "right" ? 1 : 0;
  const y = placement === "bottom" ? -1 : placement === "top" ? 1 : 0;
  camera.getWorldQuaternion(cameraRotation);
  cameraRight.set(x, 0, 0).applyQuaternion(cameraRotation);
  cameraUp.set(0, y, 0).applyQuaternion(cameraRotation);
  right.set(x, 0, 0).applyQuaternion(rotation);
  up.set(0, y, 0).applyQuaternion(rotation);
  point.addScaledVector(cameraRight, gap).addScaledVector(cameraUp, gap);
  point.addScaledVector(right, width * unit / 2).addScaledVector(up, height * unit / 2);
  return target.compose(point, rotation, scale.set(textureWidth * unit, textureHeight * unit, 1));
}

const CSS_Y_FLIP = new Matrix4().makeScale(1, -1, 1);

/** Keep Z invertible: CSS does not paint descendants of a singular transform. */
export function tooltipScreenMatrix(
  target: Matrix4,
  world: Matrix4,
  camera: Camera,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): Matrix4 {
  return target.set(
    width / 2, 0, 0, width / 2 + offsetX,
    0, -height / 2, 0, height / 2 + offsetY,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(world).multiply(CSS_Y_FLIP);
}
