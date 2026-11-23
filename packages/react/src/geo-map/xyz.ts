import type { PanoGeoPosition } from "../data/geo-map";
import {
  clampCameraZoom, position, sourceZoomLimits,
  type Camera, type EngineEvents, type MapEngine, type PanoGeoMapSource, type Pixel, type ZoomLimits,
} from "./engine";

const TILE_SIZE = 256;
const MAX_LATITUDE = 85.05112878;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(n, high));
const wrap = (x: number, length: number) => ((x % length) + length) % length;

function world(point: PanoGeoPosition): Pixel {
  const sin = Math.sin(clamp(point.lat, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI / 180);
  return { x: (point.lng + 180) / 360, y: clamp(0.5 - Math.atanh(sin) / (2 * Math.PI), 0, 1) };
}

function geographic(point: Pixel): PanoGeoPosition {
  return {
    lng: wrap(point.x, 1) * 360 - 180,
    lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * clamp(point.y, 0, 1)))) * 180 / Math.PI,
  };
}

function arc(xs: number[]): { start: number; span: number } {
  const ordered = [...xs].sort((a, b) => a - b);
  let gap = 0;
  let start = ordered[0];
  ordered.forEach((x, index) => {
    const next = ordered[index + 1] ?? ordered[0] + 1;
    if (next - x > gap) { gap = next - x; start = wrap(next, 1); }
  });
  return { start, span: 1 - gap };
}

export function createXyzEngine(
  source: Extract<PanoGeoMapSource, { kind: "xyz" }>,
  host: HTMLDivElement,
  events: EngineEvents,
  limits: ZoomLimits = sourceZoomLimits(source),
): MapEngine {
  if (!["{x}", "{y}", "{z}"].every((token) => source.urlTemplate.includes(token)))
    throw new Error("XYZ tile URL requires {x}, {y}, and {z}");
  if (!["https:", "http:"].includes(new URL(source.urlTemplate, host.ownerDocument.baseURI).protocol))
    throw new Error("XYZ tile URL must use HTTP(S)");
  type Tile = { image: HTMLImageElement; state: "pending" | "ready" | "error" };
  const tiles = new Map<string, Tile>();
  const pointers = new Map<number, Pixel>();
  const controller = new AbortController();
  const { signal } = controller;
  let zoom = clampCameraZoom(2, limits);
  let center = { x: 0.5, y: 0.5 };
  let draggable = true;
  let moved = false;
  let down: Pixel | undefined;
  let frame = 0;
  let reportedError = false;
  const size = () => TILE_SIZE * 2 ** zoom;
  const local = (event: PointerEvent | WheelEvent) => {
    const box = host.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const fromPixel = ({ x, y }: Pixel): Pixel => ({
    x: center.x + (x - host.clientWidth / 2) / size(),
    y: center.y + (y - host.clientHeight / 2) / size(),
  });
  function schedule() {
    if (frame || signal.aborted) return;
    frame = requestAnimationFrame(() => { frame = 0; draw(); });
  }
  function draw() {
    if (!host.clientWidth || !host.clientHeight) return;
    const z = Math.floor(zoom);
    const dimension = 2 ** z;
    const tileSize = size() / dimension;
    const left = center.x * size() - host.clientWidth / 2;
    const top = center.y * size() - host.clientHeight / 2;
    const visible = new Set<string>();
    for (let y = Math.max(0, Math.floor(top / tileSize)); y < Math.min(dimension, Math.ceil((top + host.clientHeight) / tileSize)); y++) {
      for (let x = Math.floor(left / tileSize); x < Math.ceil((left + host.clientWidth) / tileSize); x++) {
        const key = `${z}/${x}/${y}`;
        visible.add(key);
        let tile = tiles.get(key);
        if (!tile) {
          const image = host.ownerDocument.createElement("img");
          image.alt = "";
          image.draggable = false;
          image.className = "pano-geo-map-tile";
          const item: Tile = { image, state: "pending" };
          tiles.set(key, item);
          tile = item;
          image.onload = () => { item.state = "ready"; schedule(); };
          image.onerror = () => { item.state = "error"; schedule(); };
          image.src = source.urlTemplate.replace(/\{z\}/g, String(z)).replace(/\{x\}/g, String(wrap(x, dimension))).replace(/\{y\}/g, String(y));
          host.append(image);
        }
        const tileLeft = Math.round(x * tileSize - left);
        const tileTop = Math.round(y * tileSize - top);
        tile.image.style.transform = `translate(${tileLeft}px,${tileTop}px)`;
        tile.image.style.width = `${Math.round((x + 1) * tileSize - left) - tileLeft}px`;
        tile.image.style.height = `${Math.round((y + 1) * tileSize - top) - tileTop}px`;
        tile.image.hidden = tile.state === "error";
      }
    }
    for (const [key, tile] of tiles) {
      if (visible.has(key)) continue;
      tile.image.remove();
      tiles.delete(key);
    }
    if (!reportedError && tiles.size && [...tiles.values()].every((tile) => tile.state === "error")) {
      reportedError = true;
      events.error();
    }
    events.draw();
  }
  const setCenter = (point: Pixel) => { center = { x: wrap(point.x, 1), y: clamp(point.y, 0, 1) }; schedule(); };
  const panBy = (x: number, y: number) => setCenter({ x: center.x + x / size(), y: center.y + y / size() });
  const zoomAt = (next: number, anchor: Pixel, destination = anchor) => {
    const fixed = fromPixel(anchor);
    zoom = clampCameraZoom(next, limits);
    const after = fromPixel(destination);
    setCenter({ x: center.x + fixed.x - after.x, y: center.y + fixed.y - after.y });
  };
  const zoomBy = (delta: number) => zoomAt(zoom + delta, { x: host.clientWidth / 2, y: host.clientHeight / 2 });
  const midpoint = (a: Pixel, b: Pixel) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const distance = (a: Pixel, b: Pixel) => Math.hypot(a.x - b.x, a.y - b.y);
  host.addEventListener("pointerdown", (event) => {
    if (!draggable || event.button !== 0 || pointers.size >= 2) return;
    if (!pointers.size) { moved = false; down = local(event); }
    else moved = true;
    pointers.set(event.pointerId, local(event));
    host.setPointerCapture(event.pointerId);
  }, { signal });
  host.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const current = local(event);
    pointers.set(event.pointerId, current);
    const second = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (second) {
      const delta = Math.log2(Math.max(1, distance(current, second)) / Math.max(1, distance(previous, second)));
      zoomAt(zoom + delta, midpoint(previous, second), midpoint(current, second));
    } else {
      moved ||= !!down && distance(down, current) > 4;
      if (moved) panBy(previous.x - current.x, previous.y - current.y);
    }
  }, { signal });
  const finish = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (event.type === "pointerup" && !moved && !pointers.size)
      events.click(geographic(fromPixel(local(event))));
  };
  host.addEventListener("pointerup", finish, { signal });
  host.addEventListener("pointercancel", finish, { signal });
  host.addEventListener("lostpointercapture", finish, { signal });
  host.addEventListener("wheel", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!draggable) return;
    zoomAt(zoom + clamp(-event.deltaY / (event.deltaMode === 1 ? 12 : 160), -1, 1), local(event));
  }, { passive: false, signal });

  schedule();
  return {
    project: (point) => {
      if (Math.abs(point.lat) > MAX_LATITUDE) return undefined;
      const p = world(point);
      return {
        x: (wrap(p.x - center.x + 0.5, 1) - 0.5) * size() + host.clientWidth / 2,
        y: (p.y - center.y) * size() + host.clientHeight / 2,
      };
    },
    unproject: (point) => {
      const geo = geographic(fromPixel(point));
      return position(geo.lat, geo.lng);
    },
    getCamera: () => ({ center: geographic(center), zoom }),
    setCamera: (camera: Camera) => {
      zoom = clampCameraZoom(camera.zoom, limits);
      setCenter(world(camera.center));
    },
    fit: (points, insets) => {
      const projected = points.map(world);
      const { start, span } = arc(projected.map(({ x }) => x));
      const north = Math.min(...projected.map(({ y }) => y));
      const south = Math.max(...projected.map(({ y }) => y));
      const scaleX = Math.max(1, host.clientWidth - insets.left - insets.right) / Math.max(span, 1e-10);
      const scaleY = Math.max(1, host.clientHeight - insets.top - insets.bottom) / Math.max(south - north, 1e-10);
      zoom = clampCameraZoom(Math.min(Math.log2(Math.min(scaleX, scaleY) / TILE_SIZE), 17), limits);
      setCenter({
        x: start + span / 2 + (insets.right - insets.left) / (2 * size()),
        y: (north + south) / 2 + (insets.bottom - insets.top) / (2 * size()),
      });
    },
    panBy,
    zoomBy,
    resize: schedule,
    setDraggable: (enabled) => { draggable = enabled; },
    dispose: () => { controller.abort(); cancelAnimationFrame(frame); tiles.clear(); host.replaceChildren(); },
  };
}
