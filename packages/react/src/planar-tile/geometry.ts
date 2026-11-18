import { containRect, type MapPoint as Point, type MapRect as Rect } from "../map/geometry";
import type { PlanarLevel, PlanarManifest, Size } from "./manifest";

export type PlanarView = { center: Point; zoom: number };
export const FIT_VIEW: PlanarView = { center: { x: 0.5, y: 0.5 }, zoom: 1 };

export type PlanarTile = {
  key: string;
  level: number;
  col: number;
  row: number;
  width: number;
  height: number;
  /** Tile bounds normalized to the source image. */
  rect: Rect;
};

export function viewRect(fit: Rect, view: PlanarView): Rect {
  const width = fit.width * view.zoom;
  const height = fit.height * view.zoom;
  return {
    left: fit.left + fit.width / 2 - width * view.center.x,
    top: fit.top + fit.height / 2 - height * view.center.y,
    width,
    height,
  };
}

function constrainCenter(center: number, viewport: number, image: number) {
  if (image <= viewport) return 0.5;
  const edge = viewport / (2 * image);
  return Math.max(edge, Math.min(1 - edge, center));
}

export function constrainView(view: PlanarView, size: Size, fit: Rect, maxZoom: number): PlanarView {
  const zoom = Math.max(1, Math.min(maxZoom, view.zoom));
  return {
    zoom,
    center: {
      x: constrainCenter(view.center.x, size.width, fit.width * zoom),
      y: constrainCenter(view.center.y, size.height, fit.height * zoom),
    },
  };
}

/** A narrower image can reach its edge while the other side continues panning. */
export function planarPaneCenter(view: PlanarView, viewport: Size, sharedFit: Rect, paneFit: Rect): Point {
  const { center, zoom } = view;
  const project = (value: number, size: number, shared: number, pane: number) => {
    if (shared === pane) return value;
    const bounded = constrainCenter(value, size, shared * zoom);
    return constrainCenter(bounded, size, pane * zoom) + (value - bounded);
  };
  return {
    x: project(center.x, viewport.width, sharedFit.width, paneFit.width),
    y: project(center.y, viewport.height, sharedFit.height, paneFit.height),
  };
}

export function moveView(
  view: PlanarView, fit: Rect, viewport: Size, maxZoom: number,
  from: Point, to: Point, factor: number,
): PlanarView {
  const zoom = Math.max(1, Math.min(maxZoom, view.zoom * factor));
  return constrainView(anchorView(view, fit, viewport, from, to, zoom), viewport, fit, maxZoom);
}

export function anchorView(
  view: PlanarView, fit: Rect, viewport: Size, from: Point, to: Point, zoom: number,
): PlanarView {
  const rect = viewRect(fit, view);
  return {
    zoom,
    center: {
      x: (from.x - rect.left) / rect.width + (viewport.width / 2 - to.x) / (fit.width * zoom),
      y: (from.y - rect.top) / rect.height + (viewport.height / 2 - to.y) / (fit.height * zoom),
    },
  };
}

export function normalizeMaxScale(maxScale: number | undefined) {
  return maxScale !== undefined && Number.isFinite(maxScale) ? Math.max(1, maxScale) : undefined;
}

export function viewportGeometry(
  manifest: PlanarManifest, viewport: Size, pixelRatio: number, maxScale?: number,
) {
  const fit = containRect(viewport.width, viewport.height, manifest.source.width, manifest.source.height);
  const highest = manifest.levels[manifest.levels.length - 1]!;
  const autoZoom = Math.max(2, Math.min(
    highest.width / (fit.width * pixelRatio),
    highest.height / (fit.height * pixelRatio),
  ));
  return { fit, maxZoom: Math.min(
    normalizeMaxScale(maxScale) ?? autoZoom,
    Number.MAX_SAFE_INTEGER / Math.max(1, fit.width, fit.height),
  ) };
}

export function selectLevel(levels: PlanarLevel[], image: Rect, pixelRatio: number) {
  return levels.find((level) =>
    level.width >= image.width * pixelRatio && level.height >= image.height * pixelRatio,
  ) ?? levels[levels.length - 1]!;
}

export function visibleTiles(level: PlanarLevel, tileSize: number, image: Rect, viewport: Size) {
  const x = (screenX: number) => (screenX - image.left) * level.width / image.width;
  const y = (screenY: number) => (screenY - image.top) * level.height / image.height;
  const left = Math.max(0, Math.floor(x(0) / tileSize));
  const top = Math.max(0, Math.floor(y(0) / tileSize));
  const right = Math.min(level.columns, Math.ceil(x(viewport.width) / tileSize));
  const bottom = Math.min(level.rows, Math.ceil(y(viewport.height) / tileSize));
  const centerCol = x(viewport.width / 2) / tileSize - 0.5;
  const centerRow = y(viewport.height / 2) / tileSize - 0.5;
  const distance = (tile: PlanarTile) => Math.abs(tile.col - centerCol) + Math.abs(tile.row - centerRow);
  const tiles: PlanarTile[] = [];
  for (let row = top; row < bottom; row++) {
    for (let col = left; col < right; col++) {
      const width = Math.min(tileSize, level.width - col * tileSize);
      const height = Math.min(tileSize, level.height - row * tileSize);
      tiles.push({
        key: `${level.level}/${col}/${row}`,
        level: level.level, col, row, width, height,
        rect: {
          left: col * tileSize / level.width,
          top: row * tileSize / level.height,
          width: width / level.width,
          height: height / level.height,
        },
      });
    }
  }
  return tiles.sort((a, b) => distance(a) - distance(b));
}
