import { createContext } from "react";
import type { HotspotCorners, HotspotPosition } from "./types";

type RegisteredTarget = {
  token: symbol;
  position: HotspotPosition;
  getCorners?: () => HotspotCorners | null;
};

export type HotspotTargetRegistry = {
  getPosition: (id: string) => HotspotPosition | null;
  getCorners: (id: string) => HotspotCorners | null;
  register: (id: string, position: HotspotPosition, getCorners?: RegisteredTarget["getCorners"]) => () => void;
};

export const HotspotTargetRegistryContext = createContext<HotspotTargetRegistry | null>(
  null,
);

/** Internal position registry shared by a PanoViewer and its mounted hotspots. */
export function createHotspotTargetRegistry(): HotspotTargetRegistry {
  const targets = new Map<string, RegisteredTarget>();

  return {
    getPosition: (id) => {
      const target = targets.get(id);
      return target ? { ...target.position } : null;
    },
    getCorners: (id) => targets.get(id)?.getCorners?.() ?? null,
    register: (id, position, getCorners) => {
      const token = Symbol(id);
      targets.set(id, { token, position: { ...position }, getCorners });
      return () => {
        if (targets.get(id)?.token === token) {
          targets.delete(id);
        }
      };
    },
  };
}
