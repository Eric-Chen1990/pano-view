import assert from "node:assert/strict";
import test from "node:test";
import {
  FIT_VIEW, moveView, selectLevel, viewportGeometry, viewRect, visibleTiles,
} from "../src/planar-tile/geometry";
import { parsePlanarManifest, planarTileUrl } from "../src/planar-tile/manifest";
import { mountPlanarView, type PlanarStatus } from "../src/planar-tile/runtime";
import { coastPlanarView, dragPlanarView, followPlanarView, NO_VELOCITY } from "../src/planar-tile/motion";

const manifestUrl = "https://cdn.test/maps/manifest.json";
const source = { width: 1025, height: 769 };

function document(layout: "custom" | "deepzoom") {
  const indexBase = layout === "custom" ? 1 : 0;
  const sizes = layout === "custom"
    ? [{ width: 1, height: 1 }, { width: 257, height: 193 }, source]
    : Array.from({ length: 12 }, (_, level) => ({
      width: Math.ceil(source.width / 2 ** (11 - level)),
      height: Math.ceil(source.height / 2 ** (11 - level)),
    }));
  return {
    schemaVersion: 1,
    projection: "planar",
    source,
    thumbnail: { path: "thumbnail.png" },
    tiles: {
      tileSize: 256,
      indexBase,
      overlap: 0,
      layout,
      urlTemplate: layout === "custom" ? "tile set #1/l%l/%00v/%0h.png" : "image_files/%l/%h_%v.png",
      levels: sizes.map(({ width, height }, index) => ({
        width, height, level: index + indexBase,
        columns: Math.ceil(width / 256), rows: Math.ceil(height / 256),
      })),
    },
  };
}

test("planar manifests resolve Deep Zoom and padded custom paths from the file directory", () => {
  const custom = parsePlanarManifest(document("custom"), manifestUrl);
  assert.equal(custom.thumbnailUrl, "https://cdn.test/maps/thumbnail.png");
  assert.equal(planarTileUrl(custom, 3, 4, 3), "https://cdn.test/maps/tile%20set%20%231/l3/004/05.png");
  const dzi = parsePlanarManifest(document("deepzoom"), manifestUrl);
  assert.deepEqual(dzi.levels[1], { width: 2, height: 1, level: 1, columns: 1, rows: 1 });
  assert.equal(planarTileUrl(dzi, 11, 4, 3), "https://cdn.test/maps/image_files/11/4_3.png");
});

test("planar manifests reject incompatible projections, unsafe paths and invalid grids", () => {
  const input = document("custom");
  assert.throws(() => parsePlanarManifest({ ...input, projection: "equirectangular" }, manifestUrl));
  assert.throws(() => parsePlanarManifest({ ...input, thumbnail: { path: "../image.png" } }, manifestUrl));
  assert.throws(() => parsePlanarManifest({ ...input, tiles: { ...input.tiles, overlap: 1 } }, manifestUrl));
  input.tiles.levels[0]!.columns++;
  assert.throws(() => parsePlanarManifest(input, manifestUrl), /tile grid/);
});

test("zoom selects a denser level, culls offscreen tiles and includes exact edge dimensions", () => {
  const manifest = parsePlanarManifest(document("deepzoom"), manifestUrl);
  const viewport = { width: 240, height: 180 };
  const { fit, maxZoom } = viewportGeometry(manifest, viewport, 2);
  const start = viewRect(fit, FIT_VIEW);
  assert.equal(selectLevel(manifest.levels, start, 2).level, 10);
  const zoom = moveView(FIT_VIEW, fit, viewport, maxZoom, { x: 240, y: 180 }, { x: 240, y: 180 }, 10);
  const zoomed = viewRect(fit, zoom);
  assert.ok(Math.abs(zoomed.left + zoomed.width - viewport.width) < 1e-9);
  assert.ok(Math.abs(zoomed.top + zoomed.height - viewport.height) < 1e-9);
  const level = selectLevel(manifest.levels, zoomed, 2);
  assert.equal(level.level, 11);
  const visible = visibleTiles(level, manifest.tileSize, zoomed, viewport);
  assert.deepEqual(
    visible.map(({ col, row }) => [col, row]).sort(),
    [2, 3, 4].flatMap((col) => [1, 2, 3].map((row) => [col, row])),
  );
  const corner = visible.find(({ col, row }) => col === 4 && row === 3)!;
  assert.deepEqual([corner.width, corner.height], [1, 1]);
});

test("zoom preserves its anchor away from bounds, and fit clamps both axes", () => {
  const viewport = { width: 500, height: 500 };
  const manifest = parsePlanarManifest(document("custom"), manifestUrl);
  const { fit, maxZoom } = viewportGeometry(manifest, viewport, 1);
  const anchor = { x: 270, y: 250 };
  const zoomed = moveView(FIT_VIEW, fit, viewport, maxZoom, anchor, anchor, 2);
  const rect = viewRect(fit, zoomed);
  assert.ok(Math.abs((anchor.x - rect.left) / rect.width - anchor.x / fit.width) < 1e-9);
  assert.deepEqual(moveView(FIT_VIEW, fit, viewport, maxZoom, anchor, { x: 0, y: 0 }, 1), FIT_VIEW);
});

test("drag overshoots with resistance, reverses freely, and springs back to fit", () => {
  const viewport = { width: 240, height: 180 };
  const manifest = parsePlanarManifest(document("custom"), manifestUrl);
  const { fit, maxZoom } = viewportGeometry(manifest, viewport, 1);
  const center = { x: 120, y: 90 };
  const beyond = { x: 320, y: 90 };
  const stretched = dragPlanarView(FIT_VIEW, fit, viewport, maxZoom, center, beyond, 1);
  const offset = viewRect(fit, stretched).left - fit.left;
  assert.ok(offset > 0 && offset < 70);
  const reversed = dragPlanarView(stretched, fit, viewport, maxZoom, beyond, center, 1);
  assert.ok(Math.abs(reversed.center.x - 0.5) < 1e-10);
  let step = coastPlanarView(stretched, NO_VELOCITY, center, fit, viewport, maxZoom, 1 / 60);
  assert.ok(viewRect(fit, step.view).left < viewRect(fit, stretched).left);
  for (let i = 0; !step.settled && i < 120; i++) {
    step = coastPlanarView(step.view, step.velocity, center, fit, viewport, maxZoom, 1 / 60);
  }
  assert.ok(step.settled);
  assert.deepEqual(step.view, FIT_VIEW);
});

test("release coasts in the gesture direction and pinch rebounds at zoom limits", () => {
  const viewport = { width: 240, height: 180 };
  const manifest = parsePlanarManifest(document("custom"), manifestUrl);
  const { fit, maxZoom } = viewportGeometry(manifest, viewport, 1);
  const anchor = { x: 120, y: 90 };
  const view = moveView(FIT_VIEW, fit, viewport, maxZoom, anchor, anchor, 2);
  const coast = coastPlanarView(view, { x: -500, y: 0, zoom: 120 }, anchor, fit, viewport, maxZoom, 1 / 60);
  assert.ok(coast.view.center.x > view.center.x);
  assert.ok(coast.view.zoom > view.zoom);
  assert.ok(coast.velocity.x > -500 && coast.velocity.zoom < 120);

  for (const [factor, limit] of [[0.5, 1], [10, maxZoom]] as const) {
    const stretched = dragPlanarView(view, fit, viewport, maxZoom, anchor, anchor, factor / 2);
    if (factor < 1) assert.ok(stretched.zoom < limit);
    else assert.ok(stretched.zoom > limit);
    let step = coastPlanarView(stretched, NO_VELOCITY, anchor, fit, viewport, maxZoom, 1 / 60);
    for (let i = 0; !step.settled && i < 120; i++) {
      step = coastPlanarView(step.view, step.velocity, anchor, fit, viewport, maxZoom, 1 / 60);
    }
    assert.ok(step.settled);
    assert.ok(Math.abs(step.view.zoom - limit) < 1e-9);
  }
});

test("a smoothed zoom approaches the target without moving the image point under the cursor", () => {
  const viewport = { width: 240, height: 180 };
  const manifest = parsePlanarManifest(document("custom"), manifestUrl);
  const { fit, maxZoom } = viewportGeometry(manifest, viewport, 1);
  const anchor = { x: 134, y: 98 };
  const target = moveView(FIT_VIEW, fit, viewport, maxZoom, anchor, anchor, 2);
  const first = followPlanarView(FIT_VIEW, target, fit, viewport, maxZoom, 1 / 60);
  assert.ok(first.view.zoom > 1 && first.view.zoom < target.zoom);
  const rect = viewRect(fit, first.view);
  assert.ok(Math.abs((anchor.x - rect.left) / rect.width - (anchor.x - fit.left) / fit.width) < 1e-9);
  assert.ok(Math.abs((anchor.y - rect.top) / rect.height - (anchor.y - fit.top) / fit.height) < 1e-9);
});

test("planar runtime handles partial failure, pinch, and source cleanup", async (t) => {
  const browser = new EventTarget();
  const captured = new Set<number>();
  const viewport = Object.assign(new EventTarget(), {
    clientWidth: 240,
    clientHeight: 180,
    dataset: {},
    focus: () => {},
    setPointerCapture: (pointerId: number) => captured.add(pointerId),
    hasPointerCapture: (pointerId: number) => captured.has(pointerId),
    releasePointerCapture: (pointerId: number) => captured.delete(pointerId),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 240, height: 180 }),
  });
  const draw: string[] = [];
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const ctx = {
    canvas,
    clearRect: () => draw.push("clear"),
    drawImage: (bitmap: { name: string }) => draw.push(bitmap.name),
  };
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  const urls: string[] = [];
  const closed: string[] = [];
  const signals: AbortSignal[] = [];
  const requests = new Map<string, (response: Response) => void>();
  function mockGlobal(name: string, value: unknown) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
  mockGlobal("window", browser);
  mockGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  mockGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  mockGlobal("cancelAnimationFrame", (frame: number) => frames.delete(frame));
  mockGlobal("createImageBitmap", async (blob: Blob) => {
    const name = await blob.text();
    return { name, width: 256, height: 193, close: () => closed.push(name) };
  });
  t.mock.method(globalThis, "fetch", (url: string, { signal }: { signal: AbortSignal }) => {
    const name = new URL(url).pathname.split("/").slice(-2).join("/");
    urls.push(name);
    signals.push(signal);
    return new Promise<Response>((resolve, reject) => {
      requests.set(name, resolve);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    });
  });

  const tick = async () => {
    await new Promise<void>((resolve) => setImmediate(resolve));
    for (const [frame, callback] of [...frames]) {
      frames.delete(frame);
      callback(performance.now() + 16);
    }
  };
  const controller = new AbortController();
  const statuses: PlanarStatus[] = [];
  const manifest = parsePlanarManifest(document("custom"), manifestUrl);
  mountPlanarView(
    viewport as unknown as HTMLElement,
    canvas as unknown as HTMLCanvasElement,
    manifest, controller.signal, (status) => statuses.push(status),
  );
  await tick();
  assert.deepEqual(urls, ["maps/thumbnail.png", "001/01.png", "001/02.png"]);
  requests.get("maps/thumbnail.png")!(new Response("overview"));
  requests.get("001/01.png")!(new Response("transparent detail"));
  requests.get("001/02.png")!(new Response(null, { status: 404 }));
  await tick();
  assert.deepEqual(statuses, ["ready"]);
  assert.deepEqual(draw.slice(-4), ["clear", "overview", "clear", "transparent detail"]);

  const touch = (type: string, pointerId: number, clientX: number) => {
    viewport.dispatchEvent(Object.assign(new Event(type), {
      button: 0, pointerType: "touch", pointerId, clientX, clientY: 90,
    }));
  };
  touch("pointerdown", 1, 90);
  touch("pointerdown", 2, 150);
  touch("pointermove", 2, 210);
  await tick();
  // Four requests start even when more detail tiles intersect the viewport.
  assert.equal(urls.length, 7);
  touch("pointerup", 2, 210);
  touch("pointerup", 1, 90);
  assert.ok(frames.size > 0);
  controller.abort();
  await tick();
  assert.ok(signals.every((signal) => signal.aborted));
  assert.equal(captured.size, 0);
  assert.deepEqual(closed.sort(), ["overview", "transparent detail"]);
  assert.equal(frames.size, 0);
});
