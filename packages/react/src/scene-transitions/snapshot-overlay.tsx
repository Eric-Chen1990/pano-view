import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useMemo, useRef } from "react";
import { Mesh } from "three";
import { WebVRRuntimeContext } from "../webvr/host";
import {
  FULLSCREEN_PLANE,
  OVERLAY_RENDER_ORDER,
  bindSnapshotEyeTexture,
  overlayProgress,
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
  const gl = useThree((state) => state.gl);
  const vr = useContext(WebVRRuntimeContext);
  const startRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
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

  const bindView: Mesh["onBeforeRender"] = (_renderer, _scene, camera) => {
    if (!material) return;
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
  };

  useFrame((state) => {
    if (!material || !running || finishedRef.current) {
      return;
    }
    state.invalidate();
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
    <mesh
      renderOrder={OVERLAY_RENDER_ORDER}
      frustumCulled={false}
      onBeforeRender={bindView}
    >
      <primitive attach="geometry" object={FULLSCREEN_PLANE} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}
