import assert from "node:assert/strict";
import test from "node:test";
import {
  createPanoPerformanceHost,
  IDLE_PANO_PERFORMANCE,
  PERFORMANCE_IDLE_INTERVAL_MS,
} from "../src/performance/host";

function sample(
  now: number,
  overrides: Partial<Parameters<ReturnType<typeof createPanoPerformanceHost>["recordFrame"]>[0]> = {},
) {
  return {
    now,
    cpuMs: 4,
    drawCalls: 12,
    triangles: 2400,
    geometries: 3,
    textures: 5,
    dpr: 2,
    canvasWidth: 1600,
    canvasHeight: 900,
    frameloop: "always" as const,
    hidden: false,
    ...overrides,
  };
}

test("is inactive until a monitor acquires a lease", () => {
  const host = createPanoPerformanceHost(8);
  assert.equal(host.isActive(), false);
  const release = host.acquire(250);
  assert.equal(host.isActive(), true);
  release();
  assert.equal(host.isActive(), false);
  assert.equal(host.getSnapshot().backend, null);
  assert.equal(host.getSnapshot().history.length, 0);
});

test("computes fps and average or max frame time from recent samples", () => {
  const host = createPanoPerformanceHost(32);
  host.acquire(0);
  host.setBackend("webgl");
  let at = 1_000;
  for (let i = 0; i < 10; i += 1) {
    at += 16;
    host.recordFrame(sample(at, {
      intervalMs: 16,
      cpuMs: 3 + i * 0.1,
      drawCalls: 10 + i,
    }));
  }
  host.flush(at);
  const snapshot = host.getSnapshot();
  assert.equal(snapshot.backend, "webgl");
  assert.equal(snapshot.fps, 10);
  assert.ok(snapshot.frameTimeMs.avg !== null);
  assert.ok(snapshot.frameTimeMs.max !== null);
  assert.ok(snapshot.frameTimeMs.max! >= snapshot.frameTimeMs.avg!);
  assert.equal(snapshot.drawCalls, 19);
  assert.equal(snapshot.canvas.width, 1600);
  assert.equal(snapshot.history.length, 10);
});

test("excludes idle gaps from average frame time but keeps them in history", () => {
  const host = createPanoPerformanceHost(16);
  host.acquire(0);
  host.recordFrame(sample(100, { intervalMs: 16 }));
  host.recordFrame(sample(100 + PERFORMANCE_IDLE_INTERVAL_MS + 50, {
    intervalMs: PERFORMANCE_IDLE_INTERVAL_MS + 50,
  }));
  host.recordFrame(sample(100 + PERFORMANCE_IDLE_INTERVAL_MS + 66, { intervalMs: 16 }));
  host.flush(100 + PERFORMANCE_IDLE_INTERVAL_MS + 66);
  const snapshot = host.getSnapshot();
  assert.equal(snapshot.history.length, 3);
  assert.equal(snapshot.frameTimeMs.avg, 16);
  assert.equal(snapshot.frameTimeMs.max, 16);
});

test("throttles snapshot publishes to the shortest acquired interval", () => {
  const host = createPanoPerformanceHost(16);
  const events: number[] = [];
  host.subscribe(() => events.push(host.getSnapshot().drawCalls));
  const releaseFast = host.acquire(40);
  host.acquire(200);
  host.recordFrame(sample(1_000, { drawCalls: 1 }));
  host.recordFrame(sample(1_010, { drawCalls: 2 }));
  host.recordFrame(sample(1_050, { drawCalls: 3 }));
  assert.deepEqual(events, [1, 3]);
  releaseFast();
  host.recordFrame(sample(1_060, { drawCalls: 4 }));
  host.recordFrame(sample(1_250, { drawCalls: 5 }));
  assert.equal(events.at(-1), 5);
});

test("wraps the ring buffer and clears fps while the document is hidden", () => {
  const host = createPanoPerformanceHost(4);
  host.acquire(0);
  for (let i = 0; i < 6; i += 1) {
    host.recordFrame(sample(2_000 + i * 16, { drawCalls: i + 1, intervalMs: 16 }));
  }
  host.flush(2_000 + 5 * 16);
  assert.equal(host.getSnapshot().history.length, 4);
  assert.equal(host.getSnapshot().drawCalls, 6);
  host.setHidden(true, 2_100);
  assert.equal(host.getSnapshot().fps, null);
  host.setHidden(false, 2_200);
  assert.notEqual(host.getSnapshot().fps, null);
});

test("idle snapshot keeps the backend after the last lease releases", () => {
  const host = createPanoPerformanceHost();
  host.setBackend("webgpu");
  const release = host.acquire();
  host.recordFrame(sample(500));
  host.flush(500);
  assert.notEqual(host.getSnapshot(), IDLE_PANO_PERFORMANCE);
  release();
  assert.equal(host.getSnapshot().backend, "webgpu");
  assert.equal(host.getSnapshot().history.length, 0);
  assert.equal(host.isActive(), false);
});
