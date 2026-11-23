import type { Mesh } from "three";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { WebGPUFramePasses } from "../webgpu-frame";
import { createParticleGeometry } from "./particle-overlay";
import { createWebGPUSnapshotMaterial } from "./webgpu-snapshot-material";
import {
  FULLSCREEN_PLANE, OVERLAY_RENDER_ORDER, isPerspectiveCamera, overlayProgress, type OverlayProps,
} from "./overlay-utils";

export function WebGPUSnapshotOverlay({
  passes, snapshot, transition, running, holding, onFinish,
}: OverlayProps & { passes: WebGPUFramePasses; holding: boolean }) {
  const preset = holding ? "crossfade" : transition.preset;
  const visual = useMemo(() => createWebGPUSnapshotMaterial(passes.modules, preset, snapshot.texture), [passes, preset, snapshot]);
  const geometry = useMemo(() => preset === "particles" ? createParticleGeometry() : FULLSCREEN_PLANE, [preset]);
  const start = useRef<number | null>(null);
  const finished = useRef(false);

  useEffect(() => () => visual.material.dispose(), [visual]);
  useEffect(() => () => { if (geometry !== FULLSCREEN_PLANE) geometry.dispose(); }, [geometry]);
  const bindView: Mesh["onBeforeRender"] = (_renderer, _scene, camera) => {
    const secondEye = passes.stereoEyes?.()[1];
    const source = snapshot.eyeTextures && camera === secondEye ? snapshot.eyeTextures[1] : snapshot.texture;
    visual.map.value = source;
    const size = source.image as { width: number; height: number };
    visual.resolution.value.set(size.width, size.height);
    if (isPerspectiveCamera(camera)) visual.distance.value = Math.max(camera.near * 1.1, 0.11);
  };

  useFrame(({ clock, invalidate }) => {
    if (!running || finished.current) return;
    invalidate();
    const next = overlayProgress(clock.elapsedTime, transition.duration, start.current);
    start.current = next.startTime;
    visual.progress.value = next.progress;
    if (next.progress === 1) {
      finished.current = true;
      onFinish();
    }
  });

  return (
    <mesh renderOrder={OVERLAY_RENDER_ORDER} frustumCulled={false} onBeforeRender={bindView}>
      <primitive attach="geometry" object={geometry} />
      <primitive attach="material" object={visual.material} />
    </mesh>
  );
}
