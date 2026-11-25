# Embed the tour editor

Install `@ericchen1990/pano-editor`, a compatible `@ericchen1990/pano-view` peer and the peers required by that viewer version. Pass a project definition such as one read from `project.json` and validated with `parsePanoProject` from the viewer's `/data` export. This example assumes the project assets are served under `/tour/` in the host.

```tsx
"use client";

import { PanoEditor, type PanoEditorProps } from "@ericchen1990/pano-editor";
import type { PanoProjectDefinition } from "@ericchen1990/pano-view/data";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-editor/styles.css";

type TourEditorProps = {
  projectId: string;
  project: PanoProjectDefinition;
  onSave?: PanoEditorProps["onSave"];
};

export function TourEditor({ projectId, project, onSave }: TourEditorProps) {
  return (
    <PanoEditor
      key={projectId}
      defaultValue={project}
      baseUrl="/tour/"
      onSave={onSave}
      style={{ height: 720 }}
    />
  );
}
```

For host-controlled state, replace `defaultValue` with `value` and feed `onChange` back into that value. A draft can temporarily have zero scenes. Standard `parsePanoProject(value)` validates the saved form, and saving or exporting requires at least one valid scene.

| Callback | Host responsibility |
| --- | --- |
| `onSave(project)` | Persist the validated document. Reject a failed save so the editor can keep the document unsaved. |
| `onPickAsset(request)` | Return a durable asset URL or `undefined` on cancellation. Shared popup media has its own `onPickPopupAsset` callback. |
| `onImportPanorama(file, { signal, onProgress })` | Convert using the host backend and return `{ viewerUrl }` or `{ viewerConfig, baseUrl }` after the result is readable. Forward `signal` and report `upload` or `convert` progress when available. The host owns task and storage cleanup. |

For local authoring, open a directory containing a valid project and its resources, or import a directory containing converted `viewer.json` and tiles. Local authoring lasts for the browser session. Download the project ZIP before leaving when the local assets must be retained. A JSON-only export preserves resource references, so serve those assets at the expected paths. Test directory selection in a browser that supports it.

For custom actions, sharing local projects and backend integration, see the [editor guide](https://github.com/Eric-Chen1990/pano-view/blob/main/packages/editor/README.md) and [converter guide](https://github.com/Eric-Chen1990/pano-view/blob/main/packages/converter/README.md).
