# @ericchen1990/pano-view

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
