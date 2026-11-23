import { useThree } from "@react-three/fiber";
import { useContext, useEffect, useMemo } from "react";
import type { Mesh } from "three";
import { WebVRRuntimeContext } from "../webvr/host";
import {
  FULLSCREEN_PLANE,
  OVERLAY_RENDER_ORDER,
  bindSnapshotEyeTexture,
} from "./overlay-utils";
import type { Snapshot } from "./overlay-utils";
import { createSnapshotMaterial } from "./snapshot-shaders";

/**
 * Unmodified outgoing frame shown while detail loads. The blend shader stays
 * unmounted so preset progress does not start until the wait ends.
 */
export function SnapshotHold({ snapshot }: { snapshot: Snapshot }) {
  const gl = useThree((state) => state.gl);
  const vr = useContext(WebVRRuntimeContext);
  const material = useMemo(
    () => createSnapshotMaterial("crossfade", snapshot.texture),
    [snapshot.texture],
  );

  useEffect(() => () => material.dispose(), [material]);

  const bindView: Mesh["onBeforeRender"] = (_renderer, _scene, camera) => {
    const rightEye = gl.xr.isPresenting
      ? gl.xr.getCamera().cameras[1]
      : vr?.stereoView.active
        ? vr.stereoView.stereo.cameraR
        : undefined;
    bindSnapshotEyeTexture(
      snapshot,
      camera,
      rightEye,
      material.uniforms.map,
      material.uniforms.resolution,
    );
    material.uniforms.progress.value = 0;
  };

  return (
    <mesh
      frustumCulled={false}
      renderOrder={OVERLAY_RENDER_ORDER}
      onBeforeRender={bindView}
    >
      <primitive attach="geometry" object={FULLSCREEN_PLANE} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}
