import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

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
  visitedSceneIds: ReadonlySet<string>;
  revision: number;
  listeners: Set<() => void>;
};

export const ScenesHostContext = createContext<ScenesHost | null>(null);

export function createScenesHost(): ScenesHost {
  return {
    controller: null,
    visitedSceneIds: new Set(),
    revision: 0,
    listeners: new Set(),
  };
}

/** Called only when a scene becomes paintable, never when navigation is requested. */
export function markSceneVisited(host: ScenesHost, id: string): void {
  if (host.visitedSceneIds.has(id)) return;
  host.visitedSceneIds = new Set(host.visitedSceneIds).add(id);
  notifyScenesHost(host);
}

const EMPTY_VISITED_SCENE_IDS: ReadonlySet<string> = new Set();

export function useVisitedSceneIds(enabled: boolean): ReadonlySet<string> {
  const host = useContext(ScenesHostContext);
  const subscribe = useCallback(
    (listener: () => void) =>
      enabled && host ? subscribeScenesHost(host, listener) : () => {},
    [enabled, host],
  );
  const getSnapshot = useCallback(
    () => (enabled && host ? host.visitedSceneIds : EMPTY_VISITED_SCENE_IDS),
    [enabled, host],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
