import type {
  TileAddress,
  TileMultiresConfig,
} from "./types";

function positiveInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) {
    throw new Error(`${name} must be a positive integer, received ${String(value)}`);
  }
  return value;
}

function ascendingLevels(levels: number[]): number[] {
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index]! <= levels[index - 1]!) {
      throw new Error("multires face sizes must be strictly ascending");
    }
  }
  return levels;
}

export function parseMultires(
  multires: string | TileMultiresConfig,
): TileMultiresConfig {
  if (typeof multires !== "string") {
    const tileSize = positiveInteger(multires.tileSize, "multires.tileSize");
    if (multires.levels.length === 0) {
      throw new Error("multires.levels must contain at least one face size");
    }
    const levels = ascendingLevels(
      multires.levels.map((level, index) =>
        positiveInteger(level, `multires.levels[${index}]`),
      ),
    );
    return { tileSize, levels };
  }

  const values = multires.split(",").map((part) => Number(part.trim()));

  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) {
    throw new Error(
      "multires must contain a tile size followed by at least one face size",
    );
  }

  const tileSize = positiveInteger(values[0]!, "multires tile size");
  const levels = ascendingLevels(
    values.slice(1).map((level, index) =>
      positiveInteger(level, `multires level ${index + 1}`),
    ),
  );
  return { tileSize, levels };
}

export const DEFAULT_TILE_URL_TEMPLATE = "tiles/%s/l%l/%v/l%l_%s_%h_%v.webp";
export const DEFAULT_TILE_PREVIEW_PATH = "previews/cube-vertical.webp";

export function buildDefaultTileUrlTemplate(): string {
  return DEFAULT_TILE_URL_TEMPLATE;
}

export function resolveRelativeTileUrl(
  baseUrl: string,
  relativePath: string,
): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = relativePath.replace(/^\/+/, "");
  return normalizedBaseUrl
    ? `${normalizedBaseUrl}/${normalizedPath}`
    : normalizedPath;
}

function isAbsoluteAssetUrl(url: string): boolean {
  return (
    url.startsWith("/") ||
    url.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(url)
  );
}

export function resolveAssetUrl(baseUrl: string, path: string): string {
  return isAbsoluteAssetUrl(path) ? path : resolveRelativeTileUrl(baseUrl, path);
}

export function resolvePreviewUrl(
  baseUrl: string,
  previewUrl: string | null | undefined,
): string | null {
  if (previewUrl === null) {
    return null;
  }
  return resolveAssetUrl(baseUrl, previewUrl ?? DEFAULT_TILE_PREVIEW_PATH);
}

export function resolveTemplateUrl(
  template: string,
  address: TileAddress,
): string {
  return template
    .replace(/%s/g, address.face)
    .replace(/%l/g, String(address.level))
    .replace(/%(0*)([hxucvywr])/g, (_match, zeroes: string, placeholder: string) => {
      const value = "hxuc".includes(placeholder)
        ? address.col
        : address.row;
      return String(value).padStart(zeroes.length + 1, "0");
    });
}
