# @ericchen1990/pano-editor

An embeddable React panorama editor for scenes, all nine pano-view hotspot types, initial views and scene links. It produces the existing `schemaVersion: 1` `project.json` consumed by `loadPanoProject` and `ProjectScenes`.

[简体中文](./README.zh-CN.md)

## Local browser editor

Run the workspace with `pnpm dev` and open `/editor` to edit a ready-made two-scene tour with text, audio and scene-link hotspots. Download and unzip the prepared sample ZIP to try opening or dropping a directory without running the converter first.

For your own panoramas, prepare them with `pano-convert` locally first, then select a project root:

```text
tour/
  project.json              # optional on first import; export back here
  panoramas/lobby/
    viewer.json
    tiles/...
    previews/...
  media/marker.svg
```

If the root has a `project.json`, the editor opens it. Otherwise choose the `viewer.json` files to create scenes. Select the whole project directory, including tiles and hotspot media. For portable references, keep resources within this root. Missing resources show their paths; they never fall back to requests against the editor's server.

Add scene and Replace source distinguish Local folder from Online URL. The online input requires a complete HTTP(S) address returning viewer.json directly. Use public URLs without login for the demo, with previews and every tile level available online as well. Cross-origin servers must permit CORS; an HTTPS editor should use HTTPS resources. Leave the asset directory URL empty to resolve relative paths from viewer.json. JSON export does not download or bundle online assets.

The local option accepts a dropped or selected directory containing `viewer.json`, previews and tiles, alongside the existing URL entry. Adding imports every scene in the directory and preserves current edits; replacing requires exactly one `viewer.json`. Added directories use separate `imports/<id>/<directory-name>/` paths to avoid filename collisions. JSON export does not package assets: when hosting the result, place added directories at the exported source paths.

Files are read through the directory picker and temporary object URLs, without uploading them. The local session does not write localStorage, IndexedDB, source files, or server-side drafts. Export `project.json` before leaving; refreshing clears the session. Put the JSON in the selected root and serve the directory over HTTP to play the tour. Keep the existing directory structure: downloading JSON does not copy or package any assets.

The hosted editor is intended for desktop browsers with directory selection. It does not convert original panorama images in the browser. It supports local `tile` and `sphereTile` configurations produced by the converter.

Local iframe previews disable scripts and forms. The exported JSON retains the authored sandbox settings for the final viewer; host-managed editor sessions retain the normal iframe behavior.

## Embed in React

Install the editor and compatible `@ericchen1990/pano-view` peer dependencies. Import both stylesheets once. The editor ships scoped CSS and needs no Tailwind setup in the host.

```tsx
import { PanoEditor } from "@ericchen1990/pano-editor";
import type { PanoProjectDefinition } from "@ericchen1990/pano-view/data";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-editor/styles.css";

export function Authoring({ project }: { project: PanoProjectDefinition }) {
  return (
    <PanoEditor
      defaultValue={project}
      baseUrl="https://cdn.example.com/tour/"
      style={{ height: 780 }}
      onSave={async (updated) => {
        const response = await fetch("/api/my-project", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
        if (!response.ok) throw new Error("Could not save project");
      }}
    />
  );
}
```

Use `value` and `onChange` for a controlled document, or `defaultValue` for an internally owned document. Do not supply both. `onChange` returns authoring snapshots, including an empty `scenes` list after removing the last scene. Save/export validate the document and require at least one scene. Camera browsing, selection, media playback and unfinished geometry are not saved in the document.

Changing the host's project should remount the editor with a React `key` for that project. External controlled document replacements reset history. Acknowledging an `onChange` snapshot preserves history. Editor instances have separate state, local file maps and cancellation.

## Connect your converter service

The converter is a Node.js library/CLI, not an HTTP server. Your backend wraps `convertImage`, stores the output, and exposes either `viewer.json` or a `viewerConfig` with its resource root. The editor owns no backend, storage, authentication or job polling.

```tsx
<PanoEditor
  baseUrl="https://cdn.example.com/tour/"
  onImportPanorama={async (file, { signal, onProgress }) => {
    const body = new FormData();
    body.append("image", file);
    onProgress({ stage: "convert" }); // indeterminate until the host reports progress
    const response = await fetch("/api/my-panorama-import", {
      method: "POST", body, signal,
    });
    if (!response.ok) throw new Error("Conversion failed");
    const result: { viewerUrl: string } = await response.json();
    return { viewerUrl: result.viewerUrl };
    // Or return { viewerConfig: result.viewerConfig, baseUrl: result.publicRoot }.
  }}
  onPickAsset={async ({ kind, sceneId, hotspotId, field, currentUrl }) => {
    return myAssetLibrary.pick({ kind, sceneId, hotspotId, field, currentUrl });
    // Return a persistent resource URL; return undefined to cancel.
  }}
/>
```

The sample endpoints and asset library belong to the host. Return from `onImportPanorama` only when the resulting JSON and assets are available. The host can implement direct uploads, synchronous conversion, job polling or streaming progress inside this callback. `onProgress({stage: "upload" | "convert", progress?: number})` takes an optional 0–1 fraction. Cancellation aborts the signal and discards late results; cleanup of already-created remote jobs/assets remains the host's responsibility.

Only a supplied `onImportPanorama` enables original-image import. The public local editor supplies no upload or save callbacks. Selecting a local directory in an embedded editor also enters a local-only session: host import/save controls are hidden, and local files are not passed to host resource pickers.

## API and customization

| Prop | Purpose |
| --- | --- |
| `value`, `defaultValue`, `onChange` | Existing `PanoProjectDefinition` authoring document. |
| `baseUrl` | HTTP(S) project resource directory, defaulting to the host page directory. |
| `requestInit`, `resolveAssetUrl` | Existing viewer JSON-request options and synchronous resource URL mapping. Runtime mapped URLs are never written into the document. |
| `onImportPanorama` | Host-owned `File` → `PanoProjectSceneDefinition["source"]` conversion. |
| `onPickAsset` | Host picker for image, video, audio or document paths; cancel with `undefined`. |
| `onSave` | Async persistence of a validated project. Failed saves leave changes pending. |
| `locale` | `"en"` (default) or `"zh-CN"`. |
| `className`, `style` | Host layout and dimensions. |

Override `--pne-bg`, `--pne-panel`, `--pne-text`, `--pne-muted`, `--pne-border`, `--pne-accent`, and `--pne-brand` on the component to theme it. The fullscreen action expands the entire editor so its dialogs remain inside the fullscreen element.

The left sidebar nests each hotspot list under its scene, with per-hotspot edit and delete actions. Drag a scene header handle to reorder scenes, or press Space/Enter to pick it up, use arrow keys, then Space/Enter to drop (Escape cancels). The delete button sits beside each scene title. Both scene and hotspot deletion, including the Delete shortcut, require a confirmation dialog; cancelling leaves the document unchanged. Use Add hotspot to choose a type, then place or draw it in the panorama; media types first ask for a resource. Select hotspots from the left list or canvas. Edit mode selects/drags without playing media or following links. Preview uses the viewer's normal actions. Property fields and advanced hotspot JSON preserve supported fields that were not edited. One drag or focused text-edit gesture is one undo step. Keyboard shortcuts are scoped to the editor: Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Delete, Enter to finish geometry, Escape to cancel and Backspace to remove a draft vertex. Text inputs retain their native editing shortcuts.

Run `pnpm --filter @ericchen1990/pano-editor test`, `typecheck`, `build`, and (after building the viewer and editor) `pack:check`. No publication happens during these checks.
