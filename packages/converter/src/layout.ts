import { ConverterError, positiveInteger } from "./errors";
import { SaxesParser } from "saxes";
import { safeRelativePath, checkPixels, DEFAULT_PIXEL_LIMIT } from "./runtime";
import {
  CUBE_FACES,
  type ConversionManifest,
  type CubeFace,
  type ImageFormat,
  type ImageSize,
  type Projection,
  type TileLevel,
  type ViewerConfig,
} from "./types";

export const MAX_TILES = 100000;

export function validateFormat(format: unknown): asserts format is ImageFormat {
  if (format !== "webp" && format !== "jpeg" && format !== "png")
    throw new ConverterError(
      "INVALID_OPTIONS",
      "format must be webp, jpeg, or png.",
    );
}

export function levelSizes(
  size: ImageSize,
  tileSize: number,
  downscale = 2,
  requested?: number[] | ImageSize[],
  projection: Projection = "planar",
): ImageSize[] {
  if (!Number.isFinite(downscale) || downscale <= 1)
    throw new ConverterError(
      "INVALID_OPTIONS",
      "pyramidDownscale must be finite and greater than 1.",
    );
  let sizes: ImageSize[];
  if (requested !== undefined) {
    if (
      !Array.isArray(requested) ||
      requested.length === 0 ||
      requested.length > 64
    )
      throw new ConverterError(
        "INVALID_OPTIONS",
        "levels must contain 1 to 64 ascending sizes.",
      );
    sizes = requested.map((item) => {
      if (projection === "cubemap") {
        const edge = positiveInteger(item, "cube level edge");
        return { width: edge, height: edge };
      }
      if (!item || typeof item !== "object")
        throw new ConverterError(
          "INVALID_OPTIONS",
          "Non-cube levels must use { width, height }.",
        );
      return {
        width: positiveInteger(item.width, "level width"),
        height: positiveInteger(item.height, "level height"),
      };
    });
  } else {
    sizes = [{ ...size }];
    while (Math.max(sizes[0]!.width, sizes[0]!.height) > tileSize) {
      if (sizes.length >= 64)
        throw new ConverterError(
          "INVALID_OPTIONS",
          "pyramidDownscale produces more than 64 levels; use a larger factor.",
        );
      const previous = sizes[0]!;
      const next = {
        width: Math.max(1, Math.ceil(previous.width / downscale)),
        height: Math.max(1, Math.ceil(previous.height / downscale)),
      };
      if (next.width === previous.width && next.height === previous.height)
        throw new ConverterError(
          "INVALID_OPTIONS",
          "pyramidDownscale does not reduce the image dimensions.",
        );
      // SphereTile requires both dimensions to increase; at a one-pixel height a further level cannot do that.
      if (
        projection === "equirectangular" &&
        (next.width === previous.width || next.height === previous.height)
      )
        break;
      sizes.unshift(next);
    }
  }
  sizes.forEach((level, index) => {
    if (level.width > size.width || level.height > size.height)
      throw new ConverterError(
        "INVALID_OPTIONS",
        "Levels cannot exceed the processed source dimensions.",
      );
    if (projection === "cubemap" && level.width !== level.height)
      throw new ConverterError(
        "INVALID_OPTIONS",
        "Cube levels must be square.",
      );
    const ratioError = Math.abs(
      level.width - (level.height * size.width) / size.height,
    );
    if (
      projection !== "cubemap" &&
      ratioError > Math.max(2, size.width / size.height)
    )
      throw new ConverterError(
        "INVALID_OPTIONS",
        "Level dimensions must preserve the source aspect ratio.",
      );
    const previous = sizes[index - 1];
    if (
      previous &&
      (level.width < previous.width ||
        level.height < previous.height ||
        (level.width === previous.width && level.height === previous.height) ||
        (projection === "equirectangular" &&
          (level.width === previous.width || level.height === previous.height)))
    )
      throw new ConverterError(
        "INVALID_OPTIONS",
        "Levels must have ascending dimensions without duplicates.",
      );
  });
  return sizes;
}

export function makeLevels(
  sizes: ImageSize[],
  tileSize: number,
  indexBase: 0 | 1,
): TileLevel[] {
  return sizes.map((size, index) => ({
    ...size,
    level: index + indexBase,
    columns: Math.ceil(size.width / tileSize),
    rows: Math.ceil(size.height / tileSize),
  }));
}

export function deepZoomLevels(size: ImageSize, tileSize: number): TileLevel[] {
  const max = Math.ceil(Math.log2(Math.max(size.width, size.height)));
  return makeLevels(
    Array.from({ length: max + 1 }, (_, level) => ({
      width: Math.ceil(size.width / 2 ** (max - level)),
      height: Math.ceil(size.height / 2 ** (max - level)),
    })),
    tileSize,
    0,
  );
}

export function resolveTilePath(
  template: string,
  address: { level: number; row: number; column: number; face?: CubeFace },
): string {
  return safeRelativePath(
    template
      .replace(/%s/g, address.face ?? "")
      .replace(/%l/g, String(address.level))
      .replace(/%(0*)([hv])/g, (_, zeros: string, axis: string) =>
        String(axis === "h" ? address.column : address.row).padStart(
          zeros.length + 1,
          "0",
        ),
      ),
  );
}

export function validateTemplate(
  template: string,
  projection: Projection,
  format: ImageFormat,
): string {
  const resolved = template.replace(/%e/g, format);
  if (
    /%/.test(resolved.replace(/%s|%l|%0*[hv]/g, "")) ||
    (projection !== "cubemap" && resolved.includes("%s"))
  )
    throw new ConverterError(
      "INVALID_OPTIONS",
      "Template supports %s (cube only), %l, %h, %v, index padding, and %e only.",
    );
  const extension = resolved.split(".").pop()?.toLowerCase();
  if (extension !== format && !(format === "jpeg" && extension === "jpg"))
    throw new ConverterError(
      "INVALID_OPTIONS",
      "Tile template extension must match format (or use %e).",
    );
  resolveTilePath(resolved, { level: 1, row: 1, column: 1, face: "f" });
  return resolved;
}

export function* tileAddresses(
  manifest: ConversionManifest,
  onlyLevel?: TileLevel,
  onlyFace?: CubeFace,
) {
  for (const face of onlyFace
    ? [onlyFace]
    : (manifest.tiles.faces ?? [undefined])) {
    for (const level of onlyLevel ? [onlyLevel] : manifest.tiles.levels) {
      for (let row = 0; row < level.rows; row++) {
        for (let column = 0; column < level.columns; column++) {
          const address = {
            level: level.level,
            row: row + manifest.tiles.indexBase,
            column: column + manifest.tiles.indexBase,
            face,
          };
          yield {
            ...address,
            row0: row,
            column0: column,
            size: level,
            path: resolveTilePath(manifest.tiles.urlTemplate, address),
          };
        }
      }
    }
  }
}

export function validateTileGrid(manifest: ConversionManifest): void {
  const count =
    manifest.tiles.levels.reduce(
      (sum, level) => sum + level.columns * level.rows,
      0,
    ) * (manifest.tiles.faces?.length ?? 1);
  if (!Number.isSafeInteger(count) || count > MAX_TILES)
    throw new ConverterError(
      "INVALID_OPTIONS",
      `Output exceeds ${MAX_TILES} tiles. Use larger tiles or fewer/smaller levels.`,
    );
  const names = new Set<string>();
  for (const tile of tileAddresses(manifest)) {
    const name = tile.path.toLowerCase();
    if (
      names.has(name) ||
      name === "manifest.json" ||
      name.startsWith(".work/")
    )
      throw new ConverterError(
        "OUTPUT_CONFLICT",
        "Tile template produces duplicate or reserved paths.",
      );
    names.add(name);
  }
}

export function toViewerConfig(
  manifest: ConversionManifest,
): ViewerConfig | null {
  if (manifest.projection === "planar") return null;
  const preview = manifest.previews.find((item) => item.role === "viewer");
  if (!preview)
    throw new ConverterError(
      "INVALID_MANIFEST",
      "Panorama manifest requires a viewer preview.",
    );
  if (manifest.projection === "cubemap") {
    return {
      type: "tile",
      multires: {
        tileSize: manifest.tiles.tileSize,
        levels: manifest.tiles.levels.map((level) => level.width),
      },
      urlTemplate: manifest.tiles.urlTemplate,
      previewUrl: preview.path,
      previewFaceOrder: [...(preview.faceOrder ?? CUBE_FACES)],
    };
  }
  return {
    type: "sphereTile",
    multires: {
      tileSize: manifest.tiles.tileSize,
      levels: manifest.tiles.levels.map(({ width, height }) => ({
        width,
        height,
      })),
    },
    urlTemplate: manifest.tiles.urlTemplate,
    previewUrl: preview.path,
    indexBase: manifest.tiles.indexBase,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function dimensions(value: unknown): asserts value is ImageSize {
  if (!record(value)) throw new Error("Missing dimensions.");
  positiveInteger(value.width, "width");
  positiveInteger(value.height, "height");
}
function imageDescriptor(value: unknown): void {
  dimensions(value);
  const item = value as ImageSize & { path?: unknown };
  if (typeof item.path !== "string") throw new Error("Missing asset path.");
  safeRelativePath(item.path);
}

export function validateManifest(
  value: unknown,
  pixelLimit = DEFAULT_PIXEL_LIMIT,
): ConversionManifest {
  if (!record(value))
    throw new ConverterError("INVALID_MANIFEST", "Manifest must be an object.");
  if (value.schemaVersion !== 1)
    throw new ConverterError(
      "UNSUPPORTED_SCHEMA_VERSION",
      `Unsupported schemaVersion: ${String(value.schemaVersion)}.`,
      "manifest",
    );
  try {
    if (
      !["cubemap", "equirectangular", "planar"].includes(
        String(value.projection),
      )
    )
      throw new Error("Invalid projection.");
    dimensions(value.source);
    const tiles = value.tiles;
    if (
      !record(tiles) ||
      (tiles.layout !== "custom" && tiles.layout !== "deepzoom")
    )
      throw new Error("Invalid tile layout.");
    validateFormat(tiles.format);
    const tileSize = positiveInteger(tiles.tileSize, "tileSize", 8192);
    if (
      (tiles.indexBase !== 0 && tiles.indexBase !== 1) ||
      !Number.isSafeInteger(tiles.overlap) ||
      Number(tiles.overlap) < 0 ||
      Number(tiles.overlap) > tileSize
    )
      throw new Error("Invalid indexing or overlap.");
    if (typeof tiles.urlTemplate !== "string")
      throw new Error("Missing tile template.");
    validateTemplate(
      tiles.urlTemplate,
      value.projection as Projection,
      tiles.format,
    );
    if (value.projection === "cubemap") {
      const faces = tiles.faces;
      if (
        tiles.indexBase !== 1 ||
        !Array.isArray(faces) ||
        faces.length !== 6 ||
        CUBE_FACES.some((face) => !faces.includes(face))
      )
        throw new Error(
          "Cubemap requires six unique faces and 1-based indexing.",
        );
    } else if (tiles.faces !== undefined)
      throw new Error("Faces are only valid for cubemap.");
    if (
      tiles.layout === "custom" &&
      (tiles.indexBase !== 1 || tiles.overlap !== 0)
    )
      throw new Error("Custom schema v1 uses 1-based indices and no overlap.");
    if (
      tiles.layout === "deepzoom" &&
      (value.projection !== "planar" ||
        tiles.indexBase !== 0 ||
        typeof tiles.descriptor !== "string")
    )
      throw new Error(
        "Deep Zoom requires planar projection, 0-based indexing, and a descriptor.",
      );
    if (tiles.descriptor !== undefined)
      safeRelativePath(String(tiles.descriptor));
    if (
      !Array.isArray(tiles.levels) ||
      tiles.levels.length === 0 ||
      tiles.levels.length > 64
    )
      throw new Error("Invalid levels.");
    let previous: ImageSize | undefined;
    tiles.levels.forEach((level: unknown, index: number) => {
      dimensions(level);
      checkPixels(level.width, level.height, pixelLimit);
      const data = level as TileLevel;
      if (
        data.level !== index + Number(tiles.indexBase) ||
        data.columns !== Math.ceil(data.width / tileSize) ||
        data.rows !== Math.ceil(data.height / tileSize)
      )
        throw new Error("Inconsistent tile grid.");
      if (
        previous &&
        (data.width < previous.width ||
          data.height < previous.height ||
          (data.width === previous.width && data.height === previous.height) ||
          (value.projection === "equirectangular" &&
            (data.width === previous.width || data.height === previous.height)))
      )
        throw new Error("Levels must be ascending.");
      if (value.projection === "cubemap" && data.width !== data.height)
        throw new Error("Cube faces must be square.");
      if (
        value.projection === "equirectangular" &&
        Math.abs(data.width - 2 * data.height) > 2
      )
        throw new Error("Sphere levels must be full 2:1 images.");
      previous = data;
    });
    if (tiles.layout === "deepzoom") {
      const expected = deepZoomLevels(value.source, tileSize);
      const storedLevels = tiles.levels;
      if (
        expected.length !== tiles.levels.length ||
        expected.some((level, index) => {
          const actual = storedLevels[index] as TileLevel;
          return actual.width !== level.width || actual.height !== level.height;
        })
      )
        throw new Error(
          "Deep Zoom levels must match the complete standard pyramid.",
        );
    }
    if (!Array.isArray(value.previews) || value.previews.length === 0)
      throw new Error("Missing previews.");
    for (const preview of value.previews) {
      imageDescriptor(preview);
      if (
        !record(preview) ||
        !["viewer", "image"].includes(String(preview.role)) ||
        !["cubemap", "equirectangular", "planar"].includes(
          String(preview.projection),
        )
      )
        throw new Error("Invalid preview.");
      const faceOrder = preview.faceOrder;
      if (
        preview.projection === "cubemap" &&
        (preview.layout !== "vertical-strip" ||
          !Array.isArray(faceOrder) ||
          faceOrder.length !== 6 ||
          CUBE_FACES.some((face) => !faceOrder.includes(face)) ||
          preview.height !== Number(preview.width) * 6)
      )
        throw new Error("Invalid cube preview order.");
      if (preview.role === "viewer" && preview.projection !== value.projection)
        throw new Error(
          "Viewer preview projection does not match the panorama.",
        );
    }
    if (
      value.projection !== "planar" &&
      value.previews.filter((preview) => preview.role === "viewer").length !== 1
    )
      throw new Error("Panoramas require exactly one viewer preview.");
    imageDescriptor(value.thumbnail);
    const manifest = value as unknown as ConversionManifest;
    validateTileGrid(manifest);
    toViewerConfig(manifest);
    return manifest;
  } catch (cause) {
    if (
      cause instanceof ConverterError &&
      cause.code === "PIXEL_LIMIT_EXCEEDED"
    )
      throw cause;
    throw new ConverterError(
      "INVALID_MANIFEST",
      cause instanceof Error ? cause.message : "Invalid manifest.",
      "manifest",
      cause,
    );
  }
}

/** Read complete, regular Deep Zoom XML with a bounded parser and no DTD expansion. */
export function parseDzi(xml: string): {
  size: ImageSize;
  tileSize: number;
  overlap: number;
  format: ImageFormat;
  extension: string;
} {
  try {
    if (xml.length > 65536) throw new Error("DZI exceeds 64 KiB.");
    const elements: Record<string, Record<string, string>> = {};
    const stack: string[] = [];
    const parser = new SaxesParser({ xmlns: true });
    parser.on("doctype", () => {
      throw new Error("DZI DTDs/entities are not supported.");
    });
    parser.on("error", (error) => {
      throw error;
    });
    parser.on("text", (text) => {
      if (text.trim()) throw new Error("Unexpected DZI text.");
    });
    parser.on("opentag", (tag) => {
      if (
        (tag.uri && tag.uri !== "http://schemas.microsoft.com/deepzoom/2008") ||
        (stack.length === 0
          ? tag.local !== "Image"
          : stack.length !== 1 || tag.local !== "Size") ||
        elements[tag.local]
      )
        throw new Error(
          "Only complete, regular DZI pyramids with one Image and Size are supported.",
        );
      const attributes: Record<string, string> = {};
      for (const attribute of Object.values(tag.attributes)) {
        if (!attribute.uri) attributes[attribute.local] = attribute.value;
      }
      elements[tag.local] = attributes;
      stack.push(tag.local);
    });
    parser.on("closetag", () => {
      stack.pop();
    });
    parser.write(xml).close();
    const image = elements.Image;
    const size = elements.Size;
    if (!image || !size)
      throw new Error("DZI requires Image and Size elements.");
    const width = positiveInteger(Number(size.Width), "DZI width");
    const height = positiveInteger(Number(size.Height), "DZI height");
    const tileSize = positiveInteger(
      Number(image.TileSize),
      "DZI tile size",
      8192,
    );
    const overlap = Number(image.Overlap);
    if (!Number.isSafeInteger(overlap) || overlap < 0 || overlap > tileSize)
      throw new Error("Invalid DZI overlap.");
    const extension = image.Format?.toLowerCase();
    const format = extension === "jpg" ? "jpeg" : extension;
    validateFormat(format);
    return {
      size: { width, height },
      tileSize,
      overlap,
      format,
      extension: extension!,
    };
  } catch (cause) {
    throw new ConverterError(
      "INVALID_DZI",
      cause instanceof Error ? cause.message : "Invalid DZI.",
      "manifest",
      cause,
    );
  }
}
