# @ericchen1990/pano-view · [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![npm version](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-view.svg?style=flat)](https://www.npmjs.com/package/@ericchen1990/pano-view) [![CI](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Eric-Chen1990/pano-view/pulls)

**English** | [简体中文](./README.zh-CN.md)

Composable React components for equirectangular and krpano-style multiresolution panorama viewers.

Try the components in the [live playground](https://pano-view-playground.vercel.app/?utm_source=github&utm_medium=readme&utm_campaign=package-readme&utm_content=playground).

## Contents

- [pano-converter](#pano-converter)
- [Data sources and choosing an approach](#data-sources-and-choosing-an-approach)
- [Static projects and JSON data](#static-projects-and-json-data)
- [FAQ and troubleshooting](#faq-and-troubleshooting)
- [krpano-compatible tile output](#krpano-compatible-tile-output)
- [Install](#install)
- [Examples](#examples)
- [Exported components](#exported-components)
- [PanoViewer](#panoviewer)
- [Sphere](#sphere)
- [PanoVideo](#panovideo)
- [Tile](#tile)
- [Scenes](#scenes)
- [PanoFilter](#panofilter)
- [AutoRotate](#autorotate)
- [BackgroundAudio](#backgroundaudio)
- [Gyro](#gyro)
- [WebVR](#webvr)
- [Mouse, touch, and keyboard controls](#mouse-touch-and-keyboard-controls)
- [Panorama coordinate events](#panorama-coordinate-events)
- [PanoEvents](#panoevents)
- [PanoContextMenu](#panocontextmenu)
- [Shared hotspot contract and saved definitions](#shared-hotspot-contract-and-saved-definitions)
- [ImageHotspot](#imagehotspot)
- [GraphicHotspot](#graphichotspot)
- [Hotspot mode and zoom behaviour](#hotspot-mode-and-zoom-behaviour)
- [PolygonHotspot](#polygonhotspot)
- [PolylineHotspot](#polylinehotspot)
- [SequenceHotspot](#sequencehotspot)
- [VideoHotspot](#videohotspot)
- [AudioHotspot](#audiohotspot)
- [TextHotspot](#texthotspot)
- [IframeHotspot](#iframehotspot)
- [Next.js and SSR](#nextjs-and-ssr)
- [Spherical multiresolution tiles](#spherical-multiresolution-tiles)
- [Accessibility matrices and tooltip typography](#accessibility-matrices-and-tooltip-typography)

## pano-converter

[@ericchen1990/pano-converter](../converter/README.md) is the other package in
this repository. It generates cube and equirectangular tile pyramids in
Node.js and through the `pano-convert` CLI, then returns `viewerConfig` for
[`Tile`](#tile), [`SphereTile`](#spherical-multiresolution-tiles), and
[`Scenes`](#scenes). It does not depend on React.

## Data sources and choosing an approach

The viewer accepts configuration objects or loads JSON over HTTP. It does not connect to a database: your host backend owns database connections, queries, authorization and response mapping. A database-backed API can also return JSON; the distinction is static files versus dynamically supplied configuration, not the JSON format itself. Preview images, tiles and media can use object storage/CDN with either approach.

| Consideration | Static JSON + CDN | Database + backend API |
| --- | --- | --- |
| Configuration reads | No database queries; storage, request and traffic costs still apply | Requests that reach the backend need processing and may query the database; caching can reduce that work |
| Updates | Generate and publish files, then manage entry references and caches | No static-file publication is required; freshness still depends on backend and client caches |
| Access and personalization | Public files suit public content; private delivery needs hosting/CDN access control | Backend can authorize users/organizations and return different configurations |
| Availability and maintenance | Depends on static hosting/CDN; maintain the publication and cache-update process | Depends on the API and its database/cache services; maintain queries, authorization and cache invalidation |
| Best fit | Public, published tours; infrequent updates; high read traffic | Editing previews, private content, frequent updates and personalization |

**Prefer JSON + CDN for public, published tours; prefer database + API for editing previews, private content and personalization.** If both are needed, use the database as the editing source and generate a JSON snapshot on publication. That hybrid approach needs an application-owned publication process; the package does not generate or synchronize snapshots for you.

Neither path automatically polls or subscribes to configuration changes. To update an already-open page, the host must reload the configuration and pass the new data to the viewer. An uncached API read can return current database values, but does not make an existing viewer update automatically.

### Database-backed configuration

In your backend, query and authorize the tour, then map only the intended configuration fields into a project. The application-owned `readAuthorizedTour` below performs that database read and access check; it is not a package API. Its scene records contain the compact `viewerConfig` saved from conversion, asset directories, views and hotspot definitions:

```ts
import { loadPanoProject } from "@ericchen1990/pano-view/data";
import { readAuthorizedTour } from "./tour-repository";

export async function loadTourFromDatabase(tourId: string) {
  const tour = await readAuthorizedTour(tourId);
  return loadPanoProject({
    schemaVersion: 1,
    initialSceneId: tour.initialSceneId,
    scenes: tour.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      source: {
        viewerConfig: scene.viewerConfig,
        baseUrl: scene.assetBaseUrl,
      },
      initialView: scene.initialView,
      hotspots: scene.hotspots,
    })),
  }, { baseUrl: tour.assetBaseUrl });
}
```

Object input requires `baseUrl`: here `tour.assetBaseUrl` is an absolute directory URL such as `https://cdn.example.com/tours/123/v12/`. Project-relative hotspot URLs resolve against that directory; each scene's optional `source.baseUrl` overrides its panorama tile/preview directory. With every `source.viewerConfig` inline, this call makes no project/viewer JSON requests; rendering still loads previews, tiles and media. On the server, import data helpers from `@ericchen1990/pano-view/data`.

Pass the resulting `LoadedPanoProject` to a viewer component; in Next.js, keep the viewer inside a client boundary:

```tsx
"use client";

import {
  PanoViewer, ProjectScenes, type LoadedPanoProject,
} from "@ericchen1990/pano-view";

export function DatabaseTour({ project }: { project: LoadedPanoProject }) {
  return <PanoViewer style={{ height: 600 }}>
    <ProjectScenes project={project} transition="dissolve" />
  </PanoViewer>;
}
```

Alternatively, return a `PanoProjectDefinition` from an authorized JSON endpoint and use `loadPanoProject("https://api.example.com/tours/123", { baseUrl: "https://cdn.example.com/tours/123/v12/" })`; the URL need not end in `.json`. A single scene can use `sceneFromViewerConfig` with an existing config or `loadSceneFromJson` with an API returning a `schemaVersion: 1` viewer document, then render through `Scenes`. See [Static projects and JSON data](#static-projects-and-json-data) for request options and error handling. Protect private images/media separately: JSON request credentials are not forwarded to texture requests.

### Caching and publishing updates

`project.json` (scene structure, views and hotspots), each `viewer.json` (panorama rendering configuration), and previews/tiles/media are separate cached resources. Refreshing the project alone will not refresh an unchanged scene URL or an image at the same URL. Database-backed APIs can also be cached by the backend, CDN and client, so cache policy matters for both approaches.

- **Prefer versioned directories:** publish a complete release under a new path such as `/tours/123/v12/`, including its `project.json`, scene configs and assets, before switching the page or entry reference. Version changed assets too, and retain old assets while old configurations may still be in use. Immutable versioned files can use long-lived caching; a mutable page or pointer that selects the version needs short caching or revalidation. AWS also [recommends versioned file or directory names](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/UpdatingExistingObjects.html).
- **When overwriting the same URL:** wait for its configured cache lifetime to expire, require revalidation, or invalidate the affected CDN paths after uploading. CDN invalidation does not clear files already cached in browsers; a newly configured response header cannot retroactively replace an already-fresh cached response. Versioned paths avoid depending on those copies expiring. Query strings such as `?v=12` work only if the CDN includes them in its cache key; JSON query parameters are not inherited by referenced assets.
- **Choose headers for the resource:** `Cache-Control: no-cache` permits storage but requires validation before reuse; `no-store` tells caches not to store the response. A mutable public entry can use revalidation with validators such as `ETag`, while private/user-specific API responses need an explicit policy such as `private, no-store` and must not be shared between users. Configure hosting/CDN rules to honor the intended policy. See [MDN HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching) and [Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control).

These headers and CDN operations belong to your hosting/backend setup. The loader's `requestInit` supports only `headers`, `credentials` and `signal`; it does not expose Fetch's `cache` option, invalidate CDNs or refresh an already-loaded project automatically.

## Static projects and JSON data

No database is required. The converter writes `manifest.json` for archiving/reconstruction and a small `viewer.json` for rendering. Your application authors `project.json` to connect scenes, views and hotspots. Do not pass the full manifest directly to `Scenes`.

Deploy this `project.json`, both panorama output directories and your React app as static files:

```json
{
  "schemaVersion": 1,
  "initialSceneId": "entrance",
  "scenes": [
    {
      "id": "entrance",
      "source": { "viewerUrl": "./panoramas/entrance/viewer.json" },
      "initialView": { "yaw": 0, "pitch": 0, "fov": 75 },
      "hotspots": [{
        "id": "to-hall", "type": "graphic", "label": "Enter hall",
        "position": { "yaw": 30, "pitch": -10 },
        "graphic": { "kind": "arrow" },
        "action": { "type": "scene", "sceneId": "hall" }
      }]
    },
    {
      "id": "hall",
      "source": { "viewerUrl": "./panoramas/hall/viewer.json" },
      "hotspots": [{
        "id": "caption", "type": "text",
        "position": { "yaw": 0, "pitch": 5 }, "text": "Welcome"
      }]
    }
  ]
}
```

`source` must contain exactly one of `viewerUrl` or inline `viewerConfig`; optional `baseUrl` overrides panorama assets for that scene. `title`, `initialView` and `hotspots` are optional. The first scene is the default initial scene. Scene IDs must be unique, hotspot IDs unique within a scene, and scene-action targets must exist.

`loadPanoProject` loads metadata with at most four concurrent requests and rejects the whole project if one scene fails. It does not preload every texture. Its `LoadedPanoProject` contains `initialSceneId` and `scenes`; each entry has a runtime `scene`, title, initial view and hotspots with resolved asset URLs. Pass it to `ProjectScenes`:

```tsx
import { useEffect, useState } from "react";
import {
  PanoViewer, ProjectScenes, loadPanoProject, PanoDataError,
  type LoadedPanoProject,
} from "@ericchen1990/pano-view";

export function Tour() {
  const [project, setProject] = useState<LoadedPanoProject>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject("/tour/project.json", {
      requestInit: { signal: controller.signal },
    }).then((result) => {
      if (!controller.signal.aborted) setProject(result);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof PanoDataError
          ? `${cause.code}: ${cause.message}` : String(cause));
      }
    });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Loading tour…</p>;
  return <PanoViewer style={{ height: 600 }}>
    <ProjectScenes project={project} transition="dissolve" />
  </PanoViewer>;
}
```

`ProjectScenes` belongs inside `PanoViewer` and reuses all nine existing hotspot types. A `scene` action navigates on click. Without an action, audio/video/sequence hotspots toggle playback. Media unmounts on leaving a scene and starts from its JSON settings on re-entry; browser autoplay restrictions still apply.

Configured `initialView` values apply at `onSceneReady`, defaulting missing fields to yaw 0, pitch 0, fov 75. With no view configured, the current view is retained. Hotspots hide during transitions. Control selection with `activeSceneId` / `onActiveSceneIdChange`. Call `event.preventDefault()` in `onHotspotClick` to cancel the default action. `onHotspotError` receives the scene, hotspot and original error (media errors may be events containing an `error` field). `renderHotspot(hotspot, context)` returns `undefined` for the default renderer or `null` to hide an item. Context includes `sceneId`, `playing`, `onClick`, `togglePlayback`, `reportError` and `renderDefault`.

For individual panoramas and existing configs use the pure data entry. Next.js viewer components need a client boundary; server-side data loading uses `/data`:

```ts
import {
  sceneFromViewerConfig, loadSceneFromJson, loadPanoProject,
} from "@ericchen1990/pano-view/data";

// A JSON API and a different asset/CDN origin.
const scene = await loadSceneFromJson(
  "https://api.example.com/rooms/123/viewer",
  { id: "room", baseUrl: "https://cdn.example.com/rooms/123/" },
);

// Existing Node.js conversion results need no extra JSON request.
const inlineScene = sceneFromViewerConfig(result.viewerConfig, {
  id: "room", baseUrl: "https://cdn.example.com/rooms/123/",
});

// Use source.viewerConfig instead of source.viewerUrl to inline scene data.
const project = await loadPanoProject({
  schemaVersion: 1,
  scenes: [{ id: "room", source: { viewerConfig: result.viewerConfig } }],
}, { baseUrl: "https://cdn.example.com/rooms/123/" });
```

### URLs and upload mapping

| Reference | Default base |
| --- | --- |
| Project `viewerUrl`, hotspot assets, `source.baseUrl` | Project directory |
| Tiles and preview in external `viewer.json` | That JSON directory |
| Tiles and preview in inline config | Project directory |
| Panorama with `source.baseUrl` | Specified directory |

URL inputs use the final response directory after redirects. Object inputs require `baseUrl`; it can also override the project directory. Directory trailing slashes are normalized. Domains and cloud prefixes stay outside converter JSON. Browsers accept relative entry URLs; Node.js requires absolute HTTP(S) entry URLs. Full resource URLs remain intact; leading `/` paths resolve against the resource base origin.

If uploads rename files or scatter directories, provide synchronous `resolveAssetUrl(path, context)`. Context has `defaultUrl`, `kind` (`tile`, `preview`, `hotspot`), `sceneId` and optional `hotspotId`. Return a final absolute URL or site-root path; it is not joined again. `uploadedUrls` below is application-owned:

```ts
const project = await loadPanoProject("/tour/project.json", {
  resolveAssetUrl(path, context) {
    // Map keys must distinguish scenes and, for hotspot assets, hotspot IDs.
    const key = `${context.sceneId}/${context.hotspotId ?? ""}/${path}`;
    return uploadedUrls[key] ?? context.defaultUrl;
  },
});
```

Hotspot mapping covers images, SVG image URLs, audio source arrays, video posters, playback icons and tooltip images; text, CSS and SVG path data remain unchanged. Acquire signed URLs ahead of time in your application and return them synchronously.

`requestInit` accepts only `headers`, `credentials` and `signal`, for JSON requests only. They are not forwarded to textures, and JSON query parameters are not inherited by assets. `parsePanoProject(unknown)` validates and copies project data independently. `sceneFromViewerConfig` accepts the unwrapped compact config; `loadSceneFromJson` accepts a versioned `viewer.json`.

`PanoDataError` exposes stable codes: `INVALID_OPTIONS`, `FETCH_FAILED`, `HTTP_ERROR`, `INVALID_JSON`, `INVALID_CONFIG`, `UNSUPPORTED_SCHEMA_VERSION`, `UNSUPPORTED_PROJECTION`, `INVALID_PROJECT`, `INVALID_REFERENCE`, `ABORTED`. HTTP errors carry `status`; project errors include `sceneId` and `field` where available. Successful loading means metadata is ready, not that textures have loaded; use `onSceneReady` for render readiness.

See the `/project` playground route and `public/fixtures/projects/tour/project.json` for a complete static example.

## krpano-compatible tile output

Use this package when you want a React-native viewer around equirectangular
images or an existing krpano cube-tile pyramid. Copy the krpano `<cube>` `url`
and `multires` attributes into `Tile`'s `urlTemplate` and `multires`, and copy
`<preview url>` into `previewUrl`; krpano's on-disk naming is not the same as
this package's defaults, so omitting them loads the wrong tiles or preview.
Rendering, controls, hotspots, and scene transitions stay in your React
application. This package is compatible with that tile output format but is
not affiliated with krpano.

## Install

### Package

<details name="pano-view-install" open>
<summary>npm</summary>

```bash
npm install @ericchen1990/pano-view
```

</details>
<details name="pano-view-install">
<summary>pnpm</summary>

```bash
pnpm add @ericchen1990/pano-view
```

</details>
<details name="pano-view-install">
<summary>yarn</summary>

```bash
yarn add @ericchen1990/pano-view
```

</details>
<details name="pano-view-install">
<summary>bun</summary>

```bash
bun add @ericchen1990/pano-view
```

</details>

### Peer dependencies

The **host application** must provide compatible versions of these packages.
Automatic peer-dependency installation depends on the package manager and its
settings. Install any missing peers explicitly using the ranges below.

| Package | Supported range |
| --- | --- |
| `react` | `^19.0.0` |
| `react-dom` | `^19.0.0` |
| `three` | `^0.185.1` |
| `@react-three/fiber` | `^9.7.0` |
| `@react-three/drei` | `^10.0.0` |
| `@react-three/xr` | `^6.6.0` |

Keep a **single copy** of React, Three.js, and the React Three Fiber packages
in the host app. Duplicate `three` trees are a common cause of blank canvases
and context errors (`R3F: Hooks can only be used within the Canvas component`).
If that happens, check `npm ls three`, `pnpm why three`, `yarn why three`, or
`bun pm ls` and dedupe.

### Stylesheet (HTML chrome)

Import the shipped stylesheet once in the host app. The WebGL panorama
(`PanoViewer`, `Sphere`, `Tile`, 3D hotspots) renders without it. Built-in
**HTML** overlays depend on its prefixed `pano-*` classes for layout.

Those overlays include video controls, captions, the default context menu,
hotspot tooltips, controls for assistive technology, and WebVR session UI.

```ts
import "@ericchen1990/pano-view/styles.css";
```

Or from CSS:

```css
@import "@ericchen1990/pano-view/styles.css";
```

Skip this import only if you do not use those overlays, or if you restyle
them entirely through `className`, `style`, and appearance props. Without
the stylesheet, the overlays still mount, but they render unstyled.

## Examples

Give PanoViewer an explicit size and render one panorama source inside it.
Import the stylesheet once when you use built-in HTML overlays such as video
controls, captions, tooltips, the context menu, or WebVR UI. Each example
below shows a basic setup; the linked section has the full props.

### Equirectangular image

~~~tsx
import "@ericchen1990/pano-view/styles.css";
import { PanoViewer, Sphere } from "@ericchen1990/pano-view";

export function Panorama() {
  return (
    <PanoViewer style={{ height: 560 }}>
      <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
    </PanoViewer>
  );
}
~~~

`previewUrl` must be a low-resolution 2:1 image shown while the full image
loads. See [Sphere](#sphere).

### Cube tiles

Copy `url`, `multires`, and the preview path from krpano XML. Read the
[migration guide](../../docs/krpano-migration.md) before replacing Sphere with
Tile.

~~~tsx
import { PanoViewer, Tile } from "@ericchen1990/pano-view";

export function TilePanorama() {
  return (
    <PanoViewer style={{ height: 560 }}>
      <Tile
        baseUrl="/panoramas/room"
        urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
        multires="512,1000,2000"
        previewUrl="preview.jpg"
      />
    </PanoViewer>
  );
}
~~~

Placeholders and preview face order are in [Tile](#tile).

### 360 video

~~~tsx
import { PanoViewer, PanoVideo } from "@ericchen1990/pano-view";

export function TourVideo() {
  return (
    <PanoViewer style={{ height: 560 }}>
      <PanoVideo autoPlay muted src="/tour.mp4" />
    </PanoViewer>
  );
}
~~~

Variants, captions, and custom controls are in [PanoVideo](#panovideo).

### Multiple scenes

~~~tsx
import { useState } from "react";
import { PanoViewer, Scenes, type Scene } from "@ericchen1990/pano-view";

const scenes: Scene[] = [
  { id: "lobby", type: "sphere", src: "/lobby.webp", previewUrl: "/lobby-preview.webp" },
  { id: "roof", type: "sphere", src: "/roof.webp", previewUrl: "/roof-preview.webp" },
];

export function Tour() {
  const [activeSceneId, setActiveSceneId] = useState("lobby");

  return (
    <PanoViewer style={{ height: 560 }}>
      <Scenes
        activeSceneId={activeSceneId}
        onActiveSceneIdChange={setActiveSceneId}
        scenes={scenes}
        transition="dissolve"
      />
    </PanoViewer>
  );
}
~~~

Presets and hotspot rendering are in [Scenes](#scenes).

## Exported components

### Viewer

- [`PanoViewer`](#panoviewer) — canvas shell, camera, default controls, and imperative view API
- [`Sphere`](#sphere) — single 2:1 equirectangular image
- [`SphereTile`](#spherical-multiresolution-tiles) — multiresolution equirectangular tiles
- [`PanoVideo`](#panovideo) — 2:1 equirectangular video on the panorama sphere
- [`Tile`](#tile) — krpano-style multires cube tiles
- [`Scenes`](#scenes) — multi-scene switching in controlled or uncontrolled mode
- [`BackgroundAudio`](#backgroundaudio) — one shared track, or a different track per scene
- [`PanoFilter`](#panofilter) — color and artistic filters on the panorama source

### Controls

- [`MouseControls`](#mousecontrols) — drag look and wheel zoom
- [`TouchControls`](#touchcontrols) — one-finger drag and pinch zoom
- [`KeyboardControls`](#keyboardcontrols) — arrow-key look, FOV, and scene cycling
- [`AutoRotate`](#autorotate) — automatic yaw rotation
- [`Gyro`](#gyro) — opt-in device-orientation control
- [`WebVR`](#webvr) — WebXR-first immersive VR with MobileVR fallback

### Events and chrome

- [`PanoEvents`](#panoevents) — viewer-level lifecycle and interaction callbacks
- [`PanoContextMenu`](#panocontextmenu) — right-click reset / fullscreen menu
- [`PanoVideoControls`](#panovideo) — playback chrome for `PanoVideo` (mounted by default)

### Hotspots

- [`ImageHotspot`](#imagehotspot) — image texture at a spherical position
- [`GraphicHotspot`](#graphichotspot) — built-in shapes or SVG at a position
- [`SequenceHotspot`](#sequencehotspot) — sprite-sheet animation
- [`VideoHotspot`](#videohotspot) — HTML video texture
- [`AudioHotspot`](#audiohotspot) — directional sound at a spherical position
- [`TextHotspot`](#texthotspot) — rasterized plain text at a position
- [`IframeHotspot`](#iframehotspot) — embedded document overlay at a position
- [`PolygonHotspot`](#polygonhotspot) — closed spherical area
- [`PolylineHotspot`](#polylinehotspot) — open spherical path

### Hooks and helpers

- `usePanoViewer` — wrap the viewer ref in reusable parent-side commands
- `usePanoEvents` — subscribe to viewer events inside a custom child ([`PanoEvents`](#panoevents))
- Coordinate helpers — `normalizePanoPosition`, `normalizePanoYaw`, `clampPanoPitch`, `panoPositionToVector3`, `vector3ToPanoPosition` ([Panorama coordinate events](#panorama-coordinate-events))
- `cycleSceneId` — wrap previous/next scene ids ([`KeyboardControls`](#keyboardcontrols))
- Context menu helpers — `createPanoContextMenuPresets`, `composePanoContextMenuItems`, and related APIs ([`PanoContextMenu`](#panocontextmenu))
- Polygon / polyline validation — `validatePolygonVertices`, `validatePolylineVertices`, `unwrapPolygonVertices`

## PanoViewer

`PanoViewer` owns the canvas, perspective camera, and controls. Give its container an explicit size and place one panorama source inside it.

Angles in the public API are measured in degrees. Positive yaw looks right and positive pitch looks up.

```tsx
import "@ericchen1990/pano-view/styles.css";
import {
  PanoViewer,
  Sphere,
  AutoRotate,
  usePanoViewer,
} from "@ericchen1990/pano-view";

export function ControlledExample() {
  const viewer = usePanoViewer();

  return (
    <>
      <button onClick={() => viewer.setView({ yaw: 90, fov: 55 })}>
        Look right
      </button>
      <button onClick={() => void viewer.lookTo({ yaw: -45, pitch: 8 })}>
        Animate left
      </button>
      <PanoViewer
        ref={viewer.ref}
        controls={{
          inertia: true,
          rotateDamping: 14,
          zoomDamping: 16,
        }}
        initialView={{ yaw: 0, pitch: 0, fov: 75 }}
        minFov={30}
        maxFov={100}
        onViewChange={(view) => console.log(view)}
        style={{ height: 560 }}
      >
        <AutoRotate enabled speed={18} acceleration={18} startDelay={1_000} />
        <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
      </PanoViewer>
    </>
  );
}
```

The handle exposes view, fullscreen, scene, VR, video, and background-audio controls so custom UIs can drive the viewer from a single ref:

**View** — `getView`, `setView`, `reset`, `lookTo`, `moveTo`, `zoomTo`, `lookToHotspot`.

`setView` and `reset` remain immediate. The navigation methods return a Promise
with `{ status: "completed" | "cancelled" | "not-found" }`; each new navigation
or user interaction cancels the previous one. They default to 700 ms with
`easeInOutCubic` and take the shortest yaw path. `lookTo` and `lookToHotspot`
preserve the current FOV unless `fov` is provided.

```tsx
const result = await viewer.lookToHotspot("visitor-guide", { fov: 55 });

if (result.status === "not-found") {
  // The hotspot is not mounted in this PanoViewer.
}

await viewer.moveTo({ yaw: 170, pitch: 0 }, { shortestPath: false });
await viewer.zoomTo(48, { duration: 400, easing: "linear" });
```

Every mounted hotspot type can be targeted, including polygons and polylines,
which use their spherical center. Hotspot ids must be unique within a viewer.

**Fullscreen** — `enterFullscreen`, `exitFullscreen`, `toggleFullscreen`, `isFullscreen`.

**Scenes** (requires `<Scenes />`) — `setScene(id)`, `nextScene`, `previousScene`, `getActiveSceneId`, `getSceneIds`, `isSceneTransitioning`. `Scenes` accepts `defaultActiveSceneId` (uncontrolled) or `activeSceneId` (controlled). In controlled mode imperative calls invoke `onActiveSceneIdChange`.

**WebVR** (requires `<WebVR />`) — `enterVR`, `exitVR`, `toggleVR`, `isVRAvailable`, `isVREnabled`, `getVRMode`, `requestVRPermission`.

**Video** (requires `<PanoVideo />`) — `getVideo` returns the `PanoVideoController`, `subscribeVideo` subscribes to video controller and playback-state changes, plus convenience aliases `playVideo`, `pauseVideo`, `toggleVideo`, `seekVideo`, `setVideoVolume`, `setVideoMuted`, `toggleVideoMuted`.

**Background Audio** (requires `<BackgroundAudio />`) — `getBackgroundAudio` returns the `BackgroundAudioController`, `subscribeBackgroundAudio` subscribes to background-audio controller and playback-state changes, plus convenience aliases `playBackgroundAudio`, `pauseBackgroundAudio`, `toggleBackgroundAudio`, `setBackgroundAudioVolume`, `setBackgroundAudioMuted`, `toggleBackgroundAudioMuted`. `BackgroundAudio` accepts `playing` (controlled) or `defaultPlaying` (uncontrolled).

### Mobile media activation

By default, when a child has an initial playback intent (`PanoVideo autoPlay`, an active `BackgroundAudio`, `VideoHotspot`, or `AudioHotspot`), the viewer silently unlocks audible playback on the first user gesture when the browser requires one, or immediately when autoplay policy already allows it. Muted video can still preview inline. The same gesture resumes Web Audio and gives the host the final choice of which media becomes audible, so video, music, and positional sound never all start by assumption. Pass `mediaActivation={false}` to retain the 2.x no-automatic-activation behavior.

```tsx
<PanoViewer
  mediaActivation={{
    onActivate: (media) => {
      // Do not await: start audible media in this gesture's synchronous stack.
      void media.playVideo({ unmute: true });
    },
  }}
  style={{ height: "min(560px, 68dvh)" }}
>
  <PanoVideo autoPlay src="/tour.mp4" />
</PanoViewer>
```

The `media` argument provides `resumeAudio()`, `playVideo({ unmute })`, and `playBackgroundAudio()`. Controlled background audio remains host-owned: update its `playing` state from this callback. `viewer.activateMedia()` lets a custom control reuse the same path.

Methods that depend on an unmounted child component (e.g. `enterVR` without `<WebVR />`) perform no action and return `false`, `undefined`, `null`, or a corresponding Promise, depending on the method.

### Fullscreen

```tsx
import { PanoViewer, Sphere, usePanoViewer } from "@ericchen1990/pano-view";

function FullscreenExample() {
  const viewer = usePanoViewer();

  return (
    <>
      <button onClick={() => void viewer.enterFullscreen()}>Enter fullscreen</button>
      <button onClick={() => void viewer.exitFullscreen()}>Exit fullscreen</button>
      <button onClick={() => console.log(viewer.isFullscreen())}>Is fullscreen?</button>
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
      </PanoViewer>
    </>
  );
}
```

### Imperative scene switching

Use `usePanoViewer()` to shorten parent-side commands to `viewer.setScene("roof")`. Keep using controlled `activeSceneId` when the host UI needs to render the current scene id reactively. For uncontrolled mode, `defaultActiveSceneId` still lets imperative calls update the internal state directly.

```tsx
import { useState } from "react";
import {
  PanoViewer,
  Scenes,
  usePanoViewer,
  type Scene,
} from "@ericchen1990/pano-view";

const scenes: Scene[] = [
  { id: "lobby", type: "sphere", src: "/lobby.webp", previewUrl: "/lobby-preview.webp" },
  { id: "roof",  type: "sphere", src: "/roof.webp",  previewUrl: "/roof-preview.webp" },
];

function SceneExample() {
  const viewer = usePanoViewer();
  const [activeSceneId, setActiveSceneId] = useState("lobby");

  return (
    <>
      <button onClick={() => setActiveSceneId("roof")}>Go to roof</button>
      <button onClick={() => viewer.nextScene()}>Next</button>
      <button onClick={() => viewer.previousScene()}>Previous</button>
      <button onClick={() => viewer.setScene("roof")}>Jump via hook</button>
      <p>Current: {activeSceneId}</p>
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <Scenes
          activeSceneId={activeSceneId}
          onActiveSceneIdChange={setActiveSceneId}
          scenes={scenes}
          transition="dissolve"
        />
      </PanoViewer>
    </>
  );
}
```

### WebVR

`enterVR` and `requestVRPermission` must be called from a user gesture.

```tsx
import { PanoViewer, Sphere, WebVR, usePanoViewer } from "@ericchen1990/pano-view";

function VRExample() {
  const viewer = usePanoViewer();

  return (
    <>
      <button
        onClick={async () => {
          await viewer.requestVRPermission();
          await viewer.enterVR();
        }}
      >
        Enter VR
      </button>
      <button onClick={() => void viewer.exitVR()}>Exit VR</button>
      <button onClick={() => console.log(viewer.getVRMode())}>Mode?</button>
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <WebVR />
        <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
      </PanoViewer>
    </>
  );
}
```

### Custom video controls

Set `controls={false}` on `PanoVideo` and drive playback from `usePanoViewer()`. Use `subscribeVideo` with `useSyncExternalStore` for reactive snapshots.

```tsx
import { useSyncExternalStore } from "react";
import {
  PanoViewer,
  PanoVideo,
  usePanoViewer,
} from "@ericchen1990/pano-view";

function VideoExample() {
  const viewer = usePanoViewer();

  const snapshot = useSyncExternalStore(
    viewer.subscribeVideo,
    () => viewer.getVideo()?.getSnapshot() ?? null,
    () => null,
  );

  return (
    <>
      <button onClick={() => void viewer.toggleVideo()}>
        {snapshot?.playing ? "Pause" : "Play"}
      </button>
      <button onClick={() => viewer.toggleVideoMuted()}>
        {snapshot?.muted ? "Unmute" : "Mute"}
      </button>
      {snapshot && (
        <input
          type="range"
          min={0}
          max={snapshot.duration}
          value={snapshot.currentTime}
          onChange={(e) => viewer.seekVideo(Number(e.target.value))}
        />
      )}
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <PanoVideo controls={false} src="/tour.mp4" />
      </PanoViewer>
    </>
  );
}
```

### Custom background audio controls

`BackgroundAudio` supports uncontrolled mode — omit `playing` and use `defaultPlaying` instead. Drive it from `usePanoViewer()`.

```tsx
import { useSyncExternalStore } from "react";
import {
  PanoViewer,
  Sphere,
  BackgroundAudio,
  usePanoViewer,
} from "@ericchen1990/pano-view";

function BGMExample() {
  const viewer = usePanoViewer();

  const snapshot = useSyncExternalStore(
    viewer.subscribeBackgroundAudio,
    () => viewer.getBackgroundAudio()?.getSnapshot() ?? null,
    () => null,
  );

  return (
    <>
      <button onClick={() => viewer.toggleBackgroundAudio()}>
        {snapshot?.playing ? "Pause BGM" : "Play BGM"}
      </button>
      <button onClick={() => viewer.toggleBackgroundAudioMuted()}>
        {snapshot?.muted ? "Unmute" : "Mute"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={snapshot?.volume ?? 1}
        onChange={(e) => viewer.setBackgroundAudioVolume(Number(e.target.value))}
      />
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <BackgroundAudio defaultPlaying src="/bgm.mp3" />
        <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
      </PanoViewer>
    </>
  );
}
```

### All-in-one example

```tsx
import {
  PanoViewer,
  Scenes,
  WebVR,
  PanoVideo,
  BackgroundAudio,
  usePanoViewer,
} from "@ericchen1990/pano-view";

function TourPlayer() {
  const viewer = usePanoViewer();

  return (
    <>
      <nav>
        <button onClick={() => viewer.previousScene()}>← Prev</button>
        <button onClick={() => viewer.nextScene()}>Next →</button>
        <button onClick={() => void viewer.toggleFullscreen()}>Fullscreen</button>
        <button onClick={() => void viewer.enterVR()}>Enter VR</button>
        <button onClick={() => viewer.toggleBackgroundAudio()}>BGM</button>
      </nav>
      <PanoViewer ref={viewer.ref} style={{ height: "100vh" }}>
        <WebVR />
        <BackgroundAudio defaultPlaying src="/bgm.mp3" />
        <Scenes defaultActiveSceneId="lobby" scenes={scenes} transition="dissolve" />
      </PanoViewer>
    </>
  );
}
```

The two deprecated auto-rotation handle methods (`startAutoRotate`, `stopAutoRotate`) remain for compatibility. Mouse, touch, and keyboard input are enabled by default — you do not need to render control components for ordinary viewing. Render `MouseControls`, `TouchControls`, or `KeyboardControls` only to override properties (the child replaces that channel's default instance). Tune shared behaviour through `controls` (`inertia`, `invert`, `bouncingLimits`, `fovSpeed`, `frictionStop`, `rotateDamping`, `zoomDamping`, and top-level `rotateSpeed` / `zoomSpeed`). Disable a channel with `controls.mouse` / `touch` / `keyboard` set to `false`, or pass an options object (including `enabled`) to override defaults without mounting a child. Auto-rotation is off until you render `AutoRotate`. A default context menu (Reset view / Enter fullscreen) is also mounted — see [`PanoContextMenu`](#panocontextmenu).

Drag and zoom update a target view that the camera follows smoothly. `rotateDamping` and `zoomDamping` control that following speed in seconds^-1 (defaults: `14` and `16` respectively); smaller positive values make the camera approach the target more gradually, while `0` disables smoothing for that axis. Both values must be non-negative finite numbers. Imperative `setView()` and `reset()` remain immediate.

The canvas cursor defaults to `grab`, becomes `grabbing` while dragging with the mouse, `pointer` over an interactive hotspot, and `move` while dragging a hotspot. Override those values with `cursors` (`default`, `dragging`, `hotspot`, `hotspotDragging`), or pass `cursors={false}` to leave the canvas cursor unchanged. A hotspot may set `cursor` to replace the hover cursor for that hotspot only.

```tsx
<PanoViewer
  cursors={{ default: "grab", dragging: "grabbing", hotspot: "pointer" }}
  style={{ height: 560 }}
>
  <ImageHotspot
    id="door"
    cursor="zoom-in"
    position={{ yaw: 24, pitch: -6 }}
    src="/hotspots/door.webp"
  />
</PanoViewer>
```

## Sphere

`Sphere` expects a 2:1 equirectangular image. Use `yawOffset` when the source's forward direction needs horizontal adjustment.

`Sphere` loads the complete `src` image as one texture. High-resolution images
increase download, decoding, and GPU texture memory costs. Exceeding a device's
texture-size or memory limits can cause loading failures or WebGL context loss;
memory exhaustion can also crash the page. The current spherical renderer may
still show visible artifacts near the top and bottom poles.

Prefer cube tiles ([`Tile`](#tile)) for high-resolution panoramas, generated
with [@ericchen1990/pano-converter](../converter/README.md). The viewer loads
required tile levels by view, avoiding one oversized texture. For existing
equirectangular tiles, use [`SphereTile`](#spherical-multiresolution-tiles).

`previewUrl` is required and shows a low-resolution 2:1 image while `src` loads.
Provide a small preview to reduce download, decoding, and texture memory costs
for the initial display.
Relative paths resolve against the directory of `src`; root-absolute and
`http(s)` URLs are used as-is. For krpano sphere scenes, copy
[`<preview url>`](https://krpano.com/docu/xml/#preview) into `previewUrl`. That
preview must be equirectangular, not a cube strip.

```tsx
"use client";

import { PanoViewer, Sphere } from "@ericchen1990/pano-view";

export function SphereExample() {
  return (
    <PanoViewer style={{ width: "100%", height: 560 }}>
      <Sphere
        src="/panoramas/room.webp"
        previewUrl="preview.webp"
      />
    </PanoViewer>
  );
}
```

## PanoVideo

`PanoVideo` maps a 2:1 equirectangular video onto the same inward sphere as
`Sphere`. Pass one `src`, or `variants` with multiple files per quality so the
browser can pick mp4 / webm and the control bar can switch resolution. Changing
quality keeps the current time and play/pause state.

A default playback bar is mounted on the viewer overlay: play/pause, seek, time,
volume, speed, resolution, captions, and fullscreen. Volume is a hover (or tap)
vertical slider when the browser allows `HTMLMediaElement.volume`; iOS Safari
only exposes mute. The speed menu lists rates the current element accepts. The
captions menu also includes a settings panel for subtitle font size and
background opacity. When the viewer is narrow, speed, quality, and captions
move into a More menu.
Pass `controls={false}` to hide it, an appearance object to restyle the default
instance, or render `PanoVideoControls` as a `PanoViewer` child to replace that
instance.

Captions use WebVTT `tracks`. The video element is mounted inside the viewer as a
transparent 1×1-pixel node; cue text is rendered in a screen-space overlay. `captions={false}` hides the overlay and the language
menu; an object merges with the default appearance (`color`, `background`,
`fontSize`, `fontFamily`, `textShadow`, `padding`, `borderRadius`, `maxWidth`,
`bottom`). Those values act as the initial caption appearance; viewers can still
adjust subtitle size and background from the default control-bar menu at
runtime.

```tsx
"use client";

import { PanoViewer, PanoVideo } from "@ericchen1990/pano-view";

export function VideoExample() {
  return (
    <PanoViewer style={{ width: "100%", height: 560 }}>
      <PanoVideo
        defaultVariantId="1024"
        variants={[
          {
            id: "1024",
            label: "1024p",
            poster: "/video/1024-poster.jpg",
            sources: [
              { src: "/video/1024.mp4", type: "video/mp4" },
              { src: "/video/1024.webm", type: "video/webm" },
            ],
          },
          {
            id: "1920",
            label: "1920p",
            poster: "/video/1920-poster.jpg",
            sources: [
              { src: "/video/1920.mp4", type: "video/mp4" },
              { src: "/video/1920.webm", type: "video/webm" },
            ],
          },
        ]}
        tracks={[
          { src: "/video/en.vtt", srcLang: "en", label: "English", default: true },
          { src: "/video/zh.vtt", srcLang: "zh", label: "中文" },
        ]}
        captions={{ fontSize: 16, color: "#fff" }}
        muted
      />
    </PanoViewer>
  );
}
```

`muted` defaults to `true` for better autoplay compatibility; playback
remains subject to browser policy. `playsInline` also defaults to true and writes `playsinline`,
`webkit-playsinline`, and the X5 `h5-page` attributes, to request playback
within the page on iPhone Safari and in WeChat, QQ, and UC. Actual behavior
depends on the browser and its version. Picture-in-picture and
remote playback stay disabled so the element can keep feeding the sphere
texture. The element is mounted inside the viewer at 1×1px. Unmuted playback
may require a user gesture; `onPlaybackStateChange` receives `"blocked"` when `play()` is
rejected. Remote videos and VTT files that are not same-origin should set
`crossOrigin` (usually `"anonymous"`). For mobile delivery, provide an H.264 +
AAC MP4 fallback, poster, CORS, and Range support.

## Tile

`Tile` renders six inward-facing cube faces and loads only tiles around the current view. When `urlTemplate` is omitted, paths relative to `baseUrl` use this package default:

```text
tiles/%s/l%l/%v/l%l_%s_%h_%v.webp
```

which expands to `tiles/{face}/l{level}/{row}/l{level}_{face}_{col}_{row}.webp`. Faces are `f`, `r`, `b`, `l`, `u`, and `d`; rows and columns are 1-based.

```tsx
import { PanoViewer, Tile } from "@ericchen1990/pano-view";

export function TileExample() {
  return (
    <PanoViewer style={{ width: "100%", height: 560 }}>
      <Tile
        baseUrl="https://cdn.example.com/panoramas/room"
        multires="512,500,1000,2000"
        previewUrl="previews/cube-vertical.webp"
      />
    </PanoViewer>
  );
}
```

krpano cube-tile output does not follow that default. Read `url`, `multires`,
and the preview path from the krpano XML
([`<cube>`](https://krpano.com/docu/xml/#image.cube),
[`<preview>`](https://krpano.com/docu/xml/#preview)) and pass them through. If
those values are missing or do not match the files on disk, tiles resolve to
the wrong face, level, or row/column and the panorama looks scrambled.

| krpano | `Tile` / `TileScene` prop |
|---|---|
| `<cube url>` | `urlTemplate` |
| `<cube multires>` | `multires` |
| `<preview url>` | `previewUrl` |
| `<preview striporder>` | `previewFaceOrder` |

`Sphere` uses the same `<preview url>` → `previewUrl` mapping; that file must be a 2:1 equirectangular image, not a cube strip.

krpano's documented short syntax:

```xml
<preview url="preview.jpg" />
<image>
  <cube url="pano_%s_%l_%v_%h.jpg"
        multires="512,1024,2048,4096"
  />
</image>
```

maps to:

```tsx
<Tile
  baseUrl="/panoramas/room"
  urlTemplate="pano_%s_%l_%v_%h.jpg"
  multires="512,1024,2048,4096"
  previewUrl="preview.jpg"
/>
```

A MAKE PANO (MULTIRES) folder layout is often
`tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg` with `preview.jpg` at the scene root. That
filename is `%v_%h` (row then column). This package's default tile template is
`%h_%v` (column then row). Copy the XML values instead of assuming the two
conventions match.

The first `multires` value is the tile size. Remaining values are ascending cube-face sizes for `l1`, `l2`, and later levels. `previewUrl` is required. Relative paths resolve against `baseUrl`; root-absolute and `http(s)` URLs are used as-is. A typical krpano MAKE PANO (MULTIRES) scene looks like this:

```tsx
<Tile
  baseUrl="/panoramas/room"
  urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
  multires="512,1000,2000"
  previewUrl="preview.jpg"
  previewFaceOrder={["l", "f", "r", "b", "u", "d"]}
/>
```

`previewFaceOrder` must list all six face codes in the preview atlas's actual top-to-bottom order. The default is `l`, `f`, `r`, `b`, `u`, `d`. The preview image is a vertical 1×6 cubestrip. krpano `thumb.jpg` is a small thumbnail and is not this atlas.

During rapid rotation or zoom, loaded tiles remain visible while newly visible tiles use their parent level or the preview as a local fallback.

For layouts that are not krpano XML, override the default with a placeholder
template or a resolver. Both accept paths relative to `baseUrl` or absolute URLs:

```tsx
<Tile
  baseUrl="/panoramas/room"
  multires={{ tileSize: 512, levels: [500, 1000, 2000] }}
  previewUrl="previews/cube-vertical.webp"
  urlTemplate="assets/%s/%l/%v_%h.webp"
  resolveTileUrl={({ face, level, row, col }) =>
    `api/tile/${face}/${level}/${row}/${col}`
  }
/>
```

`resolveTileUrl` takes precedence over `urlTemplate`.

For krpano cube-tile templates, `%s` is the cube face and `%l` is the multires
level. Horizontal tile indices support the equivalent `%h`, `%x`, `%u`, and
`%c` placeholders; vertical tile indices support `%v`, `%y`, `%w`, and `%r`.
Prefix an index placeholder with zeroes for padding: `%0h` produces a two-digit
horizontal index and `%00v` produces a three-digit vertical index. The stereo
`%t` and frame `%f` placeholders are not applicable to `Tile`, which represents
a single non-stereo cube panorama.

## Scenes

`Scenes` switches between single-image equirectangular, cube-tile, and
equirectangular-tile scenes in controlled or uncontrolled mode. Transitions blend
a GPU framebuffer snapshot with the incoming scene. The incoming scene stays hidden while it loads its preview; tiled scenes also
load the lowest-resolution tiles around the view. Once the scene can be drawn, the current framebuffer becomes a temporary GPU
texture and the outgoing source textures are released. The incoming scene then switches to
full detail immediately: tiles that are already sharp replace the preview during the blend,
and tiles that are still loading keep the coarser parent tile or the preview. The incoming scene starts loading detail tiles after the outgoing scene is
released. Tile selection includes the current view and a small surrounding margin.

```tsx
import {
  Scenes,
  PanoViewer,
  type Scene,
} from "@ericchen1990/pano-view";

const scenes: Scene[] = [
  { id: "lobby", type: "sphere", src: "/panoramas/lobby.webp", previewUrl: "preview.webp" },
  {
    id: "terrace",
    type: "tile",
    baseUrl: "/panoramas/terrace",
    multires: "512,1000,2000",
    urlTemplate: "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
    previewUrl: "previews/cube-vertical.webp",
  },
];

<PanoViewer style={{ height: 560 }}>
  <Scenes
    scenes={scenes}
    activeSceneId={activeSceneId}
    transition="ellipticZoomOpen"
    renderHotspots={(scene) => <SceneHotspots sceneId={scene.id} />}
    onTransitionError={({ sceneId }) => console.warn("Could not load", sceneId)}
  />
</PanoViewer>;
```

Available krpano-style presets are `none`, `crossfade`, `zoom`, `blackout`,
`whiteFlash`, `slideRightToLeft`, `slideTopToBottom`, `slideDiagonal`,
`circleOpen`, `verticalOpen`, `horizontalOpen`, and `ellipticZoomOpen`.
Grid presets are `pixelate`, `gridWipe`, `gridWipeUp`, `gridWipeRight`,
`gridWipeDiagonal`, `gridWipeCenter`, `gridWipeChecker`, and `hexDissolve`.
Cinematic presets are `dissolve`, `shatter`, `particles`, `glitch`, `swirl`,
`clockWipe`, `ripple`, `zoomBlur`, and `filmBurn`. All of them still blend a
GPU framebuffer snapshot over the incoming panorama; they do not mix two full
360 textures. Pass `{ preset: "crossfade", duration: 0.6 }` to override a
preset duration.

`transitionWaitForDetailMs` defaults to `0`. The blend starts as soon as the incoming
scene can paint, and detail keeps loading during that blend. A positive value such as
`200` starts only after the outgoing snapshot is stored and the incoming scene is in
`full`. The blend starts early when the current view is already sharp, and otherwise
waits at most that many milliseconds. This wait is timed separately from the blend
duration. During the wait the outgoing snapshot stays fully visible while the incoming
scene draws and uploads underneath. For a normal `Sphere`, sharp means the full image
can be drawn. For cube and sphere tiles, sharp means every in-view tile at the level
chosen from viewport size, device pixel ratio, field of view, and the existing memory
budget can be drawn. Tiles outside the view are not required. Negative and non-finite
values are treated as `0`. `transition="none"` uses the same condition and then cuts
over directly. A new target, an interrupt, unmount, or a lost WebGL context cancels a
pending wait so a stale readiness report cannot affect the next scene.

`onReady` means a source can be drawn for the first time. `onSceneReady` fires
for the first paintable scene and when an incoming scene takes over after the outgoing
snapshot. It does not mean the current view's full detail has finished loading.

While a detail wait or transition runs, panorama drag/zoom input is locked and
`renderHotspots` is hidden. New `activeSceneId` values supersede a target that
is still being prepared. `maxTextureMemoryMb` and `maxConcurrentTileLoads`
apply to the whole `Scenes` viewer rather than to each tile scene.

## PanoFilter

Render `PanoFilter` inside `PanoViewer` to color-grade or stylize the panorama
source (`Sphere`, `Tile`, `SphereTile`, and `PanoVideo`). Built-in presets affect
only panorama materials. `colorMatrix` defaults to the panorama; set
`colorMatrixScope="all"` to include hotspot textures. DOM overlays such as
tooltips, video controls, and iframes are unaffected. WebXR / MobileVR use the
same panorama shader and inherit its filter appearance.

`intensity` mixes the filtered result with the original image (`0`–`1`,
default `1`). Omit the component or set `enabled={false}` to disable all filtering.
`preset="none"` disables only the built-in preset; a configured `colorMatrix`
still applies.

```tsx
<PanoViewer style={{ height: 560 }}>
  <PanoFilter preset="pencil" intensity={0.85} />
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
  <ImageHotspot
    id="door"
    position={{ yaw: 24, pitch: -6 }}
    src="/hotspots/door.webp"
  />
</PanoViewer>
```

| Preset | Look |
|---|---|
| `none` | Identity (no filter) |
| `grayscale` | Rec.709 black and white |
| `sepia` | Warm brown antique print |
| `vintage` | Faded film with grain |
| `cool` / `warm` | Blue or amber temperature shift |
| `pencil` | Graphite sketch on paper |
| `coloredPencil` | Tinted pencil lines |
| `crayon` | Posterized wax strokes |
| `watercolor` | Soft pigment on paper |
| `cartoon` | Cel shading with outlines |
| `crosshatch` | Luminance hatching |

Built-in artistic looks use screen-space edges and world-space grain so cube
tiles do not show filter seams. Scene-transition snapshots capture the filtered
panorama when a filter is active.

## AutoRotate

Auto-rotation is off by default. Render `AutoRotate` inside `PanoViewer` to enable it and keep rotation configuration separate from user-input controls. `speed` is measured in degrees per second; use a negative value to rotate left. `acceleration` is measured in degrees per second squared and smoothly ramps from zero to `speed` (default: `18`, so the default speed takes one second to reach). Set it to `0` for an immediate fixed speed. `startDelay` is measured in milliseconds from when `enabled` becomes true. While the user is dragging, or while drag inertia is still settling, rotation pauses and resumes from zero speed automatically.

```tsx
<PanoViewer style={{ height: 560 }}>
  <AutoRotate enabled speed={12} acceleration={6} startDelay={2_000} />
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

## BackgroundAudio

`BackgroundAudio` plays background music or ambience for the viewer. It is not
a hotspot: there is no spherical position, no marker, and volume does not
follow the camera. Render it as a child of `PanoViewer`, **alongside** `Scenes`,
`Sphere`, or `Tile`. Do not put it in `Scenes`' `renderHotspots` — hotspots
unmount during scene transitions and would stop the audio.

When `playing` is provided, the host controls playback. Otherwise the component
uses internal state initialized by `defaultPlaying` (default `false`). `loop`
defaults to `true`. If the browser blocks autoplay, `onPlaybackStateChange`
receives `"blocked"`. The component retries `play()` after the next click or
keypress while playback is still requested.

Pick one of the two patterns.

**One track for every scene** — pass `src` only; omit `sources`. Scene changes
do not restart the audio.

```tsx
import { BackgroundAudio, PanoViewer, Scenes } from "@ericchen1990/pano-view";

<PanoViewer style={{ height: 560 }}>
  <BackgroundAudio src="/bgm/tour.mp3" playing={isBgmPlaying} />
  <Scenes scenes={scenes} activeSceneId={activeSceneId} />
</PanoViewer>;
```

**A different track per scene** — pass `sources` (keys are `Scene.id`) and the
current `sceneId`. Omitting `sceneId` throws. When the file changes, playback
crossfades over `fadeMs` (default 400 ms; `0` is a hard cut). When two scenes
point at the same file, playback continues without restarting.

```tsx
<PanoViewer style={{ height: 560 }}>
  <BackgroundAudio
    sources={{
      lobby: "/bgm/lobby.mp3",
      terrace: "/bgm/terrace.mp3",
    }}
    sceneId={activeSceneId}
    playing={isBgmPlaying}
  />
  <Scenes scenes={scenes} activeSceneId={activeSceneId} />
</PanoViewer>;
```

Optional: also pass `src` as the default for scenes missing from `sources`. To
silence a scene, set that id to `""` (this overrides `src`; it does not fall
back to the default track).

```tsx
<BackgroundAudio
  src="/bgm/default.mp3"
  sources={{ lobby: "/bgm/courtyard.mp3", terrace: "" }}
  sceneId={activeSceneId}
  playing={isBgmPlaying}
/>;
```

In that example, `lobby` plays the courtyard clip, `terrace` is silent, and
every other scene plays `default.mp3`.

For a sound attached to a point in the panorama that pans with the view, use
`AudioHotspot`, not `BackgroundAudio`.

## Gyro

`Gyro` is an opt-in device-orientation control and is disabled by default.
Render it inside `PanoViewer` and control its `enabled` prop. Relative mode
(the default) treats the view at activation time as the starting direction.
Set `absolute` to follow compass-oriented headings and use `north` to identify
the panorama yaw that points North.

```tsx
import { useRef, useState } from "react";
import {
  Gyro,
  PanoViewer,
  Sphere,
  type GyroHandle,
} from "@ericchen1990/pano-view";

export function GyroExample() {
  const gyroRef = useRef<GyroHandle>(null);
  const [enabled, setEnabled] = useState(false);

  const toggle = async () => {
    if (enabled) {
      setEnabled(false);
      return;
    }
    // iOS requires this call to run directly inside a user gesture.
    setEnabled((await gyroRef.current?.requestPermission()) ?? false);
  };

  return (
    <>
      <button onClick={() => void toggle()}>
        {enabled ? "Disable gyro" : "Enable gyro"}
      </button>
      <PanoViewer style={{ height: 560 }}>
        <Gyro
          ref={gyroRef}
          enabled={enabled}
          camroll
          friction={0}
          softstart={0.5}
          touchMode="full"
          onDenied={() => setEnabled(false)}
        />
        <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
      </PanoViewer>
    </>
  );
}
```

`camroll` (default `true`) levels the camera from device roll. `friction`
accepts `0` to `0.99`; higher values smooth more strongly but add latency.
`softstart` is the activation blend duration in seconds (default `0.5`).
`desktopSupport` defaults to `false` because desktop browsers can expose the
API without a physical sensor.

`touchMode` controls how touch drag combines with device movement:

- `off` ignores touch yaw/pitch while leaving pinch FOV available.
- `horizontaloffset` adds only a horizontal offset.
- `full` adds horizontal and vertical offsets; the vertical offset returns
  toward the physical orientation as the device moves.
- `disablegyro` disables the active gyro session on the next touch.

The `GyroHandle` exposes `resetSensor(yaw?, pitch?)`, `isAvailable()`,
`isEnabled()`, and `requestPermission()`. Gyro activity pauses `AutoRotate`
and counts as viewer interaction for idle tracking. Sensor APIs generally
require HTTPS. A cross-origin iframe must be permitted by the host page, for
example with `allow="gyroscope; accelerometer"` and a compatible
`Permissions-Policy` header.

## WebVR

`WebVR` adds immersive viewing to the nearest `PanoViewer`. It prefers an
`immersive-vr` WebXR session on supported headsets. On phones without WebXR it
uses a stereoscopic split-screen view with device orientation, and on desktop
it can provide a mouse-driven simulated VR preview. The built-in chrome includes
Enter VR, Exit VR, and MobileVR setup controls.

```tsx
import { useRef } from "react";
import {
  PanoViewer,
  Sphere,
  WebVR,
  type WebVRHandle,
} from "@ericchen1990/pano-view";

export function WebVRExample() {
  const webVRRef = useRef<WebVRHandle>(null);

  return (
    <PanoViewer style={{ height: 560 }}>
      <WebVR
        ref={webVRRef}
        chrome
        fakeSupport
        mobileVr
        onEnterVR={(mode) => console.log("Entered", mode)}
      />
      <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
    </PanoViewer>
  );
}
```

The handle exposes `enterVR()`, `exitVR()`, `toggleVR()`, `isAvailable()`,
`isEnabled()`, `getMode()`, and `requestPermission()`. Modes are `"webxr"`,
`"mobilevr"`, and `"fake"`. `profile` accepts `"none"`, `"cardboard-v1"`,
`"cardboard-v2"`, `"gear-vr"`, `"daydream"`, or a custom
`{ fov, ipdMm, k1, k2 }` lens profile. MobileVR setup values are versioned and
stored in the current origin's `localStorage`. In VR, a center reticle shows a
crosshair; looking at an interactive hotspot draws a clockwise ring that fills
over `cursorDwellMs` (default 1500), then the hotspot click handler runs. Set
`cursorDwellMs={0}` to keep the reticle without auto-click. Simulated desktop
VR (`fake` mode) requests pointer lock by default (`mousePointerLock`) so the
cursor hides and mouse movement looks around; click the view again if the
browser releases the lock. Fallback sessions keep the screen awake
(`wakelock`) with the Screen Wake Lock API, or a looping hidden video on
browsers that lack it.

WebXR requires HTTPS and a user gesture. Mobile sensor access also requires
HTTPS and may require an explicit iOS permission prompt. Embedded viewers need
appropriate `xr-spatial-tracking`, `gyroscope`, and `accelerometer` permissions.
DOM overlays such as iframe hotspots, tooltips, and video controls are not
visible inside an immersive headset session; mesh-based hotspots remain
interactive through the default WebXR controller rays.

## Mouse, touch, and keyboard controls

`PanoViewer` enables `MouseControls`, `TouchControls`, and `KeyboardControls` by default. Configure shared options through `controls`; render a control component only to override that channel's properties. A child instance replaces the default — you do not need to set the channel to `false` first. Set `controls.mouse` / `touch` / `keyboard` to `false` to turn a channel off.

```tsx
<PanoViewer
  controls={{
    invert: false,
    bouncingLimits: false,
    mouse: { zoomSpeed: 0.12, wheel: true, buttons: ["left"] },
    touch: { pinchZoom: true },
    keyboard: { enabled: true, rotateSpeed: 90 },
  }}
  style={{ height: 560 }}
>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

**Mouse** (pointer types `mouse` / `pen`): drag look and optional wheel zoom. Defaults: `rotateSpeed` `0.35`, `zoomSpeed` `0.08`, `wheel` `true`, `buttons` `["left"]`.

### MouseControls

See the defaults above. Override through `controls.mouse` or by rendering `<MouseControls />` as a child.

### TouchControls

One-finger drag and optional two-finger pinch zoom (`pinchZoom`, default `true`). Override through `controls.touch` or by rendering `<TouchControls />` as a child.

### KeyboardControls

Hold arrows (or custom bindings) for continuous look / FOV; `0` resets; optional scene bindings. Defaults: `rotateSpeed` `60`, `zoomSpeed` `30`, `shiftMultiplier` `3`. Set `invert` to flip up/down only. Override through `controls.keyboard` or by rendering `<KeyboardControls />` as a child.

Shared all-mode options on `controls`: `enabled`, `invert` (drag direction for mouse/touch), `bouncingLimits`, `fovSpeed`, `frictionStop` (default `0.01`), plus existing damping / inertia.

### Overriding a control channel

Render the component with the props you need. The default instance for that channel is skipped:

```tsx
import { useState } from "react";
import {
  KeyboardControls,
  Scenes,
  PanoViewer,
  cycleSceneId,
  type Scene,
} from "@ericchen1990/pano-view";

export function KeyboardExample({ scenes }: { scenes: Scene[] }) {
  const [activeSceneId, setActiveSceneId] = useState(scenes[0]!.id);

  return (
    <PanoViewer style={{ height: 560 }}>
      <KeyboardControls
        keys={{
          left: ["ArrowLeft", "a"],
          right: ["ArrowRight", "d"],
          up: ["ArrowUp", "w"],
          down: ["ArrowDown", "s"],
          zoomIn: ["=", "+"],
          zoomOut: ["-", "_"],
          previousScene: ["[", "PageUp"],
          nextScene: ["]", "PageDown"],
        }}
        rotateSpeed={60}
        zoomSpeed={30}
        onPreviousScene={() => {
          const next = cycleSceneId(scenes, activeSceneId, -1);
          if (next) setActiveSceneId(next);
        }}
        onNextScene={() => {
          const next = cycleSceneId(scenes, activeSceneId, 1);
          if (next) setActiveSceneId(next);
        }}
      />
      <Scenes scenes={scenes} activeSceneId={activeSceneId} />
    </PanoViewer>
  );
}
```

Hold movement and zoom keys for continuous motion in degrees per second (`rotateSpeed` / `zoomSpeed`). Hold Shift to multiply those rates (`shiftMultiplier`, default `3`). Scene and reset bindings fire once per press. The canvas must be focused to receive keys (click the viewer first).

Default bindings: arrows and WASD for look, `+/-` for FOV, `0` for reset, plus `[`/`PageUp` and `]`/`PageDown` for previous/next scene when callbacks are provided. The same child-override pattern works with `MouseControls` and `TouchControls`. Set `controls.mouse={false}` / `controls.touch={false}` / `controls.keyboard={false}` only when you want that channel off.

## Panorama coordinate events

Use the panorama pointer callbacks when an authoring UI needs the spherical
position under the cursor. Event positions use the same public degree
convention as the camera: positive yaw looks right and positive pitch looks up.

```tsx
import {
  PanoViewer,
  Sphere,
  panoPositionToVector3,
  type HotspotPosition,
} from "@ericchen1990/pano-view";

export function PlacementExample() {
  const place = (position: HotspotPosition) => {
    const worldPosition = panoPositionToVector3(position, 10);
    console.log(position, worldPosition);
  };

  return (
    <PanoViewer
      onPanoramaClick={({ position }) => place(position)}
      onPanoramaDoubleClick={({ position }) => console.log("double", position)}
      onPanoramaPointerMove={({ position }) => console.log("move", position)}
      style={{ height: 560 }}
    >
      <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
    </PanoViewer>
  );
}
```

`normalizePanoPosition`, `normalizePanoYaw`, `clampPanoPitch`, and
`vector3ToPanoPosition` are also exported for controlled authoring flows. Yaw
is normalized to `[-180, 180)`. Pitch is clamped to `[-90, 90]`; at either
pole, yaw is normalized to `0` because it does not identify a unique point.

## PanoEvents

`PanoEvents` is the React counterpart to krpano's global `<events>` element.
Render one or more instances inside `PanoViewer` to subscribe to viewer-level
lifecycle and interaction callbacks. Multiple instances coexist (like named
krpano events); each tracks its own `idleTime`. For composition inside a custom
child, use `usePanoEvents` instead.

### usePanoEvents

```tsx
import {
  AutoRotate,
  PanoEvents,
  PanoViewer,
  Sphere,
} from "@ericchen1990/pano-view";

<PanoViewer style={{ height: 560 }}>
  <PanoEvents
    idleTime={3000}
    onIdle={() => console.log("idle")}
    onIdleEnd={() => console.log("active again")}
    onViewSettled={(view) => console.log("settled", view)}
    onViewInteractionStart={({ source }) => console.log("drag", source)}
    onClick={({ position }) => console.log("pano click", position)}
    onEnterFullscreen={() => console.log("fullscreen")}
    onAutoRotateOneRound={() => console.log("full turn")}
  />
  <AutoRotate enabled />
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>;
```

Supported callbacks (krpano names in parentheses where applicable):

- View: `onViewChange` (`onviewchange`), `onViewSettled`, `onViewInteractionStart` / `onViewInteractionEnd`
- Pointer on the panorama shell (not hotspots): `onClick`, `onDoubleClick`, `onPointerDown`, `onPointerUp`, `onPointerMove`, `onContextMenu`
- `onWheel` — mouse wheel only; touch pinch does not synthesize a wheel event
- Idle: `onIdle` / `onIdleEnd` with per-instance `idleTime` (ms, default `2000`)
- Fullscreen: `onEnterFullscreen` / `onExitFullscreen`
- `onResize` — canvas content-box size via `ResizeObserver`
- Auto-rotate: `onAutoRotateStart` / `onAutoRotateStop` / `onAutoRotateOneRound`
- Gyro: `onGyroAvailable` / `onGyroUnavailable` / `onGyroEnable` /
  `onGyroDisable` / `onGyroDenied`

`PanoViewer`'s existing `onViewChange` / `onPanoramaClick` / `onPanoramaDoubleClick` /
`onPanoramaPointerMove` props remain supported and share the same event bus.

Resource callbacks belong to each source: `Sphere` provides `onLoad`,
`onError`, and `onPreviewError`; `Tile` / `SphereTile` provide `onLoadProgress`,
`onTileError`, and `onPreviewError`. Sources report initial render readiness
through `onReady`. Use `Scenes` callbacks `onSceneReady`, `onTransitionEnd`,
and `onTransitionError` for scene state. This package does not provide a
one-to-one mapping of krpano XML-loading, VR, or frame-render events.

## PanoContextMenu

`PanoViewer` always suppresses the browser's native context menu on the
viewer (canvas, chrome, and other overlays). It also mounts a default
context menu on right-click. Default items: **Reset view** and **Enter
fullscreen** / **Exit fullscreen** (label and icon follow the current
fullscreen state), with a separator between them.

```tsx
<PanoViewer style={{ height: 560 }}>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

Disable the default menu (the native browser menu stays suppressed; mount
your own `PanoContextMenu` if you still want a custom menu):

```tsx
<PanoViewer contextMenu={false}>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

Tune appearance while keeping the default items:

```tsx
<PanoViewer contextMenu={{ appearance: { opacity: 0.92, borderRadius: 8 } }}>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

### Adding items without rebuilding defaults

Use `append` or `prepend` to keep the built-in Reset / Fullscreen entries and
only add your own:

```tsx
<PanoViewer
  contextMenu={{
    append: [
      "separator",
      {
        id: "copy",
        label: "Copy yaw / pitch",
        onSelect: ({ position }) => {
          void navigator.clipboard.writeText(
            `${position.yaw.toFixed(1)}, ${position.pitch.toFixed(1)}`,
          );
        },
      },
    ],
  }}
  style={{ height: 560 }}
>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

### Built-in presets

When you need a custom order, reuse built-in presets by id instead of
reimplementing fullscreen enter/exit state:

- `"resetView"` — resets the view
- `"fullscreen"` — Enter / Exit fullscreen with the matching icon
- `"separator"` — a horizontal rule

```tsx
<PanoViewer
  contextMenu={{
    items: [
      "resetView",
      "separator",
      {
        id: "copy",
        label: "Copy yaw / pitch",
        onSelect: ({ position }) => {
          void navigator.clipboard.writeText(
            `${position.yaw.toFixed(1)}, ${position.pitch.toFixed(1)}`,
          );
        },
      },
      "separator",
      "fullscreen",
    ],
  }}
  style={{ height: 560 }}
>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

Override presentation on a preset with `{ preset: "fullscreen", label: "…" }`.
For fully manual assembly outside the prop (for example a custom
`PanoContextMenu` child), call `createPanoContextMenuPresets({ reset,
toggleFullscreen, isFullscreen })` and use `.resetView` / `.fullscreen` /
`.defaults`.

Concrete items may use an `icon` React node or an `image` URL. Separators
always come from the `"separator"` preset. Appearance covers background, text
color, border, radius, shadow, background-only `opacity` (clamped from
`MIN_PANO_CONTEXT_MENU_BACKGROUND_OPACITY` / `0.4` to `1`; labels and icons
stay opaque), hover/disabled colors, and icon size. For an explicit translucent
fill without using `opacity`, you can still pass `background: "rgba(...)"`.

For a fully custom DOM menu, set `contextMenu={false}` and render
`PanoContextMenu` as a child. Do not mount both the default menu and a child
`PanoContextMenu` at once. Avoid combining the context menu with
`controls.mouse.buttons: ["right"]` — both claim the right mouse button.

## Shared hotspot contract and saved definitions

Every hotspot has an `id`, optional `visible`, `interactive`, `pointerEvents`,
`renderOrder`, and semantic interaction callbacks. Point hotspots additionally
use a controlled `position`, angular `width`/`height`, hotspot mode, and the
zoom options described below. `interactive={false}` keeps a hotspot visible
while letting a drawing tool receive the panorama pointer events beneath it.
`pointerEvents="none"` ignores mouse, touch, and pen so those events pass
through to the panorama even when the hotspot stays keyboard-interactive.
Interactive hotspots set the canvas cursor to `pointer` while hovered, or to
the hotspot's `cursor` prop when that is set.

```tsx
<TextHotspot
  id="caption"
  pointerEvents="none"
  position={{ yaw: 12, pitch: -8 }}
  text="Decorative label"
/>
```

`onClick` and `onHoverChange` receive a position and input source (`"pointer"`
or `"keyboard"`). Point hotspots can use `draggable`, `onDragStart`,
`onPositionChange`, and `onDragEnd`; the host must write the reported position
back to its state. Polygon and polyline hotspots report the corresponding
controlled `vertices` through `onVerticesChange`.

Every hotspot can show a DOM tooltip at its anchor. Pass a string or
`{ text?, image?, imageAlt? }` as `tooltip`. The default `tooltipTrigger` is
`"always"`: if content is present and the hotspot is visible, the bubble stays
on screen. Clicking the hotspot does not toggle it. Optional
`tooltipTrigger="hover"` shows the bubble on pointer hover or keyboard focus;
`"click"` pins it until the hotspot is clicked again or the empty panorama is
clicked. Hover and click triggers need `interactive` and `pointerEvents`
other than `"none"`.

`tooltipPlacement` is `"top"` (default), `"bottom"`, `"left"`, or `"right"`.
These are screen directions: the bubble sits outside the hotspot's projected
screen bounds on that edge, so rotated graphics such as arrows are not covered.
`tooltipOffset` is the screen-space gap in CSS pixels (default `12` /
`DEFAULT_HOTSPOT_TOOLTIP_OFFSET`).

Optional `tooltipAppearance` overrides the bubble paint. Unset fields keep the
library default theme (`DEFAULT_HOTSPOT_TOOLTIP_APPEARANCE`): background, text
color, border, corner radius, shadow, padding, and font size.

```tsx
<ImageHotspot
  id="gallery"
  ariaLabel="Open gallery"
  position={{ yaw: 28, pitch: -4 }}
  src="/hotspots/gallery.webp"
  tooltip={{ text: "Courtyard gallery", image: "/hotspots/gallery-thumb.webp" }}
  tooltipPlacement="top"
  tooltipOffset={16}
  tooltipAppearance={{
    background: "rgba(12, 28, 36, 0.88)",
    color: "#e7f2f5",
    border: "1px solid rgba(56, 84, 91, 0.9)",
    borderRadius: 10,
    shadow: "0 10px 28px rgba(0, 0, 0, 0.42)",
    padding: 10,
    fontSize: 13,
  }}
/>
```

For a hover-triggered tooltip:

```tsx
<GraphicHotspot
  id="marker"
  ariaLabel="Signal"
  position={{ yaw: -18, pitch: 9 }}
  graphic={{ kind: "ring" }}
  tooltip="Hover for details"
  tooltipTrigger="hover"
  tooltipPlacement="right"
/>
```

For persistence or a host-owned editor, use the exported discriminated
`HotspotDefinition` union. Render each variant according to `type`; an exhaustive
`switch` must cover every hotspot category in the union:

```ts
import type { HotspotDefinition } from "@ericchen1990/pano-view";

const hotspots: HotspotDefinition[] = [
  { type: "image", id: "gallery", position: { yaw: 24, pitch: -5 }, src: "/hotspots/card.webp" },
  { type: "graphic", id: "marker", position: { yaw: -18, pitch: 9 }, graphic: { kind: "ring" } },
  { type: "sequence", id: "pulse", position: { yaw: -42, pitch: -7 }, src: "/hotspots/pulse.png", frameCount: 20 },
  { type: "video", id: "clip", position: { yaw: 48, pitch: 6 }, src: "/hotspots/clip.webm" },
  { type: "audio", id: "fountain", position: { yaw: -30, pitch: -8 }, src: "/hotspots/fountain.mp3", range: 90 },
  { type: "text", id: "caption", position: { yaw: 0, pitch: -16 }, text: "Courtyard overlook" },
  { type: "iframe", id: "guide", position: { yaw: -62, pitch: 4 }, src: "/hotspots/embed.html" },
  { type: "polygon", id: "zone", vertices: [{ yaw: 12, pitch: 4 }, { yaw: 22, pitch: 4 }, { yaw: 18, pitch: 14 }] },
  { type: "polyline", id: "route", vertices: [{ yaw: -8, pitch: 1 }, { yaw: 4, pitch: 8 }] },
];
```

Definitions intentionally contain data only. Render them with a switch in the
host, where application-specific click actions, controlled media state, and
error reporting belong.

## ImageHotspot

`ImageHotspot` renders an image at a controlled spherical position. Dimensions
are angular degrees, so they remain independent of the canvas resolution.

```tsx
import { ImageHotspot, PanoViewer, Sphere } from "@ericchen1990/pano-view";

<PanoViewer style={{ height: 560 }}>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
  <ImageHotspot
    id="gallery"
    ariaLabel="Open gallery"
    position={{ yaw: 28, pitch: -4 }}
    width={18}
    height={10}
    mode="surface"
    src="/hotspots/gallery.webp"
    onClick={({ position }) => console.log("gallery", position)}
  />
</PanoViewer>;
```

Set `draggable` and update the controlled position from `onPositionChange` to
move a selected hotspot. Clickable hotspots need `ariaLabel`: PanoViewer creates
an internal semantic control for Tab, Enter, and Space activation, with a
visible WebGL focus outline.

`ImageHotspot` calls `onLoad(texture)` and `onError(error)`.

## GraphicHotspot

`GraphicHotspot` accepts built-in `circle`, `triangle`, `diamond`, `star`,
`arrow`, `rectangle`, and `ring` graphics, an SVG URL, or safe SVG path data
with an explicit viewBox. Built-in graphics support `fill`, `stroke`, and
`strokeWidth`; rectangles support a relative `cornerRadius` from `0` to `0.5`,
and rings support `innerRadius`.

```tsx
import { GraphicHotspot } from "@ericchen1990/pano-view";

<GraphicHotspot
  id="wayfinding"
  ariaLabel="Open wayfinding point"
  position={{ yaw: -18, pitch: 9 }}
  width={8}
  height={8}
  graphic={{
    kind: "ring",
    fill: "#df6b42",
    stroke: "#f5fbfc",
    strokeWidth: 8,
    innerRadius: 0.64,
  }}
  onClick={({ position }) => console.log("wayfinding", position)}
/>
```

Triangle, diamond, star, and arrow graphics use the same paint properties. The
triangle and arrow point upward at `rotation={0}`; use the hotspot's `rotation`
property to orient them in another direction.

```tsx
<GraphicHotspot
  id="direction"
  ariaLabel="Open next scene"
  position={{ yaw: 8, pitch: 2 }}
  rotation={45}
  width={8}
  height={8}
  graphic={{
    kind: "arrow",
    fill: "#df6b42",
    stroke: "#f5fbfc",
    strokeWidth: 8,
  }}
/>
```

`cornerRadius` is relative to the rendered graphic's shorter side: `0` keeps
square corners and `0.5` produces the maximum rounded corners. The value is a
relative proportion, not a texture-pixel measurement.

`GraphicHotspot` uses the same `onLoad(texture)` and `onError(error)` callbacks
as `ImageHotspot`. Built-in paths are rasterized locally; only an SVG URL
or SVG `path` data plus an explicit `viewBox` is accepted, never arbitrary SVG
markup.

## Hotspot mode and zoom behaviour

Point hotspots use `mode` to configure orientation and placement together:

- `mode="surface"` attaches the plane to the local panorama surface.
- `mode="billboard"` keeps the plane facing the camera and floats it in front
  of the shell. `distance` is the distance from the camera (world units, default `10`);
  decrease it to move the hotspot nearer.
  The built-in panorama shell is at roughly `1000` units; distance is
  automatically capped so the hotspot's corners cannot cross it.
- `scaleMode="fov"` (default) lets a hotspot grow when the user zooms in.
  `scaleMode="fixed"` compensates for FOV changes and keeps its screen size
  close to the size at `referenceFov` (default `75`).
- `rotation` rotates the hotspot around its own normal in degrees; positive
  values rotate clockwise and negative values rotate counterclockwise.
  `scale` applies an overall positive multiplier to its angular width and
  height and defaults to `1`.

```tsx
<ImageHotspot
  id="callout"
  ariaLabel="Open callout"
  position={{ yaw: 18, pitch: 5 }}
  width={10}
  height={6}
  mode="billboard"
  distance={14}
  rotation={-12}
  scale={1.25}
  scaleMode="fixed"
  src="/hotspots/callout.webp"
/>
```

## PolygonHotspot

`PolygonHotspot` renders a local spherical area from three or more controlled
yaw/pitch vertices. Concave polygons and the `-180°/180°` seam are supported.
The component reports, rather than renders, self-intersecting polygons, shapes
that contain a pole, and shapes that cannot fit within one hemisphere.

```tsx
import { PolygonHotspot } from "@ericchen1990/pano-view";

<PolygonHotspot
  id="exhibit-zone"
  ariaLabel="Open exhibit zone"
  vertices={[
    { yaw: 16, pitch: 8 },
    { yaw: 31, pitch: 7 },
    { yaw: 27, pitch: 19 },
    { yaw: 19, pitch: 16 },
  ]}
  fill="#df6b42"
  fillOpacity={0.32}
  stroke="#f5fbfc"
  strokeWidth={2}
  strokeOpacity={0.8}
  strokeDashSize={8}
  strokeGapSize={4}
  draggable
  onVerticesChange={({ vertices }) => setZoneVertices(vertices)}
  onInvalid={(issues) => console.error(issues)}
/>
```

`strokeWidth` is a screen-space CSS pixel value, so it remains visually
consistent across FOV changes. `strokeDashSize` and `strokeGapSize` use the
same CSS-pixel units; omit them or set `strokeDashSize` to `0` for a solid
stroke. Dragging moves all vertices together while keeping yaw normalized and
pitch clamped. Individual vertex editing is provided by the authoring
workflow, not the runtime hotspot component.

Set `fillOpacity={0}` for a closed outline-only polygon. The fill and outline
share the same spherical edge sampling so the outline follows the fill boundary.

## PolylineHotspot

`PolylineHotspot` is an open path of at least two yaw/pitch vertices. It uses
the same CSS-pixel `strokeWidth`, optional dashed stroke (`strokeDashSize` /
`strokeGapSize`), visibility, semantic interaction, controlled
whole-path drag, and vertex-change callback as `PolygonHotspot`, but it never
connects the final point to the first and has no fill.

```tsx
import { PolylineHotspot } from "@ericchen1990/pano-view";

<PolylineHotspot
  id="guided-route"
  ariaLabel="Guided route"
  vertices={routeVertices}
  stroke="#75cbd3"
  strokeWidth={2}
  strokeOpacity={0.9}
  strokeDashSize={8}
  strokeGapSize={4}
  draggable
  onVerticesChange={({ vertices }) => setRouteVertices(vertices)}
/>;
```

`onInvalid` reports the only invalid runtime shape: fewer than two vertices.

## SequenceHotspot

`SequenceHotspot` animates a sprite sheet: one image containing equally sized
frames in a vertical or horizontal strip. This matches the common krpano
animated-hotspot format. Give `width` and `height` the aspect ratio of a single
frame, rather than the full strip. `playing` is controlled by the host; `fps`
defaults to `12` and `loop` defaults to `true`.

```tsx
import { SequenceHotspot } from "@ericchen1990/pano-view";

<SequenceHotspot
  id="pulse"
  ariaLabel="Play marker sequence"
  position={{ yaw: -42, pitch: -7 }}
  width={8}
  height={8}
  src="/hotspots/pulse-strip.png"
  frameCount={20}
  frameDirection="vertical"
  fps={12}
  loop
  playing={isPulsePlaying}
  onEnded={() => setPulsePlaying(false)}
  onError={({ error }) => console.error(error)}
/>;
```

Sequence loading uses `onLoadProgress` and `onError`. The component does not
change `playing` by itself: update that prop in response to your UI, click
handler, `onEnded`, or playback error.

## VideoHotspot

`VideoHotspot` uses an `HTMLVideoElement` and `VideoTexture`. Its `playing`
prop is likewise controlled: toggle it from your click handler or application
state. On source change or unmount, the element is paused and its texture is
released. `playsInline` defaults to `true` and uses the same inline-playback
attributes as `PanoVideo`. The element is mounted inside the viewer, hidden,
so mobile browsers keep it in the page. `muted` defaults to `true`, `loop` to
`false`, and `preload` to `"metadata"`.

```tsx
import { VideoHotspot } from "@ericchen1990/pano-view";

<VideoHotspot
  id="clip"
  ariaLabel="Play room video"
  position={{ yaw: 48, pitch: 6 }}
  width={18}
  height={10.125}
  mode="surface"
  src="/hotspots/room.webm"
  poster="/hotspots/room-poster.webp"
  playing={isClipPlaying}
  muted
  volume={0.8}
  onClick={() => setClipPlaying((playing) => !playing)}
  onEnded={() => setClipPlaying(false)}
  onPlaybackStateChange={(state) => console.log(state)}
  onPlaybackError={(error) => console.error(error)}
/>;
```

Browsers can reject unmuted or otherwise non-gesture playback. In that case
`onPlaybackStateChange` receives `"blocked"` and `onPlaybackError` receives
the browser error; retain control of `playing` in the host and offer an
explicit user action.

Video reports media and poster failures through `onError`. Like
`SequenceHotspot`, it does not change `playing` by itself. This keeps source
changes, unmounts, and React StrictMode lifecycles deterministic.

## AudioHotspot

`AudioHotspot` plays a directional sound at a spherical position. Stereo
panning follows the camera look direction; `range` is the look-away angle in
degrees at which volume reaches silence. The default `360` disables look
attenuation (stereo pan only). Use a smaller `range` such as `90` for a
spot source.

Playback uses Web Audio via Howler.js (bundled; hosts do not install
`howler`). The file must decode before playback starts; MP3 is a suitable
format. `src` may be a string or an array of fallback URLs. The component uses Web Audio rather than HTML5
streaming to retain stereo panning.

`playing` is controlled like `VideoHotspot`. `loop` defaults to `false`,
`muted` to `false`, `volume` to `1`, and `pauseWhenHidden` to `true` (pause
when the tab is hidden, resume if `playing` is still true). A first user
gesture unlocks audio; if autoplay is blocked, the hotspot reports
`"blocked"` and retries `play()` after the next pointer or key event while
`playing` remains true.

The default marker switches between a built-in **stopped** icon (speaker)
and a **playing** icon (speaker plus sound waves). Pass `icon`
for a custom stopped image and `playingIcon` for a custom playing image.
If only `icon` is set, it is used for both states. `marker={false}` hides
the visual for an invisible positional source. For a
non-spatial tour or per-scene soundtrack, use [`BackgroundAudio`](#backgroundaudio).

```tsx
import { AudioHotspot } from "@ericchen1990/pano-view";

<AudioHotspot
  id="fountain"
  ariaLabel="Fountain"
  position={{ yaw: -30, pitch: -8 }}
  src="/hotspots/fountain.mp3"
  playing={isFountainPlaying}
  loop
  volume={0.8}
  range={90}
  onClick={() => setFountainPlaying((playing) => !playing)}
  onEnded={() => setFountainPlaying(false)}
  onPlaybackStateChange={(state) => console.log(state)}
  onPlaybackError={(error) => console.error(error)}
/>;
```

Like the other media hotspots, `AudioHotspot` does not change `playing` by
itself.

## TextHotspot

`TextHotspot` rasterizes plain text onto a canvas texture. It does not accept
HTML or Markdown. `\n` is a hard line break; `whiteSpace="normal"` (default)
wraps words to the hotspot's angular width. Dimensions stay in degrees like
the other point hotspots. Typography uses the same names as CSS
(`fontFamily`, `fontSize`, `fontWeight`, `fontStyle`) but is painted onto the
canvas, not applied as DOM style. `fontSize` is canvas pixels (default 96) and
does not scale with panel height. `fontWeight` defaults to `600` and
`fontStyle` to `"normal"`. `padding` and `borderRadius` remain fractions of
the texture's shorter side, so they still follow `width` / `height`.

```tsx
import { TextHotspot } from "@ericchen1990/pano-view";

<TextHotspot
  id="caption"
  ariaLabel="Courtyard overlook"
  position={{ yaw: 0, pitch: -16 }}
  width={16}
  height={6}
  mode="billboard"
  scaleMode="fixed"
  text={"Courtyard overlook\nNorth terrace"}
  fontFamily="system-ui, sans-serif"
  fontSize={96}
  fontWeight={600}
  fontStyle="normal"
  align="center"
  verticalAlign="middle"
  color="#f8fafc"
  background="#111827"
  backgroundOpacity={0.72}
/>;
```

Load a custom `fontFamily` on the page before the hotspot paints. The hotspot
waits on `document.fonts.load` when that API exists, then draws with whatever
faces the document has. `onLoad(texture)` and `onError(error)` match
`ImageHotspot`.

## IframeHotspot

`IframeHotspot` places an embedded document with `@react-three/drei` `Html`
`transform`, so it follows the same hotspot mode, rotation, and zoom scaling
as a texture plane. The iframe is a DOM overlay and is not occluded by the
panorama shell. There is no `srcdoc` prop.

```tsx
import { IframeHotspot } from "@ericchen1990/pano-view";

<IframeHotspot
  id="guide"
  ariaLabel="Open visitor guide"
  position={{ yaw: -62, pitch: 4 }}
  width={18}
  height={12}
  mode="billboard"
  src="/hotspots/embed.html"
  pointerPolicy="hotspot"
/>;
```

`pointerPolicy="hotspot"` (default) sets the iframe to `pointer-events: none`
so clicks and drags hit the WebGL plane. `"content"` makes the page
interactive and blocks dragging through the iframe. A hotspot
`pointerEvents="none"` also forces the iframe overlay not to capture pointer
events. `sandbox` defaults to
`allow-scripts allow-popups allow-forms` without `allow-same-origin`.
`referrerPolicy` defaults to `strict-origin-when-cross-origin`. Prefer a
same-origin document; many third-party sites send `X-Frame-Options` and will
not load.

## Next.js and SSR

The component entry is marked as a client module; render it within a Client
Component boundary. Use `@ericchen1990/pano-view/data` for server-side
configuration loading. The browser loads panorama assets. The viewer itself
needs no API key; asset servers still need appropriate access and CORS settings.

Import the stylesheet once from a Client Component or a global CSS file:

```ts
import "@ericchen1990/pano-view/styles.css";
```

See [Stylesheet (HTML chrome)](#stylesheet-html-chrome).

## Spherical multiresolution tiles

`SphereTile` renders multiresolution tile pyramids covering a complete 2:1
equirectangular panorama. It selects tiles according to the view, zoom, and
texture budget, mapping each tile as a separate texture onto its corresponding
spherical region. Coarser tiles or the preview cover regions whose detail has
not loaded yet.

This avoids loading the entire panorama as one high-resolution texture and can
reduce peak image-decoding and texture-upload costs. Actual memory use still
depends on tile dimensions, visible levels, and the cache budget. The current
spherical renderer may still show visible artifacts near the top and bottom
poles. Prefer cube tiles ([`Tile`](#tile)) for newly generated panorama assets;
use `SphereTile` for existing equirectangular tile pyramids.

Basic usage:

```tsx
import { PanoViewer, SphereTile } from "@ericchen1990/pano-view";

<PanoViewer>
  <SphereTile
    baseUrl="/panoramas/legacy"
    multires="512,257x129,513x257,1025x513,2050x1025,4100x2050"
    urlTemplate="tiles/%l/%h_%v.webp"
    previewUrl="previews/400.webp"
    indexBase={0}
  />
</PanoViewer>;
```

This layout matches Sharp Deep Zoom with `size: 512`, `depth: "onetile"`,
`layout: "dz"`, and no overlap. Set `indexBase={0}` for that raw Sharp output, including partial edge tiles.
The default `indexBase={1}` matches existing krpano sphere resources whose
level, column and row all start at **1**. Logical addresses passed to callbacks
and `resolveTileUrl` always start at 0; `indexBase` only affects URL templates.
`multires` accepts the string above or `{ tileSize, levels: [{ width, height }] }`.
Copy actual dimensions rather than deriving each level by multiplying by two:
odd dimensions round independently. Each level must describe a full 2:1 image
(with up to two pixels of rounding tolerance).

Relative paths resolve under `baseUrl`; absolute paths/URLs remain absolute.
`resolveTileUrl(address)` overrides the template. Templates support `%l`,
horizontal `%h`/`%x`/`%u`/`%c`, vertical `%v`/`%y`/`%w`/`%r`, and padding such as
`%00h`. `yawOffset` rotates the source; the source image center faces yaw 0,
right is positive yaw, and top is positive pitch.

`maxTextureMemoryMb` (128), `maxConcurrentLoads` (4), and `retryCount` (1)
configure the per-component tile cache. The preview uses separate memory. If the
visible detail and its fallback levels exceed the tile budget, the viewer uses a
coarser level; the preview stays underneath. `loadMode` is `full` (default),
`base`, or `preview`. `visible={false}` preloads without drawing.
`onReady` fires once per source when a preview or tile becomes paintable, even
if the preview failed. `onPreviewError`, `onTileError`, `onLoadProgress`, and
`onLevelChange` expose failures/progress; levels in callbacks start at 0.
Unmounting disposes owned textures and ignores late results.

Use `SphereTile` directly as a `PanoViewer` child, or define a `SphereTileScene`
with `type: "sphereTile"` inside `Scenes`. All transition presets, including
`dissolve`, work across `sphere`, cube `tile`, and `sphereTile` scenes:

```tsx
import { Scenes, type Scene } from "@ericchen1990/pano-view";

const scenes: Scene[] = [
  {
    id: "courtyard",
    type: "sphereTile",
    baseUrl: "/panoramas/courtyard/",
    multires: "512,500x250,1000x500,2000x1000",
    previewUrl: "previews/400.webp",
    urlTemplate: "tiles/%l/%h_%v.webp",
    indexBase: 1,
  },
  // Add sphere, tile, or other sphereTile scenes here.
];

<Scenes scenes={scenes} activeSceneId={activeSceneId} transition="dissolve" />;
```

`onSceneReady(sceneId)` fires when the first scene becomes paintable and when an
incoming scene takes over after the outgoing snapshot is captured. The transition
may still be running; use this callback to apply the incoming camera view without
changing the outgoing snapshot. For tiled scenes, detail loading is enabled after that handoff and continues
during the blend. `transitionWaitForDetailMs` can hold the outgoing snapshot within the configured timeout until the current
view's target detail is ready; it does not change when `onSceneReady` fires. `onTransitionEnd` marks
completion of the blend.

`SphereTileScene` accepts the source options of `SphereTile`, including
`indexBase`, `resolveTileUrl`, and `yawOffset`. `Scenes` owns visibility,
preloading, readiness, and transitions. Use `onTransitionEnd` and
`onTransitionError` on `Scenes`; its shared texture budget and request limit
apply to both cube and equirectangular tiles. Standalone `SphereTile` retains
its own cache, callbacks, and loading options.

## Accessibility matrices and tooltip typography

`PanoFilter` also accepts `colorMatrix`, a readonly row-major 4×5 RGBA matrix
(20 finite numbers, matching SVG `feColorMatrix`). The matrix is applied in
display/sRGB space after the panorama preset. `intensity` mixes each effect
with its input; `enabled={false}` disables both. Set
`colorMatrixScope="all"` to include hotspot textures; the default `"panorama"`
keeps existing behavior. Artistic presets always affect only the panorama.
HTML tooltips, iframes and other DOM chrome remain host-styled.

Hotspot `tooltipAppearance` accepts `fontFamily`, `lineHeight`, and
`letterSpacing`, in addition to `fontSize` and existing paint options.
`lineHeight` numbers are unitless; numeric `letterSpacing` values are CSS pixels.

Regression checks: `pnpm --filter @ericchen1990/pano-view test` (Node 22+).

## FAQ and troubleshooting

### Why prefer cube tiles?

[`Tile`](#tile) loads cube tiles according to the view and zoom, avoiding one oversized panorama texture and the current spherical renderer's pole artifacts. Use [`SphereTile`](#spherical-multiresolution-tiles) for existing equirectangular tiles with view-dependent loading; tiling alone does not remove spherical pole artifacts. `Sphere` suits single images with manageable dimensions. A preview improves initial display time, but its dimensions should still be kept small. See [Sphere](#sphere).

### How do I deploy multiple scenes without a database?

Keep the converter directory structure, author `project.json` referencing each `viewer.json`, and render it with `loadPanoProject` and `ProjectScenes`. Upload your React build and assets to static hosting. Under a prefix such as `/demo/`, use the correct project entry URL and prefer relative references inside the project.

### Why do JSON or textures fail across origins?

Inspect Network and Console to identify the failing config, preview or tile. The server/CDN must allow your app origin. Public anonymous resources may use `Access-Control-Allow-Origin: *`; credentialed requests need an explicit allowed origin and `Access-Control-Allow-Credentials: true`. Use `Vary: Origin` when varying by origin. JavaScript may only receive `Failed to fetch`, so the loader cannot diagnose CORS with certainty.

`no-cors` gives an unreadable opaque response; it cannot make JSON readable or bypass WebGL texture rules. Configure the server. See [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) and [WebGL textures](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL).

Example S3 console CORS configuration for reads (replace the website origin):

```json
[{
  "AllowedOrigins": ["https://app.example.com"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["Authorization"]
}]
```

CORS does not grant object read permission. When using a CDN, check its actual response headers too. See the [official S3 CORS guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html).

### Why do tiles return 404 or use the wrong URL?

Compare the complete Network URL with the uploaded object key. Check `baseUrl`, extra directory levels, case and filenames. A new domain/prefix only needs a new root; renamed files need mapping. Preserve the converter template, particularly `%v_%h` versus `%h_%v`.

### Why INVALID_JSON with HTTP 200?

Inspect the response body for HTML. A static SPA fallback may serve the homepage for a missing JSON file, or authentication may redirect to a login page. Fix the URL/routing; status 200 does not guarantee JSON.

### Why does JSON work but images return 401/403 or expired signatures?

Treat config authentication and image access separately. `requestInit` headers/credentials apply to JSON only; its URL token is not appended to tiles. Supply public URLs, signed URLs, or your application's supported authentication mechanism for assets. Acquire signatures before mapping/loading and refresh them when expired; keep temporary credentials outside conversion JSON.

### Why is the canvas blank after config loading succeeds?

Ensure the viewer container has nonzero height, inspect texture requests and WebGL console errors, and keep React, Three.js and React Three Fiber singletons. Metadata success is not render readiness: observe `onSceneReady` and `onTransitionError`.

### Why is the preview correct but detailed tiles are missing or misplaced?

Upload every tile and preserve actual level sizes, `urlTemplate`, `previewFaceOrder` and `indexBase`. Do not assume all levels exactly double or confuse zero-based logical coordinates with stored indices. A custom resolver must identify the corresponding original tile.

### Why are hotspots missing or not navigating?

Check the owning scene, `visible`, `interactive`, `pointerEvents`, angles and asset requests. Hotspots hide during transitions. IDs must be unique in their respective scopes and `action.sceneId` must exist. `preventDefault()` cancels built-in actions. Text alone does not create an information dialog.

### Why does media not play?

Start playback from a click or keyboard gesture, check supported formats and permissions, and inspect `onHotspotError`. Browsers can block unmuted autoplay; tab visibility and device rules can also affect playback. The component does not bypass browser policies.

### What about local files, mixed content, caching and versions?

Serve files over local HTTP(S), rather than double-clicking `file://` HTML. HTTPS pages should load HTTPS assets. Use versioned asset directories and coordinate JSON/image caching so stale configs do not target replaced files. `UNSUPPORTED_SCHEMA_VERSION` requires a supported config version. Planar conversions have no `viewer.json` and need a planar viewer.

For conversion failures see [converter error codes and troubleshooting](../converter/README.md#error-codes-and-troubleshooting).
