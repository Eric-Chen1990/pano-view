import { createContext } from "react";
import type { HotspotPosition } from "./types";

type RegisteredTarget = {
  token: symbol;
  position: HotspotPosition;
};

export type HotspotTargetRegistry = {
  getPosition: (id: string) => HotspotPosition | null;
  register: (id: string, position: HotspotPosition) => () => void;
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
    register: (id, position) => {
      const token = Symbol(id);
      targets.set(id, { token, position: { ...position } });
      return () => {
        if (targets.get(id)?.token === token) {
          targets.delete(id);
        }
      };
    },
  };
}
