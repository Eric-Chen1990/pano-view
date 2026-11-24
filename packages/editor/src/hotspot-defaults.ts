import { hotspotScaleMode } from "../../../shared/hotspot-rendering";
import {
  DEFAULT_HOTSPOT_TOOLTIP_OFFSET,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view";

const common: Record<string, unknown> = {
  visible: true,
  interactive: true,
  pointerEvents: "auto",
  scale: 1,
  rotation: 0,
  opacity: 1,
  distance: 10,
  referenceFov: 75,
  mode: "billboard",
  scaleMode: "fixed",
  tooltipMode: "billboard",
  tooltipScaleMode: "inherit",
  tooltipTrigger: "always",
  tooltipPlacement: "top",
  tooltipOffset: DEFAULT_HOTSPOT_TOOLTIP_OFFSET,
};

// Mirror the concrete viewer components, not the editor's creation presets.
const content: Record<
  ProjectHotspotDefinition["type"],
  Record<string, unknown>
> = {
  image: { width: 12, height: 8 },
  portal: {
    width: 10, height: 16, mode: "surface", scaleMode: "fov", shape: "rectangle",
    "frame.color": "#87ddd4", "frame.thickness": 0.04,
  },
  graphic: {
    width: 10,
    height: 10,
    "graphic.strokeWidth": 8,
    "graphic.cornerRadius": 0,
    "graphic.innerRadius": 0.58,
  },
  sequence: {
    width: 12,
    height: 8,
    fps: 12,
    frameDirection: "vertical",
    playing: false,
    loop: true,
  },
  video: {
    width: 16,
    height: 9,
    playing: false,
    loop: false,
    muted: false,
    volume: 1,
    playsInline: true,
    preload: "metadata",
  },
  audio: {
    width: 8,
    height: 8,
    playing: false,
    loop: false,
    muted: false,
    volume: 1,
    range: 360,
    spatialAudio: false,
    soundDistance: 3,
    marker: true,
    pauseWhenHidden: true,
  },
  text: {
    width: 16,
    height: 6,
    fontFamily: "system-ui, sans-serif",
    fontSize: 96,
    fontWeight: 600,
    fontStyle: "normal",
    color: "#f8fafc",
    background: "#111827",
    backgroundOpacity: 0.72,
    padding: 0.08,
    lineHeight: 1.25,
    borderRadius: 0.08,
    strokeWidth: 0,
    align: "center",
    verticalAlign: "middle",
    whiteSpace: "normal",
  },
  iframe: {
    width: 18,
    height: 12,
    pointerPolicy: "hotspot",
    background: "transparent",
  },
  callout: {
    width: 3.2,
    height: 3.2,
    trigger: "hover",
    lookAngle: 6,
    lookDelay: 250,
    "line.angle": 45,
    "line.length": 96,
    "line.color": "#ffffff",
    "line.width": 2,
    "marker.color": "#ffffff",
    "animation.lineDuration": 280,
    "animation.contentDuration": 220,
    "appearance.background": "rgba(16, 20, 24, 0.86)",
    "appearance.titleBackground": "#8b1e1e",
  },
  polygon: {
    fill: "#df6b42",
    fillOpacity: 0.34,
    stroke: "#f5fbfc",
    strokeWidth: 2,
    strokeOpacity: 1,
  },
  polyline: { stroke: "#f5fbfc", strokeWidth: 2, strokeOpacity: 1 },
};

export function hotspotFieldDefault(
  hotspot: ProjectHotspotDefinition,
  name: string
): unknown {
  if (name === "scaleMode" && "position" in hotspot)
    return hotspot.type === "portal" ? "fov" : hotspotScaleMode(hotspot.mode, hotspot.scaleMode);
  if (name === "renderOrder") return "vertices" in hotspot ? 10 : 0;
  return content[hotspot.type][name] ?? common[name];
}

export function fieldValue(value: unknown, defaultValue: unknown): unknown {
  return value === undefined ? defaultValue : value;
}
