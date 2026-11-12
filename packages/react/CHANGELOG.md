# @ericchen1990/pano-view

## 5.3.2

### Patch Changes

- d56abf4: Keep markers on the host model example above the model in VR. The example registers those DOM roots with `getOverlays()`, so the spatial panel composites them after the live canvas.

## 5.3.1

### Patch Changes

- ce4648c: Preserve a successfully captured spatial dialog when optional annotation layers fail, and retry the uninterrupted clone path when a yielding HTML capture is interrupted. One broken model marker can no longer blank the dialog or suppress the other annotations.

## 5.3.0

### Minor Changes

- ac97638: Add optional `getOverlays()` on `PanoSpatialControlAdapter` so a host can supply DOM model annotation roots. The spatial renderer captures those layers separately, composites them after the live canvas, and keeps source visibility and occlusion authoritative for both rendering and gaze. Titles and popovers inside an annotation root keep their overflow.

  Keep VR spatial panel HTML markers updating during continuous model rotation instead of waiting for DOM changes to stop. Yield between HTML cloning slices so panorama rendering and input can run, and only mark bound controls as gaze-active so hovering a plain host button does not invalidate the whole capture. Completed captures and errors still cannot update a closed or replaced panel.

## 5.2.0

### Minor Changes

- 956e5ca: Add view-relative vertical following to `WebVRSceneMenu`, with a new `followPitch` option enabled by default. Navigation smoothly follows head pitch, pauses during intentional aiming, and resumes after looking away. Prevent automatic recovery from locking at the reticle or triggering gaze actions, and keep complete controls inside both eye frustums, including when looking toward the floor.

  Open compact, flat and arc scene menus at the current heading and pitch, keep them anchored while browsing, and reanchor navigation when closing. Use `followPitch={false}` to retain horizontal-only following or `follow={false}` for fixed navigation.

### Patch Changes

- 7f39090: Clear shorthand and logical bottom corner radii on dialog snapshot clones when appending spatial controls, keeping both content-to-controls seam corners flat in the final raster. Match the automatic control footer background to its dialog.

## 5.1.0

### Minor Changes

- 6a5cb57: Add optional `hasAudio` on media and video playback snapshots. Library controls hide mute and volume only when an audio track is confirmed absent; unknown detection still shows them. Volume stays limited to 0–1, and source or track changes refresh the result.

### Patch Changes

- edba9bf: Fix VR tooltip spacing, unify spatial control groups, improve reticle contrast, and preserve open-dialog media playback on VR exit. Allow hosts to opt media out of automatic controls with data-pano-media-controls="none".

  Keep automatic model controls visible independently of gaze moving between the model, text, scroll arrows and footer buttons.

## 5.0.0

### Major Changes

- Default `VideoHotspot` `muted` to `false`. Callers that need silent playback must pass `muted`. New editor video hotspots use the same default; hotspots that already store `muted` are unchanged.

### Minor Changes

- Add `WebVRSceneMenu` for scene selection in WebXR, MobileVR, and desktop simulated VR, with compact, flat, and arc layouts, pagination, `focusColor`, and control placement that follows the open menu.

  Add `showVisited` and `visitedLabel` on `PanoSceneMenu` and `WebVRSceneMenu`. Add `WebVR` `interactionMode` (`auto`, `gaze`, or `pointer`) and expose the active input state.

  Add automatic per-video VR controls, poster and first-frame previews, clipping, resource cleanup, and playback-blocked feedback. Keep controller mute and volume across readiness changes, and keep dialog scrolling correct after resize.

## 4.1.0

### Minor Changes

- bf859eb: Add VR-only customizable icon controls for media, models and scrolling, spatial control surfaces, and a VideoHotspot media controller ref. Keep dialog scroll controls available alongside model operations.

## 4.0.1

### Patch Changes

- Publish through GitHub Actions using npm Trusted Publishing (OIDC) with provenance. No runtime or public API changes.

## 4.0.0

### Major Changes

- 28e58f7: Share one eight-way overlay anchor for the scene menu and floor-plan map. Map presentation is `panel` or `dialog`, and a panel slides off-screen instead of shrinking to a button.

### Minor Changes

- 346e214: Add a `toggle` prop on `PanoSceneMenu` and `PanoMapOverlay` so hosts can replace the edge-tab icon and restyle that button.

## 3.10.0

### Minor Changes

- 1cb8c99: Add `PanoOverlay` so screen-plane UI can sit beside scene children and stay visible in fullscreen.
- 57eae1b: Extend WebVR with Cardboard tray lens centering, MobileVR gyro options (`absolute`, `north`, `friction`, `touchSupport`), WebXR quality controls (`oversampling`, `foveation`, `frameRate`), and `resetSettings`.
- d6614ec: Add Cardboard DPDB auto screen-size lookup for MobileVR, fade session Exit/Setup chrome after idle, and expose reactive `getVRState` / `subscribeVR` so hosts own the Enter VR button (built-in Enter control removed).

### Patch Changes

- 7ba6105: Filter cube and equirectangular tiles with mipmaps, and choose a level that keeps the left and right edges of a wide view near one texel per pixel. Mipmaps still anti-alias the minified center.

## 3.9.0

### Minor Changes

- 9f0222a: Add configurable pan/scroll inertia and edge bounce for floor maps and `PanoSceneMenu`, with editor toggles for map drag motion.
- e5cc6af: Add runtime size, position, dialog, and zoom props on `PanoMapOverlay`, plus `initialScale` on `PanoMap`, with clearer floor-plan usage docs.
- aa67c00: Add `loop` to `PanoSceneMenu` for wrapping previous/next, draw the active selection ring above the thumbnail, and support `appearance.labelAlign` for scene title alignment.
- cfb0fe5: Add `PanoSceneMenu`, a scrollable thumbnail scene picker for `renderOverlay`, with placement, `align` (default center), inset, size, collapsible slide-off chrome with an inner-edge toggle, end arrows, and customizable appearance.

## 3.8.0

### Minor Changes

- d530fc7: Add project floor-plan maps with scene spots, yaw-linked sectors, docked or dialog presentation, and editor authoring.

  Map editor: keep zoom controls readable over light imagery, drag the sector itself for heading, and author solid or gradient fills plus sector border color/width/opacity.

  Sector opacity scales the whole fill in gradient mode; stop opacities only define the relative fade.

  Configurable `maxScale`, stricter fixed vs zoom interaction, and map-spot delete from the library list plus Delete/Backspace.

  Dock map chrome to the full viewer instead of the screen-visible intersection so parent scroll does not move or shrink it.

## 3.7.0

### Minor Changes

- 0448aab: Add an iPhone landscape fullscreen fallback that scrolls Safari’s URL and toolbar away when the Fullscreen API is unavailable, including swipe prompts, viewer/VR session wiring, and touch passthrough while bars are visible.

## 3.6.7

### Patch Changes

- Republish the gyro follow and stability fixes after npm staged 3.6.6 without making it publicly available.

## 3.6.6

### Patch Changes

- 3307312: Make gyro follow device orientation on the same frame, reclaim touch offsets at view limits, and keep heading stable near the zenith and across sensor discontinuities.

## 3.6.5

### Patch Changes

- Clear hotspot drag click suppression with an explicit capture option, so the next press is not swallowed when the event target ignores the boolean capture flag.

## 3.6.4

### Patch Changes

- Keep a dragged hotspot fixed to the grabbed point after the pointer leaves it, and do not treat the release as a click. Draw the selection border outside the hotspot. Delay panorama pointer capture so starting a hotspot drag is not cancelled.

## 3.6.3

### Patch Changes

- Keep panorama dragging continuous when the pointer crosses a pole, including while the camera is aimed at one.

## 3.6.2

### Patch Changes

- e3b2856: Finish each panorama drag on pointer release and base flick inertia on the latest pointer motion, so repeated drags no longer stall or coast from a lagged sample.

## 3.6.1

### Patch Changes

- Fix mouse, pen, and single-touch panorama dragging to keep the grabbed image point anchored across viewport sizes and zoom levels. Smooth fast drags with frame-aligned input and a short following filter, retain release inertia, and preserve pending input when rebasing after zoom or resize.

## 3.6.0

### Minor Changes

- 9c30a8f: Support click, pointer enter and pointer leave actions, host-owned custom actions with JSON parameters, unified cancellable events, and schema-driven editor forms with isolated preview callbacks. Preserve legacy click configuration and include all triggers in reference validation and exports.
- 426fba5: Add an embeddable panorama editor and a browser-only local-directory editor in the playground. Author scenes and all nine hotspot types, undo edits, preview tours and export portable project.json without uploading or persisting local files. Hosts can supply their own asset picker, saving and cancellable image conversion callbacks. Expose the viewer's shared hotspot resource resolver for editor rendering, and support optional audio format hints for blob and other extensionless audio URLs.

  Start the playground editor with a ready-made sample tour and downloadable sample files. Add or replace scene sources by dropping or selecting converted panorama directories, keeping their resources local and isolating filenames across imports.

  Distinguish online scene URLs from local folders in the import UI, explain resource and browser requirements, and reject local paths in online URL inputs.

  Nest hotspot lists under their scenes, replace the type toolbar with an Add hotspot picker, and expose per-hotspot edit and delete actions with undo support.

  Replace the scene actions section with drag handles for reordering and inline scene deletion. Confirm both scene and hotspot deletion, with named targets, keyboard support and undo. Preserve the mounted viewer when only scene order changes.

- b9b2bfc: Add viewer-local DOM overlays and modal interaction coordination, plus optional composable dialogs through the new ui entry and stylesheet. Keep overlay content mounted across element fullscreen changes.

### Patch Changes

- 91a4598: Discard stale drag velocity on release and stop inertia when touch or mouse input is cancelled or loses pointer capture. Keep fresh drag flicks and camera smoothing, while avoiding additional synthetic inertia on wheel and trackpad zoom.

## 3.5.0

### Minor Changes

- 5ca1447: Emit a portable viewer.json alongside panorama conversion output. Add browser-safe data loaders and ProjectScenes for static multi-scene tours, hotspot rendering and scene navigation, with cloud URL mapping and bilingual integration FAQs.

  Improve text hotspot rasterization as the viewport and field of view change. Clarify bilingual rendering, resource-loading, playback, and integration documentation, and correct migration examples.

## 3.4.2

### Patch Changes

- 591feed: Keep 360 and hotspot videos inline in WeChat, QQ, and UC, and stop picture-in-picture or remote playback from taking the texture source.

## 3.4.1

### Patch Changes

- Hide the browser focus ring on the WebGL canvas when KeyboardControls focuses it for keyboard navigation.

## 3.4.0

### Minor Changes

- 16e58fa: Load incoming panorama detail during scene transitions instead of waiting until the blend finishes. Add optional `transitionWaitForDetailMs` to hold the outgoing snapshot until the current view is sharp or the limit elapses.

## 3.3.0

### Minor Changes

- Add SphereTileScene support to Scenes so equirectangular multiresolution tiles can use dissolve and every existing scene transition alongside sphere and cube-tile scenes. Share tile texture memory and request concurrency across both tiled projections, and document the new scene type.

  Expose onSceneReady for first-scene readiness and incoming-camera setup after the outgoing snapshot has been captured.

## 3.2.3

### Patch Changes

- Update the panorama canvas throughout container resizing instead of waiting for the default measurement debounce after panel dragging stops.

## 3.2.2

### Patch Changes

- Keep fixed billboard hotspots the same screen size at the viewport edges, preserve translucent image borders, and defer label DOM root disposal until the scene commit completes, including Strict Mode and rapid scene/visibility changes.

## 3.2.1

### Patch Changes

- Accept the full React 19 line as peer dependencies. The previous upper bound stopped before 19.3 even though this package has no dependency on that cutoff.

## 3.2.0

### Minor Changes

- 04ddb9e: Add SphereTile for spherical krpano and raw Deep Zoom pyramids with explicit index bases with view-dependent loading, bounded caching, retries and source cleanup. Add display-space RGBA color matrices for panoramas and optional hotspot textures, plus tooltip font family, line height and letter spacing controls. Preserve existing cube Tile and Sphere APIs.

## 3.1.3

### Patch Changes

- dc8c043: Do not treat sticky user activation as autoplay permission. Optimistically activate when Web Audio is already running, but keep waiting for a real gesture only if this attempt requested video and autoplay policy still blocked it.

## 3.1.2

### Patch Changes

- bf0cf45: Unlock audible media on the HTML activation-triggering event (`pointerup` for touch/pen, `pointerdown` for mouse) and keep waiting if the first gesture is blocked.

## 3.1.1

### Patch Changes

- 7a5c55b: Replace the default visible "Tap to enable sound" entry layer with silent media activation on the first user gesture when the browser requires one. The `onActivate` callback and `viewer.activateMedia()` API are unchanged.

## 3.1.0

### Minor Changes

- Add `lookTo`, `moveTo`, `zoomTo`, and `lookToHotspot` to the PanoViewer handle for animated navigation. Existing `setView` and `reset` remain immediate.

## 3.0.0

### Major Changes

- 36b3b88: Add default media-activation entry UI for children that begin playback, with host-controlled audio activation controls, mobile safe-area chrome, and inline iPhone video safeguards. Set `mediaActivation={false}` to retain the 2.x entry behavior.

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
