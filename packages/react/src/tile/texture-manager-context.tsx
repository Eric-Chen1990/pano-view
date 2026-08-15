import { useThree } from "@react-three/fiber";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import { TileTextureManager } from "./texture-manager";

const TileTextureManagerContext = createContext<TileTextureManager | null>(
  null,
);

export type TileTextureManagerProviderProps = {
  children?: ReactNode;
  /** Shared viewer-wide GPU budget. Defaults to 128 MiB. */
  maxTextureMemoryMb?: number;
  /** Shared limit for tile image requests. Defaults to 4. */
  maxConcurrentLoads?: number;
};

/**
 * Provides one tile cache for a panorama scene controller. Keeping this scope
 * at the viewer level prevents a leaving and entering scene from each claiming
 * an independent texture-memory budget.
 */
export function TileTextureManagerProvider({
  children,
  maxTextureMemoryMb = 128,
  maxConcurrentLoads = 4,
}: TileTextureManagerProviderProps) {
  const gl = useThree((state) => state.gl);
  const anisotropy = gl.capabilities.getMaxAnisotropy();
  const manager = useMemo(
    () =>
      new TileTextureManager({
        anisotropy,
        maxBytes: Math.max(1, maxTextureMemoryMb) * 1024 * 1024,
        concurrency: Math.max(1, Math.floor(maxConcurrentLoads)),
        retryCount: 1,
      }),
    [anisotropy, maxConcurrentLoads, maxTextureMemoryMb],
  );

  useEffect(() => {
    manager.resume();
    return () => manager.dispose();
  }, [manager]);

  return (
    <TileTextureManagerContext.Provider value={manager}>
      {children}
    </TileTextureManagerContext.Provider>
  );
}

export function useSharedTileTextureManager() {
  return useContext(TileTextureManagerContext);
}
