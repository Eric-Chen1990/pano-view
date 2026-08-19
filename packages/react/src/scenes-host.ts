import { createContext } from "react";

export type ScenesController = {
  setScene: (id: string) => boolean;
  nextScene: () => boolean;
  previousScene: () => boolean;
  getActiveSceneId: () => string;
  getSceneIds: () => readonly string[];
  isTransitioning: () => boolean;
};

export type ScenesHost = {
  controller: ScenesController | null;
  revision: number;
  listeners: Set<() => void>;
};

export const ScenesHostContext = createContext<ScenesHost | null>(null);

export function createScenesHost(): ScenesHost {
  return {
    controller: null,
    revision: 0,
    listeners: new Set(),
  };
}

export function notifyScenesHost(host: ScenesHost): void {
  host.revision += 1;
  for (const listener of host.listeners) {
    listener();
  }
}

export function subscribeScenesHost(
  host: ScenesHost,
  listener: () => void,
): () => void {
  host.listeners.add(listener);
  return () => {
    host.listeners.delete(listener);
  };
}
