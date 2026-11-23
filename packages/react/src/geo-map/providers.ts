import type { PanoGeoPosition } from "../data/geo-map";
import {
  clampCameraZoom, position, withTimeout,
  type EngineEvents, type MapEngine, type Insets, type PanoGeoMapSource, type Pixel, type ZoomLimits,
} from "./engine";

type Geo = PanoGeoPosition;
type Pair = [number, number];
type Callback = () => void;
type Global = Window & {
  google?: { maps: Google };
  AMap?: AMap;
  BMap?: Baidu;
  BMAP_NORMAL_MAP?: unknown;
  BMAP_SATELLITE_MAP?: unknown;
  gm_authFailure?: Callback;
  _AMapSecurityConfig?: { serviceHost?: string };
};

const scripts = new WeakMap<Window, Map<string, { signature: string; ready: Promise<void> }>>();
let nextCallback = 0;

function load(
  win: Global, name: string, signature: string, url: (callback: string) => string, available: () => boolean,
): Promise<void> {
  let cache = scripts.get(win);
  if (!cache) scripts.set(win, cache = new Map());
  const previous = cache.get(name);
  if (previous) return previous.signature === signature ? previous.ready : Promise.reject(new Error("Conflicting map SDK configuration"));
  const globals = win as unknown as Record<string, unknown>;
  const callback = `__panoGeoMapReady${++nextCallback}`;
  const tag = win.document.createElement("script");
  const ready = available() ? Promise.resolve() : withTimeout(new Promise<void>((resolve, reject) => {
    globals[callback] = () => available() ? resolve() : reject(new Error("Map SDK unavailable"));
    tag.async = true;
    tag.src = url(callback);
    tag.onerror = () => reject(new Error("Map SDK request failed"));
    win.document.head.appendChild(tag);
  })).finally(() => {
    delete globals[callback];
    tag.onerror = null;
  }).catch((error: unknown) => {
    // Leave a no-op for SDKs that invoke the callback after a timed-out request.
    globals[callback] = () => {};
    tag.remove();
    cache.delete(name);
    throw error;
  });
  cache.set(name, { signature, ready });
  return ready;
}

type GoogleLatLng = { lat(): number; lng(): number };
type GoogleMap = {
  addListener(event: string, callback: (...args: never[]) => void): { remove(): void };
  getCenter(): GoogleLatLng | undefined;
  getZoom(): number | undefined;
  setCenter(center: Geo): void;
  setZoom(zoom: number): void;
  fitBounds(bounds: object, padding: Insets): void;
  panBy(x: number, y: number): void;
  setOptions(options: object): void;
};
type Google = {
  Map: new (element: HTMLElement, options: object) => GoogleMap;
  LatLng: new (lat: number, lng: number) => GoogleLatLng;
  Point: new (x: number, y: number) => Pixel;
  LatLngBounds: new () => { extend(point: Geo): void };
  OverlayView: new () => {
    onAdd: Callback; onRemove: Callback; draw: Callback;
    setMap(map: GoogleMap | null): void;
    getProjection(): {
      fromLatLngToContainerPixel(point: GoogleLatLng): Pixel | null;
      fromContainerPixelToLatLng(pixel: Pixel): GoogleLatLng | null;
    } | undefined;
  };
  event: { clearInstanceListeners(map: GoogleMap): void; trigger(map: GoogleMap, event: string): void };
};
const INITIAL = { center: { lat: 0, lng: 0 }, zoom: 2 };

function googleEngine(
  api: Google, host: HTMLDivElement, events: EngineEvents, satellite: boolean, limits: ZoomLimits,
): MapEngine {
  const map = new api.Map(host, {
    ...INITIAL, mapTypeId: satellite ? "satellite" : "roadmap", disableDefaultUI: true,
    keyboardShortcuts: false, gestureHandling: "greedy", clickableIcons: false, tilt: 0, heading: 0,
    tiltInteractionEnabled: false, headingInteractionEnabled: false,
    minZoom: limits.min, maxZoom: limits.max,
  });
  const overlay = new api.OverlayView();
  overlay.onAdd = events.draw;
  overlay.draw = events.draw;
  overlay.onRemove = () => {};
  overlay.setMap(map);
  const read = (p?: GoogleLatLng | null) => p ? position(p.lat(), p.lng()) : undefined;
  const clampZoom = (zoom: number) => clampCameraZoom(zoom, limits);
  const click = map.addListener("click", (({ latLng }: { latLng?: GoogleLatLng }) => {
    const point = read(latLng);
    if (point) events.click(point);
  }) as (...args: never[]) => void);
  return {
    project: (p) => overlay.getProjection()?.fromLatLngToContainerPixel(new api.LatLng(p.lat, p.lng)) ?? undefined,
    unproject: (p) => read(overlay.getProjection()?.fromContainerPixelToLatLng(new api.Point(p.x, p.y))),
    getCamera: () => ({
      center: read(map.getCenter()) ?? INITIAL.center,
      zoom: clampZoom(map.getZoom() ?? INITIAL.zoom),
    }),
    setCamera: ({ center, zoom }) => { map.setCenter(center); map.setZoom(clampZoom(zoom)); },
    fit: (points, insets) => {
      const bounds = new api.LatLngBounds();
      points.forEach((point) => bounds.extend(point));
      map.fitBounds(bounds, insets);
      const idle = map.addListener("idle", (() => {
        idle.remove();
        map.setZoom(clampZoom(map.getZoom() ?? INITIAL.zoom));
      }) as (...args: never[]) => void);
    },
    zoomBy: (delta) => map.setZoom(clampZoom((map.getZoom() ?? INITIAL.zoom) + delta)),
    panBy: (x, y) => map.panBy(x, y),
    resize: () => api.event.trigger(map, "resize"),
    setDraggable: (enabled) => map.setOptions({ gestureHandling: enabled ? "greedy" : "none" }),
    dispose: () => { overlay.setMap(null); click.remove(); api.event.clearInstanceListeners(map); },
  };
}

type AMapLatLng = { lng: number; lat: number };
type AMapInstance = {
  on(event: string, callback: (e: { lnglat?: AMapLatLng }) => void): void;
  off(event: string, callback: (e: { lnglat?: AMapLatLng }) => void): void;
  lngLatToContainer(point: AMapLatLng): Pixel;
  containerToLngLat(point: Pixel): AMapLatLng;
  getCenter(): AMapLatLng;
  getZoom(): number;
  setZoom(zoom: number): void;
  setZoomAndCenter(zoom: number, center: Pair, immediately?: boolean): void;
  setBounds(bounds: object, immediately?: boolean, padding?: number[]): void;
  panBy(x: number, y: number): void;
  resize?(): void;
  setStatus(options: object): void;
  destroy(): void;
};
type AMap = {
  Map: new (element: HTMLElement, options: object) => AMapInstance;
  LngLat: new (lng: number, lat: number) => AMapLatLng;
  Pixel: new (x: number, y: number) => Pixel;
  Bounds: new (sw: Pair, ne: Pair) => object;
  TileLayer: { Satellite: new () => object };
  convertFrom(points: Pair[], from: "gps" | "baidu", callback: (status: string, result: { locations?: AMapLatLng[] }) => void): void;
};
const pair = ({ lng, lat }: Geo): Pair => [lng, lat];

function amapEngine(
  api: AMap, host: HTMLDivElement, events: EngineEvents, satellite: boolean, limits: ZoomLimits,
): MapEngine {
  const clampZoom = (zoom: number) => clampCameraZoom(zoom, limits);
  const map = new api.Map(host, {
    zoom: clampZoom(INITIAL.zoom), center: pair(INITIAL.center), viewMode: "2D",
    rotateEnable: false, pitchEnable: false, keyboardEnable: false, isHotspot: false,
    zooms: [limits.min, limits.max],
    ...(satellite ? { layers: [new api.TileLayer.Satellite()] } : {}),
  });
  const read = (p: AMapLatLng) => position(p.lat, p.lng);
  const click = ({ lnglat }: { lnglat?: AMapLatLng }) => {
    const point = lnglat && read(lnglat);
    if (point) events.click(point);
  };
  const drawEvents = ["complete", "mapmove", "moveend", "zoomchange", "zoomend"];
  drawEvents.forEach((event) => map.on(event, events.draw));
  map.on("click", click);
  map.on("error", events.error);
  return {
    project: (p) => map.lngLatToContainer(new api.LngLat(p.lng, p.lat)),
    unproject: (p) => read(map.containerToLngLat(new api.Pixel(p.x, p.y))),
    getCamera: () => ({ center: read(map.getCenter()) ?? INITIAL.center, zoom: clampZoom(map.getZoom()) }),
    setCamera: ({ center, zoom }) => map.setZoomAndCenter(clampZoom(zoom), pair(center), true),
    fit: (points, insets) => {
      let south = 90, north = -90, west = 180, east = -180;
      for (const { lat, lng } of points) {
        south = Math.min(south, lat);
        north = Math.max(north, lat);
        west = Math.min(west, lng);
        east = Math.max(east, lng);
      }
      map.setBounds(new api.Bounds([west, south], [east, north]), true, [insets.top, insets.right, insets.bottom, insets.left]);
      map.setZoom(clampZoom(map.getZoom()));
    },
    zoomBy: (delta) => map.setZoom(clampZoom(map.getZoom() + delta)),
    panBy: (x, y) => map.panBy(-x, -y),
    resize: () => map.resize?.(),
    setDraggable: (enabled) => map.setStatus({ dragEnable: enabled, touchZoom: enabled }),
    dispose: () => {
      drawEvents.forEach((event) => map.off(event, events.draw));
      map.off("click", click);
      map.off("error", events.error);
      map.destroy();
    },
    convert: (points, from) => withTimeout(new Promise((resolve, reject) => {
      api.convertFrom(points.map(pair), from === "wgs84" ? "gps" : "baidu", (status, result) => {
        if (status !== "complete" || !result.locations || result.locations.length !== points.length) {
          reject(new Error("Coordinate conversion failed"));
        } else resolve(result.locations.map(read));
      });
    })),
  };
}

type BaiduMap = {
  addEventListener(event: string, callback: (e: { point?: Geo }) => void): void;
  removeEventListener(event: string, callback: (e: { point?: Geo }) => void): void;
  centerAndZoom(center: Geo, zoom: number): void;
  getCenter(): Geo;
  getZoom(): number;
  setZoom(zoom: number): void;
  setMinZoom?(zoom: number): void;
  setMaxZoom?(zoom: number): void;
  setViewport(points: Geo[], options: object): void;
  panBy(x: number, y: number, options?: object): void;
  enableDragging(): void;
  disableDragging(): void;
  enableScrollWheelZoom(): void;
  disableKeyboard?(): void;
  disableRotate?(): void;
  disableTilt?(): void;
  pointToPixel(point: Geo): Pixel;
  pixelToPoint(point: Pixel): Geo;
  destroy?(): void;
};
type Baidu = {
  Map: new (element: HTMLElement, options: object) => BaiduMap;
  Point: new (lng: number, lat: number) => Geo;
  Pixel: new (x: number, y: number) => Pixel;
  Convertor: new () => {
    translate(points: Geo[], from: number, to: number, cb: (result: { status: number; points?: Geo[] }) => void): void;
  };
};

function baiduEngine(
  api: Baidu, host: HTMLDivElement, events: EngineEvents, mapType: unknown, limits: ZoomLimits,
): MapEngine {
  const clampZoom = (zoom: number) => clampCameraZoom(zoom, limits);
  const map = new api.Map(host, { mapType, enableMapClick: false, minZoom: limits.min, maxZoom: limits.max });
  const native = (p: Geo) => new api.Point(p.lng, p.lat);
  const read = (p: Geo) => position(p.lat, p.lng);
  map.setMinZoom?.(limits.min);
  map.setMaxZoom?.(limits.max);
  map.centerAndZoom(native(INITIAL.center), clampZoom(3));
  map.enableScrollWheelZoom();
  map.disableKeyboard?.();
  map.disableRotate?.();
  map.disableTilt?.();
  const click = ({ point }: { point?: Geo }) => {
    const resolved = point && read(point);
    if (resolved) events.click(resolved);
  };
  const drawEvents = ["tilesloaded", "moving", "moveend", "zooming", "zoomend", "resize"];
  drawEvents.forEach((event) => map.addEventListener(event, events.draw));
  map.addEventListener("click", click);
  map.addEventListener("error", events.error);
  return {
    project: (p) => map.pointToPixel(native(p)),
    unproject: (p) => read(map.pixelToPoint(new api.Pixel(p.x, p.y))),
    getCamera: () => ({ center: read(map.getCenter()) ?? INITIAL.center, zoom: clampZoom(map.getZoom()) }),
    setCamera: ({ center, zoom }) => map.centerAndZoom(native(center), clampZoom(zoom)),
    fit: (points, insets) => {
      map.setViewport(points.map(native), {
        margins: [insets.top, insets.right, insets.bottom, insets.left],
        enableAnimation: false,
      });
      map.setZoom(clampZoom(map.getZoom()));
    },
    panBy: (x, y) => map.panBy(-x, -y, { noAnimation: true }),
    zoomBy: (delta) => map.setZoom(clampZoom(map.getZoom() + delta)),
    resize: events.draw,
    setDraggable: (enabled) => enabled ? map.enableDragging() : map.disableDragging(),
    dispose: () => {
      drawEvents.forEach((event) => map.removeEventListener(event, events.draw));
      map.removeEventListener("click", click);
      map.removeEventListener("error", events.error);
      map.destroy?.();
    },
    convert: (points, from) => withTimeout(new Promise((resolve, reject) => {
      new api.Convertor().translate(points.map(native), from === "wgs84" ? 1 : 3, 5, (result) => {
        if (result.status !== 0 || !result.points || result.points.length !== points.length) {
          reject(new Error("Coordinate conversion failed"));
        } else resolve(result.points.map(read));
      });
    })),
  };
}

const googleErrors = new WeakMap<Global, Set<Callback>>();
function watchGoogleAuth(win: Global, onError: Callback) {
  let listeners = googleErrors.get(win);
  if (!listeners) {
    googleErrors.set(win, listeners = new Set());
    const previous = win.gm_authFailure;
    win.gm_authFailure = () => {
      googleErrors.get(win)?.forEach((listener) => listener());
      previous?.();
    };
  }
  const active = listeners;
  active.add(onError);
  return () => active.delete(onError);
}

export async function createProviderEngine(
  source: Exclude<PanoGeoMapSource, { kind: "xyz" }>,
  host: HTMLDivElement,
  events: EngineEvents,
  signal: AbortSignal,
  limits: ZoomLimits,
): Promise<MapEngine> {
  const win = host.ownerDocument.defaultView as Global;
  const satellite = source.mapType === "satellite";
  if (source.kind === "google") {
    if (!source.apiKey) throw new Error("Missing Google Maps browser key");
    const releaseAuth = watchGoogleAuth(win, events.error);
    try {
      const query = new URLSearchParams({ key: source.apiKey, v: "quarterly", loading: "async" });
      if (source.region) query.set("region", source.region);
      await load(win, "google", query.toString(), (cb) => {
        query.set("callback", cb);
        return `https://maps.googleapis.com/maps/api/js?${query}`;
      }, () => !!win.google?.maps.Map);
      signal.throwIfAborted();
      const engine = googleEngine(win.google!.maps, host, events, satellite, limits);
      return { ...engine, dispose: () => { releaseAuth(); engine.dispose(); } };
    } catch (error) {
      releaseAuth();
      throw error;
    }
  }
  if (source.kind === "amap") {
    if (!source.apiKey || !source.serviceHost) throw new Error("Missing AMap browser key or proxy");
    if (!win.AMap && !win._AMapSecurityConfig) win._AMapSecurityConfig = { serviceHost: source.serviceHost };
    if (win._AMapSecurityConfig?.serviceHost !== source.serviceHost)
      throw new Error("Conflicting AMap proxy configuration");
    await load(win, "amap", source.apiKey, (cb) =>
      `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(source.apiKey)}&callback=${cb}`, () => !!win.AMap?.Map);
    signal.throwIfAborted();
    return amapEngine(win.AMap!, host, events, satellite, limits);
  }
  if (!source.ak) throw new Error("Missing Baidu Maps browser key");
  await load(win, "baidu", source.ak, (cb) =>
    `https://api.map.baidu.com/api?v=4.0&ak=${encodeURIComponent(source.ak)}&callback=${cb}`, () => !!win.BMap?.Map);
  signal.throwIfAborted();
  return baiduEngine(win.BMap!, host, events, satellite ? win.BMAP_SATELLITE_MAP : win.BMAP_NORMAL_MAP, limits);
}
