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

Options:
  -o, --output <directory>       Required, nonexistent or empty output directory
  --projection <name>           cubemap (default), equirectangular, planar
  --layout <name>               custom or deepzoom (planar default)
  --tile-size <pixels>          Default 512
  --format <name>               webp, jpeg, png; restore defaults to png
  --quality <1..100>             Default 95
  --levels <list>               Cube edges: 512,1024; other modes: 1024x512,2048x1024
  --pyramid-downscale <factor>   Default 2; mutually exclusive with --levels
  --tile-template <template>    %s face, %l level, %h column, %v row, %e extension
  --face-size <pixels>          Even cube-face edge
  --ffmpeg-path <path>          Also accepts FFMPEG_PATH
  --concurrency <number>        Default 4
  --timeout <milliseconds>      Default 600000
  --limit-input-pixels <number> Default 268402689
  --level <number>              Restore only; highest stored level by default
  --output-width <pixels>       Restore cube to a 2:1 panorama of this width
  --export-faces                Restore cube faces alongside panorama
  --quiet                       Suppress progress on stderr
  --json-errors                 Write machine-readable errors on stderr
  -h, --help                    Show help
  -v, --version                 Show version

Success writes JSON to stdout. Image and metadata files are written to --output.
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
