import { useFrame, useThree } from "@react-three/fiber";
import { useXR, XROrigin } from "@react-three/xr";
import { useRef } from "react";
import { Group } from "three";

/**
 * Keeps the WebXR eye midpoint at the panorama origin. Positional tracking
 * would otherwise move the camera away from the center of a monoscopic sphere.
 */
export function PanoramaXROrigin() {
  const originRef = useRef<Group>(null);
  const session = useXR((state) => state.session);
  const gl = useThree((state) => state.gl);

  useFrame((_, __, frame) => {
    const origin = originRef.current;
    if (!session || !origin || !gl.xr.isPresenting) {
      return;
    }
    const referenceSpace = gl.xr.getReferenceSpace();
    const pose = frame && referenceSpace ? frame.getViewerPose(referenceSpace) : null;
    if (!pose) return;
    // XR poses are local to the reference space, independent of the prior origin.
    const { x, y, z } = pose.transform.position;
    origin.position.set(-x, -y, -z);
    origin.updateMatrixWorld();
  }, -100);

  return <XROrigin ref={originRef} />;
}
