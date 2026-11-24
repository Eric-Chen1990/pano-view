import {
  useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore,
  type CSSProperties, type PointerEvent, type ReactNode,
} from "react";
import {
  PANO_GEO_COORDINATE_SYSTEMS,
  type PanoGeoCoordinateSystem,
  type PanoGeoMapDefinition,
  type PanoGeoMapSpot,
  type PanoGeoPosition,
} from "../data/geo-map";
import { normalizePanoYaw } from "../hotspot/position-math";
import { headingFromVector, horizontalFov } from "../map/geometry";
import { DefaultSpotIcon, SectorShape } from "../map/map-visuals";
import { ScenesHostContext, subscribeScenesHost } from "../scenes-host";
import { PanoEventBusContext } from "../pano-event-bus";
import { IDLE_SCENE_LOAD_PROGRESS, SceneLoadProgressContext } from "../scene-load-progress";
import type { PanoViewerState } from "../types";
import {
  clampCameraZoom, coordinateSystem, createMapEngine, resolveZoomLimits,
  type Camera, type MapEngine, type PanoGeoMapSource,
} from "./engine";
import { useGeoCoordinates } from "./use-geo-coordinates";

function GeoMapToolIcon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export type PanoGeoMapEdit =
  | { type: "place"; sceneId: string; coordinateSystem: PanoGeoCoordinateSystem; position: PanoGeoPosition }
  | { type: "move"; spotId: string; coordinateSystem: PanoGeoCoordinateSystem; position: PanoGeoPosition }
  | { type: "heading"; spotId: string; heading: number };

export type PanoGeoMapProps = {
  geoMap: PanoGeoMapDefinition;
  sources: readonly PanoGeoMapSource[];
  activeSceneId?: string | null;
  /** Viewer yaw of true north for the active scene. Overrides calibration inherited from Scenes. */
  northYaw?: number;
  onSelectScene?: (sceneId: string, spot: PanoGeoMapSpot) => void;
  sceneTitles?: Readonly<Record<string, string>>;
  /**
   * When to show the spot name beside each marker.
   * `"hover"` (default) shows on hover or keyboard focus; `"always"` keeps names visible.
   * Touch screens have no hover, so only `"always"` or focus shows the name.
   */
  markerLabels?: "hover" | "always";
  /** Optional camera input when the surface is mounted outside a viewer. */
  view?: PanoViewerState;
  /** Panorama viewport, in CSS pixels, for a controlled view outside a viewer. */
  viewSize?: { width: number; height: number };
  controlsLayout?: "horizontal" | "vertical";
  renderMarker?: (props: { spot: PanoGeoMapSpot; active: boolean; selected: boolean }) => ReactNode;
  selectedSpotId?: string;
  onSelectSpot?: (spotId: string) => void;
  placement?: { sceneId: string } | { spotId: string };
  onEdit?: (edit: PanoGeoMapEdit) => void;
  /** Called when the resolved basemap changes (initial selection or in-map switch). */
  onSourceChange?: (source: PanoGeoMapSource | undefined) => void;
  /** Shown instead of "No basemap configured" when no source is available. */
  emptyLabel?: string;
  translate?: (message: string) => string;
  /**
   * CSS font-family for labels, status, basemap select, and attribution.
   * Unset keeps `system-ui, sans-serif`. Map tool buttons stay on the default face.
   */
  fontFamily?: string;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_SECTOR = { angle: 70, radius: 56, followFov: true, color: "#2563eb", opacity: 0.5, strokeWidth: 1 };
const DEFAULT_VIEW = { yaw: 0, pitch: 0, fov: 75 };
const noopSubscribe = () => () => {};
const idle = () => IDLE_SCENE_LOAD_PROGRESS;
const identity = (message: string) => message;

type Drag = { id: number; spotId: string; x: number; y: number; mode: "marker" | "heading"; moved: boolean };

export function PanoGeoMap({
  geoMap, sources, activeSceneId, northYaw, onSelectScene, sceneTitles, markerLabels = "hover", view, viewSize, renderMarker, controlsLayout = geoMap.controlsLayout ?? "horizontal",
  selectedSpotId, onSelectSpot, placement, onEdit, onSourceChange, emptyLabel, translate = identity, fontFamily, style, className,
}: PanoGeoMapProps) {
  const [selectedSourceId, setSelectedSourceId] = useState<string>();
  const source = sources.find(({ id }) => id === (selectedSourceId ?? geoMap.initialSourceId)) ?? sources[0];
  const system = source && coordinateSystem(source);
  const zoomLimits = resolveZoomLimits(geoMap, source);
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const onSourceChangeRef = useRef(onSourceChange);
  onSourceChangeRef.current = onSourceChange;
  useEffect(() => {
    onSourceChangeRef.current?.(source);
  }, [source]);
  const sourceSignature = source && JSON.stringify(source);
  const zoomLimitsKey = `${zoomLimits.min}:${zoomLimits.max}`;
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<{ signature: string; attempt: number; engine?: MapEngine; failed?: boolean }>();
  const current = session?.signature === sourceSignature && session?.attempt === attempt ? session : undefined;
  const engine = current?.engine;
  const failed = current?.failed;
  const engineRef = useRef(engine);
  const failedRef = useRef(failed);
  engineRef.current = engine;
  failedRef.current = failed;
  const { resolved, pending } = useGeoCoordinates(geoMap.spots, source, engine);
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const markerNodes = useRef(new Map<string, HTMLDivElement>());
  const radar = useRef<SVGSVGElement>(null);
  const sectorNode = useRef<SVGGElement>(null);
  const cameras = useRef(new Map<string, Camera>());
  const initialized = useRef<MapEngine>(undefined);
  const lastView = useRef(DEFAULT_VIEW);
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);
  const [headingDraft, setHeadingDraft] = useState<{ spotId: string; heading: number }>();
  const gradientId = useId();
  const loadStore = useContext(SceneLoadProgressContext);
  const progress = useSyncExternalStore(loadStore?.subscribe ?? noopSubscribe, loadStore?.getSnapshot ?? idle, idle);
  const bus = useContext(PanoEventBusContext);
  const scenesHost = useContext(ScenesHostContext);
  const subscribeNorth = useCallback((listener: () => void) =>
    scenesHost ? subscribeScenesHost(scenesHost, listener) : noopSubscribe(), [scenesHost]);
  const getNorthYaw = () => activeSceneId ? scenesHost?.sceneNorthYaws?.get(activeSceneId) : undefined;
  const inheritedNorthYaw = useSyncExternalStore(subscribeNorth, getNorthYaw, getNorthYaw);
  const calibratedNorthYaw = northYaw !== undefined && Number.isFinite(northYaw) ? normalizePanoYaw(northYaw) : inheritedNorthYaw;
  const selected = onEdit ? geoMap.spots.find((spot) => spot.id === selectedSpotId && spot.sceneId === activeSceneId && resolved.has(spot.id)) : undefined;
  const active = selected ?? geoMap.spots.find((spot) => spot.sceneId === activeSceneId && resolved.has(spot.id));
  const radarSpot = progress.sceneId === null || (progress.status === "ready" && progress.sceneId === activeSceneId) ? active : undefined;
  const sector = geoMap.sector !== false ? geoMap.sector ?? DEFAULT_SECTOR : undefined;
  const heading = radarSpot && (headingDraft?.spotId === radarSpot.id ? headingDraft.heading
    : calibratedNorthYaw !== undefined ? -calibratedNorthYaw
    : radarSpot.heading ?? (selected?.id === radarSpot.id ? 0 : undefined));
  const [angle, setAngle] = useState(sector?.angle ?? 70);
  const actionRef = useRef({ placement, onEdit });
  actionRef.current = { placement, onEdit };
  const drawRef = useRef(() => {});

  drawRef.current = () => {
    if (!engine || failed) return;
    for (const [id, node] of markerNodes.current) {
      if (drag.current?.spotId === id && drag.current.mode === "marker" && drag.current.moved) continue;
      const point = resolved.get(id);
      const pixel = point && engine.project(point);
      if (pixel) node.style.transform = `translate(${pixel.x}px,${pixel.y}px)`;
      node.hidden = !pixel;
    }
    const point = radarSpot && resolved.get(radarSpot.id);
    const pixel = point && engine.project(point);
    if (radar.current) {
      if (pixel) {
        radar.current.style.left = `${pixel.x}px`;
        radar.current.style.top = `${pixel.y}px`;
      }
      radar.current.style.visibility = pixel && drag.current?.mode !== "marker" ? "" : "hidden";
    }
  };

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    // Markers and controls sit above the engine, and React's onWheel is passive.
    // A native listener has to cancel the wheel before the page can scroll.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const instance = engineRef.current;
      if (instance) initialized.current = instance;
      const host = node.querySelector(".pano-geo-map-engine");
      if (event.target instanceof Node && host?.contains(event.target)) return;
      event.stopPropagation();
      if (!instance || failedRef.current) return;
      const divisor = event.deltaMode === 1 ? 12 : 160;
      instance.zoomBy(Math.max(-1, Math.min(1, -event.deltaY / divisor)));
    };
    node.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => node.removeEventListener("wheel", onWheel, { capture: true });
  }, []);

  useEffect(() => {
    const configured = sourceRef.current;
    const root = canvas.current;
    if (!configured || !sourceSignature || !root) return;
    const host = root.ownerDocument.createElement("div");
    host.className = "pano-geo-map-engine";
    root.append(host);
    const controller = new AbortController();
    const { signal } = controller;
    let frame = 0;
    let mounted: MapEngine | undefined;
    let hasError = false;
    const draw = () => {
      if (signal.aborted || frame) return;
      frame = requestAnimationFrame(() => { frame = 0; drawRef.current(); });
    };
    const observer = new ResizeObserver(() => {
      mounted?.resize();
      draw();
    });
    observer.observe(host);
    const error = () => {
      if (!signal.aborted) {
        hasError = true;
        setSession({ signature: sourceSignature, attempt, failed: true, engine: mounted });
      }
    };
    void createMapEngine(configured, host, {
      draw, error,
      click: (position) => {
        if (!signal.aborted) {
          const { placement, onEdit } = actionRef.current;
          if (!placement || !onEdit) return;
          const common = { coordinateSystem: coordinateSystem(configured), position };
          onEdit("spotId" in placement
            ? { type: "move", ...placement, ...common }
            : { type: "place", ...placement, ...common });
        }
      },
    }, signal, zoomLimits).then((instance) => {
      if (signal.aborted) { instance.dispose(); return; }
      mounted = instance;
      setSession({ signature: sourceSignature, attempt, engine: instance, failed: hasError });
      draw();
    }).catch(error);
    return () => {
      controller.abort();
      observer.disconnect();
      cancelAnimationFrame(frame);
      if (mounted && initialized.current === mounted) {
        cameras.current.set(configured.id, mounted.getCamera());
        initialized.current = undefined;
      }
      mounted?.dispose();
      host.remove();
      drag.current = null;
    };
  }, [sourceSignature, attempt, zoomLimitsKey]);

  const framedSpots = useRef(false);
  const geolocationToken = useRef(0);
  const initialZoomApplied = useRef<number | undefined>(undefined);

  function clampZoom(zoom: number) {
    return clampCameraZoom(zoom, zoomLimits);
  }

  function overviewZoom() {
    const width = Math.max(1, canvas.current?.clientWidth ?? 240);
    const height = Math.max(1, canvas.current?.clientHeight ?? 240);
    // Zoom 2 matches a ~240px panel; larger authoring surfaces need a higher zoom.
    return clampZoom(Math.min(5, Math.max(2, 2 + Math.log2(Math.max(width, height) / 240))));
  }

  function centerFromData(): PanoGeoPosition | undefined {
    const points: PanoGeoPosition[] = [];
    for (const spot of geoMap.spots) {
      const point =
        (system && spot.positions[system]) ||
        PANO_GEO_COORDINATE_SYSTEMS.map((key) => spot.positions[key]).find(Boolean);
      if (point) points.push(point);
    }
    if (!points.length) return undefined;
    if (points.length === 1) return points[0];
    return {
      lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
      lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
    };
  }

  function setOverviewCamera(center: PanoGeoPosition, zoom: number) {
    if (!engineRef.current) return;
    engineRef.current.setCamera({ center, zoom: clampZoom(zoom) });
  }

  function openWithInitialZoom(center: PanoGeoPosition) {
    if (geoMap.initialZoom === undefined) return false;
    setOverviewCamera(center, geoMap.initialZoom);
    return true;
  }

  function frameEmpty() {
    if (!engine || !canvas.current) return;
    const fromData = centerFromData();
    if (fromData) {
      if (openWithInitialZoom(fromData)) return;
      setOverviewCamera(fromData, geoMap.spots.length === 1 ? 14 : 12);
      return;
    }

    // Contiguous US geographic center — used when spot data and geolocation are unavailable.
    const fallback = { lat: 39.8, lng: -98.5 };
    const applyFallback = () => {
      if (openWithInitialZoom(fallback)) return;
      setOverviewCamera(fallback, Math.max(overviewZoom(), 3));
    };
    if (!canvas.current.clientWidth || !canvas.current.clientHeight)
      requestAnimationFrame(applyFallback);
    else applyFallback();

    if (geoMap.initialZoom !== undefined) return;

    const geo = canvas.current.ownerDocument.defaultView?.navigator?.geolocation;
    if (!geo) return;
    const token = ++geolocationToken.current;
    const instance = engine;
    geo.getCurrentPosition(
      (position) => {
        if (
          geolocationToken.current !== token ||
          engineRef.current !== instance ||
          framedSpots.current ||
          resolved.size
        )
          return;
        // Skip if the user already panned away from the temporary overview.
        const camera = instance.getCamera();
        if (
          Math.abs(camera.center.lat - fallback.lat) > 0.5 ||
          Math.abs(camera.center.lng - fallback.lng) > 0.5
        )
          return;
        setOverviewCamera(
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          13,
        );
      },
      () => {
        /* Keep the continent overview when permission is denied or timed out. */
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 },
    );
  }

  function fit() {
    if (!engine || !canvas.current) return;
    if (!resolved.size) {
      frameEmpty();
      return;
    }
    const points = [...resolved.values()];
    if (geoMap.initialZoom !== undefined && initialized.current !== engine) {
      const center = points.length === 1
        ? points[0]
        : {
          lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
          lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
        };
      openWithInitialZoom(center);
      return;
    }
    if (points.every((point) => point.lat === points[0].lat && point.lng === points[0].lng)) {
      engine.setCamera({ center: points[0], zoom: clampZoom(16) });
    } else {
      const { clientWidth: width, clientHeight: height } = canvas.current;
      const vertical = controlsLayout === "vertical";
      engine.fit(points, {
        top: Math.min(sources.length > 1 || !vertical ? 55 : 28, height / 3),
        right: Math.min(26, width / 4),
        bottom: Math.min(28, height / 4),
        left: Math.min(vertical ? 56 : 26, width / 3),
      });
    }
  }

  useEffect(() => {
    if (!engine || failed) return;
    if (initialized.current !== engine) {
      framedSpots.current = false;
      geolocationToken.current += 1;
      const saved = source && cameras.current.get(source.id);
      if (saved) {
        engine.setCamera({
          center: saved.center,
          zoom: clampZoom(saved.zoom),
        });
        initialized.current = engine;
        framedSpots.current = true;
        initialZoomApplied.current = geoMap.initialZoom;
      } else if (resolved.size && !pending) {
        fit();
        initialized.current = engine;
        framedSpots.current = true;
        initialZoomApplied.current = geoMap.initialZoom;
      } else if (geoMap.spots.length && !resolved.size) {
        // Spot data exists but coordinates are still converting — use raw positions first.
        frameEmpty();
        initialized.current = engine;
        initialZoomApplied.current = geoMap.initialZoom;
      } else if (!pending) {
        frameEmpty();
        initialized.current = engine;
        framedSpots.current = false;
        initialZoomApplied.current = geoMap.initialZoom;
      }
    } else if (!framedSpots.current && resolved.size > 0 && !pending) {
      // First resolved spot(s): zoom to them instead of staying on the overview.
      geolocationToken.current += 1;
      if (geoMap.initialZoom !== undefined) {
        const points = [...resolved.values()];
        const center = points.length === 1
          ? points[0]
          : {
            lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
            lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
          };
        openWithInitialZoom(center);
      } else {
        fit();
      }
      framedSpots.current = true;
      initialZoomApplied.current = geoMap.initialZoom;
    }
    drawRef.current();
  });

  useEffect(() => {
    if (!engine || failed || initialized.current !== engine) return;
    if (geoMap.initialZoom === undefined) {
      initialZoomApplied.current = undefined;
      return;
    }
    if (initialZoomApplied.current === geoMap.initialZoom) return;
    initialZoomApplied.current = geoMap.initialZoom;
    const camera = engine.getCamera();
    engine.setCamera({ center: camera.center, zoom: clampZoom(geoMap.initialZoom) });
  }, [engine, failed, geoMap.initialZoom, zoomLimitsKey]);

  useEffect(() => {
    const update = (next: PanoViewerState) => {
      lastView.current = next;
      if (heading !== undefined)
        sectorNode.current?.setAttribute("transform", `rotate(${heading + next.yaw})`);
      if (sector?.followFov) {
        const aspect = viewSize?.height ? viewSize.width / viewSize.height : 1;
        setAngle(horizontalFov(next.fov, aspect));
      } else if (sector) setAngle(sector.angle);
    };
    update(view ?? lastView.current);
    if (!view) return bus?.subscribe("viewchange", update);
  }, [bus, heading, sector, view, viewSize?.height, viewSize?.width]);

  const beginDrag = (event: PointerEvent<Element>, spotId: string, mode: Drag["mode"]) => {
    event.stopPropagation();
    if (!engine || !onEdit || event.button !== 0 || !event.isPrimary) return;
    drag.current = { id: event.pointerId, spotId, x: event.clientX, y: event.clientY, mode, moved: false };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    engine.setDraggable(false);
  };
  const moveDrag = (event: PointerEvent<Element>, point?: PanoGeoPosition) => {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId || !engine || !canvas.current) return;
    const rect = canvas.current.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    gesture.moved ||= Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 4;
    if (!gesture.moved) return;
    if (gesture.mode === "marker") {
      const node = markerNodes.current.get(gesture.spotId);
      if (node) node.style.transform = `translate(${x}px,${y}px)`;
      if (radar.current) radar.current.style.visibility = "hidden";
    } else {
      const anchor = point && engine.project(point);
      if (anchor) setHeadingDraft({ spotId: gesture.spotId, heading: headingFromVector(x - anchor.x, y - anchor.y) - lastView.current.yaw });
    }
  };
  const endDrag = (event: PointerEvent<Element>, point?: PanoGeoPosition) => {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    event.stopPropagation();
    drag.current = null;
    engine?.setDraggable(true);
    suppressClick.current = gesture.moved;
    setHeadingDraft(undefined);
    if (gesture.moved && event.type === "pointerup" && engine && system && canvas.current) {
      const rect = canvas.current.getBoundingClientRect();
      const x = event.clientX - rect.left, y = event.clientY - rect.top;
      if (gesture.mode === "marker") {
        const position = engine.unproject({ x, y });
        if (position) onEdit?.({ type: "move", spotId: gesture.spotId, coordinateSystem: system, position });
      } else {
        const anchor = point && engine.project(point);
        if (anchor) {
          const bearing = headingFromVector(x - anchor.x, y - anchor.y) - lastView.current.yaw;
          onEdit?.({ type: "heading", spotId: gesture.spotId, heading: ((bearing % 360) + 360) % 360 });
        }
      }
    }
    drawRef.current();
  };

  const label = (spot: PanoGeoMapSpot) => spot.label ?? sceneTitles?.[spot.sceneId] ?? spot.sceneId;
  const select = (spot: PanoGeoMapSpot) => {
    onSelectSpot?.(spot.id);
    onSelectScene?.(spot.sceneId, spot);
  };
  const locate = (spot: PanoGeoMapSpot | undefined) => {
    const point = spot && resolved.get(spot.id);
    if (point && engine && !failed) {
      initialized.current = engine;
      engine.setCamera({
        center: point,
        zoom: clampZoom(Math.max(engine.getCamera().zoom, 15)),
      });
    }
  };

  const rootStyle: CSSProperties & Record<`--pano-geo-map-${string}`, string> = {
    ...style,
  };
  if (fontFamily) {
    rootStyle["--pano-geo-map-font-family"] = fontFamily;
  }

  return (
    <div ref={root} className={["pano-geo-map", className].filter(Boolean).join(" ")} style={rootStyle}
      data-pano-geo-map="" data-marker-labels={markerLabels}>
      <div ref={canvas} className="pano-geo-map-canvas" tabIndex={0} role="region" aria-label={translate("Map")}
        data-placement={!!placement || undefined}
        onPointerDown={() => { if (engine) initialized.current = engine; }}
        onWheel={() => { if (engine) initialized.current = engine; }}
        onKeyDown={(event) => {
          if (!engine || failed || event.target !== event.currentTarget) return;
          const nudge = { ArrowLeft: [-70, 0], ArrowUp: [0, -70], ArrowRight: [70, 0], ArrowDown: [0, 70] }[event.key];
          if (!nudge && !["+", "=", "-"].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          initialized.current = engine;
          if (nudge) engine.panBy(nudge[0], nudge[1]);
          else engine.zoomBy(event.key === "-" ? -1 : 1);
        }}
      />
      {engine && !failed ? (
        <div className="pano-geo-map-markers">
          {radarSpot && sector && heading !== undefined ? (
            <svg ref={radar} width={sector.radius * 2} height={sector.radius * 2}
              viewBox={`${-sector.radius} ${-sector.radius} ${sector.radius * 2} ${sector.radius * 2}`}
              aria-hidden="true" className="pano-geo-map-radar"
              onPointerMove={(event) => moveDrag(event, resolved.get(radarSpot.id))}
              onPointerUp={(event) => endDrag(event, resolved.get(radarSpot.id))}
              onPointerCancel={(event) => endDrag(event)}
            >
              <SectorShape sector={sector} angle={angle} rotation={heading + lastView.current.yaw} gradientId={gradientId}
                transformRef={(node) => { sectorNode.current = node; }}
                interactive={selected?.id === radarSpot.id} onHeadingPointerDown={(event) => beginDrag(event, radarSpot.id, "heading")} />
            </svg>
          ) : null}
          {geoMap.spots.filter((spot) => resolved.has(spot.id)).map((spot) => {
            const currentScene = spot.sceneId === activeSceneId;
            const selected = spot.id === selectedSpotId;
            const size = geoMap.iconSize ?? 28;
            const name = label(spot);
            return <div key={spot.id} ref={(node) => { if (node) markerNodes.current.set(spot.id, node); else markerNodes.current.delete(spot.id); }}
              className="pano-geo-map-marker" data-active={currentScene || undefined}>
              <button type="button" aria-label={name} aria-current={currentScene ? "location" : undefined}
                data-selected={selected || undefined} data-pano-geo-spot={spot.id}
                onPointerDown={(event) => beginDrag(event, spot.id, "marker")} onPointerMove={(event) => moveDrag(event)}
                onPointerUp={(event) => endDrag(event)} onPointerCancel={(event) => endDrag(event)}
                onClick={(event) => { if (!suppressClick.current || event.detail === 0) select(spot); suppressClick.current = false; }}
              >
                {renderMarker ? renderMarker({ spot, active: currentScene, selected }) : spot.icon
                  ? <img src={spot.icon} width={size} height={size} alt="" draggable={false} />
                  : <DefaultSpotIcon active={currentScene} size={size} />}
              </button>
              <span className="pano-geo-map-marker-label" aria-hidden="true">{name}</span>
            </div>;
          })}
        </div>
      ) : null}
      <div className="pano-geo-map-tools" data-layout={controlsLayout} role="group" aria-label={translate("Map controls")}>
        {engine && !failed ? <>
          <button type="button" title={translate("Zoom in")} aria-label={translate("Zoom in")} onClick={() => engine.zoomBy(1)}>
            <GeoMapToolIcon><path d="M8 3.25v9.5M3.25 8h9.5" /></GeoMapToolIcon>
          </button>
          <button type="button" title={translate("Zoom out")} aria-label={translate("Zoom out")} onClick={() => engine.zoomBy(-1)}>
            <GeoMapToolIcon><path d="M3.25 8h9.5" /></GeoMapToolIcon>
          </button>
          <button type="button" title={translate("Return to current scene")} aria-label={translate("Return to current scene")} disabled={!active} onClick={() => locate(active)}>
            <GeoMapToolIcon>
              <circle cx="8" cy="8" r="2.25" />
              <path d="M8 1.75v2.1M8 12.15v2.1M1.75 8h2.1M12.15 8h2.1" />
            </GeoMapToolIcon>
          </button>
          <button type="button" title={translate("Show all spots")} aria-label={translate("Show all spots")} disabled={!resolved.size} onClick={() => { initialized.current = engine; fit(); }}>
            <GeoMapToolIcon>
              <path d="M2.5 6V2.5H6m4 0h3.5V6m0 4v3.5H10m-4 0H2.5V10" />
              <circle cx="8" cy="8" r="1.7" />
            </GeoMapToolIcon>
          </button>
        </> : null}
      </div>
      {sources.length > 1 ? <select className="pano-geo-map-source" aria-label={translate("Basemap")} value={source?.id}
          onChange={(event) => setSelectedSourceId(event.target.value)}>
          {sources.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select> : null}
      {!source || failed || !engine ? (
        <div className="pano-geo-map-status" role="status">
          {translate(!source ? (emptyLabel ?? "No basemap configured") : failed ? "Could not load map" : "Loading map…")}
          {failed ? <button type="button" onClick={() => setAttempt((value) => value + 1)}>{translate("Retry")}</button> : null}
        </div>
      ) : null}
      {source?.kind === "xyz" ? <small className="pano-geo-map-attribution">{source.attributionUrl
        ? <a href={source.attributionUrl} target="_blank" rel="noreferrer">{source.attribution}</a>
        : source.attribution}</small> : null}
    </div>
  );
}
