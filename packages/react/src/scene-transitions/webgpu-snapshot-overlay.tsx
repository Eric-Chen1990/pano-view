import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { DoubleSide, Vector3, type Mesh, type MeshBasicMaterial } from "three";
import {
  FULLSCREEN_PLANE,
  OVERLAY_RENDER_ORDER,
  isPerspectiveCamera,
  overlayProgress,
  placeFullscreenOverlay,
  type OverlayProps,
} from "./overlay-utils";

export function WebGPUSnapshotOverlay({
  snapshot,
  transition,
  running,
  onFinish,
}: OverlayProps) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const direction = useRef(new Vector3());
  const start = useRef<number | null>(null);
  const finished = useRef(false);

  useFrame(({ camera, clock }) => {
    if (!mesh.current || !material.current || !isPerspectiveCamera(camera)) return;
    placeFullscreenOverlay(mesh.current, camera, direction.current);
    if (!running || finished.current) return;
    const { startTime, progress } = overlayProgress(clock.elapsedTime, transition.duration, start.current);
    start.current = startTime;
    material.current.opacity = 1 - progress ** 3;
    if (progress === 1) {
      finished.current = true;
      onFinish();
    }
  });

  return (
    <mesh ref={mesh} renderOrder={OVERLAY_RENDER_ORDER} frustumCulled={false}>
      <primitive attach="geometry" object={FULLSCREEN_PLANE} />
      <meshBasicMaterial
        ref={material}
        map={snapshot.texture}
        toneMapped={false}
        transparent
        depthTest={false}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
