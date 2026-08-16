# @ericchen1990/pano-view

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
