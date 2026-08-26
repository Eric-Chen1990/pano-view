# Pano View

**English** | [简体中文](./README.zh-CN.md)

Composable React components for equirectangular images, 360 video, and
krpano-style multiresolution cube tiles. Build the panorama experience inside
your application with your own React UI, controls, routes, and data.

Try the [live playground](https://pano-view-playground.vercel.app/?utm_source=github&utm_medium=readme&utm_campaign=repository&utm_content=playground) to explore
hotspots, scene transitions, 360 video, WebXR, filters, and cube-tile scenes.

## Start in 30 seconds

~~~bash
pnpm add @ericchen1990/pano-view
~~~

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

Install the supported React, Three.js, React Three Fiber, Drei, and XR peer
dependencies in the host application. See the package README for supported
ranges, styles, Next.js use, and the complete API.

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

## Components and guides

The package exports PanoViewer, Sphere, PanoVideo, Tile, Scenes, hotspots,
controls, hooks, and helpers. Start with the [full package
README](./packages/react/README.md), [360 video guide](./docs/react-360-video.md),
or [中文 360 视频指南](./docs/react-360-video.zh-CN.md).

This repository is a pnpm workspace containing the publishable package and its
Vite Playground. The Playground imports component source directly, so local
component changes are visible without a package rebuild.

## Local development

~~~bash
pnpm install
pnpm dev
~~~

## Validation

~~~bash
pnpm typecheck
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
