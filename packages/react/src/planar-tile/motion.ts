import {
  clampAxis, constrainDragPosition, DRAG_RUBBER_CONSTANT, integrateAxis, type ResolvedDragMotion,
} from "../drag-motion";
import type { MapPoint as Point, MapRect as Rect } from "../map/geometry";
import { anchorView, constrainView, type PlanarView } from "./geometry";
import type { Size } from "./manifest";

export type PlanarVelocity = Point & { zoom: number };
export const NO_VELOCITY: PlanarVelocity = { x: 0, y: 0, zoom: 0 };
export type PlanarMotion = ResolvedDragMotion & { hardMaxZoom: boolean };
const DEFAULT_MOTION: PlanarMotion = { inertia: true, bounce: true, hardMaxZoom: false };

// Express logarithmic zoom in units comparable to CSS pixels for damping and springs.
export const ZOOM_MOTION_SCALE = 200;
const ZOOM_BAND = 22;

function panLimit(viewport: number, image: number) {
  return Math.max(0, (image - viewport) / 2);
}

function panBand(viewport: number) {
  return Math.min(42, viewport * 0.12);
}

/** Convert the displayed offset back to its unresisted value before adding input. */
function unband(position: number, min: number, max: number, dimension: number) {
  const edge = clampAxis(position, min, max);
  const offset = position - edge;
  const band = Math.max(1, dimension);
  return edge + offset / Math.max(0.05, 1 - Math.abs(offset) * DRAG_RUBBER_CONSTANT / band);
}

export function dragPlanarView(
  view: PlanarView, fit: Rect, viewport: Size, maxZoom: number,
  from: Point, to: Point, factor: number, hardMaxZoom = false,
): PlanarView {
  const max = Math.log(maxZoom) * ZOOM_MOTION_SCALE;
  const raw = unband(Math.log(view.zoom) * ZOOM_MOTION_SCALE, 0, max, ZOOM_BAND);
  const nextZoom = factor === 1 ? view.zoom : Math.exp(constrainDragPosition(
    raw + Math.log(factor) * ZOOM_MOTION_SCALE, 0, max, ZOOM_BAND, true,
  ) / ZOOM_MOTION_SCALE);
  const zoom = maxZoom === 1 ? 1 : hardMaxZoom ? Math.min(maxZoom, nextZoom) : nextZoom;
  const candidate = anchorView(view, fit, viewport, from, to, zoom);

  function axis(center: number, nextCenter: number, fitted: number, size: number) {
    const oldSize = fitted * view.zoom;
    const newSize = fitted * zoom;
    const oldLimit = panLimit(size, oldSize);
    const limit = panLimit(size, newSize);
    const band = panBand(size);
    const oldPosition = (0.5 - center) * oldSize;
    const extra = unband(oldPosition, -oldLimit, oldLimit, band) - oldPosition;
    const position = constrainDragPosition(
      (0.5 - nextCenter) * newSize + extra * zoom / view.zoom, -limit, limit, band, true,
    );
    return 0.5 - position / newSize;
  }

  return {
    zoom,
    center: {
      x: axis(view.center.x, candidate.center.x, fit.width, viewport.width),
      y: axis(view.center.y, candidate.center.y, fit.height, viewport.height),
    },
  };
}

export function coastPlanarView(
  view: PlanarView, velocity: PlanarVelocity, anchor: Point,
  fit: Rect, viewport: Size, maxZoom: number, dt: number, motion = DEFAULT_MOTION,
) {
  const max = Math.log(maxZoom) * ZOOM_MOTION_SCALE;
  const zoomMotion = integrateAxis({
    position: Math.log(view.zoom) * ZOOM_MOTION_SCALE,
    velocity: velocity.zoom,
  }, dt, { ...motion, min: 0, max });
  const stopZoom = maxZoom === 1 || (motion.hardMaxZoom && zoomMotion.position >= max);
  const zoom = stopZoom ? maxZoom : Math.exp(zoomMotion.position / ZOOM_MOTION_SCALE);
  const candidate = zoom === view.zoom ? view : anchorView(view, fit, viewport, anchor, anchor, zoom);

  function axis(center: number, speed: number, image: number, size: number) {
    const limit = panLimit(size, image);
    return integrateAxis({ position: (0.5 - center) * image, velocity: speed }, dt, {
      ...motion, min: -limit, max: limit,
    });
  }

  const width = fit.width * zoom;
  const height = fit.height * zoom;
  const x = axis(candidate.center.x, velocity.x, width, viewport.width);
  const y = axis(candidate.center.y, velocity.y, height, viewport.height);
  const settled = x.settled && y.settled && (stopZoom || zoomMotion.settled);
  const next = { zoom, center: { x: 0.5 - x.position / width, y: 0.5 - y.position / height } };
  return {
    view: settled ? constrainView(next, viewport, fit, maxZoom) : next,
    velocity: { x: x.velocity, y: y.velocity, zoom: stopZoom ? 0 : zoomMotion.velocity },
    settled,
  };
}

/** Blend image translation and scale together so a zoom anchor stays under the pointer. */
export function followPlanarView(
  view: PlanarView, target: PlanarView, fit: Rect, viewport: Size, maxZoom: number, dt: number,
) {
  const blend = 1 - Math.exp(-dt / 0.055);
  const remaining = 1 - blend;
  const zoom = view.zoom * remaining + target.zoom * blend;
  const next = constrainView({
    zoom,
    center: {
      x: (view.center.x * view.zoom * remaining + target.center.x * target.zoom * blend) / zoom,
      y: (view.center.y * view.zoom * remaining + target.center.y * target.zoom * blend) / zoom,
    },
  }, viewport, fit, maxZoom);
  const settled =
    Math.abs(next.zoom - target.zoom) * Math.max(fit.width, fit.height) < 0.5 &&
    Math.abs(next.center.x - target.center.x) * fit.width * zoom < 0.5 &&
    Math.abs(next.center.y - target.center.y) * fit.height * zoom < 0.5;
  return { view: settled ? target : next, settled };
}
