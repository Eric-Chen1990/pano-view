import { parseArgs } from "node:util";
import { convertImage } from "./convert";
import { restoreImage } from "./restore";
import { ConverterError, failure } from "./errors";
import type { ConvertOptions, ImageFormat, Projection } from "./types";
import { version } from "../package.json";

const HELP = `pano-convert ${version}

Usage:
  pano-convert <image> --output <directory> [options]
  pano-convert restore <manifest.json|image.dzi> --output <directory> [options]

Input and output:
  Convert one local, static raster image (no URLs, stdin, or directory batches).
  cubemap/equirectangular require a full 2:1 panorama (1% input tolerance).
  Use planar for ordinary images. Restore reads local tiles beside the manifest/DZI.
  -o, --output <directory>       Required for both operations; nonexistent or empty

Conversion options (not accepted by restore):
  --projection <name>           cubemap (default), equirectangular, planar
  --layout <name>               custom (panorama default), deepzoom (planar default)
                               deepzoom is planar only; no custom levels/paths
  --tile-size <pixels>          Integer 1..8192; default 512
  --levels <list>               custom only; ascending, no duplicates/upscaling
                               Cube face edges: 256,512,1024
                               Other modes: 1024x512,2048x1024 (preserve aspect)
  --pyramid-downscale <factor>   custom only; finite >1, default 2
                               Mutually exclusive with --levels
  --tile-template <template>    custom only; relative path, quote in your shell
                               %s cube face (f/r/b/l/u/d), %l stored level,
                               %h column, %v row, %e extension
                               %0h pads to 2 digits; %00v pads to 3 digits
                               Default cube: tiles/%s/l%l/%v/l%l_%s_%v_%h.%e
                               Default other: tiles/%l/%h_%v.%e
  --face-size <pixels>          cubemap only; even integer 2..12288
                               Default approx. input width / 4, capped at 12288

Restore options (not accepted by conversion):
  --level <number>              Actual stored level, not array offset; default highest
  --output-width <pixels>       cubemap only; even 2:1 panorama width
                               Default 4 * selected face edge
  --export-faces                cubemap only; also write faces/{f,r,b,l,u,d}.<format>

Shared options:
  --format <name>               webp, jpeg, png; default webp for custom conversion,
                               jpeg for deepzoom, png for restore
  --quality <1..100>            Integer; default 95, JPEG/WebP only (previews use 90)
  --ffmpeg-path <path>          Executable; overrides FFMPEG_PATH, then ffmpeg on PATH
  --concurrency <number>        Integer 1..32; default 4 (active image tasks)
  --timeout <milliseconds>      Integer 1..2147483647; default 600000 (10 minutes)
  --limit-input-pixels <number> Positive integer; default 268402689
                               Also bounds reconstruction canvases
  --quiet                       Suppress TTY progress on stderr; keep result JSON
  --json-errors                 Write machine-readable errors on stderr
  -h, --help                    Show help
  -v, --version                 Show version

Dependencies:
  Node.js >=20.19 and Sharp. Cube conversion/restoration also need external
  FFmpeg with v360; equirectangular and planar operations do not use FFmpeg.

Examples:
  pano-convert room.jpg -o ./room
  pano-convert sphere.jpg --projection equirectangular -o ./sphere
  pano-convert scan.png --projection planar -o ./scan
  pano-convert room.jpg --face-size 1024 --levels 256,512,1024 -o ./custom
  pano-convert restore ./room/manifest.json -o ./restored --export-faces
  pano-convert restore ./scan/image.dzi -o ./scan-restored --level 10
  pano-convert room.jpg -o ./room --quiet --json-errors >result.json 2>error.json

Output:
  Conversion writes tiles, previews/thumbnail and manifest.json. Panoramas also
  write viewer.json; deepzoom writes image.dzi and image_files/.
  Restore writes panorama.<format> or image.<format>, plus optional cube faces.
  Success writes one result JSON to stdout; progress/errors use stderr.
  Keep redirected logs outside --output. Existing nonempty output is rejected.
  Ctrl+C/SIGTERM requests cancellation; active native work may finish first.
Exit codes: 0 success, 1 processing failure, 2 invalid arguments, 130 cancellation.
`;

async function main(): Promise<void> {
  const args = parseArgs({
    allowPositionals: true,
    strict: true,
    options: {
      output: { type: "string", short: "o" },
      projection: { type: "string" },
      layout: { type: "string" },
      "tile-size": { type: "string" },
      format: { type: "string" },
      quality: { type: "string" },
      levels: { type: "string" },
      "pyramid-downscale": { type: "string" },
      "tile-template": { type: "string" },
      "face-size": { type: "string" },
      "ffmpeg-path": { type: "string" },
      concurrency: { type: "string" },
      timeout: { type: "string" },
      "limit-input-pixels": { type: "string" },
      level: { type: "string" },
      "output-width": { type: "string" },
      "export-faces": { type: "boolean" },
      quiet: { type: "boolean" },
      "json-errors": { type: "boolean" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  if (args.values.help) {
    process.stdout.write(HELP);
    return;
  }
  if (args.values.version) {
    process.stdout.write(version + "\n");
    return;
  }
  const restore = args.positionals[0] === "restore";
  const input = args.positionals[restore ? 1 : 0];
  if (
    !input ||
    args.positionals.length !== (restore ? 2 : 1) ||
    !args.values.output
  )
    throw new ConverterError(
      "INVALID_OPTIONS",
      "Provide one input and --output. Use --help for usage.",
    );
  const values = args.values;
  const invalid = restore
    ? [
        "projection",
        "layout",
        "tile-size",
        "levels",
        "pyramid-downscale",
        "tile-template",
        "face-size",
      ]
    : ["level", "output-width", "export-faces"];
  for (const key of invalid)
    if (values[key as keyof typeof values] !== undefined)
      throw new ConverterError(
        "INVALID_OPTIONS",
        `--${key} is not valid for this operation.`,
      );
  const number = (value: string | undefined) =>
    value === undefined ? undefined : Number(value);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const common = {
      outputDir: values.output!,
      format: values.format as ImageFormat | undefined,
      quality: number(values.quality),
      concurrency: number(values.concurrency),
      timeoutMs: number(values.timeout),
      limitInputPixels: number(values["limit-input-pixels"]),
      ffmpegPath: values["ffmpeg-path"],
      signal: controller.signal,
      onProgress: values.quiet
        ? undefined
        : (event: { stage: string; completedAssets: number }) => {
            if (process.stderr.isTTY)
              process.stderr.write(
                `\r${event.stage}: ${event.completedAssets} files\x1b[K`,
              );
          },
    };
    let result;
    if (restore)
      result = await restoreImage(input, {
        ...common,
        level: number(values.level),
        outputWidth: number(values["output-width"]),
        exportCubeFaces: values["export-faces"],
      });
    else {
      let levels: ConvertOptions["levels"];
      if (values.levels !== undefined) {
        const parts = values.levels.split(",");
        levels = parts.some((part) => part.includes("x"))
          ? parts.map((part) => {
              const match = /^(\d+)x(\d+)$/.exec(part.trim());
              if (!match)
                throw new ConverterError(
                  "INVALID_OPTIONS",
                  "Use comma-separated widthxheight pairs for non-cube levels.",
                );
              return { width: Number(match[1]), height: Number(match[2]) };
            })
          : parts.map(Number);
      }
      result = await convertImage(input, {
        ...common,
        projection: values.projection as Projection | undefined,
        layout: values.layout as ConvertOptions["layout"],
        tileSize: number(values["tile-size"]),
        pyramidDownscale: number(values["pyramid-downscale"]),
        tilePathTemplate: values["tile-template"],
        faceSize: number(values["face-size"]),
        levels,
      });
    }
    if (!values.quiet && process.stderr.isTTY) process.stderr.write("\n");
    process.stdout.write(JSON.stringify(result) + "\n");
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}

main().catch((cause: unknown) => {
  const nodeError = cause as NodeJS.ErrnoException | undefined;
  const error = failure(
    nodeError?.code?.startsWith("ERR_PARSE_ARGS")
      ? "INVALID_OPTIONS"
      : "IO_ERROR",
    cause instanceof Error ? cause.message : "Conversion failed.",
    "cli",
    cause,
  );
  process.stderr.write(
    (process.argv.includes("--json-errors")
      ? JSON.stringify(error.toJSON())
      : `${error.code}: ${error.message}`) + "\n",
  );
  process.exitCode =
    error.code === "ABORTED" ? 130 : error.code === "INVALID_OPTIONS" ? 2 : 1;
});
