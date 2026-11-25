import type { MapPoint as Point, MapRect as Rect } from "../map/geometry";
import { clampAxis, resolveDragMotion, velocityFromSamples, type PanoDragMotion } from "../drag-motion";
import {
  anchorView, constrainView, FIT_VIEW, moveView, normalizeScaleLimit, planarPaneCenter, viewportGeometry, viewRect,
  type PlanarView, type PlanarZoomRange,
} from "./geometry";
import type { PlanarManifest, Size } from "./manifest";
import type { CompareConfig } from "../compare/view";
import { createPlanarTileLayer, type PlanarStatus } from "./tile-layer";
import {
  coastPlanarView, dragPlanarView, followPlanarView, NO_VELOCITY, ZOOM_MOTION_SCALE,
  type PlanarVelocity,
} from "./motion";

export type { PlanarStatus } from "./tile-layer";

export type PlanarViewOptions = {
  /** Maximum zoom relative to the fitted image. Defaults to a resolution-based limit. */
  maxScale?: number;
  /** Opening zoom relative to the fitted image. Defaults to 1. */
  initialScale?: number;
  /** Drag and pinch inertia and edge bounce. Both default to true. */
  dragMotion?: PanoDragMotion | false;
};
export type PlanarComparisonViewOptions = PlanarViewOptions & {
  /** Minimum zoom relative to the fitted image. Defaults to 1. */
  minScale?: number;
};
export type PlanarControls = {
  zoom: (factor: number) => void;
  zoomWithWheel: (event: WheelEvent, imagePoint?: Point) => void;
  reset: () => void;
  configure: (options: PlanarViewOptions) => void;
  getView: () => PlanarView;
  panTo: (center: Point) => void;
  subscribeOverview: (listener: OverviewListener) => () => void;
};

type OverviewListener = (viewport: Size, image: Rect, preview: ImageBitmap) => void;
type GestureSample = PlanarVelocity & { t: number };
type ViewAnimation =
  | { target: PlanarView }
  | { velocity: PlanarVelocity; anchor: Point };

const MAX_CANVAS_EDGE = 4096;
const MAX_CANVAS_PIXELS = 4 * 1024 * 1024;
const ZOOM_STEP = 1.5;
const EMPTY_RECT: Rect = { left: 0, top: 0, width: 0, height: 0 };

type PlanarSurface = {
  canvas: HTMLCanvasElement;
  manifest: PlanarManifest;
  report: (status: PlanarStatus, error?: unknown) => void;
};

export function mountPlanarView(
  viewportElement: HTMLElement,
  canvas: HTMLCanvasElement,
  manifest: PlanarManifest,
  signal: AbortSignal,
  report: (status: PlanarStatus) => void,
  options: PlanarViewOptions = {},
): PlanarControls {
  return mountPlanarSurfaces(viewportElement, [{ canvas, manifest, report }], signal, options);
}

export function mountPlanarSurfaces(
  viewportElement: HTMLElement,
  surfaces: readonly [PlanarSurface] | readonly [PlanarSurface, PlanarSurface],
  signal: AbortSignal,
  options: PlanarComparisonViewOptions,
  comparison?: CompareConfig,
) {
  const viewport = { width: 0, height: 0 };
  const bounds = { width: 0, height: 0 };
  let view = FIT_VIEW;
  let fit = EMPTY_RECT;
  const range: PlanarZoomRange = { min: 1, max: 2 };
  let minScale = normalizeScaleLimit(options.minScale);
  let maxScale = normalizeScaleLimit(options.maxScale);
  let motion = resolveDragMotion(options.dragMotion);
  let initialized = false;
  let pixelRatio = 1;
  let frame = 0;
  let overviewListener: OverviewListener | undefined;
  const layers = surfaces.map(({ canvas, manifest, report }) => ({
    canvas, manifest, fit: EMPTY_RECT,
    tiles: createPlanarTileLayer(canvas, manifest, signal, schedule, report, surfaces.length === 2),
  }));
  let gesturePane = 0;
  const pointers = new Map<number, Point>();
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let animation: ViewAnimation | undefined;
  let animationTime = 0;
  let samples: GestureSample[] = [];
  let samplePointerCount = 0;

  function animate(next: ViewAnimation) {
    if (!animation) animationTime = performance.now();
    animation = next;
    schedule();
  }

  function advance(now: number) {
    if (!animation) return;
    if (reducedMotion?.matches) {
      view = "target" in animation ? animation.target : constrainView(view, viewport, fit, range);
      animation = undefined;
      return;
    }
    const dt = clampAxis((now - animationTime) / 1000, 0, 0.032);
    animationTime = now;
    if ("target" in animation) {
      const next = followPlanarView(view, animation.target, fit, viewport, range, dt);
      view = next.view;
      if (next.settled) animation = undefined;
    } else {
      const next = coastPlanarView(view, animation.velocity, animation.anchor, fit, viewport, range, dt, motion);
      view = next.view;
      animation.velocity = next.velocity;
      if (next.settled) animation = undefined;
    }
    if (animation) schedule();
  }

  function schedule() {
    if (!frame && !signal.aborted) frame = requestAnimationFrame(render);
  }

  function render(now: number) {
    frame = 0;
    if (signal.aborted || !viewport.width || !viewport.height) return false;
    advance(now);
    let painted = true;
    const lodZoom = clampAxis(view.zoom, range.min, range.max);
    for (const layer of layers) {
      const center = planarPaneCenter(view, viewport, fit, layer.fit);
      const image = viewRect(layer.fit, { center, zoom: view.zoom });
      painted = layer.tiles.paint(viewport, image,
        viewRect(layer.fit, { center, zoom: lodZoom }), pixelRatio) && painted;
      if (overviewListener) {
        const preview = layer.tiles.getPreview();
        if (preview) overviewListener(viewport, image, preview);
      }
    }
    return painted;
  }

  function resize() {
    bounds.width = viewportElement.clientWidth;
    bounds.height = viewportElement.clientHeight;
    const split = comparison?.presentation === "split-view";
    viewport.width = split && comparison?.layout === "left-right" ? bounds.width / 2 : bounds.width;
    viewport.height = split && comparison?.layout === "top-bottom" ? bounds.height / 2 : bounds.height;
    clearPointers();
    animation = undefined;
    samples = [];
    const { width, height } = viewport;
    if (!width || !height) return;
    pixelRatio = Math.min(
      window.devicePixelRatio || 1, 2,
      MAX_CANVAS_EDGE / width, MAX_CANVAS_EDGE / height,
      Math.sqrt(MAX_CANVAS_PIXELS / (width * height)),
    );
    const backingWidth = Math.max(1, Math.floor(width * pixelRatio));
    const backingHeight = Math.max(1, Math.floor(height * pixelRatio));
    range.max = Infinity;
    let fitWidth = 0;
    let fitHeight = 0;
    for (const layer of layers) {
      const { canvas, manifest } = layer;
      if (canvas.width !== backingWidth) canvas.width = backingWidth;
      if (canvas.height !== backingHeight) canvas.height = backingHeight;
      const geometry = viewportGeometry(manifest, viewport, pixelRatio, maxScale, minScale);
      layer.fit = geometry.fit;
      range.max = Math.min(range.max, geometry.maxZoom);
      fitWidth = Math.max(fitWidth, layer.fit.width);
      fitHeight = Math.max(fitHeight, layer.fit.height);
    }
    range.min = Math.min(minScale ?? 1, range.max);
    range.hardMin = minScale !== undefined;
    range.hardMax = maxScale !== undefined;
    fit = {
      width: fitWidth, height: fitHeight,
      left: (width - fitWidth) / 2, top: (height - fitHeight) / 2,
    };
    if (!initialized) {
      const initialScale = options.initialScale ?? 1;
      view = { ...FIT_VIEW, zoom: Number.isFinite(initialScale) ? initialScale : 1 };
      initialized = true;
    }
    view = constrainView(view, viewport, fit, range);
    schedule();
  }

  function targetView() {
    return animation && "target" in animation ? animation.target : view;
  }

  function setTarget(target: PlanarView) {
    if (reducedMotion?.matches) {
      animation = undefined;
      view = target;
      schedule();
    } else {
      animate({ target });
    }
  }

  function move(from: Point, to: Point, factor = 1) {
    if (!viewport.width || !viewport.height) return;
    setTarget(moveView(targetView(), fit, viewport, range, from, to, factor));
  }

  function drag(from: Point, to: Point, time: number, before = 1, after = 1) {
    if (!viewport.width || !viewport.height) return;
    animation = undefined;
    const factor = after / before;
    view = reducedMotion?.matches || !motion.bounce
      ? moveView(view, fit, viewport, range, from, to, factor)
      : dragPlanarView(view, fit, viewport, range, from, to, factor);
    if (samplePointerCount !== pointers.size) {
      samples = [];
      samplePointerCount = pointers.size;
    }
    samples = samples.filter(({ t }) => time - t <= 100).slice(-7);
    samples.push({ ...to, zoom: Math.log(after) * ZOOM_MOTION_SCALE, t: time });
    schedule();
  }

  const controls = {
    zoom(factor: number) {
      const center = { x: viewport.width / 2, y: viewport.height / 2 };
      move(center, center, factor);
    },
    zoomWithWheel,
    reset() {
      setTarget({ ...FIT_VIEW, zoom: range.min });
    },
    getView: () => view,
    panTo(center: Point) {
      if (signal.aborted || !viewport.width || !viewport.height) return;
      animation = undefined;
      if (pointers.size) clearPointers();
      view = constrainView({ center, zoom: view.zoom }, viewport, fit, range);
      schedule();
    },
    subscribeOverview(listener: OverviewListener) {
      overviewListener = listener;
      schedule();
      return () => {
        if (overviewListener === listener) overviewListener = undefined;
      };
    },
    setView(next: PlanarView) {
      animation = undefined;
      view = constrainView(next, viewport, fit, range);
      cancelAnimationFrame(frame);
      return render(performance.now());
    },
    setComparison(next: CompareConfig) {
      const resizeNeeded = comparison?.presentation !== next.presentation || comparison.layout !== next.layout;
      comparison = next;
      if (resizeNeeded) resize();
    },
    configure(next: PlanarComparisonViewOptions) {
      options = next;
      const nextMin = normalizeScaleLimit(next.minScale);
      const nextMax = normalizeScaleLimit(next.maxScale);
      const nextMotion = resolveDragMotion(next.dragMotion);
      if (minScale === nextMin && maxScale === nextMax &&
          motion.inertia === nextMotion.inertia && motion.bounce === nextMotion.bounce) return;
      minScale = nextMin;
      maxScale = nextMax;
      motion = nextMotion;
      resize();
    },
  };

  function localPoint(event: MouseEvent): Point {
    const rect = viewportElement.getBoundingClientRect();
    return {
      x: rect.width ? (event.clientX - rect.left) * bounds.width / rect.width : 0,
      y: rect.height ? (event.clientY - rect.top) * bounds.height / rect.height : 0,
    };
  }

  function paneAt(point: Point) {
    if (!comparison) return 0;
    const split = comparison.presentation === "split-view" ? 0.5 : comparison.split.get();
    const fraction = comparison.layout === "left-right" ? point.x / bounds.width : point.y / bounds.height;
    return fraction < split ? 0 : 1;
  }

  function toSharedPoint(point: Point, pane: number): Point {
    if (!comparison) return point;
    const paneFit = layers[pane]!.fit;
    const offset = pane === 1 && comparison.presentation === "split-view";
    const x = point.x - (offset && comparison.layout === "left-right" ? viewport.width : 0);
    const y = point.y - (offset && comparison.layout === "top-bottom" ? viewport.height : 0);
    // Convert a pane-local cursor anchor into the shared view's coordinate space.
    return {
      x: viewport.width / 2 + (x - viewport.width / 2) * fit.width / paneFit.width,
      y: viewport.height / 2 + (y - viewport.height / 2) * fit.height / paneFit.height,
    };
  }

  viewportElement.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || pointers.size >= 2 || !viewport.width || !viewport.height) return;
    animation = undefined;
    samples = [];
    viewportElement.focus({ preventScroll: true });
    viewportElement.setPointerCapture(event.pointerId);
    const point = localPoint(event);
    if (!pointers.size) gesturePane = paneAt(point);
    pointers.set(event.pointerId, point);
    const [first, second] = pointers.values();
    const anchor = second ? midpoint(first!, second) : first!;
    const span = second ? Math.max(1, Math.hypot(first!.x - second.x, first!.y - second.y)) : 1;
    samplePointerCount = pointers.size;
    samples.push({ ...toSharedPoint(anchor, gesturePane), zoom: Math.log(span) * ZOOM_MOTION_SCALE, t: event.timeStamp });
    viewportElement.dataset.dragging = "";
  }, { signal });
  viewportElement.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const current = localPoint(event);
    pointers.set(event.pointerId, current);
    const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (!other) {
      drag(toSharedPoint(previous, gesturePane), toSharedPoint(current, gesturePane), event.timeStamp);
      return;
    }
    const before = Math.max(1, Math.hypot(previous.x - other.x, previous.y - other.y));
    const after = Math.max(1, Math.hypot(current.x - other.x, current.y - other.y));
    drag(toSharedPoint(midpoint(previous, other), gesturePane),
      toSharedPoint(midpoint(current, other), gesturePane), event.timeStamp, before, after);
  }, { signal });

  function midpoint(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  const releasePointer = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    if (viewportElement.hasPointerCapture(event.pointerId)) {
      viewportElement.releasePointerCapture(event.pointerId);
    }
    if (event.type !== "pointerup") samples = [];
    if (pointers.size) return;
    delete viewportElement.dataset.dragging;
    const last = samples[samples.length - 1];
    const recent = samples.filter(({ t }) => event.timeStamp - t <= 100);
    const speed = (axis: keyof PlanarVelocity, limit: number) => clampAxis(
      velocityFromSamples(recent.map((sample) => ({ t: sample.t, position: sample[axis] }))), -limit, limit,
    );
    const velocity = motion.inertia && recent.length > 1
      ? { x: speed("x", 1800), y: speed("y", 1800), zoom: speed("zoom", 600) }
      : NO_VELOCITY;
    samples = [];
    animate({ velocity, anchor: last ?? toSharedPoint(localPoint(event), gesturePane) });
  };
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    viewportElement.addEventListener(event, releasePointer, { signal });
  }

  function zoomWithWheel(event: WheelEvent, imagePoint?: Point) {
    // Keep the page from scrolling under the viewer, including at zoom limits,
    // during a drag, and for zero-delta trackpad pans.
    if (event.cancelable) event.preventDefault();
    if (signal.aborted || pointers.size || !viewport.width || !viewport.height) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.height : 1;
    const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
    if (!delta) return;
    const target = targetView();
    const atLimit = (delta > 0 && target.zoom <= range.min) || (delta < 0 && target.zoom >= range.max);
    if (atLimit) return;
    const factor = Math.exp(-delta * 0.004);
    if (comparison) {
      const point = localPoint(event);
      const anchor = toSharedPoint(point, paneAt(point));
      move(anchor, anchor, factor);
      return;
    }
    const zoom = clampAxis(target.zoom * factor, range.min, range.max);
    let from: Point;
    let to: Point;
    if (imagePoint) {
      const image = viewRect(fit, view);
      from = { x: image.left + imagePoint.x * image.width, y: image.top + imagePoint.y * image.height };
      // Bring a point outside the visible crop to the closest edge of the viewport.
      to = { x: clampAxis(from.x, 0, viewport.width), y: clampAxis(from.y, 0, viewport.height) };
    } else {
      from = localPoint(event);
      to = from;
    }
    // Accumulate wheel steps against the target scale while anchoring to the image on screen.
    setTarget(constrainView(anchorView(view, fit, viewport, from, to, zoom), viewport, fit, range));
  }
  viewportElement.addEventListener("wheel", zoomWithWheel, { passive: false, signal });
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

  function clearPointers() {
    const ids = Array.from(pointers.keys());
    pointers.clear();
    for (const id of ids) {
      if (viewportElement.hasPointerCapture(id)) viewportElement.releasePointerCapture(id);
    }
    delete viewportElement.dataset.dragging;
  }

  const observer = new ResizeObserver(resize);
  observer.observe(viewportElement);
  window.addEventListener("resize", resize, { signal });
  signal.addEventListener("abort", () => {
    observer.disconnect();
    overviewListener = undefined;
    cancelAnimationFrame(frame);
    clearPointers();
  }, { once: true });
  resize();
  return controls;
}

export { ZOOM_STEP };
