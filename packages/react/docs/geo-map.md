# Online scene maps

Install `@ericchen1990/pano-view` and import its `styles.css`. Mount `PanoGeoMap` in a container with an explicit height, or mount `PanoGeoMapOverlay` inside `PanoOverlay`. In a tour, share the active scene ID with `ProjectScenes` and handle `onSelectScene`. The map stays north-up and the radar follows the panorama heading and horizontal field of view.

```tsx
import { PanoGeoMapOverlay, PanoOverlay, PanoViewer, ProjectScenes } from "@ericchen1990/pano-view";
import type { LoadedPanoProject, PanoGeoMapSource } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";
import { useState } from "react";

const sources: PanoGeoMapSource[] = [{
  kind: "xyz", id: "osm", label: "OpenStreetMap",
  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  attributionUrl: "https://www.openstreetmap.org/copyright",
}];

export function Tour({ project }: { project: LoadedPanoProject }) {
  const [sceneId, setSceneId] = useState(project.initialSceneId);
  const titles = Object.fromEntries(project.scenes.map(({ scene, title }) => [scene.id, title ?? scene.id]));
  return <PanoViewer style={{ width: "100%", height: 480 }}>
    <ProjectScenes project={project} activeSceneId={sceneId} onActiveSceneIdChange={setSceneId} />
    <PanoOverlay>
      {project.geoMap && <PanoGeoMapOverlay geoMap={project.geoMap} sources={sources}
        activeSceneId={sceneId} sceneTitles={titles} onSelectScene={setSceneId} />}
    </PanoOverlay>
  </PanoViewer>;
}
```

Save settings in the optional top-level `geoMap` field of `project.json`. `loadPanoProject` resolves point icon paths relative to the project. `controlsLayout` is `"horizontal"` by default and accepts `"vertical"`. The component prop can override the saved value. The four buttons zoom in, zoom out, center the active scene and fit all points available on the current basemap. Use a separate scene menu or list if your tour needs search or navigation when the basemap is unavailable.

```json
{
  "initialSourceId": "osm",
  "presentation": { "mode": "panel" },
  "controlsLayout": "vertical",
  "spots": [
    { "id": "deck", "sceneId": "bridge", "positions": { "wgs84": { "lat": 37.81993, "lng": -122.47831 } }, "heading": 90 }
  ]
}
```

Point names default to `spot.label`, then `sceneTitles[sceneId]`, then the scene ID. They appear above each marker on hover or keyboard focus (`markerLabels="hover"`, the default). Pass `markerLabels="always"` to keep names visible. Touch screens have no hover, so only `"always"` or focus shows the name. Set `icon` on a point, `iconSize` on the map, or use `renderMarker({ spot, active, selected })` to replace the contents of its accessible button. Set `heading` to the clockwise bearing from true north when panorama yaw is zero. Omit the heading until calibrated. Use `sector` for the same styles as a floor-plan sector, or set it to `false`.

Dialog presentation uses the shared map dialog shell. `title` is the dialog heading (default `"Online map"`). `openLabel` / `closeLabel` are the accessible names for the launcher and close buttons. Pass `launcher` or `close` as `ReactNode` to replace the button contents; omit them to keep the text label and built-in X icon.

## Basemaps

Provide the available sources as runtime props. Each source has its own stable `id` and user-facing `label`. Add two entries with distinct IDs to let users switch between road and satellite styles.

| `kind` | Runtime settings | Coordinate system |
| --- | --- | --- |
| `xyz` | `urlTemplate` with `{z}/{x}/{y}`, `attribution`, optional `attributionUrl` and `maxZoom` | WGS84, Web Mercator limits |
| `google` | Browser `apiKey`, optional `region`, `coordinateSystem`, `mapType: "road" \| "satellite"` | WGS84 by default, explicitly configure a GCJ-02 source if its coverage uses those coordinates |
| `amap` | Web `apiKey`, `serviceHost` ending in `/_AMapService`, optional `mapType` | GCJ-02 |
| `baidu` | JSAPI 4.0 browser `ak`, optional `mapType` | BD-09 |

Restrict browser keys to approved domains and APIs in each provider console. Configure the AMap security key in the host proxy using the [AMap JS API guide](https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode). The public OpenStreetMap servers are suitable for this small interactive example subject to their [tile usage policy](https://operations.osmfoundation.org/policies/tiles/). Set a tile service that meets your deployment needs.

Store explicitly placed coordinates in `positions.wgs84`, `positions.gcj02` or `positions.bd09`. The map prefers a saved position in its coordinate system. AMap can convert WGS84 or BD-09 into GCJ-02, and Baidu can convert WGS84 or GCJ-02 into BD-09. A source with no saved position or supported conversion omits that marker. In Tour Editor, select the existing marker from the sidebar and use **Set point on this basemap** to add the missing position.

In Playground, open `/geo-map`. To exercise the commercial providers locally, set the public values in the Playground environment as `VITE_GEO_GOOGLE_KEY`, `VITE_GEO_AMAP_KEY`, `VITE_GEO_AMAP_SERVICE_HOST` and `VITE_GEO_BAIDU_AK`.
