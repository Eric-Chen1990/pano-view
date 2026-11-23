# @ericchen1990/pano-editor

## 3.6.0

### Minor Changes

- Let a portal doorway set its own arrival view, and author that doorway in the tour editor.

  A portal hotspot accepts optional `arrivalView` with `yaw`, `pitch`, and `fov`. It sets both the centered preview and the view after entry, in React and in project JSON. Without it, entry still uses the destination scene's `initialView`. `Scenes` accepts `previewOnly` to render configured previews without loading full images or tiles.

  In the tour editor, add a portal hotspot, resize and rotate its frame, choose the destination, and set a custom arrival view. Test portal entry plays the transition into that view.

## 3.5.0

### Minor Changes

- Let the tour editor switch the editing basemap among OpenStreetMap, Google, AMap, and Baidu, including road or satellite where the provider supports it.

  Browser keys typed in the Basemap tab stay in the editor session and are not written to `project.json`. Published playback still uses the host `geoMapSources`. Host-supplied keys prefill that session when present.

- dd8de87: Support map overlay sizes as CSS pixels or viewer percentages (`"40%"`), and redesign the tour editor library, inspector, and toolbar interactions.

  `presentation.width` / `height` now accept `number | \`${number}%\``. Existing numeric JSON remains valid. TypeScript callers that assumed a bare `number` need a narrow or resolve step. The editor lists use row actions, adds a resizable icon-rail layout, and exposes map size controls for both floor plans and online maps.

- dd8de87: Let online maps define inclusive zoom limits and an initial zoom in `project.json` and the tour editor.

  `geoMap` accepts optional `minZoom`, `maxZoom`, and `initialZoom` (Web Mercator 0–24). XYZ basemaps also accept `minZoom` beside the existing `maxZoom`. The player clamps gestures, fit, and locate to the intersection of project and basemap limits; with `initialZoom`, the first open keeps that zoom instead of auto-fitting spots.

- Calibrate a scene's virtual north and horizon, and keep hotspot anchors in the original image coordinates.

  Set optional `northYaw` to the viewer yaw when looking due north. An online map in the same viewer uses it for the radar bearing. Set optional `levelCorrection` with `pitch` and `roll`, in degrees, to level the panorama. `Scenes`, `ProjectScenes`, `Sphere`, `SphereTile`, and `Tile` apply that rotation. Camera views, view limits, and panorama pointer events stay in leveled viewer coordinates. Convert between image and viewer coordinates with `toLeveledPanoPosition` and `toSourcePanoPosition`. The tour editor saves both fields in `project.json` and ZIP exports, with undo support and a horizon guide.

- Translate built-in viewer controls, and switch the tour editor between English and Simplified Chinese.

  Wrap a viewer with `PanoUiTranslationProvider` and pass `translate(message)`. The function receives the default English text and should return it unchanged when there is no translation. Keep placeholders such as `{viewer}`. `PanoEditor` accepts `locale`: `"en"` (default) or `"zh-CN"`.

## 3.4.0

### Minor Changes

- 5e39cea: Add online scene maps for Google Maps, AMap, Baidu Maps, and XYZ tiles, with customizable markers, view-direction radar, configurable control layout, and Tour Editor authoring.

## 3.3.0

### Minor Changes

- 5e0c7b3: Add opt-in Directional 3D Sound to audio hotspots, with HRTF positioning, WebXR head translation, and per-source distance. Expose the settings in project JSON and the tour editor.

  Full-sphere 3D sound fades smoothly as the listener turns away, with a 12 dB reduction directly behind them.

- e2fbcd5: Add WebGL and WebGPU chroma keying for image and video hotspots, with project JSON support and live editing from a color picker or the original media.

## 3.2.0

### Minor Changes

- Add portal hotspots to the editor. Place a doorway, choose its target scene, shape, frame, and enter-on-zoom behavior, and keep the doorway when its destination scene is deleted so it can be rebound or undone.

## 3.1.1

### Patch Changes

- Keep the editor viewer mounted across scene changes and clear a viewer error when the scene changes. In preview, leave the project's initial view to `ProjectScenes`. Place and edit hotspots only after the active scene is ready.

## 3.1.0

### Minor Changes

- Let a local editor session attach one image, video, or audio file to a hotspot or popup field. Chosen files stay in the session and are included when the project package is exported.
- c0d8a0f: Add four-corner placement for image and video hotspots. Anchor each texture corner to a panorama position, reshape and rotate the hotspot in the editor, and preserve the final corners in project JSON and ZIP files.

## 3.0.0

### Minor Changes

- Default `VideoHotspot` `muted` to `false`. Callers that need silent playback must pass `muted`. New editor video hotspots use the same default; hotspots that already store `muted` are unchanged.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @ericchen1990/pano-view@5.0.0

## 2.0.2

### Patch Changes

- Publish through GitHub Actions using npm Trusted Publishing (OIDC) with provenance. No runtime or public API changes.

## 2.0.1

### Patch Changes

- Republish 2.0.0 after npm staged that version without making it publicly available.

## 2.0.0

### Minor Changes

- 28e58f7: Share one eight-way overlay anchor for the scene menu and floor-plan map. Map presentation is `panel` or `dialog`, and a panel slides off-screen instead of shrinking to a button.

### Patch Changes

- Updated dependencies [28e58f7]
- Updated dependencies
  - @ericchen1990/pano-view@4.0.0

## 1.2.0

### Minor Changes

- 9f0222a: Add configurable pan/scroll inertia and edge bounce for floor maps and `PanoSceneMenu`, with editor toggles for map drag motion.

## 1.1.0

### Minor Changes

- d530fc7: Add project floor-plan maps with scene spots, yaw-linked sectors, docked or dialog presentation, and editor authoring.

  Map editor: keep zoom controls readable over light imagery, drag the sector itself for heading, and author solid or gradient fills plus sector border color/width/opacity.

  Sector opacity scales the whole fill in gradient mode; stop opacities only define the relative fade.

  Configurable `maxScale`, stricter fixed vs zoom interaction, and map-spot delete from the library list plus Delete/Backspace.

  Dock map chrome to the full viewer instead of the screen-visible intersection so parent scroll does not move or shrink it.

### Patch Changes

- Updated dependencies [d530fc7]
  - @ericchen1990/pano-view@3.8.0

## 1.0.1

### Patch Changes

- Rename the editor title from Panorama editor to Tour editor.
- Updated dependencies
  - @ericchen1990/pano-view@3.6.4

## 1.0.0

### Minor Changes

- 9c30a8f: Support click, pointer enter and pointer leave actions, host-owned custom actions with JSON parameters, unified cancellable events, and schema-driven editor forms with isolated preview callbacks. Preserve legacy click configuration and include all triggers in reference validation and exports.
- 426fba5: Add an embeddable panorama editor and a browser-only local-directory editor in the playground. Author scenes and all nine hotspot types, undo edits, preview tours and export portable project.json without uploading or persisting local files. Hosts can supply their own asset picker, saving and cancellable image conversion callbacks. Expose the viewer's shared hotspot resource resolver for editor rendering, and support optional audio format hints for blob and other extensionless audio URLs.

  Start the playground editor with a ready-made sample tour and downloadable sample files. Add or replace scene sources by dropping or selecting converted panorama directories, keeping their resources local and isolating filenames across imports.

  Distinguish online scene URLs from local folders in the import UI, explain resource and browser requirements, and reject local paths in online URL inputs.

  Nest hotspot lists under their scenes, replace the type toolbar with an Add hotspot picker, and expose per-hotspot edit and delete actions with undo support.

  Replace the scene actions section with drag handles for reordering and inline scene deletion. Confirm both scene and hotspot deletion, with named targets, keyboard support and undo. Preserve the mounted viewer when only scene order changes.

### Patch Changes

- Updated dependencies [9c30a8f]
- Updated dependencies [426fba5]
- Updated dependencies [91a4598]
- Updated dependencies [b9b2bfc]
  - @ericchen1990/pano-view@3.6.0
