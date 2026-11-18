import { isRecord } from "../../../../shared/viewer-config";
import { documentUrl, readJson } from "../data/viewer";
import { resolveTemplateUrl } from "../tile/multires";

export type Size = { width: number; height: number };
export type PlanarLevel = Size & { level: number; columns: number; rows: number };
export type PlanarManifest = {
  source: Size;
  tileSize: number;
  indexBase: 0 | 1;
  levels: PlanarLevel[];
  urlTemplate: string;
  thumbnailUrl: string;
  baseUrl: string;
};

const MAX_TILES = 100_000;

function integer(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function dimensions(value: unknown): Size {
  if (!isRecord(value) || !integer(value.width) || !integer(value.height)) {
    throw new Error("Invalid planar image dimensions");
  }
  return { width: value.width, height: value.height };
}

function pathUrl(path: unknown, baseUrl: string): string {
  if (
    typeof path !== "string" ||
    /[\\:\u0000-\u001f]/u.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Invalid planar asset path");
  }
  // The converter stores filesystem paths; encode literal spaces, hashes and Unicode.
  return new URL(path.split("/").map(encodeURIComponent).join("/"), baseUrl).href;
}

export function parsePlanarManifest(value: unknown, url: string): PlanarManifest {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.projection !== "planar") {
    throw new Error("Expected a version 1 planar conversion manifest");
  }
  const source = dimensions(value.source);
  const tiles = value.tiles;
  if (
    !isRecord(tiles) ||
    !integer(tiles.tileSize) ||
    tiles.tileSize > 8192 ||
    tiles.overlap !== 0 ||
    !((tiles.layout === "deepzoom" && tiles.indexBase === 0) ||
      (tiles.layout === "custom" && tiles.indexBase === 1)) ||
    !Array.isArray(tiles.levels) ||
    tiles.levels.length === 0 ||
    tiles.levels.length > 64 ||
    typeof tiles.urlTemplate !== "string" ||
    /%/.test(tiles.urlTemplate.replace(/%l|%0*[hv]/g, ""))
  ) {
    throw new Error("Invalid planar tile layout");
  }
  const { tileSize, indexBase, urlTemplate } = tiles;
  const baseUrl = new URL(".", url).href;
  pathUrl(urlTemplate, baseUrl);
  let count = 0;
  const levels: PlanarLevel[] = [];
  for (const entry of tiles.levels) {
    const { width, height } = dimensions(entry);
    const level = levels.length + indexBase;
    const columns = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);
    const previous = levels[levels.length - 1];
    count += columns * rows;
    if (
      entry.level !== level ||
      entry.columns !== columns ||
      entry.rows !== rows ||
      width > source.width ||
      height > source.height ||
      (previous &&
        (width < previous.width ||
          height < previous.height ||
          (width === previous.width && height === previous.height))) ||
      count > MAX_TILES
    ) {
      throw new Error("Inconsistent planar tile grid");
    }
    levels.push({ width, height, level, columns, rows });
  }
  if (!isRecord(value.thumbnail)) throw new Error("Missing planar thumbnail");
  return {
    source, tileSize, indexBase, levels, urlTemplate, baseUrl,
    thumbnailUrl: pathUrl(value.thumbnail.path, baseUrl),
  };
}

export async function loadPlanarManifest(url: string, signal: AbortSignal) {
  const response = await readJson(documentUrl(url), { requestInit: { signal } });
  return parsePlanarManifest(response.value, response.url);
}

export function planarTileUrl(manifest: PlanarManifest, level: number, col: number, row: number) {
  const path = resolveTemplateUrl(manifest.urlTemplate, {
    face: "f",
    level,
    col: col + manifest.indexBase,
    row: row + manifest.indexBase,
  });
  return pathUrl(path, manifest.baseUrl);
}
