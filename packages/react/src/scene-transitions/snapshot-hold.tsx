import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Mesh, Vector3 } from "three";
import {
  FULLSCREEN_PLANE,
  OVERLAY_RENDER_ORDER,
  isPerspectiveCamera,
  placeFullscreenOverlay,
} from "./overlay-utils";
import type { Snapshot } from "./overlay-utils";
import { createSnapshotMaterial } from "./snapshot-shaders";

/**
 * Unmodified outgoing frame shown while detail loads. The blend shader stays
 * unmounted so preset progress does not start until the wait ends.
 */
export function SnapshotHold({ snapshot }: { snapshot: Snapshot }) {
  const { camera, gl } = useThree();
  const meshRef = useRef<Mesh>(null);
  const directionRef = useRef(new Vector3());
  const material = useMemo(
    () => createSnapshotMaterial("crossfade", snapshot.texture),
    [snapshot.texture],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !isPerspectiveCamera(camera)) {
      return;
    }
    placeFullscreenOverlay(mesh, camera, directionRef.current);
    const context = gl.getContext();
    material.uniforms.resolution.value.set(
      context.drawingBufferWidth,
      context.drawingBufferHeight,
    );
    material.uniforms.progress.value = 0;
  });

  return (
    <mesh frustumCulled={false} ref={meshRef} renderOrder={OVERLAY_RENDER_ORDER}>
      <primitive attach="geometry" object={FULLSCREEN_PLANE} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}
