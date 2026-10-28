import { Zip, ZipPassThrough } from "fflate";
import {
  loadPanoProject,
  parsePanoProject,
  sceneFromViewerConfig,
  type LoadPanoProjectOptions,
  type PanoProjectDefinition,
  type ViewerConfig,
  type AssetUrlContext,
  type PopupAssetUrlContext,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view/data";
import { validateViewerConfig } from "../../../shared/viewer-config";
import { mapCursorAssets } from "../../../shared/cursor-assets";
import { LocalFiles, LOCAL_ROOT } from "./local-files";
import { projectRoot } from "./sources";
import { exportDocument } from "./document";

type PackageOptions = LoadPanoProjectOptions & {
  local?: LocalFiles;
  directories?: readonly LocalFiles[];
  signal: AbortSignal;
  onProgress?: (progress: { completed: number; total: number }) => void;
};
const MAX_ENTRIES = 60_000;
const MAX_BYTES = 1024 * 1024 * 1024;

function extension(url: string, type = ""): string {
  const suffix = new URL(url, LOCAL_ROOT).pathname.match(
    /\.([a-z0-9]{1,8})$/i,
  )?.[1];
  return (
    suffix?.toLowerCase() ??
    (
      {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/svg+xml": "svg",
        "audio/mpeg": "mp3",
        "audio/ogg": "ogg",
        "video/mp4": "mp4",
        "video/webm": "webm",
        "text/html": "html",
      } as Record<string, string>
    )[type.split(";")[0]!] ??
    "bin"
  );
}

/** A single document is only portable if it has no additional resource or runtime dependencies. */
async function checkDocument(blob: Blob, path: string): Promise<void> {
  if (
    !/\.(svg|html?|css)$/i.test(path) &&
    !/svg|html|text\/css/.test(blob.type)
  )
    return;
  if (/html/i.test(blob.type) && !/\.html?$/i.test(path))
    throw new Error("Expected media but received an HTML page");
  const text = await blob.text();
  mapCursorAssets(text, (path) => {
    if (!path.startsWith("#") && !path.startsWith("data:"))
      throw new Error(
        "Embedded document has dependencies; export a self-contained document first.",
      );
    return path;
  });
  const resource =
    /\b(?:src|srcset|href|xlink:href|poster|background)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = resource.exec(text))) {
    const value = (match[1] ?? match[2] ?? match[3] ?? "").trim();
    if (value && !value.startsWith("#") && !value.startsWith("data:"))
      throw new Error(
        "Embedded document has dependencies; export a self-contained document first.",
      );
  }
  if (
    /<\s*(?:script|iframe|object|embed|base)\b|\bon\w+\s*=|@import/i.test(text)
  )
    throw new Error(
      "Embedded document has dependencies; export a self-contained document first.",
    );
}

/** Build a complete snapshot; callers only download after every resource has succeeded. */
export async function buildProjectPackage(
  input: PanoProjectDefinition,
  options: PackageOptions,
): Promise<Blob> {
  const project = parsePanoProject(input);
  const controller = new AbortController();
  const signal = AbortSignal.any([
    options.signal,
    controller.signal,
    ...(options.requestInit?.signal ? [options.requestInit.signal] : []),
  ]);
  const locals = [
    ...(options.local ? [options.local] : []),
    ...(options.directories ?? []),
  ];
  const localFor = (url: string) =>
    locals.find((files) => files.containsPath(url));
  const root = options.local ? LOCAL_ROOT : projectRoot(options.baseUrl);
  const jobs: { path: string; load: () => Promise<Blob> }[] = [];
  const media = new Map<string, Promise<string>>();
  let bytes = 0;
  const add = (path: string, load: () => Promise<Blob>) => {
    if (jobs.length >= MAX_ENTRIES)
      throw new Error(
        "Project package exceeds 60000 files or 1 GB. Split the project before exporting.",
      );
    jobs.push({ path, load });
  };
  let activeReads = 0,
    downloaded = 0;
  const pendingReads: (() => void)[] = [];
  const readNow = async (url: string): Promise<Blob> => {
    signal.throwIfAborted();
    const local = localFor(url);
    if (local) return local.file(url);
    if (url.startsWith(LOCAL_ROOT)) throw new Error("Missing local resource");
    const parsed = new URL(url, root);
    if (!["http:", "https:", "blob:", "data:"].includes(parsed.protocol))
      throw new Error("Unsupported resource URL");
    const response = await fetch(parsed.href, {
      ...options.requestInit,
      method: "GET",
      signal,
    });
    if (!response.ok || response.type === "opaque")
      throw new Error(`HTTP ${response.status}`);
    const parts: BlobPart[] = [];
    let size = 0;
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Empty response");
    try {
      for (;;) {
        signal.throwIfAborted();
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        downloaded += value.length;
        if (size > MAX_BYTES || downloaded > MAX_BYTES) {
          await reader.cancel();
          throw new Error(
            "Project package exceeds 60000 files or 1 GB. Split the project before exporting.",
          );
        }
        parts.push(new Uint8Array(value).buffer);
      }
    } finally {
      reader.releaseLock();
    }
    const blob = new Blob(parts, {
      type: response.headers.get("content-type") ?? "",
    });
    if (!blob.size) throw new Error("Empty resource");
    return blob;
  };
  const read = async (url: string): Promise<Blob> => {
    signal.throwIfAborted();
    if (activeReads >= 4)
      await new Promise<void>((resolve) => pendingReads.push(resolve));
    else activeReads++;
    try {
      signal.throwIfAborted();
      return await readNow(url);
    } finally {
      const next = pendingReads.shift();
      if (next) next();
      else activeReads--;
    }
  };
  const mediaPath = async (
    path: string,
    context: AssetUrlContext | PopupAssetUrlContext,
  ): Promise<string> => {
    if (!path) return path;
    const local = localFor(path);
    const url = local
      ? new URL(LocalFiles.reference(local.path(path)), LOCAL_ROOT).href
      : ("popupId" in context ? options.resolvePopupAssetUrl?.(path, context) : options.resolveAssetUrl?.(path, context)) ?? context.defaultUrl;
    if ("popupId" in context && (typeof url !== "string" || (!url.startsWith("/") && !/^(https?:|blob:|data:)/i.test(url))))
      throw new Error("resolvePopupAssetUrl must return an absolute URL or a site-root path");
    let pending = media.get(url);
    if (!pending) {
      const index = media.size + 1;
      pending = (async () => {
        let blob: Blob;
        try {
          blob = await read(url);
        } catch {
          throw new Error(
            `assets/${index}: Could not read resource. Check that the file exists and that its server allows CORS.`,
          );
        }
        const target = `assets/${index}.${extension(url, blob.type)}`;
        add(target, async () => blob);
        return target;
      })();
      media.set(url, pending);
    }
    return pending;
  };
  const packageHotspot = async (
    original: ProjectHotspotDefinition,
    sceneId: string,
  ) => {
    const hotspot = structuredClone(original);
    const copy = (path: string) =>
      mediaPath(path, {
        kind: "hotspot",
        sceneId,
        hotspotId: hotspot.id,
        defaultUrl: new URL(path, root).href,
      });
    if ("src" in hotspot)
      hotspot.src = Array.isArray(hotspot.src)
        ? await Promise.all(hotspot.src.map(copy))
        : await copy(hotspot.src);
    if ("poster" in hotspot && hotspot.poster)
      hotspot.poster = await copy(hotspot.poster);
    if (hotspot.type === "audio") {
      if (hotspot.icon) hotspot.icon = await copy(hotspot.icon);
      if (hotspot.playingIcon)
        hotspot.playingIcon = await copy(hotspot.playingIcon);
    }
    if (hotspot.type === "graphic" && hotspot.graphic.kind === "svg")
      hotspot.graphic.src = await copy(hotspot.graphic.src);
    if (typeof hotspot.tooltip === "object" && hotspot.tooltip.image)
      hotspot.tooltip.image = await copy(hotspot.tooltip.image);
    const copyCss = async (css: string) => {
      const images: string[] = [];
      mapCursorAssets(css, (path) => {
        images.push(path);
        return path;
      });
      const paths = await Promise.all(images.map(copy));
      let index = 0;
      return mapCursorAssets(css, () => paths[index++]!);
    };
    if (hotspot.cursor) hotspot.cursor = await copyCss(hotspot.cursor);
    if (hotspot.tooltipAppearance?.background)
      hotspot.tooltipAppearance.background = await copyCss(
        hotspot.tooltipAppearance.background,
      );
    return hotspot;
  };
  try {
    for (const popup of project.popups ?? []) {
      for (const block of popup.blocks) {
        if (block.type === "text") continue;
        const copy = (path: string, field: "src" | "poster") => mediaPath(path, {
          popupId: popup.id, blockId: block.id, field, defaultUrl: new URL(path, root).href,
        });
        block.src = await copy(block.src, "src");
        if (block.type === "video" && block.poster) block.poster = await copy(block.poster, "poster");
      }
    }
    for (const [index, scene] of project.scenes.entries()) {
      signal.throwIfAborted();
      const local = scene.source.viewerUrl
        ? locals.find((files) => files.containsSource(scene.source))
        : scene.source.baseUrl && /^https?:/i.test(scene.source.baseUrl)
        ? undefined
        : options.local;
      let config: ViewerConfig;
      let baseUrl: string;
      let previewUrl: string;
      if (local) {
        ({ config, baseUrl } = await local.source(scene.source));
        previewUrl = new URL(config.previewUrl, baseUrl).href;
      } else {
        const loaded = (
          await loadPanoProject(
            {
              schemaVersion: 1,
              scenes: [{ id: scene.id, source: scene.source }],
            },
            {
              ...options,
              baseUrl: projectRoot(options.baseUrl),
              requestInit: { ...options.requestInit, signal },
            },
          )
        ).scenes[0]!.scene;
        config = validateViewerConfig(loaded);
        baseUrl = loaded.baseUrl;
        previewUrl = loaded.previewUrl;
      }
      const prefix = `panoramas/${index + 1}/`;
      const preview = `preview.${extension(previewUrl)}`;
      add(prefix + preview, () => read(previewUrl));
      const ext = extension(config.urlTemplate);
      const template =
        config.type === "tile"
          ? `tiles/%s/%l/%v_%h.${ext}`
          : `tiles/%l/%v_%h.${ext}`;
      const strict = sceneFromViewerConfig(config, {
        id: scene.id,
        baseUrl,
        resolveAssetUrl: (path, context) =>
          local
            ? context.defaultUrl
            : options.resolveAssetUrl?.(path, context) ?? context.defaultUrl,
      });
      for (const [level, size] of config.multires.levels.entries()) {
        const cube = config.type === "tile";
        const width = typeof size === "number" ? size : size.width;
        const height = typeof size === "number" ? size : size.height;
        const rows = Math.ceil(height / config.multires.tileSize),
          cols = Math.ceil(width / config.multires.tileSize);
        const faces = ["f", "r", "b", "l", "u", "d"] as const;
        if (rows * cols * (cube ? 6 : 1) > MAX_ENTRIES - jobs.length)
          throw new Error(
            "Project package exceeds 60000 files or 1 GB. Split the project before exporting.",
          );
        for (const face of cube ? faces : (["f"] as const))
          for (let row = 0; row < rows; row++)
            for (let col = 0; col < cols; col++) {
              let url: string;
              const storage = cube
                ? 1
                : config.type === "sphereTile"
                ? config.indexBase
                : 0;
              if (strict.type === "tile")
                url = strict.resolveTileUrl!({
                  face,
                  level: level + 1,
                  row: row + 1,
                  col: col + 1,
                  faceSize: width,
                  tileSize: config.multires.tileSize,
                  width: Math.min(
                    config.multires.tileSize,
                    width - col * config.multires.tileSize,
                  ),
                  height: Math.min(
                    config.multires.tileSize,
                    height - row * config.multires.tileSize,
                  ),
                });
              else
                url = strict.resolveTileUrl!({
                  level,
                  row,
                  col,
                  imageWidth: width,
                  imageHeight: height,
                  tileSize: config.multires.tileSize,
                  width: Math.min(
                    config.multires.tileSize,
                    width - col * config.multires.tileSize,
                  ),
                  height: Math.min(
                    config.multires.tileSize,
                    height - row * config.multires.tileSize,
                  ),
                });
              const target = `${prefix}tiles/${cube ? face + "/" : ""}${
                level + storage
              }/${row + storage}_${col + storage}.${ext}`;
              add(target, () => read(url));
            }
      }
      const output = {
        ...config,
        schemaVersion: 1,
        previewUrl: preview,
        urlTemplate: template,
      };
      add(
        prefix + "viewer.json",
        async () =>
          new Blob([JSON.stringify(output, null, 2)], {
            type: "application/json",
          }),
      );
      scene.source = { viewerUrl: prefix + "viewer.json" };
      scene.hotspots = scene.hotspots
        ? await Promise.all(
            scene.hotspots.map((hotspot) => packageHotspot(hotspot, scene.id)),
          )
        : undefined;
    }
    add(
      "project.json",
      async () =>
        new Blob([exportDocument(project)], { type: "application/json" }),
    );
    const chunks: BlobPart[] = [];
    let zipError: Error | undefined;
    const zip = new Zip((error, data) => {
      if (error) zipError = error;
      else chunks.push(new Uint8Array(data).buffer);
    });
    let next = 0,
      completed = 0;
    let primaryFailure: Error | undefined;
    options.onProgress?.({ completed, total: jobs.length });
    const work = async () => {
      while (next < jobs.length) {
        signal.throwIfAborted();
        const job = jobs[next++]!;
        try {
          const blob = await job.load();
          signal.throwIfAborted();
          if (!blob.size) throw new Error("Empty resource");
          bytes += blob.size;
          if (bytes > MAX_BYTES)
            throw new Error(
              "Project package exceeds 60000 files or 1 GB. Split the project before exporting.",
            );
          await checkDocument(blob, job.path);
          const file = new ZipPassThrough(job.path);
          zip.add(file);
          // Process one resource at a time per worker; do not materialize the whole project as one array.
          const reader = blob.stream().getReader();
          try {
            for (;;) {
              signal.throwIfAborted();
              const { value, done } = await reader.read();
              if (done) {
                file.push(new Uint8Array(), true);
                break;
              }
              file.push(value);
            }
          } finally {
            reader.releaseLock();
          }
          if (zipError) throw zipError;
          options.onProgress?.({ completed: ++completed, total: jobs.length });
        } catch (cause) {
          primaryFailure ??= new Error(
            `${job.path}: ${
              cause instanceof Error &&
              /Embedded document|exceeds/.test(cause.message)
                ? cause.message
                : "Could not read resource. Check that the file exists and that its server allows CORS."
            }`,
          );
          controller.abort();
          throw primaryFailure;
        }
      }
    };
    const result = await Promise.allSettled(
      Array.from({ length: Math.min(4, jobs.length) }, work),
    );
    const failure = result.find(
      (item): item is PromiseRejectedResult => item.status === "rejected",
    );
    if (failure) {
      zip.terminate();
      throw primaryFailure ?? failure.reason;
    }
    signal.throwIfAborted();
    zip.end();
    if (zipError) throw zipError;
    return new Blob(chunks, { type: "application/zip" });
  } catch (cause) {
    controller.abort();
    options.signal.throwIfAborted();
    options.requestInit?.signal?.throwIfAborted();
    throw cause;
  }
}
