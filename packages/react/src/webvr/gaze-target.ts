import type { ThreeEvent } from "@react-three/fiber";
import type { Intersection, Object3D, Vector2 } from "three";
import type { GazeAction } from "../spatial/gaze-action";
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
  if (modalOpen || panelsOpen) {
    for (const hit of hits) {
      const resolve = hit.object.userData.panoGazeResolve as
        | ((uv: Vector2) => GazeAction | null)
        | undefined;
      if (resolve && hit.uv)
        return { channel: "spatial", action: resolve(hit.uv) };
    }
    // Only dialogs own the entire gaze channel; standalone bars own their hit area.
    if (modalOpen) return { channel: "spatial", action: null };
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
