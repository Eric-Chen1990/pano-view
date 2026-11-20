import { Camera, type Matrix4, Object3D, PerspectiveCamera, StereoCamera, Vector3 } from "three";

const PROJECT = new Vector3();

export type WebVRStereoEye = "left" | "right";

export type WebVRHotspotView = {
  camera: PerspectiveCamera;
  projectionScaleY: number | null;
  commonWidthPerHeight: number;
  renderHeight: number;
};

export function createWebVRHotspotView(): WebVRHotspotView {
  return { camera: new PerspectiveCamera(), projectionScaleY: null, commonWidthPerHeight: 0, renderHeight: 0 };
}

/** The center camera is for layout only. Each eye keeps its render projection. */
export function setWebVRHotspotProjection(
  view: WebVRHotspotView,
  renderCamera: Camera,
  eyes: Iterable<Matrix4>,
) {
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let halfWidth = Infinity;
  for (const { elements } of eyes) {
    const x = elements[0]!;
    const y = elements[5]!;
    const shift = elements[8]!;
    if (!Number.isFinite(x) || x <= 0 || !Number.isFinite(y) || y <= 0 ||
        !Number.isFinite(shift) || Math.abs(shift) >= 1) continue;
    sumX += x;
    sumY += y;
    halfWidth = Math.min(halfWidth, (1 - Math.abs(shift)) / x);
    count++;
  }
  if (!count) return false;
  const x = sumX / count;
  const y = sumY / count;
  const camera = view.camera;
  const { near, far } = renderCamera instanceof PerspectiveCamera ? renderCamera : camera;
  camera.coordinateSystem = renderCamera.coordinateSystem;
  camera.near = near;
  camera.far = far;
  camera.projectionMatrix.makePerspective(
    -near / x, near / x, near / y, -near / y, near, far, camera.coordinateSystem,
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  view.projectionScaleY = y;
  view.commonWidthPerHeight = halfWidth * y;
  return true;
}

export type WebVRStereoView = {
  active: boolean;
  stereo: StereoCamera;
  hotspotView: WebVRHotspotView;
};

export function createWebVRStereoView(): WebVRStereoView {
  return {
    active: false,
    stereo: new StereoCamera(),
    hotspotView: createWebVRHotspotView(),
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
