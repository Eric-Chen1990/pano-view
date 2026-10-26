# @ericchen1990/pano-converter

## 0.2.1

### Patch Changes

- Project cubemap faces sequentially to bound FFmpeg interpolation-map memory without reducing tile resolution. Generate panorama previews from a reduced copy while retaining full-resolution source and tile data, and report FFmpeg termination signals.

## 0.2.0

### Minor Changes

- a8338eb: Add a standalone Node.js and CLI converter for cubemap, equirectangular and planar image pyramids, custom levels and paths, standard Deep Zoom, local reconstruction, asynchronous asset callbacks, and compact pano-view configuration.
