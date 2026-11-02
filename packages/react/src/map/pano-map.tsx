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
  type WheelEvent as ReactWheelEvent,
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
const MAX_SCALE = 8;
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
  transformRef,
}: {
  sector: PanoMapSectorDefinition;
  angle: number;
  rotation: number;
  gradientId: string;
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
                  stopOpacity={stop.opacity ?? opacity}
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
                  stopOpacity={stop.opacity ?? opacity}
                />
              ))}
            </linearGradient>
          )}
        </defs>
      ) : null}
      <path
        d={path}
        fill={gradient ? `url(#${gradientId})` : color}
        fillOpacity={gradient ? 1 : opacity}
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
}: PanoMapProps) {
  const reactId = useId().replace(/:/g, "");
  const view = useMapView(controlledView);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectorNodeRef = useRef<SVGGElement | null>(null);
  const yawRef = useRef(view.yaw);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const spots = map.spots;
  const iconSize = map.iconSize ?? DEFAULT_ICON_SIZE;
  const interaction = map.interaction ?? "fixed";
  const gestureZoom = interaction === "zoom";
  const zoomControls = showZoomControls ?? map.controls?.zoom === true;
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

  const applyZoom = useCallback(
    (nextScale: number, origin?: { x: number; y: number }) => {
      const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
      const pivot = origin ?? { x: size.width / 2, y: size.height / 2 };
      const ratio = clamped / scale;
      const nextPan = {
        x: pivot.x - (pivot.x - (fit.left + pan.x)) * ratio - fit.left,
        y: pivot.y - (pivot.y - (fit.top + pan.y)) * ratio - fit.top,
      };
      setScale(clamped);
      setPan(clampPan(clamped, nextPan));
    },
    [clampPan, fit.left, fit.top, pan.x, pan.y, scale, size.height, size.width],
  );

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!gestureZoom || collapsed) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    applyZoom(scale * factor, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

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

    if (gestureZoom || scale > 1) {
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
            onClick={() => applyZoom(scale * ZOOM_STEP)}
          >
            +
          </button>
          <button
            type="button"
            className="pano-map-control"
            aria-label="Zoom out"
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
        onWheel={onWheel}
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

        {editing && selectedSpot && map.sector ? (() => {
          const center = imagePointToContainer(selectedSpot, viewport);
          const rotation = sectorRotation(selectedSpot.heading, view.yaw);
          const handleDistance = map.sector.radius;
          const rad = ((rotation - 90) * Math.PI) / 180;
          const handle = {
            x: center.x + Math.cos(rad) * handleDistance,
            y: center.y + Math.sin(rad) * handleDistance,
          };
          return (
            <button
              type="button"
              className="pano-map-heading-handle"
              aria-label="Adjust sector heading"
              style={{
                position: "absolute",
                left: handle.x,
                top: handle.y,
                width: 14,
                height: 14,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                border: "2px solid #38bdf8",
                background: "#0f172a",
                padding: 0,
                cursor: "grab",
                pointerEvents: "auto",
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (event.button !== 0) return;
                dragRef.current = {
                  kind: "heading",
                  pointerId: event.pointerId,
                  spotId: selectedSpot.id,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
            />
          );
        })() : null}
      </div>
    </div>
  );
}
