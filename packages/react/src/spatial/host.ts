import { createVRInput } from "../webvr/input";
import { createContext } from "react";
import type { Texture } from "three";
import type { GazeAction } from "./gaze-action";

export type PanoSpatialControlAdapter = {
  /** Degrees. Update the existing model viewing controls, not the panorama camera. */
  rotateBy?: (yaw: number, pitch: number) => void;
  /** Multiplicative viewing scale; values above one zoom in. */
  zoomBy?: (factor: number) => void;
  resetView?: () => void;
  canExecute?: (action: string) => boolean;
  /** Canvas frames must be copied after the host renderer finishes rendering. */
  subscribeFrame?: (invalidate: () => void) => () => void;
  /** A texture must belong to this viewer's WebGL context. */
  texture?: Texture;
};
export type SpatialSurface = { element: HTMLElement; close: () => void; scrollTarget?: () => HTMLElement | null; anchor?: { position?: { yaw: number; pitch: number }; width: number; distance: number } };
export function createSpatialHost() {
  const listeners = new Set<() => void>();
  const host = {
    input: createVRInput(),
    mode: false,
    suppressGazeUntil: 0,
    surfaces: new Set<SpatialSurface>(),
    panels: new Set<SpatialSurface>(),
    controls: new Map<HTMLElement, PanoSpatialControlAdapter>(),
    revision: 0,
    action: null as GazeAction | null,
    progress: 0,
    exit: async () => {},
    getSnapshot: () => host.revision,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    notify: () => {
      host.revision++;
      listeners.forEach((fn) => fn());
    },
    setMode: (mode: boolean) => {
      if (host.mode !== mode) {
        host.mode = mode;
        host.action = null;
        host.notify();
      }
    },
  };
  return host;
}
export type SpatialHost = ReturnType<typeof createSpatialHost>;
export const SpatialHostContext = createContext<SpatialHost | null>(null);
