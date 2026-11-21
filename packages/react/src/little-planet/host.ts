import { createContext, useContext, useLayoutEffect, useRef } from "react";
import type { Object3D } from "three";

export type LittlePlanetSource = { root: () => Object3D | null };

// The viewer owns this state so changing or losing the renderer cannot replay the intro.
export function createLittlePlanetIntroHost() {
  const sources = new Set<LittlePlanetSource>();
  let consumed = false;
  let disposeActive: (() => void) | undefined;
  return {
    sources,
    isConsumed: () => consumed,
    isPlaying: () => disposeActive !== undefined,
    start(dispose: () => void) {
      consumed = true;
      disposeActive = dispose;
    },
    finish() {
      consumed = true;
      const dispose = disposeActive;
      disposeActive = undefined;
      dispose?.();
    },
  };
}

export const LittlePlanetIntroContext = createContext<ReturnType<typeof createLittlePlanetIntroHost> | null>(null);

export function useLittlePlanetSource(
  enabled: boolean,
  sourceKey: unknown,
  getRoot: () => Object3D | null,
) {
  const host = useContext(LittlePlanetIntroContext);
  const root = useRef(getRoot);
  useLayoutEffect(() => { root.current = getRoot; });
  useLayoutEffect(() => {
    if (!host || host.isConsumed() || !enabled) return;
    const source = { root: () => root.current() };
    host.sources.add(source);
    return () => { host.sources.delete(source); };
  }, [enabled, host, sourceKey]);
}
