import { isRecord, requiredString } from "../../../../shared/viewer-config";
import { PanoDataError } from "./errors";
import { parseMapPresentation, parseMapSector, type PanoMapPresentation, type PanoMapSectorDefinition } from "./map";
import { mapResource, resolveResource, type AssetUrlResolver } from "./viewer";

export const PANO_GEO_COORDINATE_SYSTEMS = ["wgs84", "gcj02", "bd09"] as const;
export type PanoGeoCoordinateSystem = (typeof PANO_GEO_COORDINATE_SYSTEMS)[number];
export type PanoGeoPosition = { lat: number; lng: number };

export type PanoGeoMapSpot = {
  id: string;
  sceneId: string;
  positions: Partial<Record<PanoGeoCoordinateSystem, PanoGeoPosition>>;
  label?: string;
  icon?: string;
  /** Clockwise degrees from true north when viewer yaw is zero. */
  heading?: number;
};

export type PanoGeoMapDefinition = {
  spots: PanoGeoMapSpot[];
  initialSourceId?: string;
  presentation?: PanoMapPresentation;
  iconSize?: number;
  controlsLayout?: "horizontal" | "vertical";
  sector?: PanoMapSectorDefinition | false;
  /** Lowest allowed Web Mercator zoom (inclusive). */
  minZoom?: number;
  /** Highest allowed Web Mercator zoom (inclusive). */
  maxZoom?: number;
  /** Zoom used the first time a basemap opens. */
  initialZoom?: number;
};

export function isPanoGeoPosition(value: unknown): value is PanoGeoPosition {
  return isRecord(value) && typeof value.lat === "number" && Math.abs(value.lat) <= 90 &&
    typeof value.lng === "number" && Math.abs(value.lng) <= 180;
}

function optionalZoom(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`geoMap.${key}: expected a finite number`);
  if (value < 0 || value > 24)
    throw new Error(`geoMap.${key}: expected a number between 0 and 24`);
  return value;
}

export function parsePanoGeoMap(value: unknown, sceneIds: ReadonlySet<string>): PanoGeoMapDefinition | undefined {
  if (value === undefined) return undefined;
  try {
    if (!isRecord(value)) throw new Error("geoMap: expected an object");
    if (!Array.isArray(value.spots)) throw new Error("geoMap.spots: expected an array");
    const result: PanoGeoMapDefinition = { spots: [] };
    const ids = new Set<string>();
    for (const [index, spot] of value.spots.entries()) {
      const field = `geoMap.spots[${index}]`;
      if (!isRecord(spot)) throw new Error(`${field}: expected an object`);
      const id = requiredString(spot.id, `${field}.id`);
      const sceneId = requiredString(spot.sceneId, `${field}.sceneId`);
      if (ids.has(id)) throw new Error(`${field}.id: duplicate spot ID`);
      if (!sceneIds.has(sceneId)) throw new Error(`${field}.sceneId: scene does not exist`);
      if (!isRecord(spot.positions) || !Object.keys(spot.positions).length)
        throw new Error(`${field}.positions: expected at least one position`);
      const positions: PanoGeoMapSpot["positions"] = {};
      for (const [system, position] of Object.entries(spot.positions)) {
        const key = PANO_GEO_COORDINATE_SYSTEMS.find((item) => item === system);
        if (!key || !isPanoGeoPosition(position))
          throw new Error(`${field}.positions.${system}: expected a supported coordinate system and valid latitude/longitude`);
        positions[key] = { lat: position.lat, lng: position.lng };
      }
      const parsed: PanoGeoMapSpot = { id, sceneId, positions };
      if (spot.label !== undefined) parsed.label = requiredString(spot.label, `${field}.label`);
      if (spot.icon !== undefined) {
        parsed.icon = requiredString(spot.icon, `${field}.icon`);
        resolveResource("https://map.invalid/", parsed.icon);
      }
      if (spot.heading !== undefined) {
        if (typeof spot.heading !== "number" || !Number.isFinite(spot.heading))
          throw new Error(`${field}.heading: expected a finite number`);
        parsed.heading = ((spot.heading % 360) + 360) % 360;
      }
      result.spots.push(parsed);
      ids.add(id);
    }
    if (value.initialSourceId !== undefined)
      result.initialSourceId = requiredString(value.initialSourceId, "geoMap.initialSourceId");
    if (value.presentation !== undefined)
      result.presentation = parseMapPresentation(value.presentation, "geoMap.presentation");
    if (value.sector !== undefined)
      result.sector = value.sector === false ? false : parseMapSector(value.sector, "geoMap.sector");
    if (value.controlsLayout !== undefined) {
      if (value.controlsLayout !== "horizontal" && value.controlsLayout !== "vertical")
        throw new Error('geoMap.controlsLayout: expected "horizontal" or "vertical"');
      result.controlsLayout = value.controlsLayout;
    }
    if (value.iconSize !== undefined) {
      if (typeof value.iconSize !== "number" || !Number.isFinite(value.iconSize) || value.iconSize <= 0)
        throw new Error("geoMap.iconSize: expected a positive number");
      result.iconSize = value.iconSize;
    }
    const minZoom = optionalZoom(value, "minZoom");
    const maxZoom = optionalZoom(value, "maxZoom");
    const initialZoom = optionalZoom(value, "initialZoom");
    if (minZoom !== undefined && maxZoom !== undefined && minZoom > maxZoom)
      throw new Error("geoMap.minZoom: expected a number <= geoMap.maxZoom");
    if (initialZoom !== undefined) {
      if (minZoom !== undefined && initialZoom < minZoom)
        throw new Error("geoMap.initialZoom: expected a number >= geoMap.minZoom");
      if (maxZoom !== undefined && initialZoom > maxZoom)
        throw new Error("geoMap.initialZoom: expected a number <= geoMap.maxZoom");
    }
    if (minZoom !== undefined) result.minZoom = minZoom;
    if (maxZoom !== undefined) result.maxZoom = maxZoom;
    if (initialZoom !== undefined) result.initialZoom = initialZoom;
    return result;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Invalid online map";
    throw new PanoDataError("INVALID_PROJECT", message, { field: message.split(":")[0], cause });
  }
}

export function resolvePanoGeoMapAssets(
  map: PanoGeoMapDefinition, baseUrl: string, resolveAssetUrl?: AssetUrlResolver,
): PanoGeoMapDefinition {
  return {
    ...map,
    spots: map.spots.map((spot) => spot.icon ? {
      ...spot,
      icon: mapResource(spot.icon, {
        defaultUrl: resolveResource(baseUrl, spot.icon),
        kind: "map",
        sceneId: spot.sceneId,
        hotspotId: spot.id,
      }, resolveAssetUrl),
    } : spot),
  };
}
