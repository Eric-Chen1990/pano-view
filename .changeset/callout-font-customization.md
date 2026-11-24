---
"@ericchen1990/pano-view": minor
"@ericchen1990/pano-editor": minor
---

Add separate callout title and body font sizes, an optional callout font family, and optional `fontFamily` on viewer chrome.

`appearance.titleFontSize` defaults to 15. `appearance.fontSize` remains the body size and still defaults to 13. Optional `appearance.fontFamily` styles both. Desktop overlays inherit the host page when it is unset; the WebXR raster path uses `system-ui, sans-serif`. Card padding now defaults to 12, and the accent bar keeps a gap from the card content. Fonts must already be available on the device or loaded by the host page.

Optional `fontFamily` also styles planar viewer status and scene-picker text, video control labels, scene-load progress, the scene menu, the context menu, the geo map, and WebVR chrome and scene titles.

The tour editor can set a callout's title size, body size, and font family.
