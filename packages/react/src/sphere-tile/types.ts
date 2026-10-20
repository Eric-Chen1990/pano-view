import type { TileLoadProgress } from "../tile/types";

export type SphereTileLevel = { width: number; height: number };

export type SphereTileMultiresConfig = {
  tileSize: number;
  /** Ascending image dimensions. The first item maps to level 0. */
  levels: SphereTileLevel[];
};

export type SphereTileAddress = {
  /** Zero-based logical level, column and row; URL indices add indexBase. */
  level: number;
  col: number;
  row: number;
  imageWidth: number;
  imageHeight: number;
  tileSize: number;
  /** Actual tile dimensions, including partial edge tiles. */
  width: number;
  height: number;
};

export type SphereTileLoadError = {
  address: SphereTileAddress;
  url: string;
  error: unknown;
};

export type SphereTileProps = {
  baseUrl: string;
  /** `512,500x250,1000x500,2000x1000` or explicit ascending dimensions. */
  multires: string | SphereTileMultiresConfig;
  /** A 2:1 equirectangular preview, resolved relative to baseUrl. */
  previewUrl: string;
  /** Defaults to `tiles/%l/%h_%v.webp`. No tile overlap. */
  urlTemplate?: string;
  /** URL indices start at 1 for krpano (default), or 0 for raw Sharp Deep Zoom. */
  indexBase?: 0 | 1;
  /** Takes precedence over urlTemplate and indexBase. Receives zero-based addresses. */
  resolveTileUrl?: (address: SphereTileAddress) => string;
  /** Horizontal source rotation in degrees. Defaults to 0. */
  yawOffset?: number;
  /** Tile cache budget in MiB. Defaults to 128. Preview memory is separate. */
  maxTextureMemoryMb?: number;
  /** Defaults to 4. */
  maxConcurrentLoads?: number;
  /** Retries after the initial attempt. Defaults to 1. */
  retryCount?: number;
  loadMode?: "full" | "preview" | "base";
  visible?: boolean;
  /** First paintable preview or tile is ready, even if the preview failed. */
  onReady?: () => void;
  onPreviewError?: (error: unknown) => void;
  onLoadProgress?: (progress: TileLoadProgress) => void;
  onTileError?: (event: SphereTileLoadError) => void;
  /** Zero-based selected level. */
  onLevelChange?: (level: number) => void;
};
