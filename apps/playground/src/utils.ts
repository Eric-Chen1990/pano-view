import {
  DEFAULT_HOTSPOT_TOOLTIP_OFFSET,
  type GraphicDefinition,
  type HotspotPosition,
  type HotspotTooltipContent,
  type HotspotTooltipPlacement,
  type HotspotTooltipTrigger,
  type PolygonValidationIssue,
} from "@ericchen1990/pano-view";
import { DEMO_HOTSPOTS, DEMO_POLYGON } from "./constants";
import type { EditorHotspot, EditorPolygon, EditorPolyline } from "./types";

export function cloneDemoHotspots(): EditorHotspot[] {
  return DEMO_HOTSPOTS.map((hotspot) => ({
    ...hotspot,
    position: { ...hotspot.position },
    tooltip: { ...hotspot.tooltip },
    ...(hotspot.type === "graphic" ? { graphic: { ...hotspot.graphic } } : {}),
  }));
}

export function cloneDemoPolygons(): EditorPolygon[] {
  return [{
    ...DEMO_POLYGON,
    tooltip: { ...DEMO_POLYGON.tooltip },
    vertices: DEMO_POLYGON.vertices.map((vertex) => ({ ...vertex })),
  }];
}

export function cloneDemoPolylines(): EditorPolyline[] {
  return [];
}

export function createId(type: EditorHotspot["type"]): string {
  return `${type}-${crypto.randomUUID().slice(0, 8)}`;
}

export function defaultEditorTooltip(label: string): {
  tooltip: HotspotTooltipContent;
  tooltipTrigger: HotspotTooltipTrigger;
  tooltipPlacement: HotspotTooltipPlacement;
  tooltipOffset: number;
} {
  return {
    tooltip: { text: label },
    tooltipTrigger: "always",
    tooltipPlacement: "top",
    tooltipOffset: DEFAULT_HOTSPOT_TOOLTIP_OFFSET,
  };
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
    case "audio":
      return "AUD";
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

type RgbaColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (channel: number) =>
    Math.min(255, Math.max(0, Math.round(channel)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function parseRgba(value: string): RgbaColor | null {
  const match = value.trim().match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)$/i,
  );
  if (!match) {
    return null;
  }
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] == null ? 1 : Number(match[4]),
  };
}

export function composeRgba(color: RgbaColor): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
}

export function parseCssColor(value: string): RgbaColor | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0]! + hex[0], 16),
        g: Number.parseInt(hex[1]! + hex[1], 16),
        b: Number.parseInt(hex[2]! + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 6) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    return null;
  }
  return parseRgba(trimmed);
}

export function colorToHex(value: string, fallback: string): string {
  const parsed = parseCssColor(value);
  return parsed ? rgbToHex(parsed.r, parsed.g, parsed.b) : fallback;
}

export function parseBorder(value: string): { width: number; color: string } {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px\s+solid\s+(.+)$/i);
  if (!match) {
    return { width: 1, color: "rgba(46, 46, 46, 0.7)" };
  }
  return {
    width: Number(match[1]),
    color: match[2]!.trim(),
  };
}

export function composeBorder(width: number, color: string): string {
  return `${Math.max(0, width)}px solid ${color}`;
}

export function parseShadow(value: string): { blur: number; color: string; opacity: number } {
  if (value.trim() === "none") {
    return { blur: 0, color: "#000000", opacity: 0.35 };
  }
  const match = value.trim().match(
    /^0\s+(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+(.+)$/i,
  );
  if (!match) {
    return { blur: 24, color: "#000000", opacity: 0.35 };
  }
  const color = match[3]!.trim();
  const parsed = parseCssColor(color);
  return {
    blur: Number(match[2]),
    color: parsed ? rgbToHex(parsed.r, parsed.g, parsed.b) : "#000000",
    opacity: parsed?.a ?? 0.35,
  };
}

export function composeShadow(blur: number, colorHex: string, opacity: number): string {
  if (blur <= 0) {
    return "none";
  }
  const parsed = parseCssColor(colorHex);
  if (!parsed) {
    return `0 8px ${blur}px rgba(0, 0, 0, ${opacity})`;
  }
  const offset = Math.max(4, Math.round(blur / 3));
  return `0 ${offset}px ${blur}px ${composeRgba({ ...parsed, a: opacity })}`;
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
