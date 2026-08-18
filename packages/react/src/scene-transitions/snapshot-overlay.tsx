import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Mesh, Vector3 } from "three";
import {
  FULLSCREEN_PLANE,
  OVERLAY_RENDER_ORDER,
  isPerspectiveCamera,
  overlayProgress,
  placeFullscreenOverlay,
} from "./overlay-utils";
import type { OverlayProps } from "./overlay-utils";
import { isSnapshotTransition } from "./presets";
import { createSnapshotMaterial } from "./snapshot-shaders";

export function SnapshotOverlay({
  snapshot,
  transition,
  running,
  runId,
  onFinish,
}: OverlayProps) {
  const { camera, gl } = useThree();
  const meshRef = useRef<Mesh>(null);
  const startRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const directionRef = useRef(new Vector3());
  const material = useMemo(() => {
    if (!isSnapshotTransition(transition.preset)) {
      return null;
    }
    return createSnapshotMaterial(transition.preset, snapshot.texture);
  }, [snapshot.texture, transition.preset]);

  useEffect(() => () => material?.dispose(), [material]);
  useEffect(() => {
    startRef.current = null;
    finishedRef.current = false;
    if (material) {
      material.uniforms.progress.value = 0;
    }
  }, [material, runId]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || !material || !isPerspectiveCamera(camera)) {
      return;
    }
    placeFullscreenOverlay(mesh, camera, directionRef.current);
    const context = gl.getContext();
    material.uniforms.resolution.value.set(context.drawingBufferWidth, context.drawingBufferHeight);

    if (!running || finishedRef.current) {
      return;
    }
    const next = overlayProgress(state.clock.elapsedTime, transition.duration, startRef.current);
    startRef.current = next.startTime;
    material.uniforms.progress.value = next.progress;
    if (next.progress === 1) {
      finishedRef.current = true;
      onFinish();
    }
  });

  if (!material) {
    return null;
  }

  return (
    <mesh ref={meshRef} renderOrder={OVERLAY_RENDER_ORDER} frustumCulled={false}>
      <primitive attach="geometry" object={FULLSCREEN_PLANE} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}
