import type { CSSProperties } from "react";
import type {
  AssetUrlResolver,
  JsonRequestOptions,
  PanoProjectDefinition,
  PanoProjectSceneDefinition,
} from "@ericchen1990/pano-view/data";

export type PanoImportProgress = {
  stage: "upload" | "convert";
  /** Fraction from 0 to 1; omit for indeterminate progress. */
  progress?: number;
};
export type PanoImportContext = {
  signal: AbortSignal;
  onProgress: (event: PanoImportProgress) => void;
};
export type PanoAssetRequest = {
  kind: "image" | "video" | "audio" | "document";
  sceneId: string;
  hotspotId: string;
  field: string;
  currentUrl?: string;
};

export type PanoEditorProps = {
  /** Controlled document. Empty scenes are allowed while authoring, but cannot be exported. */
  value?: PanoProjectDefinition;
  defaultValue?: PanoProjectDefinition;
  onChange?: (project: PanoProjectDefinition) => void;
  onSave?: (project: PanoProjectDefinition) => void | Promise<void>;
  /** HTTP(S) resource root for host-owned projects; local directories use their own root. */
  baseUrl?: string;
  requestInit?: JsonRequestOptions["requestInit"];
  resolveAssetUrl?: AssetUrlResolver;
  onImportPanorama?: (
    file: File,
    context: PanoImportContext,
  ) => Promise<PanoProjectSceneDefinition["source"]>;
  onPickAsset?: (request: PanoAssetRequest) => Promise<string | undefined>;
  locale?: "en" | "zh-CN";
  className?: string;
  style?: CSSProperties & { [variable: `--pne-${string}`]: string | number };
};
