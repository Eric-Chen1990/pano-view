import type { MapPoint as Point, MapRect as Rect } from "../map/geometry";
import {
  constrainView, FIT_VIEW, moveView, selectLevel, viewportGeometry, viewRect,
  visibleTiles, type PlanarTile,
} from "./geometry";
import { planarTileUrl, type PlanarManifest } from "./manifest";

export type PlanarStatus = "loading" | "ready" | "error";
export type PlanarControls = { zoom: (factor: number) => void; reset: () => void };

type CachedTile = { tile: PlanarTile; bitmap: ImageBitmap };

const OVERVIEW: Rect = { left: 0, top: 0, width: 1, height: 1 };
const MAX_CONCURRENT_LOADS = 4;
const CACHE_BYTES = 64 * 1024 * 1024;
const MAX_CANVAS_EDGE = 4096;
const MAX_CANVAS_PIXELS = 4 * 1024 * 1024;
const ZOOM_STEP = 1.5;

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

export function mountPlanarView(
  viewportElement: HTMLElement,
  canvas: HTMLCanvasElement,
  manifest: PlanarManifest,
  signal: AbortSignal,
  report: (status: PlanarStatus) => void,
): PlanarControls {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");
  const viewport = { width: 0, height: 0 };
  let view = FIT_VIEW;
  let fit: Rect = { left: 0, top: 0, width: 0, height: 0 };
  let maxZoom = 2;
  let pixelRatio = 1;
  let frame = 0;
  let preview: ImageBitmap | undefined;
  let previewPending = true;
  let cacheBytes = 0;
  let status: PlanarStatus = "loading";
  const cached = new Map<string, CachedTile>();
  const pending = new Set<string>();
  const failed = new Set<string>();
  const pointers = new Map<number, Point>();

  function schedule() {
    if (!frame && !signal.aborted) frame = requestAnimationFrame(render);
  }

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
    } catch {
      if (!signal.aborted) failed.add(tile.key);
    } finally {
      pending.delete(tile.key);
      schedule();
    }
  }

  function render() {
    frame = 0;
    if (signal.aborted || !viewport.width || !viewport.height || !ctx) return;
    const image = viewRect(fit, view);
    const level = selectLevel(manifest.levels, image, pixelRatio);
    const tiles = visibleTiles(level, manifest.tileSize, image, viewport);
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
      report(status);
    }
  }

  function resize() {
    viewport.width = viewportElement.clientWidth;
    viewport.height = viewportElement.clientHeight;
    const { width, height } = viewport;
    if (!width || !height) return;
    pixelRatio = Math.min(
      window.devicePixelRatio || 1, 2,
      MAX_CANVAS_EDGE / width, MAX_CANVAS_EDGE / height,
      Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
    );
    const backingWidth = Math.max(1, Math.floor(width * pixelRatio));
    const backingHeight = Math.max(1, Math.floor(height * pixelRatio));
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    ({ fit, maxZoom } = viewportGeometry(manifest, viewport, pixelRatio));
    view = constrainView(view, viewport, fit, maxZoom);
    schedule();
  }

  function move(from: Point, to: Point, factor = 1) {
    if (!viewport.width || !viewport.height) return;
    view = moveView(view, fit, viewport, maxZoom, from, to, factor);
    schedule();
  }

  const controls: PlanarControls = {
    zoom(factor) {
      const center = { x: viewport.width / 2, y: viewport.height / 2 };
      move(center, center, factor);
    },
    reset() {
      view = FIT_VIEW;
      schedule();
    },
  };

  function localPoint(event: MouseEvent): Point {
    const rect = viewportElement.getBoundingClientRect();
    return {
      x: rect.width ? (event.clientX - rect.left) * viewport.width / rect.width : 0,
      y: rect.height ? (event.clientY - rect.top) * viewport.height / rect.height : 0,
    };
  }

  viewportElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || pointers.size >= 2) return;
    viewportElement.focus({ preventScroll: true });
    viewportElement.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, localPoint(event));
    viewportElement.dataset.dragging = "";
  }, { signal });
  viewportElement.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const current = localPoint(event);
    pointers.set(event.pointerId, current);
    const other = Array.from(pointers.entries()).find(([id]) => id !== event.pointerId)?.[1];
    if (!other) {
      move(previous, current);
      return;
    }
    const midpoint = (point: Point) => ({ x: (point.x + other.x) / 2, y: (point.y + other.y) / 2 });
    const before = Math.hypot(previous.x - other.x, previous.y - other.y);
    const after = Math.hypot(current.x - other.x, current.y - other.y);
    move(midpoint(previous), midpoint(current), before > 0 && after > 0 ? after / before : 1);
  }, { signal });
  const releasePointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (!pointers.size) delete viewportElement.dataset.dragging;
  };
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    viewportElement.addEventListener(event, releasePointer, { signal });
  }

  viewportElement.addEventListener("wheel", (event) => {
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.height : 1;
    const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
    if (!delta || (delta > 0 && view.zoom <= 1) || (delta < 0 && view.zoom >= maxZoom)) return;
    event.preventDefault();
    const point = localPoint(event);
    move(point, point, Math.exp(-delta * 0.004));
  }, { passive: false, signal });
  viewportElement.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case "+":
      case "=": controls.zoom(ZOOM_STEP); break;
      case "-": controls.zoom(1 / ZOOM_STEP); break;
      case "Home":
      case "0": controls.reset(); break;
      case "ArrowLeft": move({ x: 0, y: 0 }, { x: 48, y: 0 }); break;
      case "ArrowRight": move({ x: 0, y: 0 }, { x: -48, y: 0 }); break;
      case "ArrowUp": move({ x: 0, y: 0 }, { x: 0, y: 48 }); break;
      case "ArrowDown": move({ x: 0, y: 0 }, { x: 0, y: -48 }); break;
      default: return;
    }
    event.preventDefault();
  }, { signal });

  const observer = new ResizeObserver(resize);
  observer.observe(viewportElement);
  window.addEventListener("resize", resize, { signal });
  signal.addEventListener("abort", () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
    for (const id of pointers.keys()) {
      if (viewportElement.hasPointerCapture(id)) viewportElement.releasePointerCapture(id);
    }
    delete viewportElement.dataset.dragging;
    preview?.close();
    for (const { bitmap } of cached.values()) bitmap.close();
    cached.clear();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, { once: true });
  void loadBitmap(manifest.thumbnailUrl, signal).then(
    (bitmap) => {
      if (signal.aborted) bitmap.close();
      else preview = bitmap;
    },
    () => {},
  ).finally(() => {
    previewPending = false;
    schedule();
  });
  resize();
  return controls;
}

export { ZOOM_STEP };
