---
"@ericchen1990/pano-view": minor
"@ericchen1990/pano-editor": minor
---

Let online maps define inclusive zoom limits and an initial zoom in `project.json` and the tour editor.

`geoMap` accepts optional `minZoom`, `maxZoom`, and `initialZoom` (Web Mercator 0–24). XYZ basemaps also accept `minZoom` beside the existing `maxZoom`. The player clamps gestures, fit, and locate to the intersection of project and basemap limits; with `initialZoom`, the first open keeps that zoom instead of auto-fitting spots.
