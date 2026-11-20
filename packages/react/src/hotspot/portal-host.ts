import { createContext } from "react";
import type { Mesh, PerspectiveCamera, Scene as ThreeScene, Texture, Vector2 } from "three";
import type { Scene } from "../scenes";
import type { PanoViewerState } from "../types";
import type { PortalAperture } from "./portal-projection";
import type { HotspotPosition } from "./types";

export type PortalWindow = {
  targetId: string;
  position: HotspotPosition;
  mesh: Mesh;
  outline: readonly Vector2[];
  camera: PerspectiveCamera;
  preview: ThreeScene;
  visible: () => boolean;
  ready: () => boolean;
  enterOnZoom?: (event: WheelEvent | PointerEvent) => void;
  requestDetail: (active: boolean) => void;
  show: (aperture: PortalAperture | null, texture?: Texture) => void;
};

export type PortalHost = {
  scenes: ReadonlyMap<string, Scene>;
  destinationView: (scene: Scene) => PanoViewerState;
  spatial: boolean;
  register: (id: string, window: PortalWindow) => () => void;
  enter: (id: string, targetId: string) => void;
};

export const PortalHostContext = createContext<PortalHost | null>(null);

export type PortalRequest = {
  sourceId: string;
  targetId: string;
  hotspotId: string;
  requestedAt: number;
  error?: unknown;
};

/** A controlled selection must acknowledge the portal request before it can animate. */
export function matchesPortalSelection(
  request: PortalRequest, sourceId: string | undefined, targetId: string, now: number,
) {
  return request.sourceId === sourceId && request.targetId === targetId && now - request.requestedAt < 1_000;
}
