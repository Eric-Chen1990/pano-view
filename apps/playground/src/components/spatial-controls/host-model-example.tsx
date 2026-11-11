import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  usePanoSpatialControls,
  type PanoSpatialControlAdapter,
} from "@ericchen1990/pano-view";
import type { Mesh } from "three";

function Model({
  view,
  frames,
}: {
  view: RefObject<{ yaw: number; pitch: number; scale: number }>;
  frames: Set<() => void>;
}) {
  const mesh = useRef<Mesh>(null);
  useFrame(() => {
    if (mesh.current) {
      mesh.current.rotation.set(
        (view.current.pitch * Math.PI) / 180,
        (view.current.yaw * Math.PI) / 180,
        0,
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

/** An existing host renderer owns its model and viewing state in both modes. */
export function HostModelExample() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const view = useRef({ yaw: 0, pitch: 0, scale: 1 });
  const frames = useMemo(() => new Set<() => void>(), []);
  const adapter = useMemo<PanoSpatialControlAdapter>(
    () => ({
      rotateBy(yaw, pitch) {
        view.current.yaw += yaw;
        view.current.pitch = Math.max(
          -80,
          Math.min(80, view.current.pitch + pitch),
        );
      },
      zoomBy(factor) {
        view.current.scale = Math.max(
          0.5,
          Math.min(2, view.current.scale * factor),
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
    [frames],
  );
  usePanoSpatialControls(ref, adapter);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      adapter.zoomBy?.(Math.exp(-event.deltaY * 0.001));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [adapter]);
  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: 300,
        touchAction: "none",
        cursor: "grab",
      }}
      aria-label="Host model preview. Drag to rotate, scroll to zoom. Arrow keys rotate, plus and minus zoom, Home resets."
      role="application"
      tabIndex={0}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        adapter.rotateBy?.(
          (event.clientX - drag.current.x) * 0.4,
          (drag.current.y - event.clientY) * 0.4,
        );
        drag.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onKeyDown={(event) => {
        const rotations: Record<string, [number, number]> = {
          ArrowLeft: [-15, 0],
          ArrowRight: [15, 0],
          ArrowUp: [0, 15],
          ArrowDown: [0, -15],
        };
        if (rotations[event.key]) adapter.rotateBy?.(...rotations[event.key]);
        else if (event.key === "+" || event.key === "=") adapter.zoomBy?.(1.2);
        else if (event.key === "-") adapter.zoomBy?.(1 / 1.2);
        else if (event.key === "Home") adapter.resetView?.();
        else return;
        event.preventDefault();
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3] }}
        gl={{ preserveDrawingBuffer: true }}
      >
        <Model view={view} frames={frames} />
      </Canvas>
    </div>
  );
}
