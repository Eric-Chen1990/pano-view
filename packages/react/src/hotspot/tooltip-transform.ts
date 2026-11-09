import {
  Camera,
  MathUtils,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import type { HotspotMode, HotspotScaleMode } from "./types";

const point = new Vector3();
const normal = new Vector3();
const up = new Vector3();
const right = new Vector3();
const scale = new Vector3();
const rotation = new Quaternion();
const basis = new Matrix4();

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
  anchor.getWorldPosition(point);
  const radius = point.length();
  if (mode === "surface" && radius > 0) point.multiplyScalar(990 / radius);
  const distance = point.distanceTo(camera.getWorldPosition(normal));
  const depth = -normal.copy(point).applyMatrix4(camera.matrixWorldInverse).z;
  const reference = MathUtils.clamp(
    Number.isFinite(referenceFov) ? referenceFov : 75,
    1,
    179,
  );
  const unit =
    mode === "billboard" && scaleMode === "fixed"
      ? (2 * Math.max(0, depth)) /
        (Math.max(1, height) * camera.projectionMatrix.elements[5]!)
      : (2 * distance * Math.tan(MathUtils.degToRad(reference) / 2)) /
        Math.max(1, height);
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
