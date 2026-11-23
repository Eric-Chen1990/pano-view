---
"@ericchen1990/pano-view": minor
"@ericchen1990/pano-editor": minor
---

Support map overlay sizes as CSS pixels or viewer percentages (`"40%"`), and redesign the tour editor library, inspector, and toolbar interactions.

`presentation.width` / `height` now accept `number | \`${number}%\``. Existing numeric JSON remains valid. TypeScript callers that assumed a bare `number` need a narrow or resolve step. The editor lists use row actions, adds a resizable icon-rail layout, and exposes map size controls for both floor plans and online maps.
