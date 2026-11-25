---
name: pano-view-project
description: Create, validate, load, or troubleshoot Pano View project.json and viewer.json, including static tours, scene links, hotspot actions, and asset URL resolution. Use for persisted tours with loadPanoProject and ProjectScenes.
---

# Build a Pano View project

- Check the host's resolved `@ericchen1990/pano-view` version and the public `/data` types. Use matching SDK docs for version-sensitive fields. Read [the quickstart](references/quickstart.md) for a complete two-scene project and a React loader.
- Use `project.json` for scene order, initial views and hotspots. Use each scene's converter `viewer.json` or inline `viewerConfig` for rendering. Keep the converter `manifest.json` for restoration, or use it with `PlanarTileViewer` when it describes a flat image.
- Preserve generated tile templates and directory structure. Locate relative `viewerUrl` values from the project document, and preview and tile paths from each viewer document. Pass an explicit `baseUrl` when loading a project object. Inspect the actual document and asset responses when diagnosing invalid JSON or missing tiles.
- Validate project definitions with `parsePanoProject` from `@ericchen1990/pano-view/data`. Use `loadPanoProject` to validate and resolve referenced viewer documents, or `sceneFromViewerConfig` from `/data` for a single inline viewer config. Pass the loaded result to `ProjectScenes` inside `PanoViewer` and verify links in the browser.
- If the inputs are raw photos, use `pano-view-converter` if installed or follow the converter guide linked in the quickstart. If the task is viewer controls or a single React-only source, use the React integration guidance.
