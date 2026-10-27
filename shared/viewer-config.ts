/** The portable rendering contract shared by the converter and browser viewer. */
export type ViewerCubeFace = "f" | "r" | "b" | "l" | "u" | "d";
export type CubemapViewerConfig = {
  type: "tile";
  multires: { tileSize: number; levels: number[] };
  urlTemplate: string;
  previewUrl: string;
  previewFaceOrder: ViewerCubeFace[];
};
export type SphereViewerConfig = {
  type: "sphereTile";
  multires: { tileSize: number; levels: { width: number; height: number }[] };
  urlTemplate: string;
  previewUrl: string;
  indexBase: 0 | 1;
};
export type ViewerConfig = CubemapViewerConfig | SphereViewerConfig;
export type ViewerDocument = ViewerConfig & { schemaVersion: 1 };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${field}: expected a nonempty string`);
  return value;
}

function positive(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${field}: expected a positive safe integer`);
  return value;
}

export function validateViewerConfig(value: unknown): ViewerConfig {
  if (!isRecord(value)) throw new Error("viewerConfig: expected an object");
  if (value.type !== "tile" && value.type !== "sphereTile")
    throw new Error("type: expected tile or sphereTile");
  if (!isRecord(value.multires))
    throw new Error("multires: expected an object");
  const tileSize = positive(value.multires.tileSize, "multires.tileSize");
  if (tileSize > 8192) throw new Error("multires.tileSize: maximum is 8192");
  const input = value.multires.levels;
  if (!Array.isArray(input) || input.length === 0 || input.length > 64)
    throw new Error("multires.levels: expected 1 to 64 levels");
  const urlTemplate = requiredString(value.urlTemplate, "urlTemplate");
  const previewUrl = requiredString(value.previewUrl, "previewUrl");
  if (/%/.test(urlTemplate.replace(/%s|%l|%0*[hxucvywr]/g, "")))
    throw new Error("urlTemplate: unsupported placeholder");
  if (value.type === "tile") {
    const levels = input.map((level, i) =>
      positive(level, `multires.levels[${i}]`)
    );
    if (levels.some((level, i) => i > 0 && level <= levels[i - 1]!))
      throw new Error("multires.levels: face sizes must increase");
    const order = value.previewFaceOrder;
    if (
      !Array.isArray(order) ||
      order.length !== 6 ||
      !["f", "r", "b", "l", "u", "d"].every((face) => order.includes(face))
    )
      throw new Error("previewFaceOrder: expected six unique cube faces");
    return {
      type: "tile",
      multires: { tileSize, levels },
      urlTemplate,
      previewUrl,
      previewFaceOrder: [...order] as ViewerCubeFace[],
    };
  }
  if (urlTemplate.includes("%s"))
    throw new Error("urlTemplate: sphere has no cube face");
  if (value.indexBase !== 0 && value.indexBase !== 1)
    throw new Error("indexBase: expected 0 or 1");
  const levels = input.map((level: unknown, i) => {
    if (!isRecord(level))
      throw new Error(`multires.levels[${i}]: expected dimensions`);
    const width = positive(level.width, `multires.levels[${i}].width`);
    const height = positive(level.height, `multires.levels[${i}].height`);
    if (Math.abs(width - 2 * height) > 2)
      throw new Error(`multires.levels[${i}]: expected a full 2:1 panorama`);
    return { width, height };
  });
  if (
    levels.some(
      (level, i) =>
        i > 0 &&
        (level.width <= levels[i - 1]!.width ||
          level.height <= levels[i - 1]!.height)
    )
  )
    throw new Error("multires.levels: dimensions must increase");
  return {
    type: "sphereTile",
    multires: { tileSize, levels },
    urlTemplate,
    previewUrl,
    indexBase: value.indexBase,
  };
}
