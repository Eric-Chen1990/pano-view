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
const cameraUp = new Vector3();
const tangentOffset = new Vector3();

function setSphereTangentBasis(worldPosition: Vector3) {
  const radiusSq = worldPosition.lengthSq();
  if (radiusSq < 1e-12) {
    right.set(1, 0, 0);
    up.set(0, 1, 0);
    return;
  }
  normal.copy(worldPosition).multiplyScalar(1 / Math.sqrt(radiusSq));
  up.set(0, 1, 0).addScaledVector(normal, -normal.y);
  if (up.lengthSq() < 1e-8) {
    up.set(0, 0, 1).addScaledVector(normal, -normal.z);
  }
  up.normalize();
  // Match surface tooltip handedness: right = radial × up.
  right.crossVectors(normal, up).normalize();
}

/**
 * Plane +Z points at the camera. Camera up projected onto that plane keeps the
 * card upright when the gaze is centered; falls back to world up near poles.
 * Avoid Object3D.lookAt: it aims -Z and would flip the plane away from the viewer.
 */
export function tooltipFacingCameraQuaternion(
  target: Quaternion,
  worldPosition: Vector3,
  camera: Camera,
): Quaternion {
  camera.getWorldPosition(normal);
  normal.sub(worldPosition);
  if (normal.lengthSq() < 1e-12) {
    camera.getWorldDirection(normal).negate();
  } else {
    normal.normalize();
  }
  camera.getWorldQuaternion(rotation);
  cameraUp.set(0, 1, 0).applyQuaternion(rotation);
  up.copy(cameraUp).addScaledVector(normal, -cameraUp.dot(normal));
  if (up.lengthSq() < 1e-8) {
    up.set(0, 1, 0).addScaledVector(normal, -normal.y);
    if (up.lengthSq() < 1e-8) {
      up.set(0, 0, 1).addScaledVector(normal, -normal.z);
    }
  }
  up.normalize();
  right.crossVectors(up, normal).normalize();
  return target.setFromRotationMatrix(basis.makeBasis(right, up, normal));
}

/**
 * Screen-pixel placement offset in a stable sphere-tangent basis so head
 * rotation does not orbit the tooltip around the hotspot.
 */
export function tooltipTangentOffset(
  target: Vector3,
  worldPosition: Vector3,
  offsetX: number,
  offsetY: number,
): Vector3 {
  setSphereTangentBasis(worldPosition);
  return target
    .copy(right)
    .multiplyScalar(offsetX)
    .addScaledVector(up, offsetY);
}

function setTooltipAnchorPoint(anchor: Object3D, mode: HotspotMode) {
  anchor.getWorldPosition(point);
  const radius = point.length();
  if (mode === "surface" && radius > 0) point.multiplyScalar(990 / radius);
}

function referenceSlope(referenceFov: number) {
  const fov = MathUtils.clamp(Number.isFinite(referenceFov) ? referenceFov : 75, 1, 179);
  return Math.tan(MathUtils.degToRad(fov) / 2);
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
  setTooltipAnchorPoint(anchor, mode);
  const distance = point.distanceTo(camera.getWorldPosition(normal));
  const depth = -normal.copy(point).applyMatrix4(camera.matrixWorldInverse).z;
  const unit =
    mode === "billboard" && scaleMode === "fixed"
      ? (2 * Math.max(0, depth)) /
        (Math.max(1, height) * camera.projectionMatrix.elements[5]!)
      : (2 * distance * referenceSlope(referenceFov)) / Math.max(1, height);
  if (mode === "surface") {
    normal.copy(point).normalize().negate();
    up.set(0, 1, 0).addScaledVector(normal, -normal.y);
    if (up.lengthSq() < 1e-8)
      up.set(0, 0, 1).addScaledVector(normal, -normal.z);
    up.normalize();
    right.crossVectors(up, normal).normalize();
    rotation.setFromRotationMatrix(basis.makeBasis(right, up, normal));
  } else camera.getWorldQuaternion(rotation);
  return target.compose(point, rotation, scale.set(unit, unit, unit));
}

export function spatialTooltipWorldMatrix(
  target: Matrix4,
  anchor: Object3D,
  camera: Camera,
  viewportHeight: number,
  projectionScaleY: number,
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
): Matrix4 {
  // Measure from the hotspot center. Its edge follows the billboard's changing
  // scale and orientation as the head turns.
  setTooltipAnchorPoint(anchor.parent ?? anchor, mode);
  const distanceScale = (2 * point.distanceTo(camera.getWorldPosition(normal))) /
    Math.max(1, viewportHeight);
  setTooltipAnchorPoint(anchor, mode);
  const pixelUnit = distanceScale / projectionScaleY;
  const gap = offset * pixelUnit;
  const unit = mode === "billboard" && scaleMode === "fixed"
    ? pixelUnit
    : distanceScale * referenceSlope(referenceFov);
  const x = placement === "left" ? -(width * unit / 2 + gap)
    : placement === "right" ? width * unit / 2 + gap : 0;
  const y = placement === "bottom" ? -(height * unit / 2 + gap)
    : placement === "top" ? height * unit / 2 + gap : 0;
  point.add(tooltipTangentOffset(tangentOffset, point, x, y));
  tooltipFacingCameraQuaternion(rotation, point, camera);
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
