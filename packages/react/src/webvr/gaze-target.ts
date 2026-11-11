import type { ThreeEvent } from "@react-three/fiber";
import { flushSync } from "react-dom";
import type { Intersection, Object3D, Vector2 } from "three";
import type { GazeAction } from "../spatial/gaze-action";
import type { SpatialSurface } from "../spatial/host";

const hotspotClicks = new WeakSet<Event>();

export function isGazeHotspotClick(event: Event): boolean {
  return hotspotClicks.has(event);
}

/** Commit the old stack's removal so a reused dialog gets a fresh spatial anchor. */
export function dispatchGazeHotspotClick(
  surfaces: Iterable<Pick<SpatialSurface, "close">>,
  event: Event,
  activate: () => void,
): void {
  const previous = [...surfaces].reverse();
  if (previous.length) {
    flushSync(() => {
      for (const surface of previous) surface.close();
    });
  }
  hotspotClicks.add(event);
  try {
    activate();
  } finally {
    hotspotClicks.delete(event);
  }
}

export type R3FObject = Object3D & {
  __r3f?: {
    handlers?: {
      onClick?: (event: ThreeEvent<PointerEvent>) => void;
      onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
      onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
    };
  };
};
export type GazeTarget = { eventObject: Object3D; intersection: Intersection };
export type GazeRoute =
  | { channel: "spatial"; action: GazeAction | null }
  | { channel: "hotspot"; target: GazeTarget | null };
export function resolveGazeTarget(
  hits: Intersection[],
  { modalOpen, panelsOpen }: { modalOpen: boolean; panelsOpen: boolean }
): GazeRoute {
  hits = [...hits].sort((a, b) =>
    ((b.object as Object3D & { pointerEventsOrder?: number }).pointerEventsOrder ?? 0) -
    ((a.object as Object3D & { pointerEventsOrder?: number }).pointerEventsOrder ?? 0) || a.distance - b.distance);
  if (modalOpen || panelsOpen || hits.some(hit => hit.object.userData.panoGazeResolve)) {
    for (const hit of hits) {
      const resolve = hit.object.userData.panoGazeResolve as
        | ((uv: Vector2) => GazeAction | null)
        | undefined;
      if (resolve && hit.uv)
        return { channel: "spatial", action: resolve(hit.uv) };
    }
    // Spatial UI owns its hit area, including noninteractive panel content.
  }
  for (const intersection of hits) {
    let current: Object3D | null = intersection.object;
    while (current) {
      const handlers = (current as R3FObject).__r3f?.handlers;
      if (handlers?.onClick && handlers.onPointerOver)
        return {
          channel: "hotspot",
          target: { eventObject: current, intersection },
        };
      current = current.parent;
    }
  }
  return { channel: "hotspot", target: null };
}
