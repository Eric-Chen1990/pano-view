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
) {
  if (orientation === "billboard") {
    group.quaternion.copy(camera.quaternion);
  } else {
    group.quaternion.copy(surfaceQuaternion);
  }
  group.rotateOnAxis(LOCAL_FORWARD, MathUtils.degToRad(-rotation));
  let scaleFactor =
    scaleMode === "fixed" && camera instanceof PerspectiveCamera
      ? fixedScaleFactor(camera.fov, referenceFov)
      : 1;
  if (
    scaleMode === "fixed" &&
    orientation === "billboard" &&
    useAngularScale &&
    camera instanceof PerspectiveCamera
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

function fixedScaleFactor(cameraFov: number, referenceFov: number): number {
  const safeReferenceFov = MathUtils.clamp(referenceFov, 1, 179);
  return (
    Math.tan(MathUtils.degToRad(cameraFov) / 2) /
    Math.tan(MathUtils.degToRad(safeReferenceFov) / 2)
  );
}
