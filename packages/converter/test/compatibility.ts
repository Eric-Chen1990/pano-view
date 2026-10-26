import type { TileProps } from "../../react/src/tile/types";
import type { SphereTileProps } from "../../react/src/sphere-tile/types";
import type { CubemapViewerConfig, SphereViewerConfig } from "../src/types";

// Compile against the existing viewer's actual contracts without adding a React runtime dependency.
export function cubeContract(config: CubemapViewerConfig): TileProps {
  return { ...config, baseUrl: "/panoramas/room/" };
}
export function sphereContract(config: SphereViewerConfig): SphereTileProps {
  return { ...config, baseUrl: "/panoramas/room/" };
}
