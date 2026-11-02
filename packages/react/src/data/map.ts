import { isRecord, requiredString } from "../../../../shared/viewer-config";
import type { PanoDragMotion } from "../drag-motion";
import { PanoDataError } from "./errors";
import {
  mapResource,
  resolveResource,
  type AssetUrlResolver,
} from "./viewer";

export type { PanoDragMotion };

export type PanoMapCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type PanoMapGradientStop = {
  offset: number;
  color: string;
  opacity?: number;
};

export type PanoMapSectorGradient = {
  type: "radial" | "linear";
  stops: PanoMapGradientStop[];
};

export type PanoMapSectorDefinition = {
  /** Sector opening angle in degrees. */
  angle: number;
  /** Sector radius in CSS pixels; does not scale with the floor image. */
  radius: number;
  /** When true, sector angle follows the current horizontal FOV. */
  followFov?: boolean;
  /** Solid fill color when `gradient` is omitted. */
  color?: string;
  /**
   * Overall fill opacity in [0, 1].
   * Applies in both solid and gradient modes; gradient stop opacities only
   * describe the relative fade shape and are normalized against this value.
   */
  opacity?: number;
  /** Optional sector outline color. */
  strokeColor?: string;
  /** Outline width in CSS pixels. */
  strokeWidth?: number;
  /** Outline opacity in [0, 1]. Defaults to 1 when stroke is set. */
  strokeOpacity?: number;
  /**
   * Optional fill gradient. When omitted, the sector uses a solid `color`.
   * Stop colors are independent of `color` unless the author keeps them in sync.
   */
  gradient?: PanoMapSectorGradient;
};

export type PanoMapSpotDefinition = {
  id: string;
  sceneId: string;
  /** Normalized image X in [0, 1], origin at the top-left. */
  x: number;
  /** Normalized image Y in [0, 1], origin at the top-left. */
  y: number;
  /**
   * Clockwise degrees from image up when viewer yaw is 0.
   * Runtime sector rotation is `heading + yaw`.
   */
  heading: number;
  icon?: string;
};

export type PanoMapControlsDefinition = {
  /** Show expand/collapse on a docked panel. */
  collapse?: boolean;
  /** Show zoom-in and zoom-out buttons. */
  zoom?: boolean;
};

export type PanoMapDockedPresentation = {
  mode: "docked";
  corner?: PanoMapCorner;
  width?: number;
  height?: number;
  offsetX?: number;
  offsetY?: number;
};

export type PanoMapDialogPresentation = {
  mode: "dialog";
  corner?: PanoMapCorner;
  offsetX?: number;
  offsetY?: number;
  width?: number;
  height?: number;
};

export type PanoMapPresentation =
  | PanoMapDockedPresentation
  | PanoMapDialogPresentation;

export type PanoMapDefinition = {
  image: string;
  /**
   * Pointer interaction with the floor image.
   * - `fixed`: fit-only; no wheel/pan zoom (zoom buttons are also suppressed).
   * - `zoom`: wheel/pan zoom and optional zoom buttons.
   */
  interaction?: "fixed" | "zoom";
  presentation?: PanoMapPresentation;
  controls?: PanoMapControlsDefinition;
  /** Spot icon edge length in CSS pixels. */
  iconSize?: number;
  /**
   * Maximum zoom multiplier relative to the contain-fit scale.
   * Only applies when `interaction` is `"zoom"`. Defaults to 8.
   */
  maxScale?: number;
  /**
   * Pan inertia and edge bounce when `interaction` is `"zoom"`.
   * Omit for both on; set `false` or flag fields to disable.
   */
  dragMotion?: PanoDragMotion | false;
  spots: PanoMapSpotDefinition[];
  sector?: PanoMapSectorDefinition;
};

const CORNERS = new Set<PanoMapCorner>([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
]);

function optionalNumber(
  record: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number; exclusiveMin?: number; exclusiveMax?: number } = {},
): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${key}: expected a finite number`);
  if (options.min !== undefined && value < options.min)
    throw new Error(`${key}: expected a number >= ${options.min}`);
  if (options.max !== undefined && value > options.max)
    throw new Error(`${key}: expected a number <= ${options.max}`);
  if (options.exclusiveMin !== undefined && value <= options.exclusiveMin)
    throw new Error(`${key}: expected a number > ${options.exclusiveMin}`);
  if (options.exclusiveMax !== undefined && value >= options.exclusiveMax)
    throw new Error(`${key}: expected a number < ${options.exclusiveMax}`);
  return value;
}

function requiredNumber(
  record: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number; exclusiveMin?: number; exclusiveMax?: number } = {},
): number {
  const value = optionalNumber(record, key, options);
  if (value === undefined) throw new Error(`${key}: expected a finite number`);
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  return record[key] === undefined
    ? undefined
    : requiredString(record[key], key);
}

function parseGradientStop(
  value: unknown,
  field: string,
): PanoMapGradientStop {
  if (!isRecord(value)) throw new Error(`${field}: expected an object`);
  const offset = requiredNumber(value, "offset", { min: 0, max: 1 });
  const color = requiredString(value.color, `${field}.color`);
  const opacity = optionalNumber(value, "opacity", { min: 0, max: 1 });
  return {
    offset,
    color,
    ...(opacity === undefined ? {} : { opacity }),
  };
}

function parseSector(value: unknown, field: string): PanoMapSectorDefinition {
  if (!isRecord(value)) throw new Error(`${field}: expected an object`);
  const angle = requiredNumber(value, "angle", { exclusiveMin: 0, exclusiveMax: 360 });
  const radius = requiredNumber(value, "radius", { exclusiveMin: 0 });
  const followFov =
    value.followFov === undefined
      ? undefined
      : value.followFov === true
        ? true
        : value.followFov === false
          ? false
          : (() => {
              throw new Error(`${field}.followFov: expected a boolean`);
            })();
  const color = optionalString(value, "color");
  const opacity = optionalNumber(value, "opacity", { min: 0, max: 1 });
  const strokeColor = optionalString(value, "strokeColor");
  const strokeWidth = optionalNumber(value, "strokeWidth", { min: 0 });
  const strokeOpacity = optionalNumber(value, "strokeOpacity", { min: 0, max: 1 });
  let gradient: PanoMapSectorGradient | undefined;
  if (value.gradient !== undefined) {
    if (!isRecord(value.gradient))
      throw new Error(`${field}.gradient: expected an object`);
    const type = value.gradient.type;
    if (type !== "radial" && type !== "linear")
      throw new Error(`${field}.gradient.type: expected "radial" or "linear"`);
    if (!Array.isArray(value.gradient.stops) || value.gradient.stops.length < 2)
      throw new Error(`${field}.gradient.stops: expected at least two stops`);
    gradient = {
      type,
      stops: value.gradient.stops.map((stop, index) =>
        parseGradientStop(stop, `${field}.gradient.stops[${index}]`),
      ),
    };
  }
  return {
    angle,
    radius,
    ...(followFov === undefined ? {} : { followFov }),
    ...(color === undefined ? {} : { color }),
    ...(opacity === undefined ? {} : { opacity }),
    ...(strokeColor === undefined ? {} : { strokeColor }),
    ...(strokeWidth === undefined ? {} : { strokeWidth }),
    ...(strokeOpacity === undefined ? {} : { strokeOpacity }),
    ...(gradient === undefined ? {} : { gradient }),
  };
}

function parsePresentation(
  value: unknown,
  field: string,
): PanoMapPresentation {
  if (!isRecord(value)) throw new Error(`${field}: expected an object`);
  const mode = value.mode;
  if (mode !== "docked" && mode !== "dialog")
    throw new Error(`${field}.mode: expected "docked" or "dialog"`);
  const cornerValue = value.corner;
  const corner =
    cornerValue === undefined
      ? undefined
      : typeof cornerValue === "string" && CORNERS.has(cornerValue as PanoMapCorner)
        ? (cornerValue as PanoMapCorner)
        : (() => {
            throw new Error(
              `${field}.corner: expected top-left, top-right, bottom-left, or bottom-right`,
            );
          })();
  const width = optionalNumber(value, "width", { exclusiveMin: 0 });
  const height = optionalNumber(value, "height", { exclusiveMin: 0 });
  const offsetX = optionalNumber(value, "offsetX", { min: 0 });
  const offsetY = optionalNumber(value, "offsetY", { min: 0 });
  return {
    mode,
    ...(corner === undefined ? {} : { corner }),
    ...(width === undefined ? {} : { width }),
    ...(height === undefined ? {} : { height }),
    ...(offsetX === undefined ? {} : { offsetX }),
    ...(offsetY === undefined ? {} : { offsetY }),
  };
}

function parseOptionalBoolean(
  value: unknown,
  field: string,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === true) return true;
  if (value === false) return false;
  throw new Error(`${field}: expected a boolean`);
}

function parseDragMotion(
  value: unknown,
  field: string,
): PanoDragMotion | false {
  if (value === false) return false;
  if (!isRecord(value)) throw new Error(`${field}: expected an object or false`);
  const inertia = parseOptionalBoolean(value.inertia, `${field}.inertia`);
  const bounce = parseOptionalBoolean(value.bounce, `${field}.bounce`);
  const motion: PanoDragMotion = {
    ...(inertia === undefined ? {} : { inertia }),
    ...(bounce === undefined ? {} : { bounce }),
  };
  return motion;
}

function parseControls(
  value: unknown,
  field: string,
): PanoMapControlsDefinition {
  if (!isRecord(value)) throw new Error(`${field}: expected an object`);
  const collapse =
    value.collapse === undefined
      ? undefined
      : value.collapse === true
        ? true
        : value.collapse === false
          ? false
          : (() => {
              throw new Error(`${field}.collapse: expected a boolean`);
            })();
  const zoom =
    value.zoom === undefined
      ? undefined
      : value.zoom === true
        ? true
        : value.zoom === false
          ? false
          : (() => {
              throw new Error(`${field}.zoom: expected a boolean`);
            })();
  return {
    ...(collapse === undefined ? {} : { collapse }),
    ...(zoom === undefined ? {} : { zoom }),
  };
}

function parseSpot(
  value: unknown,
  field: string,
  sceneIds: Set<string>,
): PanoMapSpotDefinition {
  if (!isRecord(value)) throw new Error(`${field}: expected an object`);
  const id = requiredString(value.id, `${field}.id`);
  const sceneId = requiredString(value.sceneId, `${field}.sceneId`);
  if (!sceneIds.has(sceneId))
    throw new Error(`${field}.sceneId: scene does not exist`);
  const x = requiredNumber(value, "x", { min: 0, max: 1 });
  const y = requiredNumber(value, "y", { min: 0, max: 1 });
  const heading = requiredNumber(value, "heading");
  const icon = optionalString(value, "icon");
  if (icon) resolveResource("https://map.invalid/", icon);
  return {
    id,
    sceneId,
    x,
    y,
    heading,
    ...(icon === undefined ? {} : { icon }),
  };
}

/** Parse an optional project floor plan. Scene IDs must already be collected. */
export function parsePanoMap(
  value: unknown,
  sceneIds: Set<string>,
  options: { draft?: boolean } = {},
): PanoMapDefinition | undefined {
  if (value === undefined) return undefined;
  try {
    if (!isRecord(value)) throw new Error("map: expected an object");
    if (typeof value.image !== "string" || (!options.draft && !value.image.trim()))
      throw new Error("map.image: expected a nonempty string");
    const image = value.image;
    if (image.trim()) resolveResource("https://map.invalid/", image);
    const interaction =
      value.interaction === undefined
        ? undefined
        : value.interaction === "fixed" || value.interaction === "zoom"
          ? value.interaction
          : (() => {
              throw new Error('map.interaction: expected "fixed" or "zoom"');
            })();
    const presentation =
      value.presentation === undefined
        ? undefined
        : parsePresentation(value.presentation, "map.presentation");
    const controls =
      value.controls === undefined
        ? undefined
        : parseControls(value.controls, "map.controls");
    const iconSize = optionalNumber(value, "iconSize", { exclusiveMin: 0 });
    const maxScale = optionalNumber(value, "maxScale", { min: 1 });
    const dragMotion =
      value.dragMotion === undefined
        ? undefined
        : parseDragMotion(value.dragMotion, "map.dragMotion");
    if (!Array.isArray(value.spots)) throw new Error("map.spots: expected an array");
    const spotIds = new Set<string>();
    const spots = value.spots.map((spot, index) => {
      const parsed = parseSpot(spot, `map.spots[${index}]`, sceneIds);
      if (spotIds.has(parsed.id))
        throw new Error(`map.spots[${index}].id: duplicate spot ID`);
      spotIds.add(parsed.id);
      return parsed;
    });
    const sector =
      value.sector === undefined
        ? undefined
        : parseSector(value.sector, "map.sector");
    return {
      image,
      ...(interaction === undefined ? {} : { interaction }),
      ...(presentation === undefined ? {} : { presentation }),
      ...(controls === undefined ? {} : { controls }),
      ...(iconSize === undefined ? {} : { iconSize }),
      ...(maxScale === undefined ? {} : { maxScale }),
      ...(dragMotion === undefined ? {} : { dragMotion }),
      spots,
      ...(sector === undefined ? {} : { sector }),
    };
  } catch (cause) {
    if (cause instanceof PanoDataError) throw cause;
    const message = cause instanceof Error ? cause.message : "Invalid map";
    throw new PanoDataError("INVALID_PROJECT", message, {
      field: message.split(":")[0],
      cause,
    });
  }
}

export function resolvePanoMapAssets(
  map: PanoMapDefinition,
  baseUrl: string,
  resolveAssetUrl?: AssetUrlResolver,
): PanoMapDefinition {
  const resolve = (path: string, spotId?: string) =>
    mapResource(
      path,
      {
        defaultUrl: resolveResource(baseUrl, path),
        kind: "map",
        sceneId: spotId ?? "",
        hotspotId: spotId,
      },
      resolveAssetUrl,
    );
  return {
    ...map,
    image: resolve(map.image),
    spots: map.spots.map((spot) =>
      spot.icon
        ? { ...spot, icon: resolve(spot.icon, spot.id) }
        : { ...spot },
    ),
  };
}
