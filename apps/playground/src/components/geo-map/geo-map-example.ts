import type { PanoGeoMapDefinition, PanoGeoMapSource } from "@ericchen1990/pano-view";

export const OPEN_STREET_MAP: PanoGeoMapSource = {
  kind: "xyz", id: "osm", label: "OpenStreetMap",
  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors", attributionUrl: "https://www.openstreetmap.org/copyright",
};

const env = import.meta.env;
export const GEO_MAP_SOURCES: PanoGeoMapSource[] = [OPEN_STREET_MAP];
if (env.VITE_GEO_GOOGLE_KEY) {
  GEO_MAP_SOURCES.push(
    { kind: "google", id: "google", label: "Google Maps", apiKey: env.VITE_GEO_GOOGLE_KEY },
    { kind: "google", id: "google-satellite", label: "Google · satellite", mapType: "satellite", apiKey: env.VITE_GEO_GOOGLE_KEY },
  );
}
if (env.VITE_GEO_AMAP_KEY && env.VITE_GEO_AMAP_SERVICE_HOST) {
  GEO_MAP_SOURCES.push(
    { kind: "amap", id: "amap", label: "高德地图", apiKey: env.VITE_GEO_AMAP_KEY, serviceHost: env.VITE_GEO_AMAP_SERVICE_HOST },
    { kind: "amap", id: "amap-satellite", label: "高德 · 卫星图", mapType: "satellite",
      apiKey: env.VITE_GEO_AMAP_KEY, serviceHost: env.VITE_GEO_AMAP_SERVICE_HOST },
  );
}
if (env.VITE_GEO_BAIDU_AK) {
  GEO_MAP_SOURCES.push(
    { kind: "baidu", id: "baidu", label: "百度地图", ak: env.VITE_GEO_BAIDU_AK },
    { kind: "baidu", id: "baidu-satellite", label: "百度 · 卫星图", mapType: "satellite", ak: env.VITE_GEO_BAIDU_AK },
  );
}

export const GEO_MAP: PanoGeoMapDefinition = {
  initialSourceId: "osm",
  spots: [
    { id: "entrance", sceneId: "entrance", positions: { wgs84: { lat: 37.81993, lng: -122.47831 } }, heading: 0 },
    { id: "hall", sceneId: "hall", positions: { wgs84: { lat: 37.81096, lng: -122.47709 } }, heading: 260 },
  ],
};
