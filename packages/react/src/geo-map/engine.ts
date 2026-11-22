import { isPanoGeoPosition, type PanoGeoCoordinateSystem, type PanoGeoPosition } from "../data/geo-map";

type SourceBase = { id: string; label: string };
type Style = { mapType?: "road" | "satellite" };

export type PanoGeoMapSource = SourceBase & (
  | { kind: "xyz"; urlTemplate: string; attribution: string; attributionUrl?: string; maxZoom?: number }
  | ({ kind: "google"; apiKey: string; region?: string; coordinateSystem?: "wgs84" | "gcj02" } & Style)
  | ({ kind: "amap"; apiKey: string; serviceHost: string } & Style)
  | ({ kind: "baidu"; ak: string } & Style)
);

export type Pixel = { x: number; y: number };
export type Insets = { top: number; right: number; bottom: number; left: number };
export type Camera = { center: PanoGeoPosition; zoom: number };

export type MapEngine = {
  project(point: PanoGeoPosition): Pixel | undefined;
  unproject(point: Pixel): PanoGeoPosition | undefined;
  getCamera(): Camera;
  setCamera(camera: Camera): void;
  fit(points: PanoGeoPosition[], insets: Insets): void;
  panBy(x: number, y: number): void;
  zoomBy(delta: number): void;
  resize(): void;
  setDraggable(enabled: boolean): void;
  dispose(): void;
  convert?(points: PanoGeoPosition[], from: PanoGeoCoordinateSystem): Promise<(PanoGeoPosition | undefined)[]>;
};

export type EngineEvents = {
  draw(): void;
  error(): void;
  click(position: PanoGeoPosition): void;
};

export function coordinateSystem(source: PanoGeoMapSource): PanoGeoCoordinateSystem {
  if (source.kind === "amap") return "gcj02";
  if (source.kind === "baidu") return "bd09";
  return source.kind === "google" ? source.coordinateSystem ?? "wgs84" : "wgs84";
}

export function position(lat: number, lng: number): PanoGeoPosition | undefined {
  const point = { lat, lng: ((lng + 180) % 360 + 360) % 360 - 180 };
  return isPanoGeoPosition(point) ? point : undefined;
}

export function canConvert(source: PanoGeoMapSource, from: PanoGeoCoordinateSystem): boolean {
  return source.kind === "amap" && (from === "wgs84" || from === "bd09") ||
    source.kind === "baidu" && (from === "wgs84" || from === "gcj02");
}

export function withTimeout<T>(promise: Promise<T>, milliseconds = 14000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Map request timed out")), milliseconds);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function createMapEngine(
  source: PanoGeoMapSource, container: HTMLDivElement, events: EngineEvents, signal: AbortSignal,
): Promise<MapEngine> {
  if (source.kind === "xyz") {
    const { createXyzEngine } = await import("./xyz");
    signal.throwIfAborted();
    return createXyzEngine(source, container, events);
  }
  const { createProviderEngine } = await import("./providers");
  return createProviderEngine(source, container, events, signal);
}
