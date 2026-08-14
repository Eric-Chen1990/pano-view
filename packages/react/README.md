# @pano-view/react

Composable React components for equirectangular and krpano-style multiresolution panorama viewers.

## Install

```bash
npm install @pano-view/react react react-dom three @react-three/fiber
```

React 19, React DOM 19, `@react-three/fiber` 9, and Three.js are peer dependencies.

## Sphere panorama

`PanoView` owns the canvas, perspective camera, and controls. Give its container an explicit size and place one panorama source inside it.

```tsx
"use client";

import { PanoView, Sphere } from "@pano-view/react";

export function SphereExample() {
  return (
    <PanoView style={{ width: "100%", height: 560 }}>
      <Sphere src="/panoramas/room.webp" />
    </PanoView>
  );
}
```

`Sphere` expects a 2:1 equirectangular image. Use `yawOffset` when the source's forward direction needs horizontal adjustment.

## Cube Tile panorama

`Tile` renders six inward-facing cube faces and loads only tiles around the current view. The default layout matches krpano-style output:

```text
tiles/{face}/l{level}/{row}/l{level}_{face}_{col}_{row}.webp
```

Faces are `f`, `r`, `b`, `l`, `u`, and `d`; rows and columns are 1-based.

```tsx
import { PanoView, Tile } from "@pano-view/react";

export function TileExample() {
  return (
    <PanoView style={{ width: "100%", height: 560 }}>
      <Tile
        baseUrl="https://cdn.example.com/panoramas/room"
        multires="512,500,1000,2000"
      />
    </PanoView>
  );
}
```

The first `multires` value is the tile size. Remaining values are ascending cube-face sizes for `l1`, `l2`, and later levels. The default preview is `${baseUrl}/previews/cube-vertical.webp`, with faces stacked as `f/r/b/l/u/d`.

During rapid rotation or zoom, loaded tiles remain visible while newly visible tiles use their parent level or the preview as a local fallback.

Override storage conventions with either a krpano placeholder template or a resolver:

```tsx
<Tile
  baseUrl="/panoramas/room"
  multires={{ tileSize: 512, levels: [500, 1000, 2000] }}
  urlTemplate="/assets/%s/%l/%v_%h.webp"
  resolveTileUrl={({ face, level, row, col }) =>
    `/api/tile/${face}/${level}/${row}/${col}`
  }
/>
```

`resolveTileUrl` takes precedence over `urlTemplate`.

## Controls and imperative API

Angles are public degrees. Positive yaw looks right and positive pitch looks up.

```tsx
import { useRef } from "react";
import {
  PanoView,
  Sphere,
  type PanoViewHandle,
} from "@pano-view/react";

export function ControlledExample() {
  const ref = useRef<PanoViewHandle>(null);

  return (
    <>
      <button onClick={() => ref.current?.setView({ yaw: 90, fov: 55 })}>
        Look right
      </button>
      <PanoView
        ref={ref}
        controls={{
          inertia: true,
          autoRotate: false,
          rotateDamping: 14,
          zoomDamping: 16,
        }}
        initialView={{ yaw: 0, pitch: 0, fov: 75 }}
        minFov={30}
        maxFov={100}
        onViewChange={(view) => console.log(view)}
        style={{ height: 560 }}
      >
        <Sphere src="/panoramas/room.webp" />
      </PanoView>
    </>
  );
}
```

The handle exposes `getView`, `setView`, `reset`, `startAutoRotate`, `stopAutoRotate`, and `toggleFullscreen`. Built-in input supports pointer drag, touch drag, pinch, wheel, arrow keys, `+/-`, and `0` to reset.

Drag and zoom update a target view that the camera follows smoothly. `rotateDamping` and `zoomDamping` control that following speed in seconds^-1 (defaults: `14` and `16` respectively); lower values feel softer, while `0` disables smoothing for that axis. Both values must be non-negative finite numbers. Imperative `setView()` and `reset()` remain immediate.

## Next.js and SSR

The distributed entry is marked as a client module. Render it below a Client Component boundary. Panorama resources are loaded in the browser; no API keys or server configuration are required.
