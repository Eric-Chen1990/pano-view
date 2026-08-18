import type { CSSProperties } from "react";
import type { GraphicDefinition } from "./graphic-hotspot";
import type { IframePointerPolicy } from "./iframe-hotspot";
import type { TextHotspotStyle } from "./text-hotspot";
import type {
  HotspotMode,
  HotspotPointerEvents,
  HotspotPosition,
  HotspotScaleMode,
  HotspotTooltipAppearance,
  HotspotTooltipContent,
  HotspotTooltipPlacement,
  HotspotTooltipTrigger,
} from "./types";

/** Shared serializable fields for every saved hotspot definition. */
export type HotspotDefinitionBase = {
  id: string;
  /** Human-readable label; use it as the source for the rendered ariaLabel. */
  label?: string;
  visible?: boolean;
  interactive?: boolean;
  /** Pointer hit-testing. `"none"` ignores mouse, touch, and pen. */
  pointerEvents?: HotspotPointerEvents;
  /** Canvas cursor while this hotspot is hovered. */
  cursor?: CSSProperties["cursor"];
  renderOrder?: number;
  tooltip?: string | HotspotTooltipContent;
  tooltipTrigger?: HotspotTooltipTrigger;
  tooltipPlacement?: HotspotTooltipPlacement;
  tooltipOffset?: number;
  tooltipAppearance?: HotspotTooltipAppearance;
};

/** Shared serializable fields for a hotspot anchored at one yaw/pitch point. */
export type PointHotspotDefinitionBase = HotspotDefinitionBase & {
  position: HotspotPosition;
  width?: number;
  height?: number;
  scale?: number;
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

export type TextHotspotDefinition = PointHotspotDefinitionBase &
  TextHotspotStyle & {
    type: "text";
    text: string;
  };

export type IframeHotspotDefinition = PointHotspotDefinitionBase & {
  type: "iframe";
  src: string;
  title?: string;
  sandbox?: string;
  allow?: string;
  referrerPolicy?: string;
  loading?: "eager" | "lazy";
  pointerPolicy?: IframePointerPolicy;
  background?: string;
};

export type PolygonHotspotDefinition = HotspotDefinitionBase & {
  type: "polygon";
  vertices: HotspotPosition[];
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeDashSize?: number;
  strokeGapSize?: number;
};

/** An open path. This extends the original point and polygon hotspot categories. */
export type PolylineHotspotDefinition = HotspotDefinitionBase & {
  type: "polyline";
  vertices: HotspotPosition[];
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
  strokeDashSize?: number;
  strokeGapSize?: number;
};

export type PointHotspotDefinition =
  | ImageHotspotDefinition
  | GraphicHotspotDefinition
  | SequenceHotspotDefinition
  | VideoHotspotDefinition
  | TextHotspotDefinition
  | IframeHotspotDefinition;

/** A serializable, discriminated hotspot collection item. */
export type HotspotDefinition =
  | PointHotspotDefinition
  | PolygonHotspotDefinition
  | PolylineHotspotDefinition;
