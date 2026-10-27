import { isRecord, requiredString } from "../../../../shared/viewer-config";
import type { HotspotDefinition } from "../hotspot/definitions";
import type { HotspotPosition } from "../hotspot/types";
import { PanoDataError } from "./errors";
import { mapResource, resolveResource, type AssetUrlResolver } from "./viewer";

export type ProjectHotspotDefinition = HotspotDefinition & {
  action?: { type: "scene"; sceneId: string };
};

const common = [
  "label",
  "visible",
  "interactive",
  "pointerEvents",
  "cursor",
  "renderOrder",
  "tooltip",
  "tooltipTrigger",
  "tooltipPlacement",
  "tooltipOffset",
  "tooltipAppearance",
];
const point = [
  "position",
  "width",
  "height",
  "scale",
  "mode",
  "distance",
  "scaleMode",
  "referenceFov",
  "rotation",
  "opacity",
];
const fields = {
  image: ["src"],
  graphic: ["graphic"],
  sequence: ["src", "frameCount", "frameDirection", "playing", "fps", "loop"],
  video: [
    "src",
    "poster",
    "playing",
    "loop",
    "muted",
    "volume",
    "playsInline",
    "preload",
    "crossOrigin",
  ],
  audio: [
    "src",
    "format",
    "playing",
    "loop",
    "muted",
    "volume",
    "pauseWhenHidden",
    "range",
    "icon",
    "playingIcon",
    "marker",
    "crossOrigin",
  ],
  text: [
    "text",
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "color",
    "background",
    "backgroundOpacity",
    "padding",
    "align",
    "verticalAlign",
    "whiteSpace",
    "lineHeight",
    "borderRadius",
    "stroke",
    "strokeWidth",
  ],
  iframe: [
    "src",
    "title",
    "sandbox",
    "allow",
    "referrerPolicy",
    "loading",
    "pointerPolicy",
    "background",
  ],
  polygon: [
    "vertices",
    "fill",
    "fillOpacity",
    "stroke",
    "strokeWidth",
    "strokeOpacity",
    "strokeDashSize",
    "strokeGapSize",
  ],
  polyline: [
    "vertices",
    "stroke",
    "strokeWidth",
    "strokeOpacity",
    "strokeDashSize",
    "strokeGapSize",
  ],
} satisfies Record<HotspotDefinition["type"], string[]>;
const booleanFields = new Set([
  "visible",
  "interactive",
  "playing",
  "loop",
  "muted",
  "playsInline",
  "pauseWhenHidden",
  "marker",
]);
const numberFields = new Set([
  "renderOrder",
  "tooltipOffset",
  "width",
  "height",
  "scale",
  "distance",
  "referenceFov",
  "rotation",
  "opacity",
  "frameCount",
  "fps",
  "volume",
  "range",
  "fontSize",
  "backgroundOpacity",
  "padding",
  "lineHeight",
  "borderRadius",
  "strokeWidth",
  "fillOpacity",
  "strokeOpacity",
  "strokeDashSize",
  "strokeGapSize",
]);
const positiveFields = new Set([
  "width",
  "height",
  "scale",
  "distance",
  "referenceFov",
  "frameCount",
  "fps",
  "fontSize",
  "lineHeight",
]);
const enums: Record<string, readonly string[]> = {
  pointerEvents: ["auto", "none"],
  tooltipTrigger: ["always", "hover", "click"],
  tooltipPlacement: ["top", "bottom", "left", "right"],
  mode: ["surface", "billboard"],
  scaleMode: ["fov", "fixed"],
  frameDirection: ["horizontal", "vertical"],
  preload: ["none", "metadata", "auto"],
  crossOrigin: ["", "anonymous", "use-credentials"],
  fontStyle: ["normal", "italic"],
  align: ["left", "center", "right"],
  verticalAlign: ["top", "middle", "bottom"],
  whiteSpace: ["normal", "nowrap"],
  loading: ["eager", "lazy"],
  pointerPolicy: ["hotspot", "content"],
  referrerPolicy: [
    "",
    "no-referrer",
    "no-referrer-when-downgrade",
    "origin",
    "origin-when-cross-origin",
    "same-origin",
    "strict-origin",
    "strict-origin-when-cross-origin",
    "unsafe-url",
  ],
};

function finite(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${field}: expected a finite number`);
  return value;
}

export function parsePosition(value: unknown, field: string): HotspotPosition {
  if (!isRecord(value)) throw new Error(`${field}: expected yaw and pitch`);
  const yaw = finite(value.yaw, `${field}.yaw`);
  const pitch = finite(value.pitch, `${field}.pitch`);
  if (Math.abs(pitch) > 90)
    throw new Error(`${field}.pitch: expected -90 to 90`);
  return { yaw, pitch };
}

function parseGraphic(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("graphic: expected an object");
  const kind = requiredString(value.kind, "graphic.kind");
  if (
    ![
      "circle",
      "triangle",
      "diamond",
      "star",
      "arrow",
      "rectangle",
      "ring",
      "svg",
      "path",
    ].includes(kind)
  )
    throw new Error("graphic.kind: unsupported graphic");
  const result: Record<string, unknown> = { kind };
  for (const key of ["fill", "stroke"]) {
    if (value[key] !== undefined)
      result[key] = requiredString(value[key], `graphic.${key}`);
  }
  for (const key of ["strokeWidth", "cornerRadius", "innerRadius"]) {
    if (value[key] !== undefined)
      result[key] = finite(value[key], `graphic.${key}`);
  }
  if (kind === "svg") result.src = requiredString(value.src, "graphic.src");
  if (kind === "path") {
    result.path = requiredString(value.path, "graphic.path");
    if (!Array.isArray(value.viewBox) || value.viewBox.length !== 4)
      throw new Error("graphic.viewBox: expected four numbers");
    const viewBox = value.viewBox.map((n, i) =>
      finite(n, `graphic.viewBox[${i}]`)
    );
    if (viewBox[2]! <= 0 || viewBox[3]! <= 0)
      throw new Error("graphic.viewBox: width and height must be positive");
    result.viewBox = viewBox;
  }
  return result;
}

function parseTooltip(value: unknown): unknown {
  if (typeof value === "string") return value;
  if (!isRecord(value)) throw new Error("tooltip: expected text or an object");
  const result: Record<string, string> = {};
  for (const key of ["text", "image", "imageAlt"]) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== "string")
        throw new Error(`tooltip.${key}: expected a string`);
      result[key] = value[key];
    }
  }
  return result;
}

function parseAppearance(value: unknown): Record<string, string | number> {
  if (!isRecord(value))
    throw new Error("tooltipAppearance: expected an object");
  const result: Record<string, string | number> = {};
  for (const key of [
    "background",
    "color",
    "border",
    "borderRadius",
    "shadow",
    "padding",
    "fontSize",
    "fontFamily",
    "lineHeight",
    "letterSpacing",
  ]) {
    const item = value[key];
    if (item === undefined) continue;
    if (
      ["background", "color", "border", "shadow", "fontFamily"].includes(key) &&
      typeof item !== "string"
    )
      throw new Error(`tooltipAppearance.${key}: expected a string`);
    if (
      typeof item !== "string" &&
      (typeof item !== "number" || !Number.isFinite(item))
    )
      throw new Error(
        `tooltipAppearance.${key}: expected a string or finite number`
      );
    result[key] = item;
  }
  return result;
}

export function parseHotspot(
  value: unknown,
  sceneId: string,
  field: string
): ProjectHotspotDefinition {
  try {
    if (!isRecord(value)) throw new Error("expected a hotspot object");
    const type = requiredString(value.type, "type");
    if (!Object.prototype.hasOwnProperty.call(fields, type))
      throw new Error("type: unsupported hotspot type");
    const kind = type as HotspotDefinition["type"];
    const result: Record<string, unknown> = {
      type,
      id: requiredString(value.id, "id"),
    };
    const isPath = kind === "polygon" || kind === "polyline";
    const allowed = [...common, ...(isPath ? [] : point), ...fields[kind]];
    for (const key of allowed) {
      const item = value[key];
      if (item === undefined) continue;
      if (key === "position") result[key] = parsePosition(item, key);
      else if (key === "vertices") {
        if (!Array.isArray(item) || item.length < (kind === "polygon" ? 3 : 2))
          throw new Error("vertices: not enough points");
        result[key] = item.map((p, i) => parsePosition(p, `vertices[${i}]`));
      } else if (key === "graphic") result[key] = parseGraphic(item);
      else if (key === "tooltip") result[key] = parseTooltip(item);
      else if (key === "tooltipAppearance") result[key] = parseAppearance(item);
      else if (booleanFields.has(key)) {
        if (typeof item !== "boolean")
          throw new Error(`${key}: expected a boolean`);
        result[key] = item;
      } else if (numberFields.has(key)) {
        const n = finite(item, key);
        if (positiveFields.has(key) && n <= 0)
          throw new Error(`${key}: expected a positive number`);
        if (key === "frameCount" && !Number.isSafeInteger(n))
          throw new Error("frameCount: expected an integer");
        if (
          [
            "opacity",
            "fillOpacity",
            "strokeOpacity",
            "volume",
            "backgroundOpacity",
          ].includes(key) &&
          (n < 0 || n > 1)
        )
          throw new Error(`${key}: expected 0 to 1`);
        result[key] = n;
      } else if (key === "fontWeight" && typeof item === "number")
        result[key] = finite(item, key);
      else if (
        (key === "src" || key === "format") &&
        kind === "audio" &&
        Array.isArray(item)
      ) {
        if (!item.length)
          throw new Error(`${key}: expected audio ${key === "src" ? "sources" : "formats"}`);
        result[key] = item.map((entry, i) => requiredString(entry, `${key}[${i}]`));
      } else {
        if (typeof item !== "string")
          throw new Error(`${key}: expected a string`);
        if (enums[key] && !enums[key].includes(item))
          throw new Error(`${key}: unsupported value`);
        result[key] = item;
      }
    }
    if (!isPath && !result.position) throw new Error("position: required");
    if (isPath && !result.vertices) throw new Error("vertices: required");
    if (
      ["image", "sequence", "video", "audio", "iframe"].includes(kind) &&
      !(typeof result.src === "string"
        ? result.src.trim()
        : Array.isArray(result.src))
    )
      throw new Error("src: required");
    if (kind === "graphic" && !result.graphic)
      throw new Error("graphic: required");
    if (kind === "text" && typeof result.text !== "string")
      throw new Error("text: required");
    if (kind === "sequence" && !result.frameCount)
      throw new Error("frameCount: required");
    if (value.action !== undefined) {
      if (!isRecord(value.action) || value.action.type !== "scene")
        throw new Error("action: expected a scene action");
      result.action = {
        type: "scene",
        sceneId: requiredString(value.action.sceneId, "action.sceneId"),
      };
    }
    return result as ProjectHotspotDefinition;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Invalid hotspot";
    throw new PanoDataError("INVALID_PROJECT", `${field}.${detail}`, {
      sceneId,
      field: `${field}.${detail.split(":")[0]}`,
      cause,
    });
  }
}

export function resolveHotspotAssets(
  hotspot: ProjectHotspotDefinition,
  baseUrl: string,
  sceneId: string,
  resolver?: AssetUrlResolver
): ProjectHotspotDefinition {
  const resolve = (path: string) =>
    path
      ? mapResource(
          path,
          {
            kind: "hotspot",
            sceneId,
            hotspotId: hotspot.id,
            defaultUrl: resolveResource(baseUrl, path),
          },
          resolver
        )
      : path;
  const result = { ...hotspot };
  if ("src" in result)
    result.src = Array.isArray(result.src)
      ? result.src.map(resolve)
      : resolve(result.src);
  if ("poster" in result && result.poster)
    result.poster = resolve(result.poster);
  if (result.type === "audio") {
    if (result.icon) result.icon = resolve(result.icon);
    if (result.playingIcon) result.playingIcon = resolve(result.playingIcon);
  }
  if (result.type === "graphic" && result.graphic.kind === "svg")
    result.graphic = { ...result.graphic, src: resolve(result.graphic.src) };
  if (typeof result.tooltip === "object")
    result.tooltip = {
      ...result.tooltip,
      ...(result.tooltip.image ? { image: resolve(result.tooltip.image) } : {}),
    };
  return result;
}
