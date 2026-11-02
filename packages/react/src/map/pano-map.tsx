import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type {
  PanoMapDefinition,
  PanoMapSectorDefinition,
  PanoMapSpotDefinition,
} from "../data/map";
import type { PanoViewerState } from "../types";
import {
  clamp01,
  containRect,
  containerPointToImage,
  headingFromVector,
  horizontalFov,
  imagePointToContainer,
  normalizeDegrees,
  sectorRotation,
  type MapViewport,
} from "./geometry";
import { useMapView } from "./use-map-view";

const DEFAULT_ICON_SIZE = 28;
const DEFAULT_SECTOR_COLOR = "#ffffff";
const DEFAULT_SECTOR_OPACITY = 0.55;
const MIN_SCALE = 1;
const DEFAULT_MAX_SCALE = 8;
const ZOOM_STEP = 1.25;

export type PanoMapEditChange = {
  spots?: PanoMapSpotDefinition[];
  selectedSpotId?: string | null;
};

export type PanoMapProps = {
  map: PanoMapDefinition;
  activeSceneId?: string | null;
  onSelectScene?: (sceneId: string, spot: PanoMapSpotDefinition) => void;
  /** Controlled viewer state. When omitted, subscribe to the viewer event bus. */
  view?: PanoViewerState;
  mode?: "view" | "edit";
  selectedSpotId?: string | null;
  onSelectedSpotIdChange?: (spotId: string | null) => void;
  onEditChange?: (change: PanoMapEditChange) => void;
  /** Scene chosen before clicking the map to place a new spot. */
  placementSceneId?: string | null;
  className?: string;
  style?: CSSProperties;
  /** Override control visibility from the map document. */
  showZoomControls?: boolean;
  showCollapseControl?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Extra chrome rendered above the map surface. */
  renderChrome?: (controls: ReactNode) => ReactNode;
  /**
   * Opening zoom relative to the contain-fit scale.
   * Clamped to `[1, maxScale]`. Applies after the image is measured and recenters.
   * Resets only when this value or interaction mode changes.
   */
  initialScale?: number;
};

type DragState =
  | { kind: "pan"; pointerId: number; originX: number; originY: number; panX: number; panY: number }
  | {
      kind: "spot";
      pointerId: number;
      spotId: string;
      offsetX: number;
      offsetY: number;
    }
  | {
      kind: "heading";
      pointerId: number;
      spotId: string;
    };

function defaultGradientId(prefix: string): string {
  return `${prefix}-sector-gradient`;
}

function SectorShape({
  sector,
  angle,
  rotation,
  gradientId,
  interactive,
  onHeadingPointerDown,
  transformRef,
}: {
  sector: PanoMapSectorDefinition;
  angle: number;
  rotation: number;
  gradientId: string;
  interactive?: boolean;
  onHeadingPointerDown?: (event: ReactPointerEvent<SVGPathElement>) => void;
  transformRef?: (node: SVGGElement | null) => void;
}) {
  const half = angle / 2;
  const start = ((-half - 90) * Math.PI) / 180;
  const end = ((half - 90) * Math.PI) / 180;
  const radius = sector.radius;
  const largeArc = angle > 180 ? 1 : 0;
  const x1 = Math.cos(start) * radius;
  const y1 = Math.sin(start) * radius;
  const x2 = Math.cos(end) * radius;
  const y2 = Math.sin(end) * radius;
  const path = `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
  const opacity = sector.opacity ?? DEFAULT_SECTOR_OPACITY;
  const color = sector.color ?? DEFAULT_SECTOR_COLOR;
  const gradient = sector.gradient;
  const strokeWidth = sector.strokeWidth ?? 0;
  const strokeColor = sector.strokeColor ?? color;
  const strokeOpacity = sector.strokeOpacity ?? 1;
  // Stop opacities describe the fade shape (relative). Sector opacity scales the
  // whole fill so the editor slider stays effective in gradient mode.
  const gradientStrength =
    gradient && gradient.stops.length > 0
      ? Math.max(
          ...gradient.stops.map((stop) => stop.opacity ?? 1),
          Number.EPSILON,
        )
      : 1;
  return (
    <g ref={transformRef} transform={`rotate(${rotation})`} style={{ pointerEvents: "none" }}>
      {gradient ? (
        <defs>
          {gradient.type === "radial" ? (
            <radialGradient id={gradientId} cx="0" cy="0" r={radius} gradientUnits="userSpaceOnUse">
              {gradient.stops.map((stop, index) => (
                <stop
                  key={`${stop.offset}:${index}`}
                  offset={`${stop.offset * 100}%`}
                  stopColor={stop.color}
                  stopOpacity={(stop.opacity ?? 1) / gradientStrength}
                />
              ))}
            </radialGradient>
          ) : (
            <linearGradient
              id={gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2={-radius}
              gradientUnits="userSpaceOnUse"
            >
              {gradient.stops.map((stop, index) => (
                <stop
                  key={`${stop.offset}:${index}`}
                  offset={`${stop.offset * 100}%`}
                  stopColor={stop.color}
                  stopOpacity={(stop.opacity ?? 1) / gradientStrength}
                />
              ))}
            </linearGradient>
          )}
        </defs>
      ) : null}
      <path
        d={path}
        fill={gradient ? `url(#${gradientId})` : color}
        fillOpacity={opacity}
        stroke={strokeWidth > 0 ? strokeColor : "none"}
        strokeWidth={strokeWidth > 0 ? strokeWidth : undefined}
        strokeOpacity={strokeWidth > 0 ? strokeOpacity : undefined}
        vectorEffect="non-scaling-stroke"
        style={{
          pointerEvents: interactive ? "auto" : "none",
          cursor: interactive ? "grab" : undefined,
        }}
        onPointerDown={interactive ? onHeadingPointerDown : undefined}
      />
    </g>
  );
}

function DefaultSpotIcon({ active, size }: { active: boolean; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect
        x="3"
        y="7"
        width="26"
        height="18"
        rx="5"
        fill={active ? "rgba(15,23,42,0.92)" : "rgba(15,23,42,0.72)"}
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2"
      />
      <circle cx="16" cy="16" r="5" fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2" />
      <circle cx="16" cy="16" r="2" fill={active ? "#ef4444" : "rgba(255,255,255,0.85)"} />
    </svg>
  );
}

/**
 * Floor-plan map surface. Fills its parent; hosts decide docked vs dialog chrome.
 * Icons and sectors keep CSS-pixel size while the background image zooms.
 */
export function PanoMap({
  map,
  activeSceneId,
  onSelectScene,
  view: controlledView,
  mode = "view",
  selectedSpotId = null,
  onSelectedSpotIdChange,
  onEditChange,
  placementSceneId,
  className,
  style,
  showZoomControls,
  showCollapseControl,
  collapsed: controlledCollapsed,
  onCollapsedChange,
  renderChrome,
  initialScale,
}: PanoMapProps) {
  const reactId = useId().replace(/:/g, "");
  const view = useMapView(controlledView);
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectorNodeRef = useRef<SVGGElement | null>(null);
  const yawRef = useRef(view.yaw);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const initialViewKeyRef = useRef<string | null>(null);
  const spots = map.spots;
  const iconSize = map.iconSize ?? DEFAULT_ICON_SIZE;
  const interaction = map.interaction ?? "fixed";
  const gestureZoom = interaction === "zoom";
  const maxScale = Math.max(MIN_SCALE, map.maxScale ?? DEFAULT_MAX_SCALE);
  const resolvedInitialScale = Math.min(
    maxScale,
    Math.max(
      MIN_SCALE,
      Number.isFinite(initialScale) ? (initialScale as number) : MIN_SCALE,
    ),
  );
  // Zoom buttons only apply when interaction allows zooming.
  const zoomControls =
    gestureZoom && (showZoomControls ?? map.controls?.zoom === true);
  const collapseControl = showCollapseControl ?? map.controls?.collapse === true;
  const collapsed = controlledCollapsed ?? uncontrolledCollapsed;
  const editing = mode === "edit";

  const fit = useMemo(
    () => containRect(size.width, size.height, imageSize.width, imageSize.height),
    [size, imageSize],
  );

  const viewport: MapViewport = useMemo(
    () => ({ fit, scale, panX: pan.x, panY: pan.y }),
    [fit, scale, pan],
  );

  useLayoutEffect(() => {
    if (collapsed) return;
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      if (!(width > 0) || !(height > 0)) return;
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [collapsed]);

  useEffect(() => {
    yawRef.current = view.yaw;
    const node = sectorNodeRef.current;
    if (!node) return;
    const active = spots.find((spot) => spot.sceneId === activeSceneId);
    if (!active || !map.sector) return;
    node.setAttribute(
      "transform",
      `rotate(${sectorRotation(active.heading, view.yaw)})`,
    );
  }, [view.yaw, activeSceneId, spots, map.sector]);

  const setCollapsed = (next: boolean) => {
    onCollapsedChange?.(next);
    if (controlledCollapsed === undefined) setUncontrolledCollapsed(next);
  };

  const clampPan = useCallback(
    (nextScale: number, nextPan: { x: number; y: number }) => {
      const width = fit.width * nextScale;
      const height = fit.height * nextScale;
      if (!(fit.width > 0) || !(fit.height > 0)) return nextPan;
      const minX = Math.min(0, size.width - (fit.left + width));
      const maxX = Math.max(0, -fit.left);
      const minY = Math.min(0, size.height - (fit.top + height));
      const maxY = Math.max(0, -fit.top);
      return {
        x: Math.min(maxX, Math.max(minX, nextPan.x)),
        y: Math.min(maxY, Math.max(minY, nextPan.y)),
      };
    },
    [fit, size],
  );

  useEffect(() => {
    if (!gestureZoom) {
      initialViewKeyRef.current = null;
      setScale(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    setScale((previous) => {
      const next = Math.min(previous, maxScale);
      if (next !== previous) {
        setPan((currentPan) => clampPan(next, currentPan));
      }
      return next;
    });
  }, [clampPan, gestureZoom, maxScale]);

  // Apply opening zoom after the image and container are measured. Reset only
  // when initialScale or interaction mode changes; leave later user zoom alone.
  useEffect(() => {
    if (!gestureZoom) return;
    if (!(fit.width > 0) || !(fit.height > 0)) return;
    if (!(size.width > 0) || !(size.height > 0)) return;
    const key = `${interaction}:${initialScale ?? MIN_SCALE}`;
    if (initialViewKeyRef.current === key) return;
    initialViewKeyRef.current = key;
    const pivot = { x: size.width / 2, y: size.height / 2 };
    const nextPan = {
      x: pivot.x - (pivot.x - fit.left) * resolvedInitialScale - fit.left,
      y: pivot.y - (pivot.y - fit.top) * resolvedInitialScale - fit.top,
    };
    setScale(resolvedInitialScale);
    setPan(clampPan(resolvedInitialScale, nextPan));
  }, [
    clampPan,
    fit.height,
    fit.left,
    fit.top,
    fit.width,
    gestureZoom,
    initialScale,
    interaction,
    resolvedInitialScale,
    size.height,
    size.width,
  ]);

  const applyZoom = useCallback(
    (nextScale: number, origin?: { x: number; y: number }) => {
      if (!gestureZoom) return;
      const clamped = Math.min(maxScale, Math.max(MIN_SCALE, nextScale));
      const pivot = origin ?? { x: size.width / 2, y: size.height / 2 };
      const ratio = clamped / scale;
      const nextPan = {
        x: pivot.x - (pivot.x - (fit.left + pan.x)) * ratio - fit.left,
        y: pivot.y - (pivot.y - (fit.top + pan.y)) * ratio - fit.top,
      };
      setScale(clamped);
      setPan(clampPan(clamped, nextPan));
    },
    [
      clampPan,
      fit.left,
      fit.top,
      gestureZoom,
      maxScale,
      pan.x,
      pan.y,
      scale,
      size.height,
      size.width,
    ],
  );

  // React's onWheel is passive, so preventDefault cannot stop page scroll.
  // Bind a non-passive native listener on the map root.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!gestureZoom || collapsed) return;
      const viewport = containerRef.current;
      if (!viewport) return;
      const rect = viewport.getBoundingClientRect();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      applyZoom(scale * factor, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    root.addEventListener("wheel", onWheel, { passive: false });
    return () => root.removeEventListener("wheel", onWheel);
  }, [applyZoom, collapsed, gestureZoom, scale]);

  const updateSpots = (next: PanoMapSpotDefinition[], selected?: string | null) => {
    onEditChange?.({
      spots: next,
      ...(selected === undefined ? {} : { selectedSpotId: selected }),
    });
  };

  const localPoint = (event: { clientX: number; clientY: number }) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPointerDownSurface = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (collapsed) return;
    if (event.button !== 0) return;
    const point = localPoint(event);
    if (!point) return;

    if (editing && placementSceneId) {
      const image = containerPointToImage(point, viewport);
      if (!image) return;
      const spot: PanoMapSpotDefinition = {
        id: crypto.randomUUID(),
        sceneId: placementSceneId,
        x: clamp01(image.x),
        y: clamp01(image.y),
        heading: normalizeDegrees(-view.yaw),
      };
      updateSpots([...spots, spot], spot.id);
      onSelectedSpotIdChange?.(spot.id);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (gestureZoom && scale > 1) {
      dragRef.current = {
        kind: "pan",
        pointerId: event.pointerId,
        originX: point.x,
        originY: point.y,
        panX: pan.x,
        panY: pan.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onPointerMoveSurface = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = localPoint(event);
    if (!point) return;
    if (drag.kind === "pan") {
      setPan(
        clampPan(scale, {
          x: drag.panX + (point.x - drag.originX),
          y: drag.panY + (point.y - drag.originY),
        }),
      );
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (drag.kind === "spot") {
      const image = containerPointToImage(
        { x: point.x - drag.offsetX, y: point.y - drag.offsetY },
        viewport,
      );
      if (!image) return;
      updateSpots(
        spots.map((spot) =>
          spot.id === drag.spotId
            ? { ...spot, x: clamp01(image.x), y: clamp01(image.y) }
            : spot,
        ),
      );
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const spot = spots.find((entry) => entry.id === drag.spotId);
    if (!spot) return;
    const center = imagePointToContainer(spot, viewport);
    const heading = normalizeDegrees(
      headingFromVector(point.x - center.x, point.y - center.y) - view.yaw,
    );
    updateSpots(
      spots.map((entry) =>
        entry.id === drag.spotId ? { ...entry, heading } : entry,
      ),
    );
    if (sectorNodeRef.current && spot.sceneId === activeSceneId) {
      sectorNodeRef.current.setAttribute(
        "transform",
        `rotate(${sectorRotation(heading, view.yaw)})`,
      );
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const sectorAngle = (() => {
    if (!map.sector) return 0;
    if (!map.sector.followFov) return map.sector.angle;
    const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1;
    return horizontalFov(view.fov, aspect);
  })();

  const activeSpot = spots.find((spot) => spot.sceneId === activeSceneId);
  const selectedSpot = spots.find((spot) => spot.id === selectedSpotId);

  const controls = (
    <div className="pano-map-controls" style={{ pointerEvents: "auto" }}>
      {collapseControl ? (
        <button
          type="button"
          className="pano-map-control"
          aria-label={collapsed ? "Expand map" : "Collapse map"}
          aria-pressed={!collapsed}
          style={{
            background: "rgba(15, 23, 42, 0.92)",
            border: "1px solid rgba(255, 255, 255, 0.28)",
            color: "#f8fafc",
          }}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? "▣" : "▢"}
        </button>
      ) : null}
      {zoomControls && !collapsed ? (
        <>
          <button
            type="button"
            className="pano-map-control"
            aria-label="Zoom in"
            style={{
              background: "rgba(15, 23, 42, 0.92)",
              border: "1px solid rgba(255, 255, 255, 0.28)",
              color: "#f8fafc",
            }}
            onClick={() => applyZoom(scale * ZOOM_STEP)}
          >
            +
          </button>
          <button
            type="button"
            className="pano-map-control"
            aria-label="Zoom out"
            style={{
              background: "rgba(15, 23, 42, 0.92)",
              border: "1px solid rgba(255, 255, 255, 0.28)",
              color: "#f8fafc",
            }}
            onClick={() => applyZoom(scale / ZOOM_STEP)}
          >
            −
          </button>
        </>
      ) : null}
    </div>
  );

  const syncImageSize = (image: HTMLImageElement) => {
    if (!(image.naturalWidth > 0) || !(image.naturalHeight > 0)) return;
    setImageSize((previous) =>
      previous.width === image.naturalWidth &&
      previous.height === image.naturalHeight
        ? previous
        : { width: image.naturalWidth, height: image.naturalHeight },
    );
  };

  return (
    <div
      ref={rootRef}
      className={["pano-map", collapsed ? "pano-map-collapsed" : "", className]
        .filter(Boolean)
        .join(" ")}
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        pointerEvents: "auto",
        touchAction: gestureZoom && !collapsed ? "none" : "auto",
        ...style,
      }}
      data-pano-map=""
      data-mode={mode}
      data-collapsed={collapsed ? "true" : undefined}
    >
      {renderChrome ? renderChrome(controls) : (
        <div className="pano-map-chrome">{controls}</div>
      )}
      <div
        ref={containerRef}
        className="pano-map-viewport"
        hidden={collapsed}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          visibility: collapsed ? "hidden" : "visible",
        }}
        onPointerDown={onPointerDownSurface}
        onPointerMove={onPointerMoveSurface}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {fit.width > 0 && fit.height > 0 ? (
          <div
            className="pano-map-image-layer"
            style={{
              position: "absolute",
              left: fit.left + pan.x,
              top: fit.top + pan.y,
              width: fit.width * scale,
              height: fit.height * scale,
              transformOrigin: "0 0",
            }}
          >
            <img
              src={map.image}
              alt=""
              draggable={false}
              ref={(node) => {
                if (node) syncImageSize(node);
              }}
              onLoad={(event) => {
                syncImageSize(event.currentTarget);
              }}
              style={{
                width: "100%",
                height: "100%",
                display: "block",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          </div>
        ) : (
          <img
            src={map.image}
            alt=""
            hidden
            ref={(node) => {
              if (node) syncImageSize(node);
            }}
            onLoad={(event) => {
              syncImageSize(event.currentTarget);
            }}
          />
        )}

        {activeSpot && map.sector ? (
          <svg
            className="pano-map-sector-layer"
            width={size.width}
            height={size.height}
            style={{
              position: "absolute",
              inset: 0,
              overflow: "visible",
              pointerEvents: "none",
            }}
          >
            <g
              transform={`translate(${imagePointToContainer(activeSpot, viewport).x} ${imagePointToContainer(activeSpot, viewport).y})`}
            >
              <SectorShape
                sector={map.sector}
                angle={sectorAngle}
                rotation={sectorRotation(activeSpot.heading, view.yaw)}
                gradientId={defaultGradientId(reactId)}
                interactive={editing}
                onHeadingPointerDown={(event) => {
                  event.stopPropagation();
                  if (event.button !== 0) return;
                  onSelectedSpotIdChange?.(activeSpot.id);
                  dragRef.current = {
                    kind: "heading",
                    pointerId: event.pointerId,
                    spotId: activeSpot.id,
                  };
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
                transformRef={(node) => {
                  sectorNodeRef.current = node;
                }}
              />
            </g>
          </svg>
        ) : null}

        {spots.map((spot) => {
          const point = imagePointToContainer(spot, viewport);
          const active = spot.sceneId === activeSceneId;
          const selected = spot.id === selectedSpotId;
          return (
            <button
              key={spot.id}
              type="button"
              className="pano-map-spot"
              aria-label={spot.sceneId}
              aria-current={active ? "true" : undefined}
              data-active={active ? "true" : undefined}
              data-selected={selected ? "true" : undefined}
              style={{
                position: "absolute",
                left: point.x,
                top: point.y,
                width: iconSize,
                height: iconSize,
                transform: "translate(-50%, -50%)",
                padding: 0,
                border: selected ? "2px solid #38bdf8" : "0",
                borderRadius: 8,
                background: "transparent",
                cursor: editing ? "grab" : "pointer",
                pointerEvents: "auto",
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (event.button !== 0) return;
                onSelectedSpotIdChange?.(spot.id);
                if (!editing) return;
                const pointLocal = localPoint(event);
                if (!pointLocal) return;
                const center = imagePointToContainer(spot, viewport);
                dragRef.current = {
                  kind: "spot",
                  pointerId: event.pointerId,
                  spotId: spot.id,
                  offsetX: pointLocal.x - center.x,
                  offsetY: pointLocal.y - center.y,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (editing) return;
                onSelectScene?.(spot.sceneId, spot);
              }}
            >
              {spot.icon ? (
                <img
                  src={spot.icon}
                  alt=""
                  draggable={false}
                  style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
                />
              ) : (
                <DefaultSpotIcon active={active} size={iconSize} />
              )}
            </button>
          );
        })}

      </div>
    </div>
  );
}
