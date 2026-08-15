import type {
  GraphicDefinition,
  HotspotMode,
  HotspotPosition,
} from "@pano-view/react";

export type ViewerMode = "sphere" | "tile";

export type EditorTool =
  | "navigate"
  | "select"
  | "image"
  | "graphic"
  | "sequence"
  | "video"
  | "polygon"
  | "polyline";

export type EditorHotspot =
  | {
      id: string;
      type: "image";
      label: string;
      position: HotspotPosition;
      width: number;
      height: number;
      mode: HotspotMode;
      distance: number;
      scaleMode: "fov" | "fixed";
      opacity: number;
      visible: boolean;
      src: string;
    }
  | {
      id: string;
      type: "graphic";
      label: string;
      position: HotspotPosition;
      width: number;
      height: number;
      mode: HotspotMode;
      distance: number;
      scaleMode: "fov" | "fixed";
      opacity: number;
      visible: boolean;
      graphic: GraphicDefinition;
    }
  | {
      id: string;
      type: "sequence";
      label: string;
      position: HotspotPosition;
      width: number;
      height: number;
      mode: HotspotMode;
      distance: number;
      scaleMode: "fov" | "fixed";
      opacity: number;
      visible: boolean;
      src: string;
      frameCount: number;
      frameDirection: "horizontal" | "vertical";
      playing: boolean;
      fps: number;
      loop: boolean;
    }
  | {
      id: string;
      type: "video";
      label: string;
      position: HotspotPosition;
      width: number;
      height: number;
      mode: HotspotMode;
      distance: number;
      scaleMode: "fov" | "fixed";
      opacity: number;
      visible: boolean;
      src: string;
      poster: string;
      playing: boolean;
      loop: boolean;
      muted: boolean;
      volume: number;
    };

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
};

export type EditorPolyline = {
  id: string;
  label: string;
  vertices: HotspotPosition[];
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  visible: boolean;
};
