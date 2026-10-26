import { writeFile, stat, rm } from "node:fs/promises";
import { join } from "node:path";
import { ConverterError, failure, positiveInteger } from "./errors";
import { checkProjectionDimensions, runFfmpeg } from "./ffmpeg";
import {
  deepZoomLevels,
  levelSizes,
  makeLevels,
  tileAddresses,
  toViewerConfig,
  validateFormat,
  validateTemplate,
  validateTileGrid,
} from "./layout";
import {
  checkPixels,
  encode,
  loadSharp,
  mapConcurrent,
  outputJob,
  validateJobOptions,
  type JobContext,
} from "./runtime";
import {
  CUBE_FACES,
  PREVIEW_FACE_ORDER,
  type ConversionManifest,
  type ConversionResult,
  type ConvertOptions,
  type ImageDescriptor,
  type ImageFormat,
  type ImageSize,
  type PreviewDescriptor,
} from "./types";

async function customTiles(
  source: string,
  manifest: ConversionManifest,
  quality: number,
  context: JobContext,
  face?: (typeof CUBE_FACES)[number],
): Promise<void> {
  const sharp = await loadSharp();
  let previous: { data: Buffer; width: number; height: number } | undefined;
  for (const level of [...manifest.tiles.levels].reverse()) {
    context.check();
    const image = previous
      ? sharp(previous.data, {
          raw: { width: previous.width, height: previous.height, channels: 4 },
        })
      : sharp(source, { limitInputPixels: context.pixelLimit });
    const raw = await context
      .native(
        image
          .resize(level.width, level.height, {
            fit: "fill",
            kernel: "lanczos3",
          })
          .toColourspace("srgb")
          .ensureAlpha()
          .raw(),
      )
      .toBuffer();
    await mapConcurrent(
      tileAddresses(manifest, level, face),
      context,
      async (tile) => {
        const x = tile.column0 * manifest.tiles.tileSize;
        const y = tile.row0 * manifest.tiles.tileSize;
        const width = Math.min(manifest.tiles.tileSize, level.width - x);
        const height = Math.min(manifest.tiles.tileSize, level.height - y);
        const buffer = Buffer.allocUnsafe(width * height * 4);
        for (let row = 0; row < height; row++) {
          const offset = ((y + row) * level.width + x) * 4;
          raw.copy(buffer, row * width * 4, offset, offset + width * 4);
        }
        const output = await context.reserve(tile.path);
        await context
          .native(
            encode(
              sharp(buffer, { raw: { width, height, channels: 4 } }),
              manifest.tiles.format,
              quality,
            ),
          )
          .toFile(output);
        await context.emit(tile.path, "tile", {
          width,
          height,
          level: tile.level,
          row: tile.row,
          column: tile.column,
          ...(tile.face ? { face: tile.face } : {}),
        });
      },
    );
    previous = { data: raw, width: level.width, height: level.height };
  }
}

async function previews(
  source: string,
  projection: ConversionManifest["projection"],
  faces: Map<string, string>,
  format: ImageFormat,
  context: JobContext,
): Promise<{ previews: PreviewDescriptor[]; thumbnail: ImageDescriptor }> {
  const sharp = await loadSharp();
  const result: PreviewDescriptor[] = [];
  let thumbnail: ImageDescriptor | undefined;
  for (const height of [200, 400, 800]) {
    const path = `previews/${height}.${format}`;
    const output = await context.reserve(path);
    const info = await context
      .native(
        encode(
          sharp(source, { limitInputPixels: context.pixelLimit }).resize({
            height,
            withoutEnlargement: true,
          }),
          format,
          90,
        ),
      )
      .toFile(output);
    const descriptor = { path, width: info.width, height: info.height };
    result.push({
      ...descriptor,
      role: projection !== "cubemap" && height === 400 ? "viewer" : "image",
      projection: projection === "cubemap" ? "equirectangular" : projection,
    });
    if (height === 200) thumbnail = descriptor;
    await context.emit(path, "preview", {
      width: info.width,
      height: info.height,
    });
  }
  if (projection === "planar") {
    const path = `thumbnail.${format}`;
    const info = await context
      .native(
        encode(
          sharp(source, { limitInputPixels: context.pixelLimit }).resize({
            width: 400,
            height: 400,
            fit: "inside",
            withoutEnlargement: true,
          }),
          format,
          90,
        ),
      )
      .toFile(await context.reserve(path));
    thumbnail = { path, width: info.width, height: info.height };
    await context.emit(path, "thumbnail", {
      width: info.width,
      height: info.height,
    });
  }
  if (projection === "cubemap") {
    const size = Math.min(
      256,
      (await sharp(faces.get("f")!).metadata()).width!,
    );
    const images = [];
    for (let index = 0; index < PREVIEW_FACE_ORDER.length; index++) {
      const face = PREVIEW_FACE_ORDER[index]!;
      images.push({
        input: await context
          .native(sharp(faces.get(face)!).resize(size, size).png())
          .toBuffer(),
        left: 0,
        top: index * size,
      });
    }
    const path = `previews/cube-vertical.${format}`;
    await context
      .native(
        encode(
          sharp({
            create: {
              width: size,
              height: size * 6,
              channels: 3,
              background: "#ffffff",
            },
          }).composite(images),
          format,
          90,
        ),
      )
      .toFile(await context.reserve(path));
    const preview: PreviewDescriptor = {
      role: "viewer",
      projection: "cubemap",
      layout: "vertical-strip",
      path,
      width: size,
      height: size * 6,
      faceOrder: [...PREVIEW_FACE_ORDER],
    };
    result.unshift(preview);
    await context.emit(path, "preview", {
      width: preview.width,
      height: preview.height,
    });
  }
  return { previews: result, thumbnail: thumbnail! };
}

/** Convert a static raster image. All cloud and database effects belong to the caller. */
export async function convertImage(
  input: string | Buffer,
  options: ConvertOptions,
): Promise<ConversionResult> {
  validateJobOptions(options);
  const projection = options.projection ?? "cubemap";
  if (!["cubemap", "equirectangular", "planar"].includes(projection))
    throw new ConverterError("INVALID_OPTIONS", "Invalid projection.");
  const layout =
    options.layout ?? (projection === "planar" ? "deepzoom" : "custom");
  if (layout !== "custom" && layout !== "deepzoom")
    throw new ConverterError(
      "INVALID_OPTIONS",
      "layout must be custom or deepzoom.",
    );
  if (
    layout === "deepzoom" &&
    (projection !== "planar" ||
      options.levels !== undefined ||
      options.pyramidDownscale !== undefined ||
      options.tilePathTemplate !== undefined)
  )
    throw new ConverterError(
      "INVALID_OPTIONS",
      "Deep Zoom uses standard planar levels and paths; use layout: custom for customization.",
    );
  if (options.levels !== undefined && options.pyramidDownscale !== undefined)
    throw new ConverterError(
      "INVALID_OPTIONS",
      "levels and pyramidDownscale are mutually exclusive.",
    );
  if (options.faceSize !== undefined && projection !== "cubemap")
    throw new ConverterError(
      "INVALID_OPTIONS",
      "faceSize is only valid for cubemap.",
    );
  const tileSize = positiveInteger(options.tileSize ?? 512, "tileSize", 8192);
  const format = options.format ?? (layout === "deepzoom" ? "jpeg" : "webp");
  validateFormat(format);
  const quality = positiveInteger(options.quality ?? 95, "quality", 100);
  const template = validateTemplate(
    options.tilePathTemplate ??
      (projection === "cubemap"
        ? "tiles/%s/l%l/%v/l%l_%s_%v_%h.%e"
        : "tiles/%l/%h_%v.%e"),
    projection,
    format,
  );
  if (
    !(typeof input === "string" && input.trim()) &&
    !(Buffer.isBuffer(input) && input.length > 0)
  )
    throw new ConverterError(
      "INVALID_OPTIONS",
      "input must be a nonempty local path or Buffer.",
    );
  if (typeof input === "string") {
    try {
      if (!(await stat(input)).isFile()) throw new Error("Not a file.");
    } catch (cause) {
      throw new ConverterError(
        "INPUT_NOT_FOUND",
        `Cannot read input file: ${input}`,
        "decode",
        cause,
      );
    }
  }
  return outputJob(options, async (context) => {
    context.progress("decode");
    const sharp = await loadSharp();
    let metadata;
    // Header inspection precedes the explicit pixel check; every decoding pipeline retains the limit.
    try {
      metadata = await sharp(input, {
        limitInputPixels: false,
        failOn: "warning",
      }).metadata();
    } catch (cause) {
      throw failure(
        "INVALID_IMAGE",
        "Cannot decode image. Check its format, integrity, and pixel limit.",
        "decode",
        cause,
      );
    }
    if (!metadata.width || !metadata.height)
      throw new ConverterError(
        "INVALID_IMAGE",
        "Image has no dimensions.",
        "decode",
      );
    if (
      !metadata.format ||
      !["jpeg", "png", "webp", "tiff", "avif", "heif", "gif"].includes(
        metadata.format,
      ) ||
      (metadata.pages ?? 1) > 1
    )
      throw new ConverterError(
        "UNSUPPORTED_IMAGE",
        "Only single-frame raster images supported by Sharp are accepted.",
        "decode",
      );
    const rotated =
      metadata.orientation !== undefined && metadata.orientation >= 5;
    const source: ImageSize = rotated
      ? { width: metadata.height, height: metadata.width }
      : { width: metadata.width, height: metadata.height };
    checkPixels(source.width, source.height, context.pixelLimit);
    let size = { ...source };
    if (projection !== "planar") {
      if (Math.abs(source.width / source.height - 2) / 2 > 0.01)
        throw new ConverterError(
          "INVALID_PROJECTION",
          "Panorama input must be a full 2:1 equirectangular image (1% tolerance).",
          "decode",
        );
      const height = Math.max(source.height, Math.ceil(source.width / 2));
      size = { width: height * 2, height };
      checkPixels(size.width, size.height, context.pixelLimit);
    }
    const normalized = join(context.workDir, "source.png");
    let image = sharp(input, {
      limitInputPixels: context.pixelLimit,
      failOn: "warning",
    })
      .autoOrient()
      .toColourspace("srgb");
    if (projection === "cubemap")
      image = image.flatten({ background: "#ffffff" });
    if (size.width !== source.width || size.height !== source.height)
      image = image.resize(size.width, size.height, {
        fit: "cover",
        kernel: "lanczos3",
      });
    await context.native(image.png({ compressionLevel: 0 })).toFile(normalized);
    const faces = new Map<string, string>();
    let tileImageSize = size;
    let faceSize = 0;
    if (projection === "cubemap") {
      const desired = Math.max(2, Math.round(size.width / 4));
      faceSize = positiveInteger(
        options.faceSize ?? Math.min(12288, desired + (desired % 2)),
        "faceSize",
        12288,
      );
      if (faceSize % 2 !== 0)
        throw new ConverterError("INVALID_OPTIONS", "faceSize must be even.");
      checkProjectionDimensions(faceSize * 3, faceSize * 2);
      checkPixels(faceSize * 3, faceSize * 2, context.pixelLimit);
      tileImageSize = { width: faceSize, height: faceSize };
    }
    const levels =
      layout === "deepzoom"
        ? deepZoomLevels(size, tileSize)
        : makeLevels(
            levelSizes(
              tileImageSize,
              tileSize,
              options.pyramidDownscale,
              options.levels,
              projection,
            ),
            tileSize,
            1,
          );
    const manifest: ConversionManifest = {
      schemaVersion: 1,
      projection,
      source,
      tiles: {
        layout,
        format,
        tileSize,
        overlap: 0,
        indexBase: layout === "deepzoom" ? 0 : 1,
        urlTemplate:
          layout === "deepzoom" ? `image_files/%l/%h_%v.${format}` : template,
        levels,
        ...(projection === "cubemap" ? { faces: [...CUBE_FACES] } : {}),
        ...(layout === "deepzoom" ? { descriptor: "image.dzi" } : {}),
      },
      previews: [],
      thumbnail: { path: "", width: 1, height: 1 },
    };
    validateTileGrid(manifest);
    if (projection === "cubemap") {
      context.progress("project");
      const atlas = join(context.workDir, "cube.png");
      await runFfmpeg(
        normalized,
        atlas,
        `v360=input=equirect:output=c3x2:out_forder=frblud:w=${faceSize * 3}:h=${faceSize * 2}`,
        context,
      );
      for (let index = 0; index < CUBE_FACES.length; index++) {
        const face = CUBE_FACES[index]!;
        const path = join(context.workDir, `${face}.png`);
        await context
          .native(
            sharp(atlas, { limitInputPixels: context.pixelLimit })
              .extract({
                left: (index % 3) * faceSize,
                top: Math.floor(index / 3) * faceSize,
                width: faceSize,
                height: faceSize,
              })
              .png({ compressionLevel: 0 }),
          )
          .toFile(path);
        faces.set(face, path);
      }
    }
    context.progress("tiles");
    if (layout === "deepzoom") {
      const descriptor = await context.reserve("image.dzi");
      // libvips appends .dzi and _files to the basename, including when given an existing .dzi suffix.
      await context
        .native(
          encode(
            sharp(normalized, { limitInputPixels: context.pixelLimit }),
            format,
            quality,
          ).tile({
            size: tileSize,
            overlap: 0,
            depth: "onepixel",
            layout: "dz",
            skipBlanks: -1,
          }),
        )
        .toFile(descriptor.slice(0, -4));
      await rm(join(context.directory, "image_files", "vips-properties.xml"), {
        force: true,
      });
      // Native tile() exposes completion of the pyramid, not individual tile-written events.
      await mapConcurrent(tileAddresses(manifest), context, async (tile) => {
        await context.emit(tile.path, "tile", {
          width: Math.min(tileSize, tile.size.width - tile.column0 * tileSize),
          height: Math.min(tileSize, tile.size.height - tile.row0 * tileSize),
          level: tile.level,
          row: tile.row,
          column: tile.column,
        });
      });
      await context.emit("image.dzi", "descriptor");
    } else if (projection === "cubemap") {
      for (const face of CUBE_FACES)
        await customTiles(faces.get(face)!, manifest, quality, context, face);
    } else await customTiles(normalized, manifest, quality, context);
    context.progress("previews");
    Object.assign(
      manifest,
      await previews(normalized, projection, faces, format, context),
    );
    await writeFile(
      await context.reserve("manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );
    await context.emit("manifest.json", "manifest", {}, false);
    return { manifest, viewerConfig: toViewerConfig(manifest) };
  });
}
