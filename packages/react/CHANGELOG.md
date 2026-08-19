# @ericchen1990/pano-view

## 2.5.1

### Patch Changes

- Forward video and background-audio playback snapshots through `subscribeVideo` / `subscribeBackgroundAudio`, persist imperative background-audio volume across scene changes, and reset uncontrolled playing state when a track ends.

## 2.5.0

### Minor Changes

- 37d49ea: Add `usePanoViewer` to wrap `PanoViewerHandle` methods in a reusable parent-side hook.

## 2.4.0

### Minor Changes

- Add an imperative `PanoViewerHandle` API for fullscreen, scene switching, WebVR, video playback, and background audio control so host apps can build custom viewer UI from a single ref.

## 2.3.0

### Minor Changes

- e6bd44f: Add `AudioHotspot` for directional panorama sound sources. Playback uses bundled Howler.js (hosts do not install `howler`); look-away `range` fades volume and stereo pan follows the camera. Hosts with exhaustive switches over `HotspotDefinition` need to handle `audio`.
- 55776b8: Add `BackgroundAudio` for a non-spatial tour or per-scene soundtrack. `src` is the shared track; `sources` plus `sceneId` select per-scene audio, with crossfade on track changes. Render it beside `Scenes`, not inside `renderHotspots`.

## 2.2.2

### Patch Changes

- 43d04ab: Always suppress the browser native context menu on PanoViewer, including chrome and overlays. `contextMenu={false}` no longer restores the native menu.

## 2.2.1

### Patch Changes

- 7889f3d: Apply `box-sizing: border-box` to `.pano-context-menu-item` so `width: 100%` plus item padding does not overflow the menu in hosts without a global CSS reset.

## 2.2.0

### Minor Changes

- d9c2d02: Ship built-in HTML chrome styles as `@ericchen1990/pano-view/styles.css` instead of requiring Tailwind CSS v4 and an `@source` scan of this package. Host apps should import that stylesheet once; Tailwind is no longer part of the install contract.

## 2.1.0

### Minor Changes

- 0e415fc: Add required `previewUrl` to `Sphere` and `SphereScene` so a low-resolution 2:1 image displays while the full source loads. Relative paths resolve against the directory of `src`.
- 6d186ba: Make Tile `previewUrl` required and resolve it relative to `baseUrl`. Copy krpano `<preview url>`; a common atlas for this package is `previews/cube-vertical.webp`.

## 2.0.0

### Major Changes

- 6319343: Move the built-in HTML chrome to Tailwind CSS utility classes. Host apps must
  install Tailwind CSS v4 and add an `@source` entry that scans
  `@ericchen1990/pano-view`; otherwise video controls, captions, context menus,
  tooltips, and accessibility-only chrome render without their default styling.

### Minor Changes

- c7a0b9f: Add a WebXR-first WebVR component with MobileVR and simulated desktop fallbacks, built-in session chrome, headset calibration, and VR lifecycle events.
- 92508b4: Add an opt-in Gyro component for device-orientation panorama control, including relative and compass modes, touch offsets, sensor permission handling, and gyro lifecycle events.
- cd8e9be: Add cinematic scene-transition presets on top of the existing GPU snapshot overlay, including directional grid wipes, hex dissolve, clock wipe, ripple, zoom blur, film burn, shatter, particles, and glitch.
- d28ee13: Add hotspot `pointerEvents` (`"auto"` | `"none"`) so a hotspot can ignore mouse, touch, and pen hits while remaining visible.
- 6640f55: Add hotspot `tooltipAppearance` so tooltip bubbles can customize background, text color, border, corner radius, shadow, padding, and font size. Defaults match the existing built-in theme.
- 72b1a7a: Add a PanoFilter component that applies color and artistic looks to Sphere, Tile, and PanoVideo sources without tinting hotspots.
- 475d9b2: Add PanoVideo for equirectangular 360 playback on the panorama sphere, with overlay controls (including resolution switching) and configurable WebVTT captions.
- d043f79: Add `strokeDashSize` and `strokeGapSize` to polygon and polyline hotspots so outlines can use a custom dashed stroke in CSS pixels.
- 3cdba78: Change TextHotspot `fontSize` from a 0–1 texture-height fraction to canvas pixels (default 96). Existing values such as `0.18` must be updated to pixel sizes.
- bcd969c: Align video control popovers with the volume slider spacing and add caption menu settings for subtitle size and background opacity.

### Patch Changes

- a05cd19: Add WASD to the default KeyboardControls look bindings alongside the arrow keys.
- a0bab64: Focus the WebGL canvas on pointer down so KeyboardControls receive key events after clicking the viewer.
- b018d0e: Fix hotspot tooltip overlapping rotated graphics by anchoring tooltips to the hotspot's projected screen bounds.
- 8ab6f5c: Fix simulated WebVR pointer lock so mouse look actually engages after fullscreen, and keep fallback VR sessions awake across tab visibility changes.

## 1.0.0

### Major Changes

- 80d39ba: Rename public viewer components and related types:

  - `PanoView` → `PanoViewer`
  - `PanoramaScenes` → `Scenes`
  - `PanoViewProps` / `PanoViewHandle` / `PanoViewState` / `SetPanoViewOptions` → `PanoViewer*`
  - `PanoramaScene` / `PanoramaScenesProps` / `PanoramaTransition*` → `Scene` / `ScenesProps` / `SceneTransition*`

  No compatibility aliases are provided.

### Minor Changes

- 8f11ad0: Render MouseControls, TouchControls, or KeyboardControls as a PanoViewer child to override that channel's properties without first setting the channel to false. AutoRotate remains off until explicitly mounted.
- 107f1d8: Add hotspot tooltips with text and/or image content. The default trigger keeps the bubble visible; hover and click-to-pin are optional. Placement (`top` / `bottom` / `left` / `right`) and pixel offset from the hotspot edge are configurable.
- 546bf3d: Add a canvas cursor for panorama drag and hotspot hover, with viewer-level `cursors` overrides and a per-hotspot `cursor` prop.
- 0ec0f59: Add `TextHotspot` and `IframeHotspot` point types, including serializable `HotspotDefinition` variants. `@react-three/drei` is a new peer dependency used to project iframe content. Hosts with exhaustive switches over `HotspotDefinition` need to handle `text` and `iframe`.

### Patch Changes

- 33e3c7b: Stop point-hotspot planes from occluding other hotspots through empty texels. Transparent pixels no longer write depth or capture pointer hits, so graphic/image/text/sequence shapes no longer clip polygons behind their rectangular bounds.

## 0.2.0

### Minor Changes

- 1c80665: Add a composable KeyboardControls component with customizable key bindings for look, FOV, and scene switching.
- 5239062: Add default MouseControls and TouchControls, fold view runtime out of PanoramaControls, and expand shared control options (invert, bouncingLimits, fovSpeed, frictionStop) with per-channel overrides.
- 9755b73: Add a default panorama context menu with reusable presets (`resetView`, `fullscreen`, `separator`), `prepend`/`append` helpers, custom items (icons/images/separators), and appearance including opacity.
- 5f9766b: Add PanoEvents and usePanoEvents for viewer-level panorama events (view, interaction, idle, fullscreen, resize, auto-rotate), backed by a shared event bus.

## 0.1.6

### Patch Changes

- Support 90-degree pole positions and configurable hotspot transforms

## 0.1.5

### Patch Changes

- Document the configurable preview atlas face order and its default layout.

## 0.1.3

### Patch Changes

- Align workspace package naming with the published `@ericchen1990/pano-view` package.
