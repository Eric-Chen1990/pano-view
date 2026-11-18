import { createContext, useContext, useSyncExternalStore } from "react";
import { PerspectiveCamera, type Camera, type Vector2 } from "three";

export type PanoCompareLayout = "left-right" | "top-bottom";
export type PanoComparePresentation = "wipe" | "split-view";
export type PanoCompareSide = "before" | "after";

export type CompareRect = { x: number; y: number; width: number; height: number };
export type CompareSize = { width: number; height: number };

export function normalizeCompareSplit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5;
}

/** Use the same rounded buffer edge for both panes, even at fractional DPR. */
export function compareRects(
  { width, height }: CompareSize,
  layout: PanoCompareLayout,
  split: number,
  dpr: number,
): readonly [CompareRect, CompareRect] {
  const horizontal = layout === "left-right";
  const extent = horizontal ? width : height;
  const edge = Math.min(extent, Math.round(extent * split * dpr) / dpr);
  return horizontal
    ? [{ x: 0, y: 0, width: edge, height }, { x: edge, y: 0, width: width - edge, height }]
    : [{ x: 0, y: 0, width, height: edge }, { x: 0, y: edge, width, height: height - edge }];
}

export type CompareConfig = {
  layout: PanoCompareLayout;
  presentation: PanoComparePresentation;
  split: number;
  changeSplit: (split: number) => void;
};

type CompareMotion = { layout: PanoCompareLayout; separation: number };

/** The crop stays on the divider while the projection centers move apart. */
export function comparePaneViewport(
  size: CompareSize,
  layout: PanoCompareLayout,
  side: PanoCompareSide,
  separation: number,
  dpr: number,
): CompareRect {
  const horizontal = layout === "left-right";
  const extent = horizontal ? size.width : size.height;
  const middle = Math.min(extent, Math.round(extent * 0.5 * dpr) / dpr);
  const before = side === "before";
  const start = before ? 0 : middle * separation;
  const end = before ? extent + (middle - extent) * separation : extent;
  return horizontal
    ? { x: start, y: 0, width: end - start, height: size.height }
    : { x: 0, y: start, width: size.width, height: end - start };
}

export function createCompareHost() {
  let currentConfig: CompareConfig | null = null;
  let currentMotion: CompareMotion | null = null;
  const cameras: Partial<Record<PanoCompareSide, PerspectiveCamera>> = {};
  let cachedRects: {
    width: number; height: number; dpr: number; layout: PanoCompareLayout; split: number;
    rects: ReturnType<typeof compareRects>;
  } | undefined;
  const listeners = new Set<() => void>();
  const host = {
    get config(): CompareConfig | null { return currentConfig; },
    get motion(): CompareMotion | null { return currentMotion; },
    beforeHtml: null as HTMLDivElement | null,
    afterHtml: null as HTMLDivElement | null,
    chrome: null as HTMLDivElement | null,
    transitionLayer: null as HTMLDivElement | null,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    notify: () => { for (const listener of listeners) listener(); },
    getConfig: () => currentConfig,
    setConfig: (config: CompareConfig | null) => {
      currentConfig = config;
      host.notify();
    },
    setMotion(motion: CompareMotion | null) {
      const presenceChanged = Boolean(currentMotion) !== Boolean(motion);
      currentMotion = motion;
      if (motion && currentConfig?.layout === motion.layout) {
        const split = currentConfig.split + (0.5 - currentConfig.split) * motion.separation;
        host.chrome?.style.setProperty("--pano-compare-motion-divider", `${split * 100}%`);
      } else {
        host.chrome?.style.removeProperty("--pano-compare-motion-divider");
      }
      if (presenceChanged) host.notify();
    },
    hasPaneViews: () => currentMotion !== null || currentConfig?.presentation === "split-view",
    getRects(size: CompareSize, dpr: number, config: CompareConfig | null = currentConfig): readonly [CompareRect, CompareRect] | null {
      if (!config) return null;
      const { layout } = config;
      const split = currentMotion?.layout === layout
        ? config.split + (0.5 - config.split) * currentMotion.separation
        : config.presentation === "wipe" ? config.split : 0.5;
      if (cachedRects?.width !== size.width || cachedRects.height !== size.height ||
          cachedRects.dpr !== dpr || cachedRects.layout !== layout || cachedRects.split !== split) {
        cachedRects = { width: size.width, height: size.height, dpr, layout, split,
          rects: compareRects(size, layout, split, dpr) };
      }
      return cachedRects.rects;
    },
    getPane(
      camera: Camera,
      size: CompareSize,
      dpr: number,
      side: PanoCompareSide,
      config: CompareConfig | null = currentConfig,
    ): { camera: PerspectiveCamera; rect: CompareRect; clip: CompareRect } | null {
      if (!config || !(camera instanceof PerspectiveCamera)) return null;
      const separation = currentMotion?.layout === config.layout ? currentMotion.separation : null;
      if (separation === null && config.presentation !== "split-view") {
        return null;
      }
      const clip = host.getRects(size, dpr, config)?.[side === "before" ? 0 : 1];
      if (!clip) return null;
      const rect = separation === null ? clip : comparePaneViewport(size, config.layout, side, separation, dpr);
      if (rect.width <= 0 || rect.height <= 0) return null;
      const pane = cameras[side] ??= new PerspectiveCamera();
      const aspect = rect.width / rect.height;
      if (pane.matrixWorldAutoUpdate || !pane.matrixWorld.equals(camera.matrixWorld) ||
          pane.aspect !== aspect || pane.fov !== camera.fov || pane.zoom !== camera.zoom ||
          pane.near !== camera.near || pane.far !== camera.far ||
          pane.filmOffset !== camera.filmOffset || pane.layers.mask !== camera.layers.mask) {
        // Both projections follow the same world-space pose and vertical FOV.
        pane.copy(camera, false);
        pane.matrix.copy(camera.matrixWorld);
        pane.matrixWorld.copy(camera.matrixWorld);
        pane.matrixWorldInverse.copy(camera.matrixWorldInverse);
        pane.matrixWorldAutoUpdate = false;
        pane.aspect = aspect;
        pane.updateProjectionMatrix();
      }
      return { camera: pane, rect, clip };
    },
  };
  return host;
}

export const CompareHostContext = createContext<ReturnType<typeof createCompareHost> | null>(null);
export const CompareSourceSideContext = createContext<PanoCompareSide | null>(null);

export function useCompareSplitView() {
  const host = useContext(CompareHostContext);
  return useSyncExternalStore(
    host?.subscribe ?? (() => () => {}),
    () => host?.hasPaneViews() ?? false,
    () => false,
  );
}

export function aimComparePointer(
  host: ReturnType<typeof createCompareHost> | null,
  event: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement,
  camera: Camera,
  size: CompareSize,
  dpr: number,
  ndc: Vector2,
  lockedSide?: PanoCompareSide,
) {
  if (!host?.config || !host.hasPaneViews()) return null;
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  const x = (event.clientX - bounds.left) * size.width / bounds.width;
  const y = (event.clientY - bounds.top) * size.height / bounds.height;
  const before = host.getRects(size, dpr)?.[0];
  if (!before) return null;
  const side = lockedSide ?? ((host.config.layout === "left-right" ? x < before.width : y < before.height) ? "before" : "after");
  const pane = host.getPane(camera, size, dpr, side);
  if (!pane) return null;
  const { rect } = pane;
  ndc.set(((x - rect.x) / rect.width) * 2 - 1, -((y - rect.y) / rect.height) * 2 + 1);
  return { camera: pane.camera, side };
}
