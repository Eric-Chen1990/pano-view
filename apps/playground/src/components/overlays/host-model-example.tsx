import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  usePanoSpatialControls,
  type PanoSpatialControlAdapter,
} from "@ericchen1990/pano-view";
import type { Mesh } from "three";

/** An existing host renderer owns its model and viewing state in both modes. */
export function HostModelExample() {
  const ref = useRef<HTMLDivElement>(null);
  const view = useRef({ yaw: 0, pitch: 0, scale: 1 });
  const frames = useMemo(() => new Set<() => void>(), []);
  const adapter = useMemo<PanoSpatialControlAdapter>(
    () => ({
      rotateBy(yaw, pitch) {
        view.current.yaw += yaw;
        view.current.pitch = Math.max(
          -80,
          Math.min(80, view.current.pitch + pitch)
        );
      },
      zoomBy(factor) {
        view.current.scale = Math.max(
          0.5,
          Math.min(2, view.current.scale * factor)
        );
      },
      resetView() {
        view.current = { yaw: 0, pitch: 0, scale: 1 };
      },
      canExecute(action) {
        return action === "in"
          ? view.current.scale < 2
          : action === "out"
          ? view.current.scale > 0.5
          : action === "up"
          ? view.current.pitch < 80
          : action === "down"
          ? view.current.pitch > -80
          : true;
      },
      subscribeFrame(fn) {
        frames.add(fn);
        return () => {
          frames.delete(fn);
        };
      },
    }),
    [frames]
  );
  usePanoSpatialControls(ref, adapter);
  function Model() {
    const mesh = useRef<Mesh>(null);
    useFrame(() => {
      if (mesh.current) {
        mesh.current.rotation.set(
          (view.current.pitch * Math.PI) / 180,
          (view.current.yaw * Math.PI) / 180,
          0
        );
        mesh.current.scale.setScalar(view.current.scale);
      }
      frames.forEach((fn) => fn());
    });
    return (
      <mesh ref={mesh}>
        <torusKnotGeometry args={[0.7, 0.22, 96, 16]} />
        <meshNormalMaterial />
      </mesh>
    );
  }
  return (
    <div
      ref={ref}
      style={{ width: "100%", height: 300 }}
      aria-label="Host model preview"
    >
      <Canvas
        camera={{ position: [0, 0, 3] }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <Model />
      </Canvas>
      <button type="button" onClick={() => adapter.rotateBy?.(30, 0)}>
        Rotate
      </button>
      <button type="button" onClick={() => adapter.zoomBy?.(1.2)}>
        Zoom in
      </button>
      <button type="button" onClick={() => adapter.resetView?.()}>
        Reset model
      </button>
    </div>
  );
}
