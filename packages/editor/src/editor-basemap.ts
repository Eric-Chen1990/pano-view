import type { PanoGeoMapSource } from "@ericchen1990/pano-view";

export const EDITOR_BASEMAP_PROVIDERS = ["osm", "google", "amap", "baidu"] as const;
export type EditorBasemapProvider = (typeof EDITOR_BASEMAP_PROVIDERS)[number];

/** Credentials and the selected provider for the current editor session. Never written to project.json. */
export type EditorBasemapSession = {
  provider: EditorBasemapProvider;
  mapType: "road" | "satellite";
  googleApiKey: string;
  amapApiKey: string;
  amapServiceHost: string;
  baiduAk: string;
};

export function basemapSessionFromSources(sources?: readonly PanoGeoMapSource[]): EditorBasemapSession {
  const session: EditorBasemapSession = {
    provider: "osm",
    mapType: "road",
    googleApiKey: "",
    amapApiKey: "",
    amapServiceHost: "",
    baiduAk: "",
  };
  for (const source of sources ?? []) {
    if (source.kind === "google" && source.apiKey && !session.googleApiKey) session.googleApiKey = source.apiKey;
    if (source.kind === "amap") {
      if (source.apiKey && !session.amapApiKey) session.amapApiKey = source.apiKey;
      if (source.serviceHost && !session.amapServiceHost) session.amapServiceHost = source.serviceHost;
    }
    if (source.kind === "baidu" && source.ak && !session.baiduAk) session.baiduAk = source.ak;
  }
  return session;
}

const OPEN_STREET_MAP: PanoGeoMapSource = {
  kind: "xyz",
  id: "osm",
  label: "OpenStreetMap",
  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  attributionUrl: "https://www.openstreetmap.org/copyright",
};

/** Status key when the selected provider cannot load yet. OpenStreetMap always loads. */
export function basemapBlockReason(session: EditorBasemapSession): "Missing browser key" | "Missing AMap security proxy" | undefined {
  if (session.provider === "google") return session.googleApiKey.trim() ? undefined : "Missing browser key";
  if (session.provider === "baidu") return session.baiduAk.trim() ? undefined : "Missing browser key";
  if (session.provider === "amap") {
    if (!session.amapApiKey.trim()) return "Missing browser key";
    if (!session.amapServiceHost.trim().endsWith("/_AMapService")) return "Missing AMap security proxy";
  }
  return undefined;
}

/** The basemap the editor map should load. Missing credentials return undefined and are not stored on the project. */
export function editorBasemapSource(session: EditorBasemapSession): PanoGeoMapSource | undefined {
  const satellite = session.mapType === "satellite";
  if (session.provider === "osm") return OPEN_STREET_MAP;
  if (session.provider === "google") {
    const apiKey = session.googleApiKey.trim();
    if (!apiKey) return undefined;
    return {
      kind: "google",
      id: satellite ? "google-satellite" : "google",
      label: "Google Maps",
      apiKey,
      ...(satellite ? { mapType: "satellite" as const } : {}),
    };
  }
  if (session.provider === "amap") {
    const apiKey = session.amapApiKey.trim();
    const serviceHost = session.amapServiceHost.trim();
    if (!apiKey || !serviceHost.endsWith("/_AMapService")) return undefined;
    return {
      kind: "amap",
      id: satellite ? "amap-satellite" : "amap",
      label: "AMap",
      apiKey,
      serviceHost,
      ...(satellite ? { mapType: "satellite" as const } : {}),
    };
  }
  const ak = session.baiduAk.trim();
  if (!ak) return undefined;
  return {
    kind: "baidu",
    id: satellite ? "baidu-satellite" : "baidu",
    label: "Baidu Maps",
    ak,
    ...(satellite ? { mapType: "satellite" as const } : {}),
  };
}
