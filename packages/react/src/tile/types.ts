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
  /** Supports krpano `%s`, `%l`, `%h`, and `%v` placeholders. */
  urlTemplate?: string;
  resolveTileUrl?: (address: TileAddress) => string;
  maxTextureMemoryMb?: number;
  maxConcurrentLoads?: number;
  retryCount?: number;
  onLoadProgress?: (progress: TileLoadProgress) => void;
  onTileError?: (event: TileLoadError) => void;
  onLevelChange?: (level: number) => void;
};

export type TextureEntrySnapshot = {
  status: "idle" | "queued" | "loading" | "loaded" | "error";
  texture: Texture | null;
  error: unknown;
};
