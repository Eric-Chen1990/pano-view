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

## Exported components

### Viewer

- [`PanoViewer`](#panoviewer) — canvas shell, camera, default controls, and imperative view API
- [`Sphere`](#sphere) — single 2:1 equirectangular image
- [`Tile`](#tile) — krpano-style multires cube tiles
- [`Scenes`](#scenes) — controlled multi-scene transitions

### Controls

- [`MouseControls`](#mousecontrols) — drag look and wheel zoom
- [`TouchControls`](#touchcontrols) — one-finger drag and pinch zoom
- [`KeyboardControls`](#keyboardcontrols) — arrow-key look, FOV, and scene cycling
- [`AutoRotate`](#autorotate) — automatic yaw rotation

### Events and chrome

- [`PanoEvents`](#panoevents) — viewer-level lifecycle and interaction callbacks
- [`PanoContextMenu`](#panocontextmenu) — right-click reset / fullscreen menu

### Hotspots

- [`ImageHotspot`](#imagehotspot) — image texture at a spherical position
- [`GraphicHotspot`](#graphichotspot) — built-in shapes or SVG at a position
- [`SequenceHotspot`](#sequencehotspot) — sprite-sheet animation
- [`VideoHotspot`](#videohotspot) — HTML video texture
- [`PolygonHotspot`](#polygonhotspot) — closed spherical area
- [`PolylineHotspot`](#polylinehotspot) — open spherical path

### Hooks and helpers

- `usePanoEvents` — subscribe to viewer events inside a custom child ([`PanoEvents`](#panoevents))
- Coordinate helpers — `normalizePanoPosition`, `normalizePanoYaw`, `clampPanoPitch`, `panoPositionToVector3`, `vector3ToPanoPosition` ([Panorama coordinate events](#panorama-coordinate-events))
- `cycleSceneId` — wrap previous/next scene ids ([`KeyboardControls`](#keyboardcontrols))
- Context menu helpers — `createPanoContextMenuPresets`, `composePanoContextMenuItems`, and related APIs ([`PanoContextMenu`](#panocontextmenu))
- Polygon / polyline validation — `validatePolygonVertices`, `validatePolylineVertices`, `unwrapPolygonVertices`

## PanoViewer

`PanoViewer` owns the canvas, perspective camera, and controls. Give its container an explicit size and place one panorama source inside it.

Angles are public degrees. Positive yaw looks right and positive pitch looks up.

```tsx
import { useRef } from "react";
import {
  PanoViewer,
  Sphere,
  AutoRotate,
  type PanoViewerHandle,
} from "@ericchen1990/pano-view";

export function ControlledExample() {
  const ref = useRef<PanoViewerHandle>(null);

  return (
    <>
      <button onClick={() => ref.current?.setView({ yaw: 90, fov: 55 })}>
        Look right
      </button>
      <PanoViewer
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
      </PanoViewer>
    </>
  );
}
```

The handle exposes `getView`, `setView`, `reset`, `startAutoRotate`, `stopAutoRotate`, and `toggleFullscreen`. Mouse, touch, and keyboard input are enabled by default — you do not need to render control components for ordinary viewing. Tune shared behaviour through `controls` (`inertia`, `invert`, `bouncingLimits`, `fovSpeed`, `frictionStop`, `rotateDamping`, `zoomDamping`, and top-level `rotateSpeed` / `zoomSpeed`). Disable a channel with `controls.mouse` / `touch` / `keyboard` set to `false`, or pass an options object (including `enabled`) to override defaults without mounting a child. The two auto-rotation handle methods remain supported for compatibility; prefer rendering `AutoRotate` for new code. A default context menu (Reset view / Enter fullscreen) is also mounted — see [`PanoContextMenu`](#panocontextmenu).

Drag and zoom update a target view that the camera follows smoothly. `rotateDamping` and `zoomDamping` control that following speed in seconds^-1 (defaults: `14` and `16` respectively); lower values feel softer, while `0` disables smoothing for that axis. Both values must be non-negative finite numbers. Imperative `setView()` and `reset()` remain immediate.

## Sphere

`Sphere` expects a 2:1 equirectangular image. Use `yawOffset` when the source's forward direction needs horizontal adjustment.

```tsx
"use client";

import { PanoViewer, Sphere } from "@ericchen1990/pano-view";

export function SphereExample() {
  return (
    <PanoViewer style={{ width: "100%", height: 560 }}>
      <Sphere src="/panoramas/room.webp" />
    </PanoViewer>
  );
}
```

## Tile

`Tile` renders six inward-facing cube faces and loads only tiles around the current view. The default layout matches krpano-style output:

```text
tiles/{face}/l{level}/{row}/l{level}_{face}_{col}_{row}.webp
```

Faces are `f`, `r`, `b`, `l`, `u`, and `d`; rows and columns are 1-based.

```tsx
import { PanoViewer, Tile } from "@ericchen1990/pano-view";

export function TileExample() {
  return (
    <PanoViewer style={{ width: "100%", height: 560 }}>
      <Tile
        baseUrl="https://cdn.example.com/panoramas/room"
        multires="512,500,1000,2000"
      />
    </PanoViewer>
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

## Scenes

`Scenes` switches controlled sphere and cube-tile scenes with GPU-only
snapshot blending. The target scene loads its sphere image or tile preview first;
once ready, the current framebuffer becomes a temporary GPU texture, its source
textures are released, and the target scene blends in. This avoids holding two
high-resolution tile scenes in WebGL memory at once.

```tsx
import {
  Scenes,
  PanoViewer,
  type Scene,
} from "@ericchen1990/pano-view";

const scenes: Scene[] = [
  { id: "lobby", type: "sphere", src: "/panoramas/lobby.webp" },
  {
    id: "terrace",
    type: "tile",
    baseUrl: "/panoramas/terrace",
    multires: "512,1000,2000",
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

Available presets are `none`, `crossfade`, `zoom`, `blackout`, `whiteFlash`,
`slideRightToLeft`, `slideTopToBottom`, `slideDiagonal`, `circleOpen`,
`verticalOpen`, `horizontalOpen`, and `ellipticZoomOpen`. Pass
`{ preset: "crossfade", duration: 0.6 }` to override a preset duration.

While a transition runs, panorama drag/zoom input is locked and
`renderHotspots` is hidden. New `activeSceneId` values supersede a target that
is still being prepared. `maxTextureMemoryMb` and `maxConcurrentTileLoads`
apply to the whole `Scenes` viewer rather than to each tile scene.

## AutoRotate

Render `AutoRotate` inside `PanoViewer` to keep rotation configuration separate from user-input controls. `speed` is measured in degrees per second; use a negative value to rotate left. `acceleration` is measured in degrees per second squared and smoothly ramps from zero to `speed` (default: `18`, so the default speed takes one second to reach). Set it to `0` for an immediate fixed speed. `startDelay` is measured in milliseconds from when `enabled` becomes true. While the user is dragging, or while drag inertia is still settling, rotation pauses and resumes from zero speed automatically.

```tsx
<PanoViewer style={{ height: 560 }}>
  <AutoRotate enabled speed={12} acceleration={6} startDelay={2_000} />
  <Sphere src="/panoramas/room.webp" />
</PanoViewer>
```

## Mouse, touch, and keyboard controls

`PanoViewer` mounts default `MouseControls`, `TouchControls`, and `KeyboardControls` instances. Configure them through `controls` for most apps; render the components yourself only when you need to replace a channel (for example scene-switch callbacks).

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
  <Sphere src="/panoramas/room.webp" />
</PanoViewer>
```

**Mouse** (pointer types `mouse` / `pen`): drag look and optional wheel zoom. Defaults: `rotateSpeed` `0.35`, `zoomSpeed` `0.08`, `wheel` `true`, `buttons` `["left"]`.

### MouseControls

See the defaults above. Override through `controls.mouse` or render `<MouseControls />` when `controls.mouse={false}`.

### TouchControls

One-finger drag and optional two-finger pinch zoom (`pinchZoom`, default `true`). Override through `controls.touch` or render `<TouchControls />` when `controls.touch={false}`.

### KeyboardControls

Hold arrows (or custom bindings) for continuous look / FOV; `0` resets; optional scene bindings. Defaults: `rotateSpeed` `60`, `zoomSpeed` `30`, `shiftMultiplier` `3`. Set `invert` to flip up/down only. Override through `controls.keyboard` or render `<KeyboardControls />` when `controls.keyboard={false}`.

Shared all-mode options on `controls`: `enabled`, `invert` (drag direction for mouse/touch), `bouncingLimits`, `fovSpeed`, `frictionStop` (default `0.01`), plus existing damping / inertia.

### Overriding a control channel

Set the channel to `false` and render your own component when you need callbacks or fully custom behaviour:

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
    <PanoViewer controls={{ keyboard: false }} style={{ height: 560 }}>
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

Default bindings: arrows for look, `+/-` for FOV, `0` for reset, plus `[`/`PageUp` and `]`/`PageDown` for previous/next scene when callbacks are provided. The same override pattern works with `MouseControls` and `TouchControls` (`controls.mouse={false}` / `controls.touch={false}`).

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
      <Sphere src="/panoramas/room.webp" />
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
  <Sphere src="/panoramas/room.webp" />
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

`PanoViewer`'s existing `onViewChange` / `onPanoramaClick` / `onPanoramaDoubleClick` /
`onPanoramaPointerMove` props remain supported and share the same event bus.

Resource loading and scene blending stay on their owners: use `Sphere` /
`Tile` `onLoad` / `onError` / `onLoadProgress`, and `Scenes`
`onTransitionEnd` / `onTransitionError`. This package does not mirror krpano
xml/VR/gyro/frame-render events.

## PanoContextMenu

`PanoViewer` mounts a default context menu that replaces the browser menu on
right-click. Default items: **Reset view** and **Enter fullscreen** / **Exit
fullscreen** (label and icon follow the current fullscreen state), with a
separator between them.

```tsx
<PanoViewer style={{ height: 560 }}>
  <Sphere src="/panoramas/room.webp" />
</PanoViewer>
```

Disable the default menu (restore the browser menu, or mount your own):

```tsx
<PanoViewer contextMenu={false}>
  <Sphere src="/panoramas/room.webp" />
</PanoViewer>
```

Tune appearance while keeping the default items:

```tsx
<PanoViewer contextMenu={{ appearance: { opacity: 0.92, borderRadius: 8 } }}>
  <Sphere src="/panoramas/room.webp" />
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
  <Sphere src="/panoramas/room.webp" />
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
  <Sphere src="/panoramas/room.webp" />
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
`PanoContextMenu` as a child (same override pattern as `MouseControls`). Do
not mount both the default menu and a child `PanoContextMenu` at once. Avoid
combining the context menu with `controls.mouse.buttons: ["right"]` — both
claim the right mouse button.

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

## ImageHotspot

`ImageHotspot` renders an image at a controlled spherical position. Dimensions
are angular degrees, so they remain independent of the canvas resolution.

```tsx
import { ImageHotspot, PanoViewer, Sphere } from "@ericchen1990/pano-view";

<PanoViewer style={{ height: 560 }}>
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
square corners and `0.5` produces the maximum rounded corners. This replaces
the previous Canvas-texture pixel interpretation.

`GraphicHotspot` uses the same `onLoad(texture)` and `onError(error)` callbacks
as `ImageHotspot`. Built-in paths are rasterized locally; only an SVG URL
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

## PolylineHotspot

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

Video reports media and poster failures through `onError`. Like
`SequenceHotspot`, it does not change `playing` by itself. This keeps source
changes, unmounts, and React StrictMode lifecycles deterministic.

## Next.js and SSR

The distributed entry is marked as a client module. Render it below a Client Component boundary. Panorama resources are loaded in the browser; no API keys or server configuration are required.
