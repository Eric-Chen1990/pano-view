import type { MapRect as Rect } from "../map/geometry";
import { selectLevel, visibleTiles, type PlanarTile } from "./geometry";
import { planarTileUrl, type PlanarManifest, type Size } from "./manifest";

export type PlanarStatus = "loading" | "ready" | "error";
type CachedTile = { tile: PlanarTile; bitmap: ImageBitmap };

const OVERVIEW: Rect = { left: 0, top: 0, width: 1, height: 1 };
const MAX_CONCURRENT_LOADS = 4;
const CACHE_BYTES = 64 * 1024 * 1024;

async function loadBitmap(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Image request returned HTTP ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  if (signal.aborted) {
    bitmap.close();
    throw signal.reason;
  }
  return bitmap;
}

function drawRegion(ctx: CanvasRenderingContext2D, bitmap: ImageBitmap, image: Rect, rect: Rect) {
  const left = Math.round(image.left + rect.left * image.width);
  const top = Math.round(image.top + rect.top * image.height);
  const width = Math.round(image.left + (rect.left + rect.width) * image.width) - left;
  const height = Math.round(image.top + (rect.top + rect.height) * image.height) - top;
  const x = Math.max(0, left);
  const y = Math.max(0, top);
  const w = Math.min(ctx.canvas.width, left + width) - x;
  const h = Math.min(ctx.canvas.height, top + height) - y;
  if (w <= 0 || h <= 0) return false;
  const sx = bitmap.width / width;
  const sy = bitmap.height / height;
  // Replace the lower-resolution pixels so transparent tiles keep their alpha.
  ctx.clearRect(x, y, w, h);
  ctx.drawImage(bitmap, (x - left) * sx, (y - top) * sy, w * sx, h * sy, x, y, w, h);
  return true;
}

export function createPlanarTileLayer(
  canvas: HTMLCanvasElement,
  manifest: PlanarManifest,
  signal: AbortSignal,
  schedule: () => void,
  report: (status: PlanarStatus, error?: unknown) => void,
  allowLowerFallback: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  let preview: ImageBitmap | undefined;
  let previewPending = true;
  let cacheBytes = 0;
  let status: PlanarStatus = "loading";
  let lastError: unknown;
  const cached = new Map<string, CachedTile>();
  const pending = new Set<string>();
  const failed = new Set<string>();

  async function load(tile: PlanarTile) {
    pending.add(tile.key);
    try {
      const bitmap = await loadBitmap(planarTileUrl(manifest, tile.level, tile.col, tile.row), signal);
      if (signal.aborted || bitmap.width !== tile.width || bitmap.height !== tile.height) {
        bitmap.close();
        throw new Error("Unexpected planar tile dimensions");
      }
      cached.set(tile.key, { tile, bitmap });
      cacheBytes += bitmap.width * bitmap.height * 4;
    } catch (error) {
      if (!signal.aborted) {
        failed.add(tile.key);
        lastError = error;
      }
    } finally {
      pending.delete(tile.key);
      schedule();
    }
  }

  const paint = (viewport: Size, image: Rect, lodImage: Rect, pixelRatio: number) => {
    let level = selectLevel(manifest.levels, lodImage, pixelRatio);
    let tiles = visibleTiles(level, manifest.tileSize, image, viewport);
    while (allowLowerFallback && !previewPending && !preview &&
        tiles.length && tiles.every(({ key }) => failed.has(key))) {
      const lowerLevel = manifest.levels[level.level - manifest.indexBase - 1];
      if (!lowerLevel) break;
      level = lowerLevel;
      tiles = visibleTiles(level, manifest.tileSize, image, viewport);
    }
    const visible = new Set(tiles.map((tile) => tile.key));
    const drawRect = {
      left: image.left * canvas.width / viewport.width,
      width: image.width * canvas.width / viewport.width,
      top: image.top * canvas.height / viewport.height,
      height: image.height * canvas.height / viewport.height,
    };
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let painted = preview ? drawRegion(ctx, preview, drawRect, OVERVIEW) : false;
    // Preserve already decoded detail while the selected level arrives.
    const drawTiles = Array.from(cached.values())
      .filter(({ tile }) => tile.level < level.level || visible.has(tile.key))
      .sort((a, b) => a.tile.level - b.tile.level);
    const used = new Set<string>();
    for (const entry of drawTiles) {
      if (!drawRegion(ctx, entry.bitmap, drawRect, entry.tile.rect)) continue;
      painted = true;
      used.add(entry.tile.key);
      cached.delete(entry.tile.key);
      cached.set(entry.tile.key, entry);
    }
    if (cacheBytes > CACHE_BYTES) {
      for (const [key, { bitmap }] of cached) {
        if (visible.has(key)) continue;
        bitmap.close();
        cacheBytes -= bitmap.width * bitmap.height * 4;
        cached.delete(key);
        // Redraw with the remaining fallback if an on-screen fallback was evicted.
        if (used.has(key)) schedule();
        if (cacheBytes <= CACHE_BYTES) break;
      }
    }

    for (const tile of tiles) {
      if (pending.size >= MAX_CONCURRENT_LOADS) break;
      if (!cached.has(tile.key) && !pending.has(tile.key) && !failed.has(tile.key)) {
        void load(tile);
      }
    }
    const nextStatus = painted ? "ready"
      : !previewPending && tiles.length > 0 && tiles.every(({ key }) => failed.has(key))
        ? "error" : "loading";
    if (status !== nextStatus) {
      status = nextStatus;
      report(status, status === "error" ? lastError : undefined);
    }
    return painted;
  };

  signal.addEventListener("abort", () => {
    preview?.close();
    for (const { bitmap } of cached.values()) bitmap.close();
    cached.clear();
    canvas.width = 0;
    canvas.height = 0;
  }, { once: true });
  void loadBitmap(manifest.thumbnailUrl, signal).then(
    (bitmap) => {
      if (signal.aborted) bitmap.close();
      else preview = bitmap;
    },
    (error) => { lastError ??= error; },
  ).finally(() => {
    previewPending = false;
    schedule();
  });
  return { paint, getPreview: () => preview };
}
