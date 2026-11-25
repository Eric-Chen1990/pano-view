# Static tour quickstart

Serve the following tree over HTTP. Each scene directory contains the original panorama conversion output, including its `viewer.json`, preview and tile tree. The converter's full `manifest.json` can be retained separately for restoration.

```text
tour/
  project.json
  entrance/viewer.json
  hall/viewer.json
```

Save the following definition as `tour/project.json`.

```json
{
  "schemaVersion": 1,
  "initialSceneId": "entrance",
  "scenes": [
    {
      "id": "entrance",
      "source": { "viewerUrl": "./entrance/viewer.json" },
      "hotspots": [
        {
          "id": "enter-hall",
          "type": "graphic",
          "label": "Enter hall",
          "position": { "yaw": 0, "pitch": 0 },
          "graphic": { "kind": "arrow", "fill": "#ffffff", "stroke": "#172554", "strokeWidth": 24 },
          "events": { "click": { "type": "scene", "sceneId": "hall" } }
        }
      ]
    },
    {
      "id": "hall",
      "source": { "viewerUrl": "./hall/viewer.json" }
    }
  ]
}
```

Scene IDs are unique across the tour, and hotspot IDs are unique within a scene. A scene source must supply exactly one of `viewerUrl` and `viewerConfig`. Set the project loader's `baseUrl` when passing an object. A scene's `source.baseUrl` can override its preview and tile root. Keep signed URLs and credentials under the host's access controls.

## Validate generated or edited JSON

From the application directory, choose your package manager to run `pano-validate` from the installed `@ericchen1990/pano-view` package. Use `project` for a tour and `viewer` for a standalone converter descriptor.

<details open>
<summary>pnpm</summary>

```sh
pnpm exec pano-validate project tour/project.json
pnpm exec pano-validate viewer tour/entrance/viewer.json
```

</details>

<details>
<summary>npm</summary>

```sh
npm exec -- pano-validate project tour/project.json
npm exec -- pano-validate viewer tour/entrance/viewer.json
```

</details>

<details>
<summary>Yarn</summary>

```sh
yarn run pano-validate project tour/project.json
yarn run pano-validate viewer tour/entrance/viewer.json
```

</details>

Each command runs the matching Schema and the SDK checks offline. Fix the reported field and rerun the same command. To check a served tour, use `loadPanoProject` to fetch its viewer documents, then check the previews and detail tiles in the browser.

## Load the project in React

```tsx
"use client";

import { useEffect, useState } from "react";
import { PanoViewer, ProjectScenes } from "@ericchen1990/pano-view";
import { loadPanoProject, PanoDataError, type LoadedPanoProject } from "@ericchen1990/pano-view/data";
import "@ericchen1990/pano-view/styles.css";

export function Tour() {
  const [project, setProject] = useState<LoadedPanoProject>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void loadPanoProject("/tour/project.json", { requestInit: { signal } })
      .then((loaded) => {
        if (!signal.aborted) setProject(loaded);
      })
      .catch((cause: unknown) => {
        if (signal.aborted) return;
        setError(cause instanceof PanoDataError ? `${cause.code}: ${cause.message}` : String(cause));
      });
    return () => controller.abort();
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Loading tour…</p>;
  return (
    <PanoViewer style={{ height: 480 }}>
      <ProjectScenes project={project} transition="dissolve" />
    </PanoViewer>
  );
}
```

At a server or build boundary, call `parsePanoProject(value)` from `@ericchen1990/pano-view/data` on parsed JSON before saving or publishing it. The parser checks the definition and scene references. `loadPanoProject` also fetches external viewer documents, but texture requests happen in the viewer. In the browser, click the link from `entrance` to `hall` and verify a detail tile loads. For failures, inspect the requested project, viewer and texture URLs separately. Look for an HTML fallback served with status 200, invalid schema, cross-origin errors or missing assets.

For data shape, resource remapping and hotspot actions, see the [static project guide](https://github.com/Eric-Chen1990/pano-view/blob/main/packages/react/README.md#static-projects-and-json-data) and the [converter output guide](https://github.com/Eric-Chen1990/pano-view/blob/main/packages/converter/README.md).
