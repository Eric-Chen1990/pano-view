# @ericchen1990/pano-view · [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![npm version](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-view.svg?style=flat)](https://www.npmjs.com/package/@ericchen1990/pano-view) [![CI](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Eric-Chen1990/pano-view/pulls)

**English** | [简体中文](./README.zh-CN.md)

Composable React components for equirectangular and krpano-style multiresolution panorama viewers.

Try the components in the [live playground](https://pano-view-playground.vercel.app/?utm_source=github&utm_medium=readme&utm_campaign=package-readme&utm_content=playground).

## Contents

- [pano-converter](#pano-converter)
- [Data sources and choosing an approach](#data-sources-and-choosing-an-approach)
- [Static projects and JSON data](#static-projects-and-json-data)
- [Floor plan maps](#floor-plan-maps)
- [FAQ and troubleshooting](#faq-and-troubleshooting)
- [krpano-compatible tile output](#krpano-compatible-tile-output)
- [Install](#install)
- [Examples](#examples)
- [Exported components](#exported-components)
- [PanoViewer](#panoviewer)
- [DOM overlays and dialogs](#dom-overlays-and-dialogs)
- [Sphere](#sphere)
- [PanoVideo](#panovideo)
- [Tile](#tile)
- [Scenes](#scenes)
- [PanoSceneMenu](#panoscenemenu)
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

Configured `initialView` values apply at `onSceneReady`, defaulting missing fields to yaw 0, pitch 0, fov 75. With no view configured, the current view is retained. Hotspots hide during transitions. Control selection with `activeSceneId` / `onActiveSceneIdChange`. When uncontrolled, internal state starts at `project.initialSceneId`; a new `project` reference resets that selection. Call `event.preventDefault()` in `onHotspotClick` to cancel the default action. `onHotspotError` receives `sceneId`, the hotspot, and the original error (media errors may be events containing an `error` field). `renderHotspot(hotspot, context)` returns `undefined` for the default renderer or `null` to hide an item. Context includes `sceneId`, `playing`, `onClick`, `onHoverChange`, `togglePlayback`, `reportError`, and `renderDefault`.

Beyond project-specific props, `ProjectScenes` accepts the `Scenes` transition and cache props: `transition`, `onSceneReady`, `transitionWaitForDetailMs`, `onTransitionEnd`, `onTransitionError`, `maxTextureMemoryMb`, `maxConcurrentTileLoads`, and `snapshotMaxPixels` (default `3686400`). It does not accept `scenes`, `defaultActiveSceneId`, or a host `renderHotspots` — the scene list comes from `project`, and hotspots are rendered by the component.

### Hotspot actions and shared popup content

`ProjectHotspotAction` is a discriminated union. Keep `{ type: "scene", sceneId }` for navigation. Use `{ type: "view", view: { yaw, pitch, fov }, duration?: number }` to animate the current scene (700 ms by default, 0 for immediate movement), or `{ type: "popup", popupId }` to request shared content. Narrow `action.type` before reading `sceneId`. Explicit actions take priority over media playback and can all be cancelled with `onHotspotClick(event).preventDefault()`.

Add an optional project-level `popups: ProjectPopupDefinition[]`. Each entry has a unique `id`, a nonempty `title`, and ordered `blocks` with unique IDs within that popup:

```json
{
  "id": "story",
  "title": "About this place",
  "blocks": [
    { "id": "intro", "type": "text", "text": "Plain text, including line breaks." },
    { "id": "photo", "type": "image", "src": "media/photo.webp", "alt": "The main hall" },
    { "id": "film", "type": "video", "src": "media/movie.mp4", "poster": "media/photo.webp" },
    { "id": "voice", "type": "audio", "src": "media/story.mp3" }
  ]
}
```

Store this content structure in `project.json`; store media as separate files. Popup paths resolve from the project directory, independently of each panorama's `viewer.json`. `loadPanoProject` returns resolved `popups`; its optional `resolvePopupAssetUrl(path, context)` receives `{ defaultUrl, popupId, blockId, field }`, where field is `src` or `poster`. Like the existing resolver, return an absolute URL or site-root path. Existing `resolveAssetUrl` callbacks continue to receive only their scene/hotspot resources. `resolveProjectPopupAssets` is also exported from `/data` for custom loaders. Request credentials for JSON do not automatically protect media.

`ProjectScenes.onPopupRequest({ sceneId, hotspot, popup })` delegates display to your overlay. A missing handler or missing popup reports through `onHotspotError`. The optional UI entry supplies `ProjectPopupDialog` without adding Dialog dependencies to the viewer core:

```tsx
import { useState } from "react";
import { PanoOverlay, PanoViewer, ProjectScenes, type LoadedPanoProject, type ProjectPopupDefinition } from "@ericchen1990/pano-view";
import { ProjectPopupDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/ui/styles.css";

export function Tour({ project }: { project: LoadedPanoProject }) {
  const [popup, setPopup] = useState<ProjectPopupDefinition | null>(null);
  return <PanoViewer>
    <ProjectScenes project={project} onPopupRequest={({ popup }) => setPopup(popup)}
      onActiveSceneIdChange={() => setPopup(null)} />
    <PanoOverlay>
      <ProjectPopupDialog popup={popup} onOpenChange={(open) => { if (!open) setPopup(null); }} />
    </PanoOverlay>
  </PanoViewer>;
}
```

`ProjectPopupDialog` accepts `popup` (or `null` to close), `onOpenChange`, optional `closeLabel` and `onMediaError(block)`. It renders text as text, uses native audio/video controls without autoplay, and releases media when content closes or changes. It inherits `PanoDialog` fullscreen, sizing and focus behavior. Replace this component with your own overlay to customize rendering.

### Floor plan maps

An optional project-level `map` places scene spots on one floor image. Projects without `map` stay valid, and `schemaVersion` remains 1. `loadPanoProject` returns the map with the floor image and spot icons resolved from the project directory. `parsePanoMap` and `resolvePanoMapAssets` are also exported from `/data` for custom loaders.

```json
"map": {
  "image": "assets/map/floor.webp",
  "interaction": "zoom",
  "maxScale": 4,
  "iconSize": 28,
  "presentation": {
    "mode": "panel",
    "anchor": {
      "align": "bottom-left",
      "axis": "horizontal",
      "inset": 16
    },
    "width": 240,
    "height": 180
  },
  "controls": { "collapse": true, "zoom": true },
  "sector": {
    "angle": 70,
    "radius": 56,
    "followFov": false,
    "color": "#38bdf8",
    "opacity": 0.55,
    "strokeColor": "#ffffff",
    "strokeWidth": 1.5,
    "strokeOpacity": 0.9
  },
  "spots": [{
    "id": "entrance-spot",
    "sceneId": "entrance",
    "x": 0.31,
    "y": 0.5,
    "heading": 20,
    "icon": "assets/map/pin.webp"
  }]
}
```

`image` is a project-relative path or an absolute URL. `spots` is required. Spot IDs are unique, and each `sceneId` must name a scene in the project. `x` and `y` are normalized image coordinates in [0, 1], with the origin at the top-left. `heading` is clockwise degrees from image-up when viewer yaw is 0; the drawn sector uses `heading + yaw`. Several spots may share a scene. The sector is drawn on the first spot whose `sceneId` matches the active scene. `icon` is optional; a spot without one uses the built-in marker.

`interaction` is `"fixed"` (the default) or `"zoom"`. Fixed mode fits the image in the panel and ignores the wheel, drag-pan, and zoom buttons. Zoom mode allows wheel zoom, and drag-pan once the scale is above the fitted size. Wheel events on the map do not scroll the page. `maxScale` is the maximum multiple of that fitted size, at least 1, default 8. `dragMotion` controls pan inertia and edge bounce while zoomed (both on by default). Set `false` to disable both, or `{ inertia?: boolean; bounce?: boolean }` to toggle either flag. Spot and heading edits stay direct. `controls.zoom` shows the zoom buttons only when interaction is `"zoom"`. `controls.collapse` shows an edge tab that slides a panel off-screen. `iconSize` is the marker edge in CSS pixels, default 28. Icons and the sector keep that screen size while the floor image zooms.

`sector` is optional. `angle` is the opening in degrees, greater than 0 and less than 360. `radius` is CSS pixels and does not scale with the image. `followFov` replaces `angle` with the horizontal field of view derived from the viewer FOV and the map panel's aspect ratio. Without `gradient`, the fill is solid `color` (default `#ffffff`) at `opacity` (default 0.55). `gradient.type` is `"radial"` or `"linear"`, with at least two stops. Each stop has `offset` in [0, 1], `color`, and an optional `opacity`. Stop opacities describe only the fade shape. `sector.opacity` scales the whole fill in both solid and gradient mode. `strokeColor`, `strokeWidth`, and `strokeOpacity` draw an outline when the width is greater than 0. The outline width stays in CSS pixels.

`presentation.mode` is `"panel"` (the default) or `"dialog"`. Both accept `anchor`, plus `width` and `height`. `anchor` is the shared overlay anchor: `align` is `top`, `bottom`, `left`, `right`, or one of the four corners (default `bottom-left`); `axis` is `"horizontal"` or `"vertical"` and applies only to corners (default `"horizontal"`); `inset` is a number, a CSS length string, or `{ top, right, bottom, left }` (default `16`). Safe-area insets are added on top. A panel defaults to 220×160. Dialog mode places a launcher (48×48 when width and height are omitted) and opens the same map in a viewer-local dialog. Choosing a spot closes that dialog. The chrome is positioned on the full viewer overlay, so scrolling a parent page does not move or resize it. Edges center a sized box on that edge. Corners pin to both adjacent edges. Collapsing keeps the panel size and slides it off the outer edge: edges slide toward that edge, and corners slide vertically when `axis` is horizontal or horizontally when `axis` is vertical. The tab stays on the inner side of that edge.

The document stores saved defaults (`image`, `spots`, `sector`, `presentation`, `interaction`, `maxScale`, `dragMotion`, `controls`, `iconSize`). Mount-time props on `PanoMapOverlay` override presentation and zoom for that render without cloning the map. Priority is built-in defaults → map document → `presentationOverride` (same shape as `map.presentation`) → individual props. Spot geometry and sector styling stay in the document. `selectedSpotId` / `onSelectedSpotIdChange` are forwarded to the inner `PanoMap`. Panel collapse state is owned by the overlay; dialog mode and `editorSurface` force the edge tab off. `PanoMap`'s own `collapsed` prop still hides the surface inside a host-owned frame.

#### Mounting `PanoMapOverlay`

Mount it inside `PanoOverlay` and pass the same `activeSceneId` you pass to `ProjectScenes`. Import `@ericchen1990/pano-view/styles.css` for the built-in `pano-map-*` classes. The overlay reads yaw and FOV from the viewer. It does not change scenes by itself: set the active scene from `onSelectScene`. Pass `view` when the camera state comes from outside the viewer; outside the viewer with no `view`, the surface stays at yaw `0`, pitch `0`, fov `75`. `PanoMap` is the surface alone, for a host-owned frame.

`PanoMap` also accepts controlled selection and collapse: `selectedSpotId` / `onSelectedSpotIdChange` (internal selection defaults to `null`); `collapsed` / `onCollapsedChange` (uncontrolled starts expanded and hides the surface inside the host frame); `renderChrome` to draw host controls above the surface. On `PanoMapOverlay`, `showCollapseControl` shows the shared edge tab instead. `className` / `style` attach to the surface root.

```tsx
import { useState } from "react";
import {
  PanoOverlay, PanoViewer, ProjectScenes, PanoMapOverlay, type LoadedPanoProject,
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function Tour({ project }: { project: LoadedPanoProject }) {
  const [activeSceneId, setActiveSceneId] = useState(project.initialSceneId);
  const map = project.map;
  return <PanoViewer style={{ height: 600 }}>
    <ProjectScenes
      project={project}
      activeSceneId={activeSceneId}
      onActiveSceneIdChange={setActiveSceneId}
    />
    {map ? (
      <PanoOverlay>
        <PanoMapOverlay
          map={map}
          activeSceneId={activeSceneId}
          onSelectScene={setActiveSceneId}
        />
      </PanoOverlay>
    ) : null}
  </PanoViewer>;
}
```

#### Size, align, and inset

- `presentation` — `"panel"` | `"dialog"` (defaults from the document, otherwise `"panel"`).
- `anchor` — shared `PanoOverlayAnchor`. `align` is one of eight positions (default `"bottom-left"`). `axis` is used for corners. `inset` defaults to `16`.
- `width` / `height` — panel size, or the dialog launcher size, in CSS pixels. Panel defaults to 220×160; the dialog launcher defaults to 48×48.

```tsx
<PanoMapOverlay
  map={map}
  activeSceneId={activeSceneId}
  onSelectScene={setActiveSceneId}
  presentation="panel"
  anchor={{ align: "bottom-right", axis: "vertical", inset: 20 }}
  width={280}
  height={200}
/>
```

#### Dialog mode

Dialog mode places a launcher button and opens the map in a viewer-local modal. Launcher size uses `width` / `height`, and the launcher uses the same `anchor`. The dialog body uses a separate pair:

- `dialogWidth` / `dialogHeight` — preferred dialog size in CSS pixels (default 720×520). Both are clamped to the viewer with a 16 px margin on each side.
- `openLabel` / `closeLabel` / `title` — launcher accessible name, close button label, and dialog heading (defaults `"Map"`, `"Close"`, `"Map"`).

Choosing a spot closes the dialog.

```tsx
<PanoMapOverlay
  map={map}
  activeSceneId={activeSceneId}
  onSelectScene={setActiveSceneId}
  presentation="dialog"
  anchor={{ align: "bottom-left", inset: 16 }}
  width={52}
  height={52}
  dialogWidth={640}
  dialogHeight={480}
  openLabel="Floor plan"
  title="Floor plan"
  closeLabel="Close"
/>
```

#### Zoom and controls

These props override the map document for the current mount:

- `interaction` — `"fixed"` | `"zoom"`.
- `maxScale` — maximum multiple of the contain-fit size; values below 1 are treated as 1.
- `dragMotion` — pan inertia / edge bounce when `interaction` is `"zoom"`. Omit for both on; `false` disables both.
- `initialScale` — opening zoom relative to the contain-fit size, clamped to `[1, maxScale]`. View state only; not written back to the document. Applies after the image is measured and recenters. Resets only when `initialScale` or `interaction` changes; later wheel and drag keep the user's view. Shrinking `maxScale` only clamps the current scale.
- `showZoomControls` / `showCollapseControl` — force zoom or collapse chrome on or off.
- `iconSize` — marker edge in CSS pixels.

```tsx
<PanoMapOverlay
  map={map}
  activeSceneId={activeSceneId}
  onSelectScene={setActiveSceneId}
  interaction="zoom"
  maxScale={4}
  initialScale={1.5}
  showZoomControls
  showCollapseControl
  iconSize={32}
/>
```

`toggle` replaces the panel edge-tab icon or restyles that button. Dialog mode has no edge tab. Omit `toggle` to keep the default chevron. Pass an element (`<Icon />`) for `icon`, not a component type. When the glyph depends on the collapsed state, pass a function of `{ collapsed }`. `className` is appended to the button. `style` overrides background, border, color, and size. Position and `transform` belong to the edge layout; do not set them in `style`. The default chevron uses `currentColor`, so `style.color` recolors it without replacing the icon.

```tsx
<PanoMapOverlay
  map={map}
  activeSceneId={activeSceneId}
  onSelectScene={setActiveSceneId}
  showCollapseControl
  toggle={{ style: { color: "#7dd3fc" } }}
/>
```

```tsx
<PanoMapOverlay
  map={map}
  activeSceneId={activeSceneId}
  onSelectScene={setActiveSceneId}
  showCollapseControl
  toggle={{
    className: "map-tab",
    style: {
      background: "#0c4a6e",
      color: "#7dd3fc",
      border: "1px solid #7dd3fc",
    },
    icon: ({ collapsed }) => (collapsed ? "+" : "–"),
  }}
/>
```

#### Edit mode

`mode="edit"` is the authoring surface: with `placementSceneId` set, a click adds a spot whose heading is the negation of the current yaw, so the sector points image-up at that yaw; dragging a spot moves it, and dragging the sector sets `heading`. `onEditChange` reports `{ spots?, selectedSpotId? }`. Visitor playback stays on the default `mode="view"`. `editorSurface` enlarges the panel for authoring; pass `width` / `height` to size that surface, otherwise it scales with the viewer.

Run `pnpm dev` and open `/map` for the playground. Authoring the same document is described in the [editor floor-plan section](../editor/README.md#floor-plan).

The schema remains version 1 and old projects remain valid. Projects using new actions or a floor-plan map require a viewer that supports them. `parsePanoProject(input, { draft: true })` is for authoring only: it permits empty scene lists, unfinished popup titles/media, and an empty floor-plan image. Loading, saving and package export validate strictly. Host applications may save the same document in a database or map it to tables; the viewer has no database connection.

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
| Project `viewerUrl`, hotspot assets, floor-plan image and spot icons, `source.baseUrl` | Project directory |
| Tiles and preview in external `viewer.json` | That JSON directory |
| Tiles and preview in inline config | Project directory |
| Panorama with `source.baseUrl` | Specified directory |

URL inputs use the final response directory after redirects. Object inputs require `baseUrl`; it can also override the project directory. Directory trailing slashes are normalized. Domains and cloud prefixes stay outside converter JSON. Browsers accept relative entry URLs; Node.js requires absolute HTTP(S) entry URLs. Full resource URLs remain intact; leading `/` paths resolve against the resource base origin.

If uploads rename files or scatter directories, provide synchronous `resolveAssetUrl(path, context)`. Context has `defaultUrl`, `kind` (`tile`, `preview`, `hotspot`, `map`), `sceneId` and optional `hotspotId`. Return a final absolute URL or site-root path; it is not joined again. `uploadedUrls` below is application-owned:

```ts
const project = await loadPanoProject("/tour/project.json", {
  resolveAssetUrl(path, context) {
    // Map keys must distinguish scenes and, for hotspot assets, hotspot IDs.
    const key = `${context.sceneId}/${context.hotspotId ?? ""}/${path}`;
    return uploadedUrls[key] ?? context.defaultUrl;
  },
});
```

Hotspot mapping covers images, SVG image URLs, audio source arrays, video posters, playback icons and tooltip images; text, CSS and SVG path data remain unchanged. Floor-plan images and spot icons use the same callback with `kind: "map"`. The floor image has an empty `sceneId` and no `hotspotId`. A spot icon sets both `sceneId` and `hotspotId` to the spot id. Include `kind` in an upload key when one path is reused as more than one kind. Acquire signed URLs ahead of time in your application and return them synchronously.

`requestInit` accepts only `headers`, `credentials` and `signal`, for JSON requests only. They are not forwarded to textures, and JSON query parameters are not inherited by assets. `parsePanoProject(unknown)` validates and copies project data independently. `sceneFromViewerConfig` accepts the unwrapped compact config; `loadSceneFromJson` accepts a versioned `viewer.json`.

`PanoDataError` exposes stable codes: `INVALID_OPTIONS`, `FETCH_FAILED`, `HTTP_ERROR`, `INVALID_JSON`, `INVALID_CONFIG`, `UNSUPPORTED_SCHEMA_VERSION`, `UNSUPPORTED_PROJECTION`, `INVALID_PROJECT`, `INVALID_REFERENCE`, `ABORTED`. HTTP errors carry `status`; project errors include `sceneId` and `field` where available. Successful loading means metadata is ready, not that textures have loaded; use `onSceneReady` for render readiness.

See the `/project` playground route and `public/fixtures/projects/tour/project.json` for a complete static example. `/map` shows the floor-plan overlay on that tour.

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
hotspot tooltips, controls for assistive technology, WebVR session UI, and the
floor-plan map.

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
controls, captions, tooltips, the context menu, WebVR UI, or the floor-plan
map. Each example below shows a basic setup; the linked section has the full
props.

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
- [`PanoOverlay`](#dom-overlays-and-dialogs) — screen-plane DOM wrapper for fullscreen-safe UI
- [`PanoContextMenu`](#panocontextmenu) — right-click reset / fullscreen menu
- [`PanoSceneMenu`](#panoscenemenu) — scrollable thumbnail scene picker for `PanoOverlay`
- [`PanoVideoControls`](#panovideo) — playback chrome for `PanoVideo` (mounted by default)

### Floor plan

- [`PanoMap`](#floor-plan-maps) — floor image, scene spots, and the yaw-linked sector
- [`PanoMapOverlay`](#floor-plan-maps) — panel or dialog launcher for `PanoOverlay`

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

## DOM overlays and dialogs

Prefer `PanoOverlay` for ordinary DOM UI outside the Three.js tree. It mounts on the viewer plane inside the fullscreen root, so chrome stays visible when the viewer goes fullscreen. Place it as a direct child of `PanoViewer` (or inside a Fragment under it) beside scene content. `renderOverlay` remains supported for callback-style mounts.

```tsx
<PanoViewer style={{ height: 560 }}>
  <Sphere src="/pano.jpg" />
  <PanoOverlay>
    <PanoSceneMenu items={items} activeId={id} onSelect={setId} />
    <button
      type="button"
      style={{ position: "absolute", right: 16, bottom: 16, pointerEvents: "auto" }}
      onClick={() => void viewer.toggleFullscreen()}
    >
      Fullscreen
    </button>
  </PanoOverlay>
</PanoViewer>
```

The overlay layer is `position: absolute; inset: 0; pointer-events: none`. Position children yourself and set `pointerEvents: "auto"` on interactive nodes. When both are used, `renderOverlay` renders first and each `PanoOverlay` follows in document order. Call `usePanoOverlay()` inside `PanoOverlay` (or `renderOverlay`) to get `portalContainer`, `size` (viewer width/height), `visibleRect`, and `isFullscreen`. `usePanoModal(open)` holds that viewer's modal lock while `open === true` (pauses input and auto-rotate, marks the backdrop inert, closes the context menu); it does not trap focus. `PanoOverlayPortalProvider` takes a required `container` and `children` and only remaps `portalContainer` for descendants; `size` / `visibleRect` still describe the whole viewer. Field meanings, reference counting, and third-party Dialog wiring live in the separate **[Dialog and styling guide](./docs/dialogs.md)**. The optional `/ui` entry provides `PanoDialog` and composable parts. The guide ships in the npm package; run `pnpm dev` and open `/overlays` for local examples.

### Default dialog

Start with [Quick start](./docs/dialogs.md#quick-start), then [customize the default appearance](./docs/dialogs.md#customize-the-default-appearance). Default styling is an optional import from `@ericchen1990/pano-view/ui/styles.css`.

For multiple hotspots, use the [complete scene/hotspot-to-content example](./docs/dialogs.md#choose-content-by-hotspot): five content definitions, one shared dialog, matching project JSON and scene-local IDs.

### Compose parts or integrate an existing Dialog

Use [composable parts](./docs/dialogs.md#compose-a-different-layout) for a custom header/body/footer, or [connect an existing Dialog](./docs/dialogs.md#use-an-existing-dialog) through the local Portal container and `usePanoModal(open)`. Fullscreen belongs in viewer-level UI, not in dialog content.

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

**WebVR** (requires `<WebVR />`) — `enterVR`, `exitVR`, `toggleVR`, `isVRAvailable`, `isVREnabled`, `getVRMode`, `getVRState`, `subscribeVR`, `requestVRPermission`. Use `subscribeVR` with `useSyncExternalStore` for reactive Enter / Exit buttons; the built-in chrome no longer renders an Enter VR control.

**Video** (requires `<PanoVideo />`) — `getVideo` returns the `PanoVideoController`, `subscribeVideo` subscribes to video controller and playback-state changes, plus convenience aliases `playVideo`, `pauseVideo`, `toggleVideo`, `seekVideo`, `setVideoVolume`, `setVideoMuted`, `toggleVideoMuted`.

**Background Audio** (requires `<BackgroundAudio />`) — `getBackgroundAudio` returns the `BackgroundAudioController`, `subscribeBackgroundAudio` subscribes to background-audio controller and playback-state changes, plus convenience aliases `playBackgroundAudio`, `pauseBackgroundAudio`, `toggleBackgroundAudio`, `setBackgroundAudioVolume`, `setBackgroundAudioMuted`, `toggleBackgroundAudioMuted`. `BackgroundAudio` accepts `playing` (controlled) or `defaultPlaying` (uncontrolled).

### Props

- `initialView` — when omitted, yaw `0`, pitch `0`, fov `75`. Partial objects fill the rest from those defaults.
- `minFov` / `maxFov` — default `30` / `100`. Used as FOV bounds when `viewLimits.fov` is not set.
- `viewLimits` — camera-center yaw / pitch / fov ranges; scene-level limits override matching axes. See [Camera-center limits](#camera-center-limits).
- `dpr` — canvas pixel ratio, default `[1, 2]` (clamped device pixel ratio). A single number is also accepted.
- `controls` — `false` disables all user input. An object configures shared options and `mouse` / `touch` / `keyboard` channels; see [Mouse, touch, and keyboard controls](#mouse-touch-and-keyboard-controls). Shared defaults: `enabled` `true`, `inertia` `true`, `invert` `false`, `bouncingLimits` `false`, `frictionStop` `0.01`, `rotateSpeed` `0.35`, `zoomSpeed` `0.08`, `rotateDamping` / `zoomDamping` `14` / `16`. Omit `fovSpeed` for no extra cap: mouse wheel clamps each step `deltaY * zoomSpeed` to `±fovSpeed`; keyboard zoom compares degrees-per-second × frame time against `fovSpeed`.
- `cursors` — `true` / omit uses grab / grabbing / pointer / move; `false` leaves the canvas cursor unchanged; an object overrides those four states.
- `contextMenu` — `true` / omit mounts Reset view + Fullscreen; `false` skips the default menu; an object can change appearance or `items` / `prepend` / `append`. See [PanoContextMenu](#panocontextmenu).
- `mediaActivation` — enabled by default when a mounted child intends to play; `false` disables automatic activation.
- `renderOverlay` — optional callback-style DOM UI outside the Three.js tree and inside fullscreen; the callback receives `portalContainer`, `size`, `visibleRect`, and `isFullscreen`. Prefer `<PanoOverlay>` as a child.
- `onViewChange` — `{ yaw, pitch, fov }` in degrees.
- `onPanoramaClick` / `onPanoramaDoubleClick` / `onPanoramaPointerMove` — panorama pointer events with `position` (yaw / pitch), `nativeEvent`, `button`, `buttons`, `clientX`, `clientY`, and optional `pointerId`.
- Other standard `div` props (`className`, `style`, `id`, …) are accepted; conflicting `onChange` and `contextMenu` are omitted from the type.

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

iPhone Safari does not implement the HTML5 Fullscreen API. When `enterFullscreen()` or MobileVR runs on an iPhone, the viewer covers the visual viewport and scrolls the page in landscape so Safari’s URL and toolbar can collapse. If the bars stay visible, an on-screen prompt asks the user to swipe. Host pages should set:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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
Drive entry from host UI with `getVRState` / `subscribeVR`; session chrome only
shows Exit VR and MobileVR Setup (which fade after a few idle seconds).

```tsx
import { useSyncExternalStore } from "react";
import { PanoViewer, Sphere, WebVR, usePanoViewer } from "@ericchen1990/pano-view";

function VRExample() {
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(
    viewer.subscribeVR,
    viewer.getVRState,
    viewer.getVRState,
  );

  return (
    <>
      <button
        disabled={!vr.available}
        onClick={() => void (vr.enabled ? viewer.exitVR() : viewer.enterVR())}
      >
        {vr.enabled ? "Exit VR" : "Enter VR"}
      </button>
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

Mouse, pen, and single-touch drags anchor the grabbed panorama point and update rotation once per render frame, with a short time-based filter (about 10ms of following delay during steady movement) to smooth uneven input samples. The grabbed point aligns once movement settles, and releasing the pointer completes that alignment immediately. Flick inertia follows the latest pointer motion, so a pause before release does not continue an earlier flick. View limits and positions near the poles can restrict tracking. The default `rotateSpeed` of `0.35` gives 1:1 tracking; other values scale pointer displacement relative to it, `0` disables rotation, and `invert` reverses direction. The separate `rotateDamping` setting does not apply during anchored drags; release inertia is retained. Pinch and wheel zoom continue to follow the target FOV smoothly.

Other rotation input and zoom update a target view that the camera follows smoothly. `rotateDamping` and `zoomDamping` control that following speed in seconds^-1 (defaults: `14` and `16` respectively); smaller positive values make the camera approach the target more gradually, while `0` disables smoothing for that axis. Both values must be non-negative finite numbers. Imperative `setView()` and `reset()` remain immediate.

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
`http(s)`, `blob:`, and `data:` URLs are used as-is. For krpano sphere scenes, copy
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

### Props

- `src` — required full 2:1 equirectangular image.
- `previewUrl` — required low-resolution 2:1 preview while `src` loads.
- `yawOffset` — horizontal rotation in degrees, default `0`. Set when the source forward direction differs from viewer yaw `0`.
- `visible` — default `true`. `false` keeps the source mounted for preload without drawing it.
- `onReady` — once when the first paintable texture (preview or `src`) is ready.
- `onLoad` — when the `src` texture finishes loading; argument is a Three.js `Texture`.
- `onError` — when `src` fails to load.
- `onPreviewError` — when the preview fails; `src` still continues loading.

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

### Props

- `src` — single-file shortcut; mutually exclusive with `variants`.
- `poster` — cover image. Variants may also set `variants[].poster`.
- `variants` / `defaultVariantId` — multi-quality list; missing `defaultVariantId` falls back to the first item. Switching keeps current time and play/pause.
- `tracks` — WebVTT tracks. Each may include `src`, `srcLang`, `label`, `default`, `id` (defaults to `srcLang`), and `kind` (`"subtitles"` or `"captions"`, default `"subtitles"`).
- `captions` — `true` / omit shows the default overlay; `false` hides the overlay and language menu; an object merges with defaults. Defaults: `color` `#ffffff`, `background` `rgba(0, 0, 0, 0.55)`, `fontSize` `16`, `fontFamily` Inter / system-ui, `fontWeight` `500`, `textShadow` `0 1px 2px rgba(0, 0, 0, 0.8)`, `padding` `"6px 10px"`, `borderRadius` `6`, `maxWidth` `"72%"`, `bottom` `72`, `lineHeight` `1.35`.
- `controls` — `true` / omit mounts the default bar; `false` hides it; an object restyles the default instance. Appearance keys: `background` (default `rgba(16, 16, 16, 0.88)`), `color` (`#f4f4f4`), `accent` (`#75cbd3`), `borderRadius` (`8`), `fontSize` (`12`), `padding` (`"8px 10px"`). Render `PanoVideoControls` as a `PanoViewer` child to replace the bar (same `appearance` prop).
- `yawOffset` — horizontal offset in degrees, default `0`.
- `loop` — default `false`.
- `muted` — default `true`.
- `volume` — default `1`, range 0–1.
- `autoPlay` — default `false`. When `true`, counts as media-activation intent.
- `playsInline` — default `true`.
- `preload` — `"none"` | `"metadata"` | `"auto"`, default `"metadata"`.
- `crossOrigin` — `""` | `"anonymous"` | `"use-credentials"`; omit to leave unset.
- `playbackRates` — speed menu list, default `[0.5, 1, 1.25, 1.5, 2]`.
- `visible` — default `true`; `false` preloads without drawing.
- `onLoad` — when the video becomes playable.
- `onError` — `{ source: "poster" | "video" | "track", error }`.
- `onPlaybackStateChange` — `"playing" | "paused" | "ended" | "blocked"`.
- `onEnded` — when playback reaches the end without looping.
- `onVariantChange` / `onTrackChange` — current variant id, or current track id (`null` when none).

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

### Props

- `baseUrl` / `multires` / `previewUrl` — required. `multires` may be a string or `{ tileSize, levels }`.
- `previewFaceOrder` — default `["l", "f", "r", "b", "u", "d"]`; must list exactly six faces.
- `urlTemplate` — package default when omitted; `resolveTileUrl` wins over the template.
- `maxTextureMemoryMb` — standalone `Tile` default `128`.
- `maxConcurrentLoads` — standalone `Tile` default `8` (do not confuse with `SphereTile` / `Scenes` concurrency of `4`).
- `retryCount` — retries after the first failure, default `1`.
- `loadMode` — `"full"` (default), `"preview"`, or `"base"`.
- `visible` — default `true`; `false` preloads only.
- `onReady` — when the preview is paintable (tiles may still report ready if the preview failed).
- `onPreviewError` — preview load failure.
- `onLoadProgress` — `{ requested, loaded, failed, active, queued }`.
- `onTileError` — `{ address, url, error }`.
- `onLevelChange` — current cube level, **1-based** (`SphereTile` logical levels are 0-based).

Inside `Scenes` with `type: "tile"`, the shared texture cache overrides per-scene `maxTextureMemoryMb`, `maxConcurrentLoads`, and `retryCount` (the shared provider fixes retry at `1`). Visibility, `loadMode`, and the callbacks above are owned by `Scenes` and should not be set on the scene object.

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

### Props

- `scenes` — required. Supports `type: "sphere" | "tile" | "sphereTile"`.
- `activeSceneId` — controlled current scene.
- `defaultActiveSceneId` — uncontrolled initial scene. When both are omitted, uses `scenes[0].id`.
- `onActiveSceneIdChange` — fired by imperative switches in controlled mode.
- `transition` — defaults to `"crossfade"` for `1` second. Also accepts `{ preset, duration }`. Preset default seconds: `none` 0; `crossfade` / `whiteFlash` / most slides and opens / `pixelate` / `dissolve` / `clockWipe` / `zoomBlur` 1; `verticalOpen` 0.7; `glitch` 0.8; `hexDissolve` 1.1; the six `gridWipe*` / `shatter` / `swirl` / `ripple` 1.2; `filmBurn` 1.3; `particles` 1.4; `zoom` / `blackout` 2.
- `transitionWaitForDetailMs` — default `0`.
- `renderHotspots` — rendered only after a transition finishes; hidden while blending.
- `onSceneReady` — first paintable scene, or incoming scene after snapshot takeover; not full detail.
- `onTransitionEnd` — `{ previousSceneId, sceneId, preset }`.
- `onTransitionError` — `{ sceneId, error }`.
- `maxTextureMemoryMb` — shared budget, default `128`.
- `maxConcurrentTileLoads` — shared concurrency, default `4`.
- `snapshotMaxPixels` — max physical-pixel area of the outgoing GPU snapshot, default `3686400` (~2560×1440).

Scene `viewLimits` are covered in the FAQ; `yawOffset` matches the source component. Per-scene cube cache fields are ignored under the shared cache — see [Tile](#tile).

## PanoSceneMenu

`PanoSceneMenu` is a scrollable thumbnail strip for switching scenes. Mount it
inside `PanoOverlay` so it stays inside the viewer (including fullscreen).
Import `@ericchen1990/pano-view/styles.css` for the default layout.

The menu is host-driven: you pass `items`, `activeId`, and `onSelect`. It does
not read `Scenes` state or scene `previewUrl`. Cube `previewUrl` values are
often 1×6 preview strips and are not suitable thumbnails — use a dedicated
thumbnail URL (for converter output, prefer something like `previews/200.webp`).

### Basic wiring

Keep one controlled scene id and share it with `Scenes`:

```tsx
import { useState } from "react";
import {
  PanoOverlay,
  PanoSceneMenu,
  PanoViewer,
  Scenes,
  type PanoSceneMenuItem,
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const menuItems: PanoSceneMenuItem[] = [
  {
    id: "lobby",
    title: "Lobby",
    thumbnailUrl: "/panoramas/lobby/thumb.webp",
  },
  {
    id: "terrace",
    title: "Terrace",
    thumbnailUrl: "/panoramas/terrace/previews/200.webp",
  },
];

export function Tour() {
  const [activeSceneId, setActiveSceneId] = useState("lobby");

  return (
    <PanoViewer style={{ height: 560 }}>
      <Scenes
        scenes={scenes}
        activeSceneId={activeSceneId}
        onActiveSceneIdChange={setActiveSceneId}
      />
      <PanoOverlay>
        <PanoSceneMenu
          activeId={activeSceneId}
          items={menuItems}
          onSelect={setActiveSceneId}
        />
      </PanoOverlay>
    </PanoViewer>
  );
}
```

Each item needs `id` and `thumbnailUrl`. Optional `title` is shown on the
thumbnail label and as the control tooltip; when omitted, `id` is used. The
active item gets a selection ring above the thumbnail and `data-active="true"`.
Scene names sit on a dark translucent bar at the bottom of each thumbnail;
use `appearance.labelAlign` for `"center"` or `"end"` alignment.

### Align, inset, and size

`anchor` is the shared `PanoOverlayAnchor` used by the scene menu and the floor-plan map.

- `anchor.align` — `"top"` | `"bottom"` | `"left"` | `"right"` | `"top-left"` | `"top-right"` | `"bottom-left"` | `"bottom-right"` (default `"bottom"`).
  Top and bottom are horizontal strips. Left and right are vertical strips.
  A corner uses `anchor.axis`.
- `anchor.axis` — `"horizontal"` | `"vertical"`. Edges ignore it. Corners default to `"horizontal"`: a horizontal strip slides up or down, and a vertical strip slides left or right.
- `anchor.inset` — gap from the viewer edges (default `12`). A number is pixels; a
  string keeps units such as `"1rem"`; an object sets `top` / `right` /
  `bottom` / `left` independently. Safe-area insets are added.
- `width` / `height` — menu size. A number is pixels; a string is used as CSS as-is,
  including `%`, `rem`, `calc()`, `min()`, `max()`, and `clamp()`.
  On an edge, a set main-axis size is centered and a missing one stretches between the cross-axis insets. A corner pins to both edges and shrinks to content when a size is omitted.
  Short lists pack toward the corner, or stay centered on an edge.
- `dragMotion` — scroll inertia and edge bounce. Omit for both on (custom pointer
  scrolling, including desktop drag). Set `false` for native overflow scroll.
  Pass `{ inertia?: boolean; bounce?: boolean }` to toggle either flag. A short
  press still selects; a drag past a few pixels suppresses the click.

```tsx
<PanoSceneMenu
  anchor={{ align: "bottom", inset: 16 }}
  width="min(720px, 100%)"
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>

<PanoSceneMenu
  anchor={{
    align: "top-left",
    axis: "vertical",
    inset: { top: 24, right: 12, bottom: 24, left: 12 },
  }}
  height="70%"
  width={160}
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>
```

If you omit `width` on a top or bottom menu, the strip stretches between the left
and right insets. If you omit `height` on a left or right menu, it stretches between
the top and bottom insets. The menu also applies a max size that subtracts
`inset` and safe-area insets, so `100%` still stays inside the viewer.

Use `style` when you need one-off positioning overrides on top of these props.

### Collapsible menu and arrows

By default the menu stays open. Set `collapsible` to show a toggle centered on
the inner side of the collapse edge. Collapsing slides the list off-screen by
its size plus that edge's inset, and leaves the expand button on the viewer edge:

```tsx
<PanoSceneMenu
  collapsible
  defaultExpanded
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>

// Controlled
<PanoSceneMenu
  collapsible
  expanded={menuOpen}
  onExpandedChange={setMenuOpen}
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>
```

Set `showArrows` to add previous/next buttons at both ends of the list. By
default the buttons stop at the first and last items. Set `loop` so arrows and
arrow keys wrap from the last item to the first (and vice versa). Arrows stay
disabled when there are fewer than two scenes. Customize their accessible names
with `previousLabel` / `nextLabel`, and the toggle with `expandLabel` /
`collapseLabel`. Defaults are `"Previous scene"`, `"Next scene"`,
`"Show scenes"`, and `"Hide scenes"`. The radiogroup label defaults to `"Scenes"`
via `label`. When collapsible, `defaultExpanded` defaults to `true`.

```tsx
<PanoSceneMenu
  showArrows
  loop
  collapsible
  anchor={{ align: "bottom" }}
  width="min(720px, 100%)"
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
  previousLabel="Previous room"
  nextLabel="Next room"
/>
```

### Appearance and CSS hooks

Pass `appearance` for common chrome tokens without writing CSS. The border sits
inside the thumbnail: `selectionColor` defaults to white for the current scene;
`focusColor` defaults to `"#7dd3fc"` for mouse hover and keyboard focus, taking
priority over selection. All three states share `selectionWidth` (default 2px).
`selectionWidth: 0` hides these borders while retaining the independent keyboard
focus outline. Scene titles default to start alignment; set `labelAlign: "center"`
or `"end"` to change that.

Set `showVisited` (default `false`) to show a dark circular check icon in the
thumbnail's top-right corner, with no visible text. `visitedLabel` (default
`"Visited"`) customizes only the accessible description. A scene is recorded when
`Scenes` / `ProjectScenes` first reports it paintable, including the initial and
current scene; clicks, preloads and failed loads do not count. Both menu types in
the same `PanoViewer` share this session history, including visits made before
turning the option on. Collapsing, hiding or remounting a menu and entering/exiting
VR retain the history. Refreshing or remounting the viewer clears it. Standalone
menus without a scene-ready source do not generate visits; `activeId` alone does
not record one.

```tsx
<PanoSceneMenu items={menuItems} activeId={activeSceneId} onSelect={setActiveSceneId} showVisited />
```

```tsx
<PanoSceneMenu
  appearance={{
    background: "rgba(8, 12, 18, 0.88)",
    itemWidth: 144,
    itemHeight: 88,
    gap: 10,
    borderRadius: 10,
    selectionColor: "#7dd3fc",
    selectionWidth: 2,
    labelBackground: "rgba(0, 0, 0, 0.6)",
    labelColor: "#ffffff",
    labelAlign: "center",
    fontSize: 12,
    controlColor: "#f8fafc",
    controlBackground: "rgba(255, 255, 255, 0.14)",
  }}
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>
```

`DEFAULT_PANO_SCENE_MENU_APPEARANCE` exports the defaults (including
`padding: "8px 10px"` and `labelAlign: "start"`). For deeper styling,
use `className` / `style` against these stable classes:

- `pano-scene-menu` — root chrome
- `pano-scene-menu-body` — arrows + list row/column (owns the strip background)
- `pano-scene-menu-list` — scrollable item list
- `pano-scene-menu-item` / `pano-scene-menu-thumb` / `pano-scene-menu-label`
- `pano-scene-menu-control` / `pano-scene-menu-arrow` / `pano-scene-menu-toggle`

The root also exposes `data-placement`, `data-align`, `data-orientation`
(`horizontal` | `vertical`), `data-expanded`, and `data-collapsible`. The active
item has `data-active="true"`; a visited item has `data-visited="true"` when
`showVisited` is enabled. The badge uses `pano-scene-menu-visited`.

When `collapsible` is set, `toggle` replaces the edge-tab icon or restyles that
button. Omit `toggle` to keep the default chevron. Pass an element (`<Icon />`)
for `icon`, not a component type. When the glyph depends on the collapsed
state, pass a function of `{ collapsed }` (`collapsed` is `false` while the
menu is expanded). `className` is appended to the button. `style` overrides
background, border, color, and size. Position and `transform` belong to the
edge layout; do not set them in `style`. The default chevron uses
`currentColor`, so `style.color` recolors it without replacing the icon.

```tsx
<PanoSceneMenu
  collapsible
  toggle={{ style: { color: "#7dd3fc" } }}
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>
```

```tsx
<PanoSceneMenu
  collapsible
  toggle={{
    className: "scene-tab",
    style: {
      background: "#0c4a6e",
      color: "#7dd3fc",
      border: "1px solid #7dd3fc",
    },
    icon: ({ collapsed }) => (collapsed ? "+" : "–"),
  }}
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>
```

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

Auto-rotation is off by default. Render `AutoRotate` inside `PanoViewer` to enable it and keep rotation configuration separate from user-input controls. `speed` is measured in degrees per second; use a negative value to rotate left. `acceleration` is measured in degrees per second squared and smoothly ramps from zero to `speed` (default: `18`, so the default speed takes one second to reach). Set it to `0` for an immediate fixed speed. `startDelay` is measured in milliseconds from when `enabled` becomes true (default `2`). While the user is dragging, or while drag inertia is still settling, rotation pauses and resumes from zero speed automatically. When the component is mounted and `enabled` is omitted, it is treated as `true`; omitting the component entirely means no auto-rotation.

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

### Props

- `src` / `sources` — `src` is the shared track, or the fallback when a scene is missing from `sources`. Either value may be a string or a string array (Howler multi-format fallback). `sources` keys are `Scene.id` values.
- `sceneId` — required when `sources` is set; omitting it throws.
- `playing` / `defaultPlaying` — controlled playback, or uncontrolled initial value (default `false`).
- `loop` — default `true`.
- `muted` — default `false`.
- `volume` — default `1`, range 0–1.
- `pauseWhenHidden` — default `true`; pauses while the page is hidden.
- `fadeMs` — crossfade milliseconds when the resolved track changes, default `400`; `0` is a hard cut.
- `crossOrigin` — `""` | `"anonymous"` | `"use-credentials"`; omit to leave unset.
- `onPlaybackStateChange` — `"playing" | "paused" | "ended" | "blocked"`.
- `onPlaybackError` — `play()` and other playback failures.
- `onEnded` — when the track finishes; uncontrolled mode also sets internal playing to `false`.
- `onError` — resource load failure, `{ error }` (distinct from `onPlaybackError`).

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

### Props

- `enabled` — default `false`. On iOS, call `requestPermission()` inside a user gesture before setting `true`.
- `camroll` — default `true`.
- `absolute` — default `false` (relative mode); `true` follows the compass.
- `north` — panorama yaw that represents North, in degrees, default `0`.
- `friction` — `0`–`0.99`, default `0`.
- `touchMode` — default `"full"`; see values above.
- `softstart` — blend seconds when enabling, default `0.5`.
- `desktopSupport` — default `false`.
- `onAvailable` / `onUnavailable` — when sensor capability detection changes.
- `onEnable` / `onDisable` — when a session actually starts / stops.
- `onDenied` — when permission is denied (examples often set `enabled` back to `false`).

These are props on `Gyro` itself. `PanoEvents` `onGyro*` callbacks subscribe to the same event bus for viewer-level listeners.

## WebVR

VR settings use independent v2 storage for simulated desktop and MobileVR; legacy v1 values are ignored. Reset affects the active fallback mode, or both outside VR. The neutral `none` preset uses 80° vertical FOV, 60 mm virtual eye spacing and centered optics regardless of physical screen size. Only MobileVR auto screen size queries DPDB (5-second timeout); ambiguous matches require manual calibration. Phone detection never selects a lens preset. Explicit props take precedence and their controls are read-only in Setup.


`WebVR` adds immersive viewing to the nearest `PanoViewer`. It prefers an
`immersive-vr` WebXR session on supported headsets. On phones without WebXR it
uses a stereoscopic split-screen view with device orientation, and on desktop
it can provide a mouse-driven simulated VR preview. Host apps provide Enter VR
through the viewer handle; the built-in chrome only shows Exit VR and MobileVR
setup controls while a session is active (they fade after idle interaction).

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
`isEnabled()`, `getMode()`, `getState()`, `subscribe()`, `requestPermission()`,
and `resetSettings()`. Modes are `"webxr"`, `"mobilevr"`, and `"fake"`.
`profile` accepts `"none"`, `"cardboard-v1"`, `"cardboard-v2"`, `"gear-vr"`,
`"daydream"`, or a custom `{ fov, ipdMm, k1, k2, screenToLensMm?, trayDistanceMm? }`
lens profile. When the physical screen size is known, MobileVR places each eye's
optical axis with the inter-lens distance and optional tray-to-lens height
(`trayDistanceMm`; Cardboard V1 uses `35`). `0` or omitted keeps the vertical
center. When `screensize` is `"auto"`, MobileVR loads the Cardboard Device
Parameter Database (`databaseUrl`, default Google's public DPDB) to estimate
diagonal inches; pass `""` or `null` to skip the request. Unknown devices fire
`onUnknownDevice` and keep the lens-profile FOV (no tray offset until a size is
known). MobileVR setup values are versioned and stored in the current origin's
`localStorage`; `resetSettings()` clears that storage and restores prop or
built-in defaults (also available from the Setup panel Reset control). In VR, a
center reticle shows a crosshair; looking at an interactive hotspot draws a
clockwise ring that fills over `cursorDwellMs` (default 1500), then the hotspot
click handler runs. Set `cursorDwellMs={0}` to keep the reticle without
auto-click. Simulated desktop VR (`fake` mode) requests pointer lock by default
(`mousePointerLock`) so the cursor hides and mouse movement looks around. Right-click
to release the mouse without leaving VR; left-click the view to lock it again.
While unlocked, the reticle is hidden and gaze actions stop; relocking starts
a fresh dwell. Desktop crosshair and ring sizes are 60% of the headset size.
Browser Escape behavior is preserved. If locking is denied or unsupported,
VR stays available with a normal cursor; a later left-click can retry. Fallback sessions keep the
screen awake (`wakelock`) with the Screen Wake Lock API, or a looping hidden
video on browsers that lack it.

WebXR requires HTTPS and a user gesture. Mobile sensor access also requires
HTTPS and may require an explicit iOS permission prompt. Embedded viewers need
appropriate `xr-spatial-tracking`, `gyroscope`, and `accelerometer` permissions.
DOM overlays such as iframe hotspots, tooltips, and video controls are not
visible inside an immersive headset session; mesh-based hotspots remain
interactive through the default WebXR controller rays.

### Props

- `chrome` — default `true` mounts session Exit / Setup UI (no Enter VR button). An appearance object may set `background` (default `rgba(16, 24, 32, 0.78)`), `color` (`#ffffff`), `accent` (`#7dd3fc`), `borderRadius` (`6`), `fontSize` (`14`), and optional `setupTitle`. Session buttons fade after ~3s idle while locked. Simulated VR keeps them visible while the mouse is unlocked; hovering, keyboard focus, and an open Setup panel also keep them visible.
- `mobileVr` — default `true`.
- `desktopSupport` — default `false` (independent of the same-named `Gyro` prop).
- `fakeSupport` — default `true` for mouse-driven desktop simulation.
- `screensize` — `"auto"` (factory / omitted storage default) or inches; numbers are clamped to **3–20** with one decimal place.
- `databaseUrl` — Cardboard DPDB URL for `"auto"` screensize. Default `https://storage.googleapis.com/cardboard-dpdb/dpdb.json`. Pass `""` or `null` to disable the online lookup.
- `profile` — omitted values use stored settings; factory default is `"none"`. Also accepts `"none"`, `"cardboard-v2"`, `"gear-vr"`, `"daydream"`, or a custom `{ fov, ipdMm, k1, k2, screenToLensMm?, trayDistanceMm?, label?, id? }`. `trayDistanceMm` is millimetres from the headset tray bottom to the lens center; `0` / omitted keeps the vertical optical axis at screen center.
- `absolute` — default `false`. Compass-oriented MobileVR heading (no effect in WebXR).
- `north` — default `0`. Panorama yaw that represents North when `absolute` is enabled.
- `friction` — default `0` (range `0–0.99`). MobileVR gyro smoothing; keep `0` for normal viewing.
- `touchSupport` — default `false`. When `true`, allows horizontal touch dragging to correct MobileVR heading (`horizontaloffset`). Disabled by default because headset trays can trigger false touches.
- `oversampling` — default `1`, clamped to **0.5–2**. Scales the MobileVR distortion render target only (viewports unchanged). For WebXR, sets the framebuffer scale factor before the session starts (cannot change mid-session).
- `foveation` — optional WebXR fixed foveation in **0–1**. Omit to keep the device default; `0` is full resolution, `1` is maximum edge downsampling.
- `frameRate` — optional WebXR target rate: `"low" | "mid" | "high"` or a numeric Hz (closest supported rate). Omit to keep the store default (`"high"`).
- `cursor` — default `true`; `false` hides the center reticle.
- `cursorDwellMs` — default `1500`; `0` disables auto-click.
- `wakelock` / `mousePointerLock` — both default to `true`.
- `onAvailable` / `onUnavailable` — VR capability changes.
- `onEnterVR` / `onExitVR` — mode `"webxr" | "mobilevr" | "fake"`.
- `onDenied` — permission or session denial, optional `error`.
- `onUnknownDevice` — when `"auto"` screensize cannot be resolved from the DPDB (disabled URL, no match, or fetch failure).

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

Override the default channel through `controls.mouse` or by rendering `<MouseControls />` as a child. A child instance does **not** inherit `controls.fovSpeed`; pass `fovSpeed` on the component when you need the cap.

- `enabled` — default `true`.
- `rotateSpeed` — default `0.35` (scales pointer displacement; `0` disables rotate).
- `zoomSpeed` — default `0.08`; each wheel step is `deltaY * zoomSpeed`.
- `wheel` — default `true`.
- `invert` — default `false`; may override shared `controls.invert`.
- `buttons` — default `["left"]`; values `"left" | "middle" | "right"`.
- `fovSpeed` — omit for no cap; when set, clamps each wheel step to `±fovSpeed` (not a per-second rate).

### TouchControls

One-finger drag and optional two-finger pinch zoom. Override through `controls.touch` or by rendering `<TouchControls />`.

- `enabled` — default `true`.
- `rotateSpeed` — default `0.35`, same meaning as mouse.
- `invert` — default `false`.
- `pinchZoom` — default `true`. Pinch changes FOV from the finger-distance ratio and is not limited by `fovSpeed`.

### KeyboardControls

Hold arrows (or custom bindings) for continuous look / FOV. Override through `controls.keyboard` or by rendering `<KeyboardControls />`. Child instances likewise do not inherit `controls.fovSpeed`.

- `enabled` — default `true`.
- `rotateSpeed` / `zoomSpeed` — default `60` / `30` (degrees per second).
- `shiftMultiplier` — default `3`.
- `invert` — default `false`; flips up/down only.
- `fovSpeed` — omit for no cap; when set, limits with `min(zoom, fovSpeed * dt)`.
- `keys` — replaces an action wholesale when that key is present; omitted actions keep defaults; an empty array unbinds the action. Matching compares both `event.key` and `event.code` (lowercased).
- `onPreviousScene` / `onNextScene` — keys still `preventDefault` when bound; without a callback the scene does not change.

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

Default bindings: arrows and WASD for look; zoom in with `+` and `=`, zoom out with `-` and `_`; `0` resets; `[` / `PageUp` and `]` / `PageDown` for previous/next scene (without callbacks the scene does not change, but the key may still be intercepted). The same child-override pattern works with `MouseControls` and `TouchControls`. Set `controls.mouse={false}` / `controls.touch={false}` / `controls.keyboard={false}` only when you want that channel off.

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

- View: `onViewChange` (`onviewchange`), `onViewSettled` — both receive `{ yaw, pitch, fov }`. `viewchange` fires while the view moves; `viewsettled` fires when inertia/tween first stops or a commanded animation ends.
- `onViewInteractionStart` / `onViewInteractionEnd` — `{ source }` with `source` `"mouse" | "touch" | "keyboard"`.
- Pointer on the panorama shell (not hotspots): `onClick`, `onDoubleClick`, `onPointerDown`, `onPointerUp`, `onPointerMove`, `onContextMenu` — `PanoramaPointerEvent` with `position`, `nativeEvent`, `button`, `buttons`, `clientX`, `clientY`, and optional `pointerId`.
- `onWheel` — mouse wheel only; touch pinch does not synthesize a wheel event. Payload `{ delta, nativeEvent }`; `delta` matches the sign of `WheelEvent.deltaY`.
- Idle: `onIdle` / `onIdleEnd` with per-instance `idleTime` (ms, default `2000`)
- Fullscreen: `onEnterFullscreen` / `onExitFullscreen` (no payload)
- `onResize` — `{ width, height }` from a content-box `ResizeObserver`
- Auto-rotate: `onAutoRotateStart` / `onAutoRotateStop` / `onAutoRotateOneRound` (no payload)
- Gyro: `onGyroAvailable` / `onGyroUnavailable` / `onGyroEnable` / `onGyroDisable` / `onGyroDenied` (no payload)
- VR: `onVRAvailable` / `onVRUnavailable` / `onVREnter` / `onVRExit` / `onVRDenied` / `onVRUnknownDevice`. Enter/exit carry mode `"webxr" | "mobilevr" | "fake"`; `onVRDenied` may include an optional `error`.

`PanoViewer`'s existing `onViewChange` / `onPanoramaClick` / `onPanoramaDoubleClick` /
`onPanoramaPointerMove` props remain supported and share the same event bus.
`usePanoEvents` accepts the same props as `<PanoEvents>` and returns nothing.

Resource callbacks belong to each source: `Sphere` provides `onLoad`,
`onError`, and `onPreviewError`; `Tile` / `SphereTile` provide `onLoadProgress`,
`onTileError`, and `onPreviewError`. Sources report initial render readiness
through `onReady`. Use `Scenes` callbacks `onSceneReady`, `onTransitionEnd`,
and `onTransitionError` for scene state. This package does not mirror krpano
XML-loading or frame-render events one-to-one; use the `onVR*` callbacks above
for VR lifecycle.

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

Override presentation on a preset with `{ preset: "fullscreen", label: "…" }`;
presets may also override `id`, `className`, `style`, `disabled`, and `hidden`.
For fully manual assembly outside the prop (for example a custom
`PanoContextMenu` child), call `createPanoContextMenuPresets({ reset,
toggleFullscreen, isFullscreen })` and use `.resetView` / `.fullscreen` /
`.defaults`.

Concrete items may use an `icon` React node or an `image` URL (optional
`imageAlt`). Items may also set `disabled`, `hidden`, `className`, and `style`.
`onSelect` receives `position`, `view`, `nativeEvent`, and `close()`. Separators
always come from the `"separator"` preset.

When `items` is provided, `prepend` / `append` are ignored. `children` is a
full custom render: `(props: { event, view, close }) => ReactNode`; it takes
precedence over `items` while open/close/positioning stay with the component.
`className`, `style`, `itemClassName`, and `separatorClassName` are also accepted.

Appearance fields and defaults: `background` `#161616`, `color` `#f4f4f4`,
`border` `"1px solid #2e2e2e"`, `borderRadius` `8`,
`shadow` `"0 8px 24px rgba(0,0,0,0.45)"`, `opacity` `1` (background only,
clamped to `[0.4, 1]`; labels and icons stay opaque), `fontSize` `13`,
`minWidth` `180`, `padding` `4`, `iconSize` `16`, `itemPadding` `"6px 10px"`,
`itemHoverBackground` `#2a2a2a`, `itemDisabledColor` `#777777`,
`separatorColor` `#333333`, `separatorMargin` `"4px 6px"`. For an explicit
translucent fill without using `opacity`, you can still pass
`background: "rgba(...)"`.

For a fully custom DOM menu, set `contextMenu={false}` and render
`PanoContextMenu` as a child. Do not mount both the default menu and a child
`PanoContextMenu` at once. Avoid combining the context menu with
`controls.mouse.buttons: ["right"]` — both claim the right mouse button.

## Shared hotspot contract and saved definitions

Every hotspot has an `id`, optional shared fields, and semantic interaction
callbacks. Point hotspots additionally use a controlled `position`, angular
`width`/`height`, hotspot mode, and the zoom options described below.
`interactive={false}` keeps a hotspot visible while letting a drawing tool
receive the panorama pointer events beneath it. `pointerEvents="none"` ignores
mouse, touch, and pen so those events pass through to the panorama even when
the hotspot stays keyboard-interactive. Interactive hotspots set the canvas
cursor to `pointer` while hovered, or to the hotspot's `cursor` prop when that
is set.

Shared field defaults and usage:

- `visible` — default `true`.
- `renderOrder` — default `0` for point hotspots; `10` for polygons / polylines.
- `opacity` — default `1`; applies to point-hotspot textures / iframes.
- `selected` — default `false`; when `true`, draws an ~3px selection outline (common in authoring).
- `interactive` — default `true`; `pointerEvents` defaults to `"auto"`.
- `onHoverChange(hovered, event)` — boolean hover state, then the interaction event.
- `onClick` — position and input source (`"pointer"` or `"keyboard"`).
- Point-hotspot drag: with `draggable`, `onDragStart` fires at the start,
  `onPositionChange` reports the new position while moving (the host must write
  it back), and `onDragEnd` fires on release. Polygon / polyline callbacks with
  the same names carry vertex sets — see those sections.

Default angular size when `width` / `height` are omitted: `ImageHotspot` /
`SequenceHotspot` `12×8`; canvas `GraphicHotspot` `10×10` (`12×8` when
`kind: "svg"` loads as an image); `VideoHotspot` `16×9`; `AudioHotspot` `8×8`;
`TextHotspot` `16×6`; `IframeHotspot` `18×12`.

```tsx
<TextHotspot
  id="caption"
  pointerEvents="none"
  position={{ yaw: 12, pitch: -8 }}
  text="Decorative label"
/>
```

Point hotspots can use `draggable`, `onDragStart`, `onPositionChange`, and
`onDragEnd`; the host must write the reported position back to its state.
Polygon and polyline hotspots report controlled `vertices` through
`onVerticesChange`.

Every hotspot can show a DOM tooltip at its anchor. Pass a string or
`{ text?, image?, imageAlt? }` as `tooltip`. The default `tooltipTrigger` is
`"always"`: if content is present and the hotspot is visible, the bubble stays
on screen. Clicking the hotspot does not toggle it. Optional
`tooltipTrigger="hover"` shows the bubble on pointer hover or keyboard focus;
`"click"` pins it until the hotspot is clicked again or the empty panorama is
clicked. Hover and click triggers need `interactive` and `pointerEvents`
other than `"none"`.

`tooltipMode` defaults to `"billboard"` and supports `"surface"`. `tooltipScaleMode` defaults to `"inherit"`, following the hotspot’s effective zoom behavior. Floating tooltips also support `"fov"` and `"fixed"`; surface tooltips always scale with FOV. Styling is measured at the hotspot’s `referenceFov` (default `75`), while the gap remains in screen pixels. Polygon and polyline geometry always follows the sphere, without floating, distance or scale-mode controls; their tooltips remain independently configurable and default to floating with FOV scaling. Omitted settings in existing projects use these new defaults too.

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
error reporting belong. Project JSON `label` is not a component prop;
`ProjectScenes` uses `hotspot.label || hotspot.id` as the accessible name
(`ariaLabel`). `selected` exists only on runtime props and is not part of the
saved definition.

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

`ImageHotspot` calls `onLoad(texture)` and `onError(error)`. When size is
omitted, defaults are `width={12}` and `height={8}`.

## GraphicHotspot

`GraphicHotspot` accepts built-in `circle`, `triangle`, `diamond`, `star`,
`arrow`, `rectangle`, and `ring` graphics, an SVG URL, or safe SVG path data
with an explicit viewBox. Built-in graphics support `fill`, `stroke`, and
`strokeWidth`; rectangles support a relative `cornerRadius` from `0` to `0.5`;
rings support `innerRadius` (fraction of the outer radius, default `0.58`).
Canvas `strokeWidth` is line width on the **512** texture (default `8`), not
the CSS-pixel stroke used by polygons. `kind: "path"` needs `path` and
`viewBox: [x, y, width, height]`.

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
markup. Canvas graphics default to angular size `10×10`; `kind: "svg"` image
loads default to `12×8`.

## Hotspot mode and zoom behaviour

Point hotspots use `mode` to configure orientation and placement together:

- `mode="surface"` attaches the plane to the local panorama surface.
- `mode="billboard"` keeps the plane facing the camera and floats it in front
  of the shell. `distance` is the distance from the camera (world units, default `10`);
  decrease it to move the hotspot nearer.
  The built-in panorama shell is at roughly `1000` units; distance is
  automatically capped so the hotspot's corners cannot cross it.
- Floating hotspots default to `scaleMode="fixed"`; choose `"fov"` to scale with zoom. Surface hotspots always use `"fov"`, even when `"fixed"` was saved.
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

Defaults: `fill` `#df6b42`, `fillOpacity` `0.34`, `stroke` `#f5fbfc`,
`strokeWidth` `2`, `strokeOpacity` `1`, `renderOrder` `10`. `onDragStart` /
`onDragEnd` / `onVerticesChange` carry vertex events (`vertices`,
`startVertices`, `position`, `startPosition`), not point-hotspot drag events.
`onInvalid` codes are `too_few_vertices`, `self_intersection`,
`contains_pole`, and `outside_hemisphere`.

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

`onInvalid` reports the only invalid runtime shape: fewer than two vertices
(`code: "too_few_vertices"`). Defaults: `stroke` `#f5fbfc`, `strokeWidth` `2`,
`strokeOpacity` `1`, `renderOrder` `10`. Drag callbacks likewise carry a
vertex set (`PolylineVerticesChangeEvent`).

## SequenceHotspot

`SequenceHotspot` animates a sprite sheet: one image containing equally sized
frames in a vertical or horizontal strip. This matches the common krpano
animated-hotspot format. Give `width` and `height` the aspect ratio of a single
frame, rather than the full strip. `playing` is controlled by the host; `fps`
defaults to `12`, `loop` to `true`, and `frameDirection` to `"vertical"`.
Omitted size defaults to `12×8`.

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

Sequence loading uses `onLoadProgress` (`{ id, total, loaded, failed }`) and
`onError` (`{ id, src, error }`). Also available: `onFrameChange`
(`{ id, index, src }`) and `onPlaybackStateChange`
(`"playing" | "paused" | "ended"`, no `"blocked"`). The component does not
change `playing` by itself: update that prop in response to your UI, click
handler, `onEnded`, or playback error.

## VideoHotspot

`VideoHotspot` uses an `HTMLVideoElement` and `VideoTexture`. Its `playing`
prop is likewise controlled: initialize it to `false` for manual playback, then toggle it from your click handler or application state. On source change or unmount, the element is paused and its texture is
released. `playsInline` defaults to `true` and uses the same inline-playback
attributes as `PanoVideo`. The element is mounted inside the viewer, hidden,
so mobile browsers keep it in the page. `muted` defaults to `false`, `loop` to
`false`, `preload` to `"metadata"` (also `"none"` | `"auto"`), and `volume` to
`1` (0–1). Omitted size defaults to `16×9`. Cross-origin media may set
`crossOrigin` (`""` | `"anonymous"` | `"use-credentials"`).

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
  volume={0.8}
  onClick={() => setClipPlaying((playing) => !playing)}
  onEnded={() => setClipPlaying(false)}
  onPlaybackStateChange={(state) => console.log(state)}
  onPlaybackError={(error) => console.error(error)}
/>;
```

Loading or entering VR does not start playback. Readiness events and seeking preserve controller-set mute and volume; changing the corresponding props or source applies the new settings. Pass `muted` explicitly when you want silent playback. Browsers can reject unmuted or otherwise non-gesture playback. In that case
`onPlaybackStateChange` receives `"blocked"` and `onPlaybackError` receives
the browser error; retain control of `playing` in the host and offer an
explicit user action.

Video reports media and poster failures through `onError`, including
`source: "poster" | "video"`. Like `SequenceHotspot`, it does not change
`playing` by itself. This keeps source changes, unmounts, and React StrictMode
lifecycles deterministic.

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

For extensionless sources such as `blob:` URLs, pass `format="mp3"` (or an array of container hints in source order). The optional `format` field is also supported by audio definitions in `project.json`.

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
itself. Omitted marker size defaults to `8×8`. `crossOrigin` is also accepted;
load failures go to `onError({ id, error })`, distinct from `onPlaybackError`.

## TextHotspot

`TextHotspot` rasterizes plain text onto a canvas texture. It does not accept
HTML or Markdown. `\n` is a hard line break; `whiteSpace="normal"` (default)
wraps words to the hotspot's angular width; `"nowrap"` is also accepted.
Dimensions stay in degrees like the other point hotspots; the default panel is
`16×6`. Typography uses the same names as CSS (`fontFamily`, `fontSize`,
`fontWeight`, `fontStyle`) but is painted onto the canvas, not applied as DOM
style. `fontSize` is canvas pixels (default 96) and does not scale with panel
height. `fontWeight` defaults to `600` and `fontStyle` to `"normal"`. `align`
defaults to `"center"` (`left` | `center` | `right`); `verticalAlign` defaults
to `"middle"` (`top` | `middle` | `bottom`). `color` defaults to `#f8fafc`;
`background` defaults to `#111827` (empty string skips the panel fill);
`backgroundOpacity` defaults to `0.72`. `padding` defaults to `0.08` and
`borderRadius` to `0.08` (fractions of the shorter side, `0`–`0.5`).
`lineHeight` defaults to `1.25` (multiple of font size). `stroke` /
`strokeWidth` draw an outline when `strokeWidth > 0` (default width `0`).

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
`referrerPolicy` defaults to `strict-origin-when-cross-origin`. Also accepted:
`title` (falls back to `ariaLabel`), `allow`, `loading` (`"eager"` | `"lazy"`),
`background`, and `onLoad` / `onError`. Omitted size defaults to `18×12`. Prefer
a same-origin document; many third-party sites send `X-Frame-Options` and will
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

### Camera-center limits

`PanoViewer`, every `Scenes` scene, and each `project.json` scene accept optional `viewLimits`:

```ts
viewLimits: {
  yaw: { min: 170, max: -170 },
  pitch: { min: -30, max: 45 },
  fov: { min: 40, max: 90 },
}
```

Angles are degrees. Yaw bounds are within −180…180; min > max crosses the seam. −180…180 allows a full circle. Pitch bounds are within −90…90, FOV within 1…179; both require min ≤ max. Equal bounds lock an axis. Scene axes override viewer axes individually; omitted axes inherit viewer settings, with existing `minFov` / `maxFov` (30 / 100 by default) as the FOV fallback. Bounds apply to the camera center, including pointer, touch, keyboard, inertia, auto rotation, gyro and view navigation APIs; they do not keep the entire visible image inside the bounds. Explicit axes have hard boundaries even with `bouncingLimits`. Limited yaw animations stay in the permitted arc, overriding a shorter path through forbidden angles. Immersive WebXR remains controlled by the headset.

Scene limits take effect when the incoming scene takes over, before its initial view. Live changes cancel navigation and inertia and constrain the current view without rewriting authored initial views or reloading textures. Removing scene limits restores viewer limits.

### Hotspot interaction events and custom actions

`events` maps `click`, `pointerenter`, and `pointerleave` to one action each. Every event supports `scene`, `view`, `popup`, and `{ type: "custom", actionId, params? }`. `params` is a JSON object; functions, credentials, API implementations and form definitions belong to the host. Parameter strings are not resolved or packaged as assets.

```json
{"events":{"click":{"type":"scene","sceneId":"hall"},"pointerenter":{"type":"custom","actionId":"product.preview","params":{"visible":true}},"pointerleave":{"type":"custom","actionId":"product.preview","params":{"visible":false}}}}
```

Legacy `action` remains a click fallback; `events.click` wins. Editing or clearing click removes the legacy fallback. Loading a project does not migrate it. New event configurations require an updated viewer (project schemaVersion remains 1). Media without a click action still toggles playback; hover has no default action.

`ProjectScenes.onHotspotEvent(event)` receives `trigger`, `sceneId`, `hotspot`, `interaction` and `preventDefault()`. On clicks it runs before the existing `onHotspotClick`; either callback can cancel the action. `onCustomAction(event)` additionally receives `action` and may return a Promise. Dispatch by the stable `action.actionId`, validate business parameters and throw for unknown actions. Missing handlers, synchronous exceptions and rejected Promises reach `onHotspotError` with `trigger`. Requests, authentication, cancellation, duplicate prevention and response ordering are host responsibilities; events dispatch independently without automatic retries.

Hover runs once per logical hotspot boundary, skips touch and keyboard focus, and respects visibility and pointer interaction settings. Scene changes, hiding and unmounting clear hover state without executing leave actions. Existing tooltip behavior is independent. Custom renderers must forward `context.onHoverChange(hovered, interaction)` as well as `context.onClick`; `context.renderDefault()` wires both automatically.

## VR control groups

Customizable VR-only icon groups support media, models and scrolling. See the [VR controls guide](./docs/dialogs.md#vr-icon-controls-and-scrolling) for APIs and examples.

## WebVRSceneMenu

Mount beside `WebVR` and `Scenes` inside `PanoViewer`. This native spatial menu appears in WebXR, MobileVR and desktop simulated VR. Previous/next buttons surround a circular scene-menu button below the current view. Opening it reveals a curved thumbnail grid with pagination, gaze/pointer controls and accessible keyboard buttons. The active scene has a border and check mark; reopening locates its page.

```tsx
<WebVRSceneMenu
  items={[
    { id: "hall", thumbnailUrl: "/hall.webp", title: "Hall" },
    { id: "garden", thumbnailUrl: "/garden.webp", title: "Garden" },
  ]}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
  columns={4}
  rows={3}
  appearance={{ labelPlacement: "center", selectionColor: "#ffffff" }}
/>
```

Items reuse `PanoSceneMenuItem`. Titles default to centered image overlays, wrap to two lines and truncate with an ellipsis. Empty titles fall back to IDs; accessible names retain the full title. Thumbnail sources must permit cross-origin image access. Cards remain selectable when images fail.

| Prop | Default / range |
| --- | --- |
| `layout` | `"compact"` (default, original curved grid), `"flat"` (flat wall), or `"arc"` (independent flat cards around the viewer) |
| `displayMode` | `"paged"` (default) or `"all"`; all mode grows rows, ignores `rows`, and hides paging controls |
| `arcAngle` | 180°; clamped to 60–360°, used only by arc layout |
| `columns`, `rows` | compact/flat: 4 columns; arc: automatic (8 at 180°, 16 at 360°). Column ranges: compact 2–4, flat/arc 2–24. Paged rows: 3, range 1–3 |
| `loop` | `true`; wraps scene navigation, never pagination |
| `closeOnSelect` | `true`; use `false` for continuous browsing |
| `follow` | `true`; collapsed navigation follows the view, with a vertical comfort zone; `false` keeps the original fixed heading/world pitch |
| `followPitch` | `true`; requires `follow`; `false` restores horizontal-only following |
| `navigationPitch` | −25 degrees; −40 to −15; view-relative offset when both follow options are enabled, otherwise fixed world pitch |
| `distance`, `scale` | 2 meters, 1; ranges 1.5–3, 0.75–1.25 |
| `fadeDurationMs` | 200; 0–600ms, respects reduced motion |
| `showTitles` | `true` |
| `showVisited`, `visitedLabel` | `false`, `"Visited"`; icon-only visit badge and its accessible description |

Dwell timing inherits `WebVR.cursorDwellMs`. `activeId` owns selection; `onSelect` requests navigation from the host, which retains scene loading/error handling. Dialogs and VR Setup temporarily hide the menu. Empty lists render nothing; a single scene disables previous/next navigation.

The bounded `appearance` interface includes `controlColor` (white), `controlBackground` (`transparent`), `controlOpacity` (0.75, range 0–1), `selectionColor` (white), `focusColor` (`#7dd3fc`), `selectionWidth` (4, range 0–8), `borderRadius` (8, range 0–48), `labelColor` (white), `labelBackground` (`transparent`), `fontSize` (28, range 16–48), and `labelPlacement` (`"center"` or `"bottom"`). Scene outlines meet the thumbnail edge from the outside. Selected, gaze and keyboard-focus borders share `selectionWidth`; zero hides them while retaining a separate keyboard-focus indicator. The optional visited check icon is independent of selection and remains visible at zero border width. The current scene uses `selectionColor`; gaze and keyboard focus use `focusColor`, taking priority on the current scene. Sizes use reference-canvas pixels and follow the overall scale. Exports include `WebVRSceneMenuProps`, `WebVRSceneMenuAppearance`, and `DEFAULT_WEBVR_SCENE_MENU_APPEARANCE`.

`showVisited` and `visitedLabel` follow the same session and scene-ready rules as `PanoSceneMenu` above. The badge remains visible when `showTitles={false}` or a thumbnail fails to load. Dialogs, VR Setup, pagination and VR re-entry preserve the shared viewer history.

The `/webvr` example teaches VR entry, exit, capability events and gaze activation. `/vr-scene-menu` includes behavior, layout and appearance controls, editable scene titles, a 25-scene pagination fixture, reset, and a regular scene menu for checking shared visit history across VR entry/exit. `/spatial-controls` teaches media, model and scrolling targets; `/immersive-tour` combines them. Settings live in page state only.

The floating navigation is a compact button group with equal-height icons, transparent backgrounds and subtle shadows for contrast against the panorama.

Vertical following is enabled by default. Navigation starts below the current view and stays still while its relative pitch is between `navigationPitch − 15°` and `+10°`. Outside that comfort zone it eases toward the configured offset with a 0.2-second time constant, limited to ±75° world pitch, without following head roll. Gaze/ray hits and keyboard focus pause both axes. A padded aiming region also pauses following before an exact hit, and recovery stops before crossing the reticle, so the controls remain reachable. Set `followPitch={false}` for the previous horizontal-only behavior, or `follow={false}` for fixed navigation. Closing the grid reanchors navigation below the current view before fading it in.

Flat and arc layouts use bounded texture atlases. Compact/flat default to four columns; arc defaults to one column per 22.5° (8 for a semicircle, 16 for a full circle). Compact supports 2–4 columns; new layouts support 2–24. Paged rows default to 3, clamped to 1–3. All mode extends the wall without shrinking cards, so large lists require more looking around. All three layouts open at the current heading and pitch (limited to ±75°, without head roll), then follow translation but not head rotation. New layouts keep close/paging controls in a separate forward control strip. The `/vr-scene-menu` playground exposes layout, display mode, and arc angle; leave columns blank for automatic defaults.

VR scene titles default to a transparent background with a subtle dark text shadow. Menu textures use 2× raster resolution, mipmaps and anisotropic filtering while layout and hit areas remain unchanged.
