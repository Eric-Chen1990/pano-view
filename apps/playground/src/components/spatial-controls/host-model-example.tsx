import { Html } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  usePanoSpatialControls,
  type PanoSpatialControlAdapter,
} from "@ericchen1990/pano-view";
import { TorusKnotGeometry, Vector3, type Group } from "three";

const TORUS_KNOT_ARGS = [0.7, 0.22, 96, 16] as const;
const MARKER_DIRECTIONS = [
  new Vector3(-0.7, 0.7, 0.9),
  new Vector3(0.7, 0.7, 0.9),
] as const;

const markerButtonClassName =
  "inline-flex size-8 shrink-0 aspect-square items-center justify-center rounded-full border border-[#3e6c73] bg-canvas! p-0 text-[0.72rem] font-medium leading-none text-[#f5fbfc] transition hover:border-[#75cbd3] aria-pressed:border-brand aria-pressed:bg-brand! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/** Furthest mesh vertex along each marker direction, in local space. */
function surfaceAnchorsAlong(
  directions: readonly Vector3[],
  geometry: TorusKnotGeometry,
): Array<[number, number, number]> {
  const position = geometry.getAttribute("position");
  const vertex = new Vector3();
  return directions.map((direction) => {
    let best = Number.NEGATIVE_INFINITY;
    const point = new Vector3();
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      const score = vertex.dot(direction);
      if (score > best) {
        best = score;
        point.copy(vertex);
      }
    }
    return [point.x, point.y, point.z] as [number, number, number];
  });
}

function Model({
  view,
  frames,
  markers,
}: {
  view: RefObject<{ yaw: number; pitch: number; scale: number }>;
  frames: Set<() => void>;
  markers: RefObject<Array<HTMLButtonElement | null>>;
}) {
  const model = useRef<Group>(null);
  const [selectedPin, setSelectedPin] = useState<number | null>(null);
  const anchors = useMemo(() => {
    const geometry = new TorusKnotGeometry(...TORUS_KNOT_ARGS);
    const points = surfaceAnchorsAlong(MARKER_DIRECTIONS, geometry);
    geometry.dispose();
    return points;
  }, []);
  useFrame(() => {
    if (model.current) {
      // Positive pitch is "up" for drag, keys and VR; Three.js +X tilts the opposite way.
      model.current.rotation.set(
        (-view.current.pitch * Math.PI) / 180,
        (view.current.yaw * Math.PI) / 180,
        0,
      );
      model.current.scale.setScalar(view.current.scale);
    }
    frames.forEach((fn) => fn());
  });
  return (
    <group ref={model}>
      <mesh>
        <torusKnotGeometry args={[...TORUS_KNOT_ARGS]} />
        <meshNormalMaterial />
      </mesh>
      {anchors.map((position, index) => (
        <Html key={index} position={position} center zIndexRange={[9, 0]}>
          <button
            ref={(node) => {
              markers.current[index] = node;
            }}
            type="button"
            className={markerButtonClassName}
            aria-label={`Model marker ${index + 1}`}
            aria-pressed={selectedPin === index}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedPin(index);
            }}
          >
            {index + 1}
          </button>
        </Html>
      ))}
    </group>
  );
}

/** An existing host renderer owns its model and viewing state in both modes. */
export function HostModelExample() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const view = useRef({ yaw: 0, pitch: 0, scale: 1 });
  const frames = useMemo(() => new Set<() => void>(), []);
  const markers = useRef<Array<HTMLButtonElement | null>>([]);
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
      // VR redraws the live canvas over the dialog snapshot. These roots are
      // captured on their own and composited afterwards, so the model cannot cover them.
      getOverlays() {
        return markers.current.filter(
          (node): node is HTMLButtonElement => node !== null,
        );
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
        <Model view={view} frames={frames} markers={markers} />
      </Canvas>
    </div>
  );
}
