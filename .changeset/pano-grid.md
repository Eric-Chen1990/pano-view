---
"@ericchen1990/pano-view": minor
---

Add `PanoGrid`, a debug reference grid for panorama space.

Mount it alone inside `PanoViewer` when no panorama image is present, or beside `Sphere` / `Tile` to check alignment. Choose `projection="sphere"` for latitude/longitude lines or `projection="cube"` for a six-face grid, and adjust `divisions`, `color`, and `opacity`.
