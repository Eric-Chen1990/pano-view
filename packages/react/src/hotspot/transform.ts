import {
  Camera,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import type { HotspotScaleMode } from "./types";

const LOCAL_FORWARD = new Vector3(0, 0, 1);
const CAMERA_POSITION = new Vector3();
const PARENT_ROTATION = new Quaternion();

export function resolveFloatingHotspotDistance(
  distance: number | undefined,
  maximumDistance: number,
  inVR: boolean,
): number {
  if (distance === undefined || !Number.isFinite(distance)) {
    return inVR ? Math.min(10, maximumDistance) : 10;
  }
  return MathUtils.clamp(Math.abs(distance), inVR ? 2 : 0.1, maximumDistance);
}

export function applyHotspotTransform(
  group: Object3D,
  camera: Camera,
  orientation: "billboard" | "surface",
  surfaceQuaternion: Quaternion,
  rotation: number,
  scaleMode: HotspotScaleMode,
  referenceFov: number,
  useAngularScale: boolean,
  worldWidth: number,
  worldHeight: number,
  distance: number,
  eyeProjectionScaleY?: number,
) {
  if (orientation === "billboard") {
    if (eyeProjectionScaleY === undefined) {
      group.quaternion.copy(camera.quaternion);
    } else {
      camera.getWorldQuaternion(group.quaternion);
      if (group.parent) {
        group.quaternion.premultiply(group.parent.getWorldQuaternion(PARENT_ROTATION).invert());
      }
    }
  } else {
    group.quaternion.copy(surfaceQuaternion);
  }
  group.rotateOnAxis(LOCAL_FORWARD, MathUtils.degToRad(-rotation));
  const fixedScale = scaleMode === "fixed";
  const focalLength = eyeProjectionScaleY ??
    (camera instanceof PerspectiveCamera ? 1 / fovSlope(camera.fov) : undefined);
  let scaleFactor = fixedScale && focalLength !== undefined
    ? 1 / (focalLength * fovSlope(MathUtils.clamp(referenceFov, 1, 179)))
    : 1;
  if (
    fixedScale &&
    orientation === "billboard" &&
    useAngularScale &&
    focalLength !== undefined
  ) {
    group.updateWorldMatrix(true, false);
    CAMERA_POSITION.setFromMatrixPosition(group.matrixWorld).applyMatrix4(
      camera.matrixWorldInverse,
    );
    // A billboard's projected size depends on camera-space depth, not radius.
    scaleFactor *= Math.max(0, -CAMERA_POSITION.z) / distance;
  }
  group.scale.set(
    (useAngularScale ? worldWidth : 1) * scaleFactor,
    (useAngularScale ? worldHeight : 1) * scaleFactor,
    1,
  );
  group.updateMatrixWorld();
}

function fovSlope(fov: number): number {
  return Math.tan(MathUtils.degToRad(fov) / 2);
}

/**
 * Scale for a unit quad whose screen-space stroke center sits `outsetPixels`
 * outside the hotspot. X and Y differ when the hotspot is not square.
 */
export function selectionFrameScale(
  worldScaleX: number,
  worldScaleY: number,
  cameraSpaceDepth: number,
  fovDegrees: number,
  viewportHeight: number,
  outsetPixels: number,
): readonly [number, number] {
  const pixels = Number.isFinite(outsetPixels) && outsetPixels > 0 ? outsetPixels : 0;
  const depth = Number.isFinite(cameraSpaceDepth) ? Math.max(cameraSpaceDepth, 1e-4) : 1e-4;
  const height = Number.isFinite(viewportHeight) ? Math.max(viewportHeight, 1) : 1;
  const fov = Number.isFinite(fovDegrees) ? MathUtils.clamp(fovDegrees, 1, 179) : 75;
  const pixelsPerWorldUnit =
    height / (2 * Math.tan(MathUtils.degToRad(fov) * 0.5) * depth);
  const axis = (worldScale: number) => {
    const pixelsPerLocalUnit = pixelsPerWorldUnit * Math.abs(worldScale);
    if (pixelsPerLocalUnit < 1e-4) {
      return 1;
    }
    return 1 + (2 * pixels) / pixelsPerLocalUnit;
  };
  return [axis(worldScaleX), axis(worldScaleY)];
}
