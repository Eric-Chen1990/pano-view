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

export function buildDefaultTileUrlTemplate(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return `${normalizedBaseUrl}/tiles/%s/l%l/%v/l%l_%s_%h_%v.webp`;
}

export function resolveTemplateUrl(
  template: string,
  address: TileAddress,
): string {
  return template
    .replace(/%s/g, address.face)
    .replace(/%l/g, String(address.level))
    .replace(/%h/g, String(address.col))
    .replace(/%v/g, String(address.row));
}
