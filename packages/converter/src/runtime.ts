import {
  open,
  mkdir,
  mkdtemp,
  readdir,
  lstat,
  rm,
  rename,
  rmdir,
  stat,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type sharp from "sharp";
import { ConverterError, failure, positiveInteger } from "./errors";
import type {
  AssetKind,
  ImageFormat,
  JobOptions,
  OutputAsset,
  ProgressEvent,
} from "./types";

export const DEFAULT_PIXEL_LIMIT = 268402689;
let sharpPromise: Promise<typeof sharp> | undefined;
export function loadSharp(): Promise<typeof sharp> {
  sharpPromise ??= import("sharp")
    .then((module) => module.default)
    .catch((cause: unknown) => {
      sharpPromise = undefined;
      throw new ConverterError(
        "SHARP_UNAVAILABLE",
        `Sharp could not load for ${process.platform}/${process.arch}. Install optional dependencies for the target OS, CPU and Linux libc; do not copy node_modules between platforms.`,
        "dependencies",
        cause,
      );
    });
  return sharpPromise;
}

export function validateJobOptions(options: JobOptions): void {
  if (
    !options ||
    typeof options.outputDir !== "string" ||
    !options.outputDir.trim()
  ) {
    throw new ConverterError("INVALID_OPTIONS", "outputDir is required.");
  }
  positiveInteger(options.concurrency ?? 4, "concurrency", 32);
  positiveInteger(options.timeoutMs ?? 600000, "timeoutMs", 2147483647);
  positiveInteger(
    options.limitInputPixels ?? DEFAULT_PIXEL_LIMIT,
    "limitInputPixels",
  );
  if (
    options.ffmpegPath !== undefined &&
    (typeof options.ffmpegPath !== "string" || !options.ffmpegPath.trim())
  ) {
    throw new ConverterError(
      "INVALID_OPTIONS",
      "ffmpegPath must be a nonempty executable path.",
    );
  }
}

export function checkPixels(
  width: number,
  height: number,
  limit: number,
): void {
  if (!Number.isSafeInteger(width * height) || width * height > limit) {
    throw new ConverterError(
      "PIXEL_LIMIT_EXCEEDED",
      `${width}x${height} exceeds the ${limit} pixel limit.`,
    );
  }
}

export function safeRelativePath(path: string): string {
  if (!path || path.includes("\\") || /[\x00-\x1f<>:"|?*]/.test(path)) {
    throw new ConverterError("INVALID_OPTIONS", `Unsafe output path: ${path}`);
  }
  for (const part of path.split("/")) {
    if (
      !part ||
      part === "." ||
      part === ".." ||
      /[. ]$/.test(part) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part) ||
      Buffer.byteLength(part) > 255
    ) {
      throw new ConverterError(
        "INVALID_OPTIONS",
        `Unsafe output path: ${path}`,
      );
    }
  }
  return path;
}

export class JobContext {
  readonly assets: OutputAsset[] = [];
  readonly pixelLimit: number;
  readonly concurrency: number;
  readonly signal: AbortSignal;
  readonly workDir: string;
  private readonly controller = new AbortController();
  private readonly timer: ReturnType<typeof setTimeout>;
  private readonly deadline: number;
  private timedOut = false;
  private readonly reserved = new Set<string>();
  stage: ProgressEvent["stage"] = "decode";

  constructor(
    readonly directory: string,
    readonly options: JobOptions,
  ) {
    this.pixelLimit = options.limitInputPixels ?? DEFAULT_PIXEL_LIMIT;
    this.concurrency = options.concurrency ?? 4;
    this.deadline = Date.now() + (options.timeoutMs ?? 600000);
    this.signal = options.signal
      ? AbortSignal.any([options.signal, this.controller.signal])
      : this.controller.signal;
    this.workDir = join(directory, ".work");
    this.timer = setTimeout(() => {
      this.timedOut = true;
      this.controller.abort();
    }, options.timeoutMs ?? 600000);
    this.timer.unref();
  }

  check(): void {
    if (!this.signal.aborted && Date.now() >= this.deadline) {
      this.timedOut = true;
      this.controller.abort();
    }
    if (this.signal.aborted) {
      throw new ConverterError(
        this.timedOut ? "TIMEOUT" : "ABORTED",
        this.timedOut
          ? "Conversion deadline exceeded."
          : "Operation cancelled.",
        this.stage,
      );
    }
  }

  native(image: sharp.Sharp): sharp.Sharp {
    this.check();
    return image.timeout({
      seconds: Math.max(1, Math.ceil((this.deadline - Date.now()) / 1000)),
    });
  }

  path(relativePath: string): string {
    return join(this.directory, safeRelativePath(relativePath));
  }

  async reserve(relativePath: string): Promise<string> {
    const path = this.path(relativePath);
    // Case-folding prevents a package that works on Linux from silently overwriting files on Windows/macOS.
    const key = relativePath.toLowerCase();
    if (this.reserved.has(key) || relativePath.split("/")[0] === ".work") {
      throw new ConverterError(
        "OUTPUT_CONFLICT",
        `Output paths collide: ${relativePath}`,
        this.stage,
      );
    }
    this.reserved.add(key);
    await mkdir(dirname(path), { recursive: true });
    return path;
  }

  progress(stage: ProgressEvent["stage"]): void {
    this.stage = stage;
    this.check();
    try {
      this.options.onProgress?.({ stage, completedAssets: this.assets.length });
    } catch (cause) {
      throw failure(
        "CALLBACK_FAILED",
        "onProgress callback failed.",
        stage,
        cause,
      );
    }
  }

  async emit(
    relativePath: string,
    kind: AssetKind,
    properties: Partial<OutputAsset> = {},
    notify = true,
  ): Promise<void> {
    this.check();
    const absolutePath = this.path(relativePath);
    const info = await stat(absolutePath);
    const extension = relativePath.split(".").pop()?.toLowerCase();
    const contentType =
      extension === "json"
        ? "application/json"
        : extension === "dzi"
          ? "application/xml"
          : extension === "png"
            ? "image/png"
            : extension === "webp"
              ? "image/webp"
              : "image/jpeg";
    const asset: OutputAsset = Object.freeze({
      ...properties,
      kind,
      absolutePath,
      relativePath,
      contentType,
      bytes: info.size,
    });
    this.assets.push(asset);
    if (notify) {
      try {
        await this.options.onAsset?.(asset, this.signal);
      } catch (cause) {
        throw failure(
          "CALLBACK_FAILED",
          `onAsset failed for ${relativePath}.`,
          this.stage,
          cause,
        );
      }
    }
    this.check();
    this.progress(this.stage);
  }

  dispose(): void {
    clearTimeout(this.timer);
  }
}

export async function mapConcurrent<T>(
  items: Iterable<T>,
  context: JobContext,
  operation: (item: T) => Promise<void>,
): Promise<void> {
  const iterator = items[Symbol.iterator]();
  let error: unknown;
  let failed = false;
  await Promise.all(
    Array.from({ length: context.concurrency }, async () => {
      while (!failed) {
        try {
          context.check();
          const item = iterator.next();
          if (item.done) return;
          await operation(item.value);
        } catch (cause) {
          if (!failed) error = cause;
          failed = true;
        }
      }
    }),
  );
  if (failed) throw error;
}

export function encode(
  image: sharp.Sharp,
  format: ImageFormat,
  quality: number,
): sharp.Sharp {
  if (format === "jpeg")
    return image.flatten({ background: "#ffffff" }).jpeg({ quality });
  if (format === "webp")
    return image.webp({ quality, effort: 4, preset: "photo" });
  return image.png();
}

export async function outputJob<T>(
  options: JobOptions,
  operation: (context: JobContext) => Promise<T>,
): Promise<T & { outputDir: string; assets: OutputAsset[] }> {
  validateJobOptions(options);
  if (options.signal?.aborted)
    throw new ConverterError("ABORTED", "Operation cancelled.");
  const outputDir = resolve(options.outputDir);
  const parent = dirname(outputDir);
  if (outputDir === parent)
    throw new ConverterError(
      "INVALID_OPTIONS",
      "outputDir cannot be a filesystem root.",
    );
  try {
    await mkdir(parent, { recursive: true });
  } catch (cause) {
    throw failure(
      "IO_ERROR",
      `Cannot prepare output parent: ${parent}`,
      "output",
      cause,
    );
  }
  const lockPath = join(parent, `.${basename(outputDir)}.pano-converter.lock`);
  let lock;
  try {
    lock = await open(lockPath, "wx");
  } catch (cause) {
    throw failure(
      "OUTPUT_CONFLICT",
      `Output is locked or not writable: ${outputDir}`,
      "output",
      cause,
    );
  }
  let working: string | undefined;
  let context: JobContext | undefined;
  try {
    const existing = await lstat(outputDir).catch(
      (cause: NodeJS.ErrnoException) => {
        if (cause.code !== "ENOENT") throw cause;
        return null;
      },
    );
    if (
      existing &&
      (!existing.isDirectory() ||
        existing.isSymbolicLink() ||
        (await readdir(outputDir)).length > 0)
    ) {
      throw new ConverterError(
        "OUTPUT_CONFLICT",
        "outputDir must not exist or must be an empty directory.",
        "output",
      );
    }
    working = await mkdtemp(join(parent, `.${basename(outputDir)}.pano-`));
    context = new JobContext(working, options);
    await mkdir(context.workDir);
    const result = await operation(context);
    await rm(context.workDir, { recursive: true, force: true });
    context.check();
    context.progress("complete");
    context.check();
    if (existing) await rmdir(outputDir);
    await rename(working, outputDir);
    working = undefined;
    return {
      ...result,
      outputDir,
      assets: context.assets.map((asset) => ({
        ...asset,
        absolutePath: join(outputDir, asset.relativePath),
      })),
    };
  } catch (cause) {
    context?.check();
    throw failure(
      "IO_ERROR",
      cause instanceof Error
        ? `Operation failed: ${cause.message}`
        : "Operation failed; check cause for filesystem or codec details.",
      context?.stage ?? "output",
      cause,
    );
  } finally {
    context?.dispose();
    try {
      if (working) await rm(working, { recursive: true, force: true });
    } finally {
      await lock.close();
      await rm(lockPath, { force: true });
    }
  }
}
