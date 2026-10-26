import { readFile, realpath, stat } from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { ConverterError, failure, positiveInteger } from "./errors";
import { checkProjectionDimensions, runFfmpeg } from "./ffmpeg";
import {
  deepZoomLevels,
  parseDzi,
  tileAddresses,
  validateFormat,
  validateManifest,
  validateTileGrid,
} from "./layout";
import {
  checkPixels,
  DEFAULT_PIXEL_LIMIT,
  encode,
  loadSharp,
  mapConcurrent,
  outputJob,
  safeRelativePath,
  validateJobOptions,
  type JobContext,
} from "./runtime";
import {
  CUBE_FACES,
  type ConversionManifest,
  type CubeFace,
  type ImageFormat,
  type RestorationResult,
  type RestoreOptions,
  type TileLevel,
} from "./types";

async function inputFile(
  root: string,
  path: string,
  code: "TILE_MISSING" | "INVALID_MANIFEST" = "TILE_MISSING",
): Promise<string> {
  try {
    const target = await realpath(join(root, safeRelativePath(path)));
    const child = relative(root, target);
    if (
      child === ".." ||
      child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) ||
      isAbsolute(child)
    )
      throw new Error("Asset escapes input directory.");
    if (!(await stat(target)).isFile()) throw new Error("Asset is not a file.");
    return target;
  } catch (cause) {
    throw new ConverterError(
      code,
      `Cannot read safe local asset: ${path}`,
      "restore",
      cause,
    );
  }
}

async function readDescription(
  path: string,
  pixelLimit: number,
): Promise<{ manifest: ConversionManifest; root: string }> {
  const location = resolve(path);
  let content: string;
  let root: string;
  try {
    const info = await stat(location);
    if (!info.isFile() || info.size > 8 * 1024 * 1024)
      throw new Error("Description must be a file smaller than 8 MiB.");
    content = await readFile(location, "utf8");
    root = await realpath(dirname(location));
  } catch (cause) {
    throw new ConverterError(
      "INPUT_NOT_FOUND",
      `Cannot read description: ${path}`,
      "manifest",
      cause,
    );
  }
  if (extname(location).toLowerCase() !== ".dzi") {
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (cause) {
      throw new ConverterError(
        "INVALID_MANIFEST",
        "Manifest is not valid JSON.",
        "manifest",
        cause,
      );
    }
    return { manifest: validateManifest(data, pixelLimit), root };
  }
  const dzi = parseDzi(content);
  checkPixels(dzi.size.width, dzi.size.height, pixelLimit);
  const stem = basename(location, extname(location));
  const manifest: ConversionManifest = {
    schemaVersion: 1,
    projection: "planar",
    source: dzi.size,
    tiles: {
      layout: "deepzoom",
      format: dzi.format,
      tileSize: dzi.tileSize,
      overlap: dzi.overlap,
      indexBase: 0,
      urlTemplate: `${stem}_files/%l/%h_%v.${dzi.extension}`,
      descriptor: basename(location),
      levels: deepZoomLevels(dzi.size, dzi.tileSize),
    },
    previews: [],
    thumbnail: { path: "", width: 1, height: 1 },
  };
  validateTileGrid(manifest);
  return { manifest, root };
}

async function stitch(
  manifest: ConversionManifest,
  root: string,
  level: TileLevel,
  context: JobContext,
  face?: CubeFace,
): Promise<Buffer> {
  const sharp = await loadSharp();
  checkPixels(level.width, level.height, context.pixelLimit);
  const buffer = Buffer.alloc(level.width * level.height * 4);
  await mapConcurrent(
    tileAddresses(manifest, level, face),
    context,
    async (tile) => {
      const path = await inputFile(root, tile.path);
      const left = tile.column0 * manifest.tiles.tileSize;
      const top = tile.row0 * manifest.tiles.tileSize;
      const width = Math.min(manifest.tiles.tileSize, level.width - left);
      const height = Math.min(manifest.tiles.tileSize, level.height - top);
      const overlapLeft = Math.min(manifest.tiles.overlap, left);
      const overlapTop = Math.min(manifest.tiles.overlap, top);
      const expectedWidth =
        width +
        overlapLeft +
        Math.min(manifest.tiles.overlap, level.width - left - width);
      const expectedHeight =
        height +
        overlapTop +
        Math.min(manifest.tiles.overlap, level.height - top - height);
      try {
        const { data, info } = await context
          .native(
            sharp(path, {
              limitInputPixels: context.pixelLimit,
              failOn: "warning",
            })
              .toColourspace("srgb")
              .ensureAlpha()
              .raw(),
          )
          .toBuffer({ resolveWithObject: true });
        if (
          info.width !== expectedWidth ||
          info.height !== expectedHeight ||
          info.channels !== 4
        )
          throw new Error(
            `Expected ${expectedWidth}x${expectedHeight}, got ${info.width}x${info.height}.`,
          );
        for (let row = 0; row < height; row++) {
          const start = ((row + overlapTop) * info.width + overlapLeft) * 4;
          data.copy(
            buffer,
            ((top + row) * level.width + left) * 4,
            start,
            start + width * 4,
          );
        }
      } catch (cause) {
        context.check();
        throw failure(
          "INVALID_TILE",
          `Cannot reconstruct tile ${tile.path}.`,
          "restore",
          cause,
        );
      }
    },
  );
  return buffer;
}

/** Restore a new converter manifest or a complete standard DZI pyramid from local files. */
export async function restoreImage(
  descriptionPath: string,
  options: RestoreOptions,
): Promise<RestorationResult> {
  validateJobOptions(options);
  if (typeof descriptionPath !== "string" || !descriptionPath.trim())
    throw new ConverterError(
      "INVALID_OPTIONS",
      "A local manifest.json or .dzi path is required.",
    );
  const format: ImageFormat = options.format ?? "png";
  validateFormat(format);
  const quality = positiveInteger(options.quality ?? 95, "quality", 100);
  const { manifest, root } = await readDescription(
    descriptionPath,
    options.limitInputPixels ?? DEFAULT_PIXEL_LIMIT,
  );
  const level =
    options.level === undefined
      ? manifest.tiles.levels.at(-1)!
      : manifest.tiles.levels.find((item) => item.level === options.level);
  if (!level)
    throw new ConverterError(
      "LEVEL_NOT_FOUND",
      `Level ${options.level} does not exist.`,
      "restore",
    );
  if (
    manifest.projection !== "cubemap" &&
    (options.exportCubeFaces || options.outputWidth !== undefined)
  )
    throw new ConverterError(
      "INVALID_OPTIONS",
      "exportCubeFaces and outputWidth are only valid for cubemap reconstruction.",
    );
  const width =
    manifest.projection === "cubemap"
      ? positiveInteger(options.outputWidth ?? level.width * 4, "outputWidth")
      : level.width;
  const height = manifest.projection === "cubemap" ? width / 2 : level.height;
  if (!Number.isInteger(height))
    throw new ConverterError(
      "INVALID_OPTIONS",
      "Cubemap outputWidth must be even.",
    );
  checkPixels(width, height, options.limitInputPixels ?? DEFAULT_PIXEL_LIMIT);
  if (format === "webp" && (width > 16383 || height > 16383))
    throw new ConverterError(
      "INVALID_OPTIONS",
      "WebP dimensions cannot exceed 16383; select PNG or a lower level.",
    );
  if (format === "jpeg" && (width > 65535 || height > 65535))
    throw new ConverterError(
      "INVALID_OPTIONS",
      "JPEG dimensions cannot exceed 65535; select PNG or a lower level.",
    );
  if (manifest.projection === "cubemap") {
    checkProjectionDimensions(width, height);
    checkPixels(
      level.width * 3,
      level.height * 2,
      options.limitInputPixels ?? DEFAULT_PIXEL_LIMIT,
    );
  }
  return outputJob(options, async (context) => {
    context.progress("restore");
    const sharp = await loadSharp();
    let imageSource: string | Buffer;
    if (manifest.projection === "cubemap") {
      const facePaths: string[] = [];
      for (const face of CUBE_FACES) {
        const raw = await stitch(manifest, root, level, context, face);
        const path = join(context.workDir, `${face}.png`);
        await context
          .native(
            sharp(raw, {
              raw: { width: level.width, height: level.height, channels: 4 },
            }).png({ compressionLevel: 0 }),
          )
          .toFile(path);
        facePaths.push(path);
        if (options.exportCubeFaces) {
          const relativePath = `faces/${face}.${format}`;
          await context
            .native(encode(sharp(path), format, quality))
            .toFile(await context.reserve(relativePath));
          await context.emit(relativePath, "cube-face", {
            face,
            width: level.width,
            height: level.height,
          });
        }
      }
      const atlas = join(context.workDir, "cube.png");
      await context
        .native(
          sharp({
            create: {
              width: level.width * 3,
              height: level.height * 2,
              channels: 3,
              background: "#ffffff",
            },
          })
            .composite(
              facePaths.map((input, index) => ({
                input,
                left: (index % 3) * level.width,
                top: Math.floor(index / 3) * level.height,
              })),
            )
            .png({ compressionLevel: 0 }),
        )
        .toFile(atlas);
      const panorama = join(context.workDir, "panorama.png");
      context.progress("project");
      await runFfmpeg(
        atlas,
        panorama,
        `v360=input=c3x2:output=equirect:in_forder=frblud:w=${width}:h=${height}:interp=lanczos`,
        context,
      );
      imageSource = panorama;
    } else imageSource = await stitch(manifest, root, level, context);
    context.progress("restore");
    const path = `${manifest.projection === "planar" ? "image" : "panorama"}.${format}`;
    const image =
      typeof imageSource === "string"
        ? sharp(imageSource, { limitInputPixels: context.pixelLimit })
        : sharp(imageSource, { raw: { width, height, channels: 4 } });
    await context
      .native(encode(image, format, quality))
      .toFile(await context.reserve(path));
    await context.emit(path, "image", { width, height });
    return {
      width,
      height,
      projection:
        manifest.projection === "planar"
          ? ("planar" as const)
          : ("equirectangular" as const),
    };
  });
}
