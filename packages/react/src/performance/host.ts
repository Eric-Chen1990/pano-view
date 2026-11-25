import { createContext } from "react";
import type { PanoRendererBackend } from "../types";

export type PanoPerformanceFrameloop = "always" | "demand" | "never";

export type PanoPerformanceSnapshot = Readonly<{
  backend: PanoRendererBackend | null;
  frameloop: PanoPerformanceFrameloop;
  /** Frames completed in the last second, or null while the document is hidden. */
  fps: number | null;
  frameTimeMs: Readonly<{ avg: number | null; max: number | null }>;
  /** JS time from the start of the Fiber frame to after the draw. Not GPU time. */
  cpuTimeMs: number | null;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
  canvas: Readonly<{ width: number; height: number }>;
  /** Recent frame intervals in milliseconds, oldest first. */
  history: readonly number[];
}>;

export type PanoPerformanceFrameSample = {
  now: number;
  intervalMs: number;
  cpuMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
  canvasWidth: number;
  canvasHeight: number;
  frameloop: PanoPerformanceFrameloop;
  hidden: boolean;
};

export const DEFAULT_PERFORMANCE_HISTORY = 120;
export const DEFAULT_PERFORMANCE_UPDATE_MS = 500;
export const PERFORMANCE_IDLE_INTERVAL_MS = 1000;
export const PERFORMANCE_FPS_WINDOW_MS = 1000;

export const IDLE_PANO_PERFORMANCE: PanoPerformanceSnapshot = Object.freeze({
  backend: null,
  frameloop: "always",
  fps: null,
  frameTimeMs: Object.freeze({ avg: null, max: null }),
  cpuTimeMs: null,
  drawCalls: 0,
  triangles: 0,
  geometries: 0,
  textures: 0,
  dpr: 1,
  canvas: Object.freeze({ width: 0, height: 0 }),
  history: Object.freeze([] as number[]),
});

type FrameRecord = {
  at: number;
  intervalMs: number;
  cpuMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
  canvasWidth: number;
  canvasHeight: number;
  frameloop: PanoPerformanceFrameloop;
  hidden: boolean;
};

type Listener = () => void;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function createPanoPerformanceHost(
  historySize = DEFAULT_PERFORMANCE_HISTORY,
) {
  const capacity = Math.max(1, Math.floor(historySize));
  const buffer: FrameRecord[] = new Array(capacity);
  let write = 0;
  let count = 0;
  let lastFrameAt: number | null = null;
  let backend: PanoRendererBackend | null = null;
  let snapshot: PanoPerformanceSnapshot = IDLE_PANO_PERFORMANCE;
  let publishedAt = 0;
  let updateIntervalMs = DEFAULT_PERFORMANCE_UPDATE_MS;
  let subscribers = 0;
  let active = false;
  const snapshotListeners = new Set<Listener>();
  const activeListeners = new Set<Listener>();
  const leaseIntervals: number[] = [];

  function notify(listeners: Set<Listener>) {
    for (const listener of listeners) listener();
  }

  function setActive(next: boolean) {
    if (active === next) return;
    active = next;
    if (!next) {
      write = 0;
      count = 0;
      lastFrameAt = null;
      publishedAt = 0;
      if (snapshot !== IDLE_PANO_PERFORMANCE) {
        snapshot = Object.freeze({
          ...IDLE_PANO_PERFORMANCE,
          backend,
        });
        notify(snapshotListeners);
      }
    }
    notify(activeListeners);
  }

  function refreshUpdateInterval() {
    let next = DEFAULT_PERFORMANCE_UPDATE_MS;
    for (const interval of leaseIntervals) {
      if (interval < next) next = interval;
    }
    updateIntervalMs = leaseIntervals.length === 0 ? DEFAULT_PERFORMANCE_UPDATE_MS : next;
  }

  function buildSnapshot(now: number): PanoPerformanceSnapshot {
    if (count === 0) {
      return Object.freeze({
        ...IDLE_PANO_PERFORMANCE,
        backend,
      });
    }

    const history: number[] = [];
    let avgSum = 0;
    let avgCount = 0;
    let maxInterval: number | null = null;
    let fpsCount = 0;
    let latest: FrameRecord | null = null;

    for (let i = 0; i < count; i += 1) {
      const record = buffer[(write - count + i + capacity) % capacity]!;
      history.push(record.intervalMs);
      latest = record;
      if (record.intervalMs <= PERFORMANCE_IDLE_INTERVAL_MS) {
        avgSum += record.intervalMs;
        avgCount += 1;
        if (maxInterval === null || record.intervalMs > maxInterval) {
          maxInterval = record.intervalMs;
        }
      }
      if (!record.hidden && now - record.at <= PERFORMANCE_FPS_WINDOW_MS) {
        fpsCount += 1;
      }
    }

    const fps = latest?.hidden ? null : fpsCount;
    return Object.freeze({
      backend,
      frameloop: latest?.frameloop ?? "always",
      fps,
      frameTimeMs: Object.freeze({
        avg: avgCount === 0 ? null : round1(avgSum / avgCount),
        max: maxInterval === null ? null : round1(maxInterval),
      }),
      cpuTimeMs: latest ? round1(latest.cpuMs) : null,
      drawCalls: latest?.drawCalls ?? 0,
      triangles: latest?.triangles ?? 0,
      geometries: latest?.geometries ?? 0,
      textures: latest?.textures ?? 0,
      dpr: latest?.dpr ?? 1,
      canvas: Object.freeze({
        width: latest?.canvasWidth ?? 0,
        height: latest?.canvasHeight ?? 0,
      }),
      history: Object.freeze(history),
    });
  }

  function publish(now: number, force = false) {
    if (!force && now - publishedAt < updateIntervalMs && snapshot !== IDLE_PANO_PERFORMANCE) {
      return;
    }
    publishedAt = now;
    snapshot = buildSnapshot(now);
    notify(snapshotListeners);
  }

  return {
    getSnapshot: () => snapshot,
    isActive: () => active,
    subscribe(listener: Listener) {
      snapshotListeners.add(listener);
      return () => {
        snapshotListeners.delete(listener);
      };
    },
    subscribeActive(listener: Listener) {
      activeListeners.add(listener);
      return () => {
        activeListeners.delete(listener);
      };
    },
    /**
     * Keep the collector running while at least one monitor is mounted.
     * Returns a release function. `updateIntervalMs` chooses the publish cadence;
     * with several monitors the shortest interval wins.
     */
    acquire(intervalMs = DEFAULT_PERFORMANCE_UPDATE_MS) {
      const resolved = Number.isFinite(intervalMs)
        ? Math.max(0, intervalMs)
        : DEFAULT_PERFORMANCE_UPDATE_MS;
      leaseIntervals.push(resolved);
      subscribers += 1;
      refreshUpdateInterval();
      setActive(true);
      return () => {
        const index = leaseIntervals.indexOf(resolved);
        if (index >= 0) leaseIntervals.splice(index, 1);
        subscribers = Math.max(0, subscribers - 1);
        refreshUpdateInterval();
        if (subscribers === 0) setActive(false);
      };
    },
    setBackend(next: PanoRendererBackend | null) {
      if (backend === next) return;
      backend = next;
      snapshot = Object.freeze({ ...snapshot, backend });
      notify(snapshotListeners);
    },
    /** Call when the document visibility changes so FPS can clear immediately. */
    setHidden(hidden: boolean, now = performance.now()) {
      if (!active) return;
      if (hidden) {
        snapshot = Object.freeze({ ...snapshot, fps: null });
        publishedAt = now;
        notify(snapshotListeners);
        return;
      }
      publish(now, true);
    },
    recordFrame(sample: Omit<PanoPerformanceFrameSample, "intervalMs"> & { intervalMs?: number }) {
      if (!active) return;
      const at = sample.now;
      const intervalMs =
        sample.intervalMs ??
        (lastFrameAt === null ? 0 : Math.max(0, at - lastFrameAt));
      lastFrameAt = at;
      buffer[write] = {
        at,
        intervalMs,
        cpuMs: sample.cpuMs,
        drawCalls: sample.drawCalls,
        triangles: sample.triangles,
        geometries: sample.geometries,
        textures: sample.textures,
        dpr: sample.dpr,
        canvasWidth: sample.canvasWidth,
        canvasHeight: sample.canvasHeight,
        frameloop: sample.frameloop,
        hidden: sample.hidden,
      };
      write = (write + 1) % capacity;
      if (count < capacity) count += 1;
      publish(at, sample.hidden);
    },
    /** Test helper: force a snapshot from the current buffer. */
    flush(now = performance.now()) {
      publish(now, true);
    },
  };
}

export type PanoPerformanceHost = ReturnType<typeof createPanoPerformanceHost>;

export const PanoPerformanceHostContext = createContext<PanoPerformanceHost | null>(null);
