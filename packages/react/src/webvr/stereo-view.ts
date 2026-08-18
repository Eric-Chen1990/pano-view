import { Camera, Object3D, StereoCamera, Vector3 } from "three";

const PROJECT = new Vector3();

export type WebVRStereoEye = "left" | "right";

export type WebVRStereoView = {
  active: boolean;
  stereo: StereoCamera;
};

export function createWebVRStereoView(): WebVRStereoView {
  return {
    active: false,
    stereo: new StereoCamera(),
  };
}

export function isFallbackStereoMode(mode: string | null | undefined): boolean {
  return mode === "mobilevr" || mode === "fake";
}

export function projectStereoHtmlPosition(
  el: Object3D,
  camera: Camera,
  size: { width: number; height: number },
  eye: WebVRStereoEye,
): [number, number] {
  PROJECT.setFromMatrixPosition(el.matrixWorld);
  PROJECT.project(camera);
  if (
    PROJECT.z > 1 ||
    PROJECT.x < -1.15 ||
    PROJECT.x > 1.15 ||
    PROJECT.y < -1.15 ||
    PROJECT.y > 1.15
  ) {
    return [-1e5, -1e5];
  }
  const eyeWidth = size.width / 2;
  const xOffset = eye === "right" ? eyeWidth : 0;
  return [
    PROJECT.x * (eyeWidth / 2) + eyeWidth / 2 + xOffset,
    -(PROJECT.y * (size.height / 2)) + size.height / 2,
  ];
}
