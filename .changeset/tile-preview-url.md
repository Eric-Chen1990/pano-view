---
"@ericchen1990/pano-view": patch
---

Resolve Tile `previewUrl` relative to `baseUrl` (like `urlTemplate`) and document the krpano `<preview url>` mapping. Root-absolute and `http(s)` / `blob:` / `data:` URLs are still used as-is; `null` still skips the preview.
