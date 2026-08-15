import type { GraphicDefinition } from "./graphic-hotspot";
import type {
  HotspotMode,
  HotspotPosition,
  HotspotScaleMode,
} from "./types";

/** Shared serializable fields for every saved hotspot definition. */
export type HotspotDefinitionBase = {
  id: string;
  /** Human-readable label; use it as the source for the rendered ariaLabel. */
  label?: string;
  visible?: boolean;
  interactive?: boolean;
  renderOrder?: number;
};

/** Shared serializable fields for a hotspot anchored at one yaw/pitch point. */
export type PointHotspotDefinitionBase = HotspotDefinitionBase & {
  position: HotspotPosition;
  width?: number;
  height?: number;
  mode?: HotspotMode;
  distance?: number;
  scaleMode?: HotspotScaleMode;
  referenceFov?: number;
  rotation?: number;
  opacity?: number;
};

export type ImageHotspotDefinition = PointHotspotDefinitionBase & {
  type: "image";
  src: string;
};

export type GraphicHotspotDefinition = PointHotspotDefinitionBase & {
  type: "graphic";
  graphic: GraphicDefinition;
};

export type SequenceHotspotDefinition = PointHotspotDefinitionBase & {
  type: "sequence";
  src: string;
  frameCount: number;
  frameDirection?: "horizontal" | "vertical";
  playing?: boolean;
  fps?: number;
  loop?: boolean;
};

export type VideoHotspotDefinition = PointHotspotDefinitionBase & {
  type: "video";
  src: string;
  poster?: string;
  playing?: boolean;
  loop?: boolean;
  muted?: boolean;
  volume?: number;
  playsInline?: boolean;
  preload?: "none" | "metadata" | "auto";
  crossOrigin?: "" | "anonymous" | "use-credentials";
};

export type PolygonHotspotDefinition = HotspotDefinitionBase & {
  type: "polygon";
  vertices: HotspotPosition[];
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
};

/** An open path. This extends the original five hotspot categories. */
export type PolylineHotspotDefinition = HotspotDefinitionBase & {
  type: "polyline";
  vertices: HotspotPosition[];
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
};

export type PointHotspotDefinition =
  | ImageHotspotDefinition
  | GraphicHotspotDefinition
  | SequenceHotspotDefinition
  | VideoHotspotDefinition;

/** A serializable, discriminated hotspot collection item. */
export type HotspotDefinition =
  | PointHotspotDefinition
  | PolygonHotspotDefinition
  | PolylineHotspotDefinition;
