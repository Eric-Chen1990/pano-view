import type {
  GraphicDefinition,
  HotspotMode,
  HotspotPosition,
  HotspotTooltipContent,
  HotspotTooltipPlacement,
  HotspotTooltipTrigger,
  IframePointerPolicy,
  TextHotspotAlign,
  TextHotspotFontStyle,
  TextHotspotVerticalAlign,
  TextHotspotWhiteSpace,
} from "@ericchen1990/pano-view";

export type ViewerMode = "sphere" | "tile";

export type EditorTool =
  | "navigate"
  | "select"
  | "image"
  | "graphic"
  | "sequence"
  | "video"
  | "text"
  | "iframe"
  | "polygon"
  | "polyline";

type EditorPointHotspotBase = {
  id: string;
  label: string;
  position: HotspotPosition;
  width: number;
  height: number;
  rotation: number;
  scale: number;
  mode: HotspotMode;
  distance: number;
  scaleMode: "fov" | "fixed";
  opacity: number;
  visible: boolean;
  tooltip: HotspotTooltipContent;
  tooltipTrigger: HotspotTooltipTrigger;
  tooltipPlacement: HotspotTooltipPlacement;
  tooltipOffset: number;
};

export type EditorHotspot =
  | (EditorPointHotspotBase & {
      type: "image";
      src: string;
    })
  | (EditorPointHotspotBase & {
      type: "graphic";
      graphic: GraphicDefinition;
    })
  | (EditorPointHotspotBase & {
      type: "sequence";
      src: string;
      frameCount: number;
      frameDirection: "horizontal" | "vertical";
      playing: boolean;
      fps: number;
      loop: boolean;
    })
  | (EditorPointHotspotBase & {
      type: "video";
      src: string;
      poster: string;
      playing: boolean;
      loop: boolean;
      muted: boolean;
      volume: number;
    })
  | (EditorPointHotspotBase & {
      type: "text";
      text: string;
      fontFamily: string;
      fontSize: number;
      fontWeight: number;
      fontStyle: TextHotspotFontStyle;
      color: string;
      background: string;
      backgroundOpacity: number;
      align: TextHotspotAlign;
      verticalAlign: TextHotspotVerticalAlign;
      whiteSpace: TextHotspotWhiteSpace;
    })
  | (EditorPointHotspotBase & {
      type: "iframe";
      src: string;
      title: string;
      sandbox: string;
      pointerPolicy: IframePointerPolicy;
    });

export type EditorPolygon = {
  id: string;
  label: string;
  vertices: HotspotPosition[];
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  visible: boolean;
  tooltip: HotspotTooltipContent;
  tooltipTrigger: HotspotTooltipTrigger;
  tooltipPlacement: HotspotTooltipPlacement;
  tooltipOffset: number;
};

export type EditorPolyline = {
  id: string;
  label: string;
  vertices: HotspotPosition[];
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  visible: boolean;
  tooltip: HotspotTooltipContent;
  tooltipTrigger: HotspotTooltipTrigger;
  tooltipPlacement: HotspotTooltipPlacement;
  tooltipOffset: number;
};
