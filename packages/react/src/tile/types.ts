import type { Texture } from "three";

export type CubeFaceCode = "f" | "r" | "b" | "l" | "u" | "d";

export type TileAddress = {
  face: CubeFaceCode;
  level: number;
  row: number;
  col: number;
  faceSize: number;
  tileSize: number;
  width: number;
  height: number;
};

export type TileMultiresConfig = {
  tileSize: number;
  /** Ascending face sizes. The first value maps to l1. */
  levels: number[];
};

export type TileLoadProgress = {
  requested: number;
  loaded: number;
  failed: number;
  active: number;
  queued: number;
};

export type TileLoadError = {
  address: TileAddress;
  url: string;
  error: unknown;
};

export type TileProps = {
  baseUrl: string;
  multires: string | TileMultiresConfig;
  /** Defaults to `${baseUrl}/previews/cube-vertical.webp`. */
  previewUrl?: string | null;
  /**
   * Face order in the vertical preview atlas, from top to bottom. Defaults to
   * `l/f/r/b/u/d`.
   */
  previewFaceOrder?: readonly CubeFaceCode[];
  /**
   * Relative to `baseUrl`; supports krpano cube-tile `%s` and `%l` placeholders,
   * horizontal `%h`/`%x`/`%u`/`%c`, vertical `%v`/`%y`/`%w`/`%r`, and index padding
   * such as `%0h` or `%00v`.
   */
  urlTemplate?: string;
  /** Returns a path relative to `baseUrl`; takes precedence over `urlTemplate`. */
  resolveTileUrl?: (address: TileAddress) => string;
  maxTextureMemoryMb?: number;
  maxConcurrentLoads?: number;
  retryCount?: number;
  /**
   * `preview` loads only the preview atlas; `base` also preloads the visible
   * lowest-resolution tiles before full-resolution loading begins.
   */
  loadMode?: "full" | "preview" | "base";
  /** Keeps the source mounted for preloading without drawing it. */
  visible?: boolean;
  /** Called when the preview atlas is ready for display. */
  onReady?: () => void;
  /** Called when the preview atlas cannot be loaded. */
  onPreviewError?: (error: unknown) => void;
  onLoadProgress?: (progress: TileLoadProgress) => void;
  onTileError?: (event: TileLoadError) => void;
  onLevelChange?: (level: number) => void;
};

export type TextureEntrySnapshot = {
  status: "idle" | "queued" | "loading" | "loaded" | "error";
  texture: Texture | null;
  error: unknown;
};
