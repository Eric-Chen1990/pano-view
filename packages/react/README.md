# @ericchen1990/pano-view

Composable React components for equirectangular and krpano-style multiresolution panorama viewers.

Try the components in the [live playground](https://pano-view-playground.vercel.app/).

## krpano-compatible tile output

Use this package when you want a React-native viewer around equirectangular
images or an existing krpano cube-tile pyramid. `Tile` understands the common
krpano-style multires directory layout by default, while keeping rendering,
controls, hotspots, and scene transitions in your React application. It is
compatible with that tile output format but is not affiliated with krpano.

## Install

```bash
npm install @ericchen1990/pano-view react react-dom three @react-three/fiber
```

React 19, React DOM 19, `@react-three/fiber` 9, and Three.js are peer dependencies.

## Sphere panorama

`PanoView` owns the canvas, perspective camera, and controls. Give its container an explicit size and place one panorama source inside it.

```tsx
"use client";

import { PanoView, Sphere } from "@ericchen1990/pano-view";

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
import { PanoView, Tile } from "@ericchen1990/pano-view";

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

The first `multires` value is the tile size. Remaining values are ascending cube-face sizes for `l1`, `l2`, and later levels. The default preview is `${baseUrl}/previews/cube-vertical.webp`, with six square faces stacked from top to bottom as `l/f/r/b/u/d`. Use `previewFaceOrder` when an atlas uses a different order:

```tsx
<Tile
  baseUrl="/panoramas/room"
  multires="512,1000,2000"
  previewUrl="/panoramas/room/previews/cube-vertical.webp"
  previewFaceOrder={["l", "f", "r", "b", "u", "d"]}
/>
```

`previewFaceOrder` must list the six face codes in their top-to-bottom atlas order: `f`, `r`, `b`, `l`, `u`, and `d`.

During rapid rotation or zoom, loaded tiles remain visible while newly visible tiles use their parent level or the preview as a local fallback.

Override storage conventions with either a krpano placeholder template or a resolver. Both return paths relative to `baseUrl`:

```tsx
<Tile
  baseUrl="/panoramas/room"
  multires={{ tileSize: 512, levels: [500, 1000, 2000] }}
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

## Scene transitions

`PanoramaScenes` switches controlled sphere and cube-tile scenes with GPU-only
snapshot blending. The target scene loads its sphere image or tile preview first;
once ready, the current framebuffer becomes a temporary GPU texture, its source
textures are released, and the target scene blends in. This avoids holding two
high-resolution tile scenes in WebGL memory at once.

```tsx
import {
  PanoramaScenes,
  PanoView,
  type PanoramaScene,
} from "@ericchen1990/pano-view";

const scenes: PanoramaScene[] = [
  { id: "lobby", type: "sphere", src: "/panoramas/lobby.webp" },
  {
    id: "terrace",
    type: "tile",
    baseUrl: "/panoramas/terrace",
    multires: "512,1000,2000",
  },
];

<PanoView style={{ height: 560 }}>
  <PanoramaScenes
    scenes={scenes}
    activeSceneId={activeSceneId}
    transition="ellipticZoomOpen"
    renderHotspots={(scene) => <SceneHotspots sceneId={scene.id} />}
    onTransitionError={({ sceneId }) => console.warn("Could not load", sceneId)}
  />
</PanoView>;
```

Available presets are `none`, `crossfade`, `zoom`, `blackout`, `whiteFlash`,
`slideRightToLeft`, `slideTopToBottom`, `slideDiagonal`, `circleOpen`,
`verticalOpen`, `horizontalOpen`, and `ellipticZoomOpen`. Pass
`{ preset: "crossfade", duration: 0.6 }` to override a preset duration.

While a transition runs, panorama drag/zoom input is locked and
`renderHotspots` is hidden. New `activeSceneId` values supersede a target that
is still being prepared. `maxTextureMemoryMb` and `maxConcurrentTileLoads`
apply to the whole `PanoramaScenes` viewer rather than to each tile scene.

## Controls and imperative API

Angles are public degrees. Positive yaw looks right and positive pitch looks up.

```tsx
import { useRef } from "react";
import {
  PanoView,
  Sphere,
  AutoRotate,
  type PanoViewHandle,
} from "@ericchen1990/pano-view";

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
        <Sphere src="/panoramas/room.webp" />
      </PanoView>
    </>
  );
}
```

The handle exposes `getView`, `setView`, `reset`, `startAutoRotate`, `stopAutoRotate`, and `toggleFullscreen`. Built-in input supports pointer drag, touch drag, pinch, wheel, arrow keys, `+/-`, and `0` to reset. The two auto-rotation handle methods remain supported for compatibility; prefer rendering `AutoRotate` for new code.

## Panorama coordinate events

Use the panorama pointer callbacks when an authoring UI needs the spherical
position under the cursor. Event positions use the same public degree
convention as the camera: positive yaw looks right and positive pitch looks up.

```tsx
import {
  PanoView,
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
    <PanoView
      onPanoramaClick={({ position }) => place(position)}
      onPanoramaDoubleClick={({ position }) => console.log("double", position)}
      onPanoramaPointerMove={({ position }) => console.log("move", position)}
      style={{ height: 560 }}
    >
      <Sphere src="/panoramas/room.webp" />
    </PanoView>
  );
}
```

`normalizePanoPosition`, `normalizePanoYaw`, `clampPanoPitch`, and
`vector3ToPanoPosition` are also exported for controlled authoring flows. Yaw
is normalized to `[-180, 180)`. Pitch is clamped to `[-89.9, 89.9]` to avoid
the spherical-coordinate singularity at the poles.

## Shared hotspot contract and saved definitions

Every hotspot has an `id`, optional `visible`, `interactive`, `renderOrder`,
and semantic interaction callbacks. Point hotspots additionally use a
controlled `position`, angular `width`/`height`, hotspot mode, and the zoom
options described below. `interactive={false}` keeps a hotspot visible while
letting a drawing tool receive the panorama pointer events beneath it.

`onClick` and `onHoverChange` receive a position and input source (`"pointer"`
or `"keyboard"`). Point hotspots can use `draggable`, `onDragStart`,
`onPositionChange`, and `onDragEnd`; the host must write the reported position
back to its state. Polygon and polyline hotspots report the corresponding
controlled `vertices` through `onVerticesChange`.

For persistence or a host-owned editor, use the exported discriminated
`HotspotDefinition` union. It contains the original five categories plus the
open `polyline` extension:

```ts
import type { HotspotDefinition } from "@ericchen1990/pano-view";

const hotspots: HotspotDefinition[] = [
  { type: "image", id: "gallery", position: { yaw: 24, pitch: -5 }, src: "/hotspots/card.webp" },
  { type: "graphic", id: "marker", position: { yaw: -18, pitch: 9 }, graphic: { kind: "ring" } },
  { type: "sequence", id: "pulse", position: { yaw: -42, pitch: -7 }, src: "/hotspots/pulse.png", frameCount: 20 },
  { type: "video", id: "clip", position: { yaw: 48, pitch: 6 }, src: "/hotspots/clip.webm" },
  { type: "polygon", id: "zone", vertices: [{ yaw: 12, pitch: 4 }, { yaw: 22, pitch: 4 }, { yaw: 18, pitch: 14 }] },
  { type: "polyline", id: "route", vertices: [{ yaw: -8, pitch: 1 }, { yaw: 4, pitch: 8 }] },
];
```

Definitions intentionally contain data only. Render them with a switch in the
host, where application-specific click actions, controlled media state, and
error reporting belong.

## Image and graphic hotspots

`ImageHotspot` renders an image at a controlled spherical position. Dimensions
are angular degrees, so they remain independent of the canvas resolution.

```tsx
import { ImageHotspot, PanoView, Sphere } from "@ericchen1990/pano-view";

<PanoView style={{ height: 560 }}>
  <Sphere src="/panoramas/room.webp" />
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
</PanoView>;
```

`GraphicHotspot` accepts built-in `circle`, `rectangle`, and `ring` graphics,
an SVG URL, or safe SVG path data with an explicit viewBox. Built-in graphics
support `fill`, `stroke`, and `strokeWidth`; rectangles also support
`cornerRadius` and rings support `innerRadius`.

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

Set `draggable` and update the controlled position from `onPositionChange` to
move a selected hotspot. Clickable hotspots need `ariaLabel`: PanoView creates
an internal semantic control for Tab, Enter, and Space activation, with a
visible WebGL focus outline.

`ImageHotspot` calls `onLoad(texture)` and `onError(error)`. `GraphicHotspot`
uses the same callbacks. Built-in paths are rasterized locally; only an SVG URL
or SVG `path` data plus an explicit `viewBox` is accepted, never arbitrary SVG
markup.

## Hotspot mode and zoom behaviour

Point hotspots use one safe `mode` instead of separate orientation and
placement properties:

- `mode="surface"` attaches the plane to the local panorama surface.
- `mode="billboard"` keeps the plane facing the camera and floats it in front
  of the shell. Set `distance` (world units, default `10`) to bring it nearer.
  The built-in panorama shell is at roughly `1000` units; distance is
  automatically capped so the hotspot's corners cannot cross it.
- `scaleMode="fov"` (default) lets a hotspot grow when the user zooms in.
  `scaleMode="fixed"` compensates for FOV changes and keeps its screen size
  close to the size at `referenceFov` (default `75`).

```tsx
<ImageHotspot
  id="callout"
  ariaLabel="Open callout"
  position={{ yaw: 18, pitch: 5 }}
  width={10}
  height={6}
  mode="billboard"
  distance={14}
  scaleMode="fixed"
  src="/hotspots/callout.webp"
/>
```

## Polygon hotspots

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
  draggable
  onVerticesChange={({ vertices }) => setZoneVertices(vertices)}
  onInvalid={(issues) => console.error(issues)}
/>
```

`strokeWidth` is a screen-space CSS pixel value, so it remains visually
consistent across FOV changes. Dragging moves all vertices together while
keeping yaw normalized and pitch clamped. Individual vertex editing is provided
by the authoring workflow, not the runtime hotspot component.

Set `fillOpacity={0}` for a closed outline-only polygon. The fill and outline
share the same spherical edge sampling, so there is no intentional seam
between them.

## Polyline hotspots

`PolylineHotspot` is an open path of at least two yaw/pitch vertices. It uses
the same CSS-pixel `strokeWidth`, visibility, semantic interaction, controlled
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
  draggable
  onVerticesChange={({ vertices }) => setRouteVertices(vertices)}
/>;
```

`onInvalid` reports the only invalid runtime shape: fewer than two vertices.

## Sequence and video hotspots

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

`VideoHotspot` uses an `HTMLVideoElement` and `VideoTexture`. Its `playing`
prop is likewise controlled: toggle it from your click handler or application
state. On source change or unmount, the element is paused and its texture is
released. `playsInline` defaults to `true`, `muted` to `true`, `loop` to
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

Sequence loading uses `onLoadProgress` and `onError`; video reports media and
poster failures through `onError`. Neither component changes `playing` by
itself: update that prop in response to your UI, click handler, `onEnded`, or
playback error. This keeps source changes, unmounts, and React StrictMode
lifecycles deterministic.

## Automatic rotation

Render `AutoRotate` inside `PanoView` to keep rotation configuration separate from user-input controls. `speed` is measured in degrees per second; use a negative value to rotate left. `acceleration` is measured in degrees per second squared and smoothly ramps from zero to `speed` (default: `18`, so the default speed takes one second to reach). Set it to `0` for an immediate fixed speed. `startDelay` is measured in milliseconds from when `enabled` becomes true. While the user is dragging, or while drag inertia is still settling, rotation pauses and resumes from zero speed automatically.

```tsx
<PanoView style={{ height: 560 }}>
  <AutoRotate enabled speed={12} acceleration={6} startDelay={2_000} />
  <Sphere src="/panoramas/room.webp" />
</PanoView>
```

Drag and zoom update a target view that the camera follows smoothly. `rotateDamping` and `zoomDamping` control that following speed in seconds^-1 (defaults: `14` and `16` respectively); lower values feel softer, while `0` disables smoothing for that axis. Both values must be non-negative finite numbers. Imperative `setView()` and `reset()` remain immediate.

## Next.js and SSR

The distributed entry is marked as a client module. Render it below a Client Component boundary. Panorama resources are loaded in the browser; no API keys or server configuration are required.
