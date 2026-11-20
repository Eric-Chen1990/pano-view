import { useFrame, useThree } from "@react-three/fiber";
import { useXR, XROrigin } from "@react-three/xr";
import { useRef } from "react";
import { Group, Matrix4, Quaternion } from "three";
import { createWebVRHotspotView, setWebVRHotspotProjection, type WebVRHotspotView } from "./stereo-view";

export const createWebXRHeadView = createWebVRHotspotView;

/**
 * Keeps the WebXR eye midpoint at the panorama origin. Positional tracking
 * would otherwise move the camera away from the center of a monoscopic sphere.
 */
export function PanoramaXROrigin({ headView }: { headView: WebVRHotspotView }) {
  const originRef = useRef<Group>(null);
  const originRotation = useRef(new Quaternion());
  const projections = useRef<Matrix4[]>([]);
  const viewSession = useRef<XRSession | null>(null);
  const session = useXR((state) => state.session);
  const gl = useThree((state) => state.gl);

  useFrame(({ camera: renderCamera }, _, frame) => {
    const currentSession = gl.xr.isPresenting ? session ?? null : null;
    if (viewSession.current !== currentSession) {
      viewSession.current = currentSession;
      headView.projectionScaleY = null;
    }
    const origin = originRef.current;
    if (!currentSession || !origin) {
      return;
    }
    const referenceSpace = gl.xr.getReferenceSpace();
    const pose = frame && referenceSpace ? frame.getViewerPose(referenceSpace) : null;
    if (!pose) return;
    // XR poses are local to the reference space, independent of the prior origin.
    const { x, y, z } = pose.transform.position;
    origin.position.set(-x, -y, -z);
    origin.updateMatrixWorld();

    const matrices = projections.current;
    for (let i = 0; i < pose.views.length; i++) {
      (matrices[i] ??= new Matrix4()).fromArray(pose.views[i]!.projectionMatrix);
    }
    matrices.length = pose.views.length;
    if (!setWebVRHotspotProjection(headView, renderCamera, matrices)) return;
    // Three updates the real XR eye viewports before invoking the frame callback.
    headView.renderHeight = gl.xr.getCamera().cameras.reduce(
      (height, eye) => Math.max(height, eye.viewport?.w ?? 0), 0,
    );

    const { camera } = headView;
    const orientation = pose.transform.orientation;
    camera.position.set(x, y, z).applyMatrix4(origin.matrixWorld);
    camera.quaternion
      .set(orientation.x, orientation.y, orientation.z, orientation.w)
      .premultiply(origin.getWorldQuaternion(originRotation.current));
    camera.updateMatrixWorld();
  }, -100);

  return <XROrigin ref={originRef} />;
}
