# Pano View · [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![pano-view npm version](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-view.svg?style=flat&label=pano-view)](https://www.npmjs.com/package/@ericchen1990/pano-view) [![converter npm version](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-converter.svg?style=flat&label=converter)](https://www.npmjs.com/package/@ericchen1990/pano-converter) [![CI](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml) [![Converter](https://github.com/Eric-Chen1990/pano-view/actions/workflows/converter.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/converter.yml) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Eric-Chen1990/pano-view/pulls)

**English** | [简体中文](./README.zh-CN.md)

Pano View provides a React viewer and a Node.js converter for panoramic images
and 360 video. Host applications compose the panorama experience with React
components and manage their own UI, controls, routes, and data.

Try the [live playground](https://pano-view-playground.vercel.app/?utm_source=github&utm_medium=readme&utm_campaign=repository&utm_content=playground) to explore
hotspots, scene transitions, 360 video, WebXR, filters, and cube-tile scenes.

## Contents

- [Packages](#packages)
- [Data sources and choosing an approach](#data-sources-and-choosing-an-approach)
- [Static multi-scene projects](#static-multi-scene-projects)
- [Installation](#installation)
- [Examples](#examples)
  - [Equirectangular image](#equirectangular-image)
  - [Cube tiles](#cube-tiles)
  - [360 video](#360-video)
  - [Multiple scenes](#multiple-scenes)
- [Reuse existing krpano tile output](#reuse-existing-krpano-tile-output)
- [Guides](#guides)
- [Local development](#local-development)
- [Validation](#validation)
- [Publishing](#publishing)
- [Maintainer and support](#maintainer-and-support)

## Packages

| Package | What it does |
| --- | --- |
| [@ericchen1990/pano-view](./packages/react/README.md) | Composable React components for equirectangular images, 360 video, and krpano-style multiresolution cube tiles. |
| [@ericchen1990/pano-converter](./packages/converter/README.md) | Node.js library and `pano-convert` CLI. It builds tile pyramids, previews, and the `viewerConfig` the React package renders. It does not depend on React, cloud storage, or a database. |

The sections below use the viewer. Generate a new tile pyramid with the converter, then pass its `viewerConfig` to `Tile`, `SphereTile`, or `Scenes`.

## Data sources and choosing an approach

The viewer accepts configuration objects or loads JSON over HTTP. Choose where your application stores and serves that configuration:

- **Static JSON + CDN:** serve `project.json` and scene `viewer.json` files from static hosting. Loading configuration requires no database queries; storage, requests and traffic still have costs. Updates require publishing files and managing caches.
- **Database + backend API:** your backend queries and authorizes the data, then supplies configuration objects or a JSON API response. The viewer does not connect to the database. This suits editing, private content and per-user configuration; backend availability, query costs and cache management belong to your application.

**Prefer JSON + CDN for public, published tours; prefer database + API for editing previews, private content and personalization.** If you need both, keep the database as the editing source and generate a JSON snapshot on publication. Neither path automatically subscribes to configuration changes: the host must reload data and update the viewer in an already-open page.

See [Data sources and choosing an approach](./packages/react/README.md#data-sources-and-choosing-an-approach) for the comparison and database example, and [Caching and publishing updates](./packages/react/README.md#caching-and-publishing-updates) for versioned URLs, cache headers and CDN invalidation.

## Static multi-scene projects

The converter writes a complete `manifest.json` for archiving/reconstruction and a compact `viewer.json` for rendering. Without a database, author one `project.json` referencing each scene's `viewer.json`, plus its views, hotspots and scene links.

```tsx
import { loadPanoProject, PanoViewer, ProjectScenes } from "@ericchen1990/pano-view";

const project = await loadPanoProject("/tour/project.json");
// Render in your React app after metadata loading completes:
<PanoViewer style={{ height: 600 }}>
  <ProjectScenes project={project} transition="dissolve" />
</PanoViewer>;
```

Preserve the output directory structure when uploading to static hosting. Use `baseUrl` for custom domains/cloud prefixes, or synchronous URL mapping for renamed files. Server-side data consumers import from `@ericchen1990/pano-view/data`. Run `pnpm dev` and visit `/project` for the static two-scene example.

See [Static projects and JSON data](./packages/react/README.md#static-projects-and-json-data) for configuration and React loading/error/cancellation, and [FAQ and troubleshooting](./packages/react/README.md#faq-and-troubleshooting) for CORS, 404, authentication, blank canvases and playback restrictions.

## Installation

Install [@ericchen1990/pano-view](./packages/react/README.md) in the host
application. Peer-dependency installation depends on your package manager
and settings. Ensure that all required peers are installed using the ranges in
the [package README](./packages/react/README.md#peer-dependencies). Converter installation is in
the [converter README](./packages/converter/README.md#install).

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

Import the shipped stylesheet once when you use built-in HTML overlays such as
video controls, captions, tooltips, the context menu, or WebVR UI. The WebGL
panorama itself renders without it.

```ts
import "@ericchen1990/pano-view/styles.css";
```

Supported React, Three.js, React Three Fiber, Drei, and XR ranges, Next.js
use, and the complete API are in the [package README](./packages/react/README.md).

## Examples

Give `PanoViewer` an explicit size and render one panorama source inside it.
These snippets show the basic setup for each source. The package README has
the full props, hotspots, controls, and hooks.

### Equirectangular image

`Sphere` expects a 2:1 image. `previewUrl` is required and shows a low-resolution
2:1 image while `src` loads. Relative preview paths resolve against the
directory of `src`.

Prefer [cube tiles](#cube-tiles) for high-resolution panoramas to load by view
and reduce the cost of one oversized texture. `Sphere` loads the full image
and is constrained by device texture-size and memory limits. The current
spherical renderer may still show visible artifacts near the poles. Provide a
small `previewUrl` for a faster initial display. See
[Sphere](./packages/react/README.md#sphere).

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

### Cube tiles

Copy `url`, `multires`, and the preview path from the krpano XML. The package
default tile path is not the same as krpano's on-disk naming.

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

Read the [krpano migration guide](./docs/krpano-migration.md) before replacing
`Sphere` with `Tile`. The [Tile reference](./packages/react/README.md#tile)
documents placeholders, preview face order, and custom resolvers.
[@ericchen1990/pano-converter](./packages/converter/README.md) can generate
this pyramid and return the same `urlTemplate`, `multires`, and `previewUrl`
fields on `viewerConfig`.

### 360 video

`PanoVideo` maps a 2:1 equirectangular video onto the same sphere. `muted`
defaults to `true` for better autoplay compatibility; browser policy still applies.

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

Variants, captions, and custom controls are in the [360 video
guide](./docs/react-360-video.md) and the [PanoVideo
reference](./packages/react/README.md#panovideo). Try it in the [playground](https://pano-view-playground.vercel.app/video?utm_source=github&utm_medium=readme&utm_campaign=repository&utm_content=video).

### Multiple scenes

`Scenes` switches single-image, cube-tile, and equirectangular-tile scenes
with GPU snapshot blending. Use controlled `activeSceneId` when the host UI
needs to read the current scene ID.

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

Scene props, transition presets, and hotspots are in the [Scenes
reference](./packages/react/README.md#scenes). The [scene transition
playground](https://pano-view-playground.vercel.app/scene-transitions?utm_source=github&utm_medium=readme&utm_campaign=repository&utm_content=scenes)
runs the same component.

## Reuse existing krpano tile output

Pano View can render a krpano-style cube-tile pyramid in a React application.
Copy the values from your krpano XML rather than assuming the package default
path layout:

| krpano XML | Pano View prop |
| --- | --- |
| cube url | urlTemplate |
| cube multires | multires |
| preview url | previewUrl |
| preview striporder | previewFaceOrder |

Read the [English krpano migration guide](./docs/krpano-migration.md) or
[中文迁移指南](./docs/krpano-migration.zh-CN.md). Pano View supports this tile
output format, but is not a krpano plugin, wrapper, replacement, or affiliated
project.

## Guides

- [@ericchen1990/pano-view](./packages/react/README.md) — component API, hotspots, controls, and hooks
- [@ericchen1990/pano-converter](./packages/converter/README.md) — Node.js and CLI tiling and reconstruction
- [360 video guide](./docs/react-360-video.md) — inline playback, captions, and mobile activation
- [krpano migration guide](./docs/krpano-migration.md) — XML attributes to component props

The Vite Playground in this workspace imports viewer source directly, so local
component changes are visible without a package rebuild.

## Local development

~~~bash
pnpm install
pnpm dev
~~~

## Validation

~~~bash
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
git diff --check
~~~

## Publishing

This repository publishes through Changesets. Do not use npm version or npm
publish directly.

1. Run pnpm changeset and describe the package change.
2. Run pnpm version-packages to generate versions and changelog entries.
3. Run pnpm release only after the relevant changeset, changelog, typecheck,
   and build have been verified.

## Maintainer and support

Maintained by [Eric Chen](https://github.com/Eric-Chen1990). Report bugs and
feature requests through the [GitHub issue
tracker](https://github.com/Eric-Chen1990/pano-view/issues).
