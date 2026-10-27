import type { ViewerConfig } from "../../../shared/viewer-config";
export type Projection = "cubemap" | "equirectangular" | "planar";
export type ImageFormat = "webp" | "jpeg" | "png";
export type CubeFace = "f" | "r" | "b" | "l" | "u" | "d";
export const CUBE_FACES: readonly CubeFace[] = ["f", "r", "b", "l", "u", "d"];
export const PREVIEW_FACE_ORDER: readonly CubeFace[] = [
  "l",
  "f",
  "r",
  "b",
  "u",
  "d",
];

export type ImageSize = { width: number; height: number };
export type TileLevel = ImageSize & {
  level: number;
  columns: number;
  rows: number;
};
export type ImageDescriptor = ImageSize & { path: string };
export type PreviewDescriptor = ImageDescriptor & {
  role: "viewer" | "image";
  projection: Projection;
  layout?: "vertical-strip";
  faceOrder?: CubeFace[];
};

export type ConversionManifest = {
  schemaVersion: 1;
  projection: Projection;
  source: ImageSize;
  tiles: {
    layout: "custom" | "deepzoom";
    format: ImageFormat;
    tileSize: number;
    overlap: number;
    indexBase: 0 | 1;
    urlTemplate: string;
    faces?: CubeFace[];
    descriptor?: string;
    levels: TileLevel[];
  };
  previews: PreviewDescriptor[];
  thumbnail: ImageDescriptor;
};

export type { CubemapViewerConfig, SphereViewerConfig, ViewerConfig, ViewerDocument } from "../../../shared/viewer-config";
export type AssetKind =
  | "tile"
  | "preview"
  | "thumbnail"
  | "descriptor"
  | "manifest"
  | "image"
  | "cube-face";
export type OutputAsset = {
  kind: AssetKind;
  absolutePath: string;
  relativePath: string;
  contentType: string;
  bytes: number;
  width?: number;
  height?: number;
  face?: CubeFace;
  level?: number;
  row?: number;
  column?: number;
};
export type ProgressEvent = {
  stage: "decode" | "project" | "tiles" | "previews" | "restore" | "complete";
  completedAssets: number;
};
export type JobOptions = {
  outputDir: string;
  /** Default 4; controls concurrent native encodes/decodes, not process-wide Sharp settings. */
  concurrency?: number;
  signal?: AbortSignal;
  /** Default 600000 ms. In-flight callbacks must finish before cleanup. */
  timeoutMs?: number;
  /** Default Sharp limit, 268402689. Also bounds reconstruction canvases. */
  limitInputPixels?: number;
  ffmpegPath?: string;
  /** Awaited; paths are valid during the callback and may move when the job commits. */
  onAsset?: (
    asset: Readonly<OutputAsset>,
    signal: AbortSignal,
  ) => void | Promise<void>;
  onProgress?: (event: Readonly<ProgressEvent>) => void;
};
export type ConvertOptions = JobOptions & {
  projection?: Projection;
  /** Only planar supports deepzoom; planar defaults to deepzoom, panoramas to custom. */
  layout?: "custom" | "deepzoom";
  tileSize?: number;
  format?: ImageFormat;
  quality?: number;
  pyramidDownscale?: number;
  /** Ascending square face edges for cubemap, explicit sizes for other custom modes. */
  levels?: number[] | ImageSize[];
  /** %s face, %l level, %h column, %v row, %e extension; %0h/%00v padding is supported. */
  tilePathTemplate?: string;
  /** Even cube-face edge. Default approximately source width / 4, capped at 12288. */
  faceSize?: number;
};
export type ConversionResult = {
  outputDir: string;
  manifest: ConversionManifest;
  /** Null for planar images. No id, host, cloud credentials, or database fields. */
  viewerConfig: ViewerConfig | null;
  assets: OutputAsset[];
};
export type RestoreOptions = JobOptions & {
  /** The stored level number, not an array offset. Defaults to the highest level. */
  level?: number;
  format?: ImageFormat;
  quality?: number;
  exportCubeFaces?: boolean;
  /** Even equirectangular width for cubemap reconstruction. Default 4 * selected face edge. */
  outputWidth?: number;
};
export type RestorationResult = ImageSize & {
  outputDir: string;
  projection: "equirectangular" | "planar";
  assets: OutputAsset[];
};
