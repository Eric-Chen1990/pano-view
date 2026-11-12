---
"@ericchen1990/pano-view": minor
---

Add optional `getOverlays()` on `PanoSpatialControlAdapter` so a host can supply DOM model annotation roots. The spatial renderer captures those layers separately, composites them after the live canvas, and keeps source visibility and occlusion authoritative for both rendering and gaze. Titles and popovers inside an annotation root keep their overflow.

Keep VR spatial panel HTML markers updating during continuous model rotation instead of waiting for DOM changes to stop. Yield between HTML cloning slices so panorama rendering and input can run, and only mark bound controls as gaze-active so hovering a plain host button does not invalidate the whole capture. Completed captures and errors still cannot update a closed or replaced panel.
