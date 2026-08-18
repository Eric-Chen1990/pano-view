import { useFrame, useThree } from "@react-three/fiber";
import { useXR, XROrigin } from "@react-three/xr";
import { useRef } from "react";
import { Group, Vector3 } from "three";

/**
 * Keeps the WebXR eye midpoint at the panorama origin. Positional tracking
 * would otherwise move the camera away from the center of a monoscopic sphere.
 */
export function PanoramaXROrigin() {
  const originRef = useRef<Group>(null);
  const localHeadPositionRef = useRef(new Vector3());
  const session = useXR((state) => state.session);
  const gl = useThree((state) => state.gl);

  useFrame(() => {
    const origin = originRef.current;
    if (!session || !origin || !gl.xr.isPresenting) {
      return;
    }
    const xrCamera = gl.xr.getCamera();
    localHeadPositionRef.current.copy(xrCamera.position).sub(origin.position);
    origin.position.copy(localHeadPositionRef.current).multiplyScalar(-1);
    origin.updateMatrixWorld();
  }, -100);

  return <XROrigin ref={originRef} />;
}
