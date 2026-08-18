import type {
  GraphicDefinition,
  HotspotPosition,
  PolygonValidationIssue,
} from "@ericchen1990/pano-view";
import { DEMO_HOTSPOTS, DEMO_POLYGON } from "./constants";
import type { EditorHotspot, EditorPolygon, EditorPolyline } from "./types";

export function cloneDemoHotspots(): EditorHotspot[] {
  return DEMO_HOTSPOTS.map((hotspot) => ({
    ...hotspot,
    position: { ...hotspot.position },
    ...(hotspot.type === "graphic" ? { graphic: { ...hotspot.graphic } } : {}),
  }));
}

export function cloneDemoPolygons(): EditorPolygon[] {
  return [{
    ...DEMO_POLYGON,
    vertices: DEMO_POLYGON.vertices.map((vertex) => ({ ...vertex })),
  }];
}

export function cloneDemoPolylines(): EditorPolyline[] {
  return [];
}

export function createId(type: EditorHotspot["type"]): string {
  return `${type}-${crypto.randomUUID().slice(0, 8)}`;
}

export function hotspotTypeCode(type: EditorHotspot["type"]): string {
  switch (type) {
    case "image":
      return "IMG";
    case "graphic":
      return "GFX";
    case "sequence":
      return "SEQ";
    case "video":
      return "VID";
    case "text":
      return "TXT";
    case "iframe":
      return "FRM";
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

export function createGraphic(
  kind: "circle" | "triangle" | "diamond" | "star" | "arrow" | "rectangle" | "ring" | "svg",
): GraphicDefinition {
  switch (kind) {
    case "rectangle":
      return {
        kind,
        fill: "#df6b42",
        stroke: "#f5fbfc",
        strokeWidth: 8,
        cornerRadius: 0.1,
      };
    case "triangle":
    case "diamond":
    case "star":
    case "arrow":
      return { kind, fill: "#df6b42", stroke: "#f5fbfc", strokeWidth: 8 };
    case "ring":
      return {
        kind,
        fill: "#df6b42",
        stroke: "#f5fbfc",
        strokeWidth: 8,
        innerRadius: 0.62,
      };
    case "svg":
      return { kind, src: "/fixtures/hotspots/signal.svg" };
    case "circle":
      return { kind, fill: "#df6b42", stroke: "#f5fbfc", strokeWidth: 8 };
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function formatPosition(position: HotspotPosition): string {
  return `${position.yaw.toFixed(1)}° / ${position.pitch.toFixed(1)}°`;
}

export function numberValue(value: string, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function withoutTrailingDuplicate(vertices: HotspotPosition[]): HotspotPosition[] {
  if (vertices.length < 2) return vertices;
  const previous = vertices[vertices.length - 2]!;
  const last = vertices[vertices.length - 1]!;
  const yawDifference = Math.abs(((last.yaw - previous.yaw + 540) % 360) - 180);
  return yawDifference < 0.001 && Math.abs(last.pitch - previous.pitch) < 0.001
    ? vertices.slice(0, -1)
    : vertices;
}

export function polygonIssueSummary(issues: PolygonValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(" ");
}
