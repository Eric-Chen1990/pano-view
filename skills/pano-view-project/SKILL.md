---
name: pano-view-project
description: Create, validate, load, or troubleshoot Pano View project.json and viewer.json, including static tours, scene links, hotspot actions, and asset URL resolution. Use for persisted tours with loadPanoProject and ProjectScenes.
---

# Build a Pano View project

- Read [the quickstart](references/quickstart.md) for a two-scene project, validation commands and a React loader. Prefer the Schema files exported by the host's installed `@ericchen1990/pano-view`. This Skill ships [project](references/project.schema.json) and [viewer](references/viewer.schema.json) snapshots for use with the matching SDK release. For an older SDK, check that release's public `/data` types and docs before using fields from the current snapshots.
- Generate `project.json` from the user's actual scenes, views and interactions. Use `events.click` for new click actions and point scene and popup actions at existing IDs. Reference the converter's `viewer.json` with `viewerUrl`, or reuse a known inline `viewerConfig`. Ask for missing required asset paths or hotspot coordinates. Keep the converter `manifest.json` for restoration, or use it with `PlanarTileViewer` when it describes a flat image.
- Preserve generated tile templates and directory structure. Locate relative `viewerUrl` values from the project document, and preview and tile paths from each viewer document. Pass an explicit `baseUrl` when loading a project object. Inspect the actual document and asset responses when diagnosing invalid JSON or missing tiles.
- Run the `pano-validate` command through the host application's package manager. The quickstart lists commands for pnpm, npm and Yarn. Use the `project` subcommand for a tour or `viewer` for a standalone `viewer.json`. The command checks JSON structure and semantics offline. Fix the reported field and rerun it. Use `loadPanoProject` when checking served viewer documents and resolved paths. Pass the loaded result to `ProjectScenes` inside `PanoViewer` and verify links, previews and detail tiles in the browser.
- If the inputs are raw photos, use `pano-view-converter` if installed or follow the converter guide linked in the quickstart. If the task is viewer controls or a single React-only source, use the React integration guidance.
