# @ericchen1990/pano-converter

## 0.3.0

### Minor Changes

- 5ca1447: Emit a portable viewer.json alongside panorama conversion output. Add browser-safe data loaders and ProjectScenes for static multi-scene tours, hotspot rendering and scene navigation, with cloud URL mapping and bilingual integration FAQs.

  Improve text hotspot rasterization as the viewport and field of view change. Clarify bilingual rendering, resource-loading, playback, and integration documentation, and correct migration examples.

## 0.2.1

### Patch Changes

- Project cubemap faces sequentially to bound FFmpeg interpolation-map memory without reducing tile resolution. Generate panorama previews from a reduced copy while retaining full-resolution source and tile data, and report FFmpeg termination signals.

## 0.2.0

### Minor Changes

- a8338eb: Add a standalone Node.js and CLI converter for cubemap, equirectangular and planar image pyramids, custom levels and paths, standard Deep Zoom, local reconstruction, asynchronous asset callbacks, and compact pano-view configuration.
