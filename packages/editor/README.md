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

Files are read through the directory picker and temporary object URLs, without uploading them. The local session does not write localStorage, IndexedDB, source files, or server-side drafts. Export a project package before leaving to keep configuration and resources together; refreshing clears the session. Unzip the package and serve its directory over HTTP with your existing player. JSON-only export is also available: put that JSON in the selected root and keep the existing resource structure, since JSON-only export does not copy assets.

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

### Portable project packages

**Export project package** downloads `panorama-project.zip` containing `project.json`, per-scene `panoramas/<number>/viewer.json`, all preview/tile levels, and referenced hotspot media, tooltip images and cursor images under `assets/`. Both local and online resources are copied and references rewritten relative to the package. Unzip it before using Open directory; serve the extracted directory over HTTP with your existing viewer. The package does not include a player page. **Export JSON** remains configuration-only.

Export uses up to four concurrent resource transfers, supports cancellation, and stops without downloading a ZIP if a resource is missing, unreadable or blocked by CORS. It does not substitute the editor's missing-tile placeholder. Packages are limited to 60,000 files and 1 GB. Embedded HTML/CSS/SVG that reference other resources or execute scripts cannot be proven self-contained and stop package export; use a document with inline resources and no runtime dependencies. Resource paths in an error identify the package entry; signed URL query parameters are not included.

Hover cursor offers common cursor styles and local PNG selection (up to 32 × 32 pixels), preview and default reset. Imported cursor files are held in the local session and included in project packages. Existing CSS cursor configurations remain readable, including URL offsets and fallbacks. A host asset picker still owns persistent resources for host-managed sessions.

## Click actions and shared content

The inspector's **Click action** section supports scene navigation, current-scene view adjustment and shared popups. Capture the current view to set yaw/pitch/FOV; animation duration defaults to 700 ms. Without an explicit action, media hotspots use play/pause and other hotspots have no action.

Use **Test this hotspot** to enter the real preview and execute its click once after the source scene is ready. Returning to Edit restores the original scene, camera and hotspot selection without changing the document. Hidden hotspots or hotspots with pointer interaction disabled must be enabled before testing. Edit mode deliberately keeps hotspots selectable/draggable and pauses media; Preview applies visitor settings.

Switch the left sidebar to **Popup content** to create, duplicate and edit shared content. Each popup has a title and ordered text/image/video/audio blocks; add, move or remove blocks and browse media resources. Empty titles and media paths may remain in authoring drafts, but must be completed before saving/exporting. Text is plain text, without HTML execution.

Hotspots reference `popups` through `{ type: "popup", popupId }`. Changing shared content updates every reference. Duplicating a hotspot preserves the shared reference; duplicating a popup makes independent content with new IDs. Referenced popups cannot be deleted: follow the listed hotspot links and change their actions first. Removing a scene does not remove content. All library content, including unused entries, is retained in JSON and included in project packages; shared files are deduplicated.

Known defaults display their effective values directly. Reset appears only for overrides. Cursor inheritance remains explicit; unspecified browser settings say so. Camera distance is enabled only in floating mode, and reference FOV only for fixed screen size. Opening a project does not write default values or add undo steps.

`PanoEditorProps` adds `resolvePopupAssetUrl` (same callback as the viewer loader) and `onPickPopupAsset(request)`. The latter receives `{ kind: "image" | "video" | "audio", popupId, blockId, field: "src" | "poster", currentUrl? }` and returns a durable resource path or `undefined`. The existing `onPickAsset` scene/hotspot contract is unchanged. Local sessions use directory resources instead of host pickers. Editor CSS imports the optional viewer UI styles for its preview dialog.

Store content structure in project.json and media as files. A host backend can persist the same document in a database. See the [viewer popup integration](../react/README.md#hotspot-actions-and-shared-popup-content) to display exported content with `ProjectScenes.onPopupRequest` and `ProjectPopupDialog`, or a custom overlay.

### Scene view limits

Scene settings separate **Initial view** from **View limits**. Enable Yaw, Pitch or FOV individually, then enter minimum and maximum angles. Defaults on enabling are −180 / 180, −90 / 90 and 30 / 100 respectively. Limits apply immediately in editing and preview and support undo/redo. Invalid values are reported beside the field and do not update the project. Yaw min > max crosses ±180°; equal bounds lock an axis. Limits constrain the camera center, not the entire visible frame. They are saved as each scene's optional `viewLimits` in `project.json`; the source path is hidden in the settings panel, while Replace source remains available.

ZIP export uses package-relative references for scene documents, previews, tiles, hotspot resources, cursor/tooltip images and popup media. Unzip and serve the complete directory at any HTTP subdirectory. Prose URLs remain unchanged. JSON-only export keeps online URLs and does not bundle their resources.

### Hotspot interaction events and custom actions

`events` maps `click`, `pointerenter`, and `pointerleave` to one action each. Every event supports `scene`, `view`, `popup`, and `{ type: "custom", actionId, params? }`. `params` is a JSON object; functions, credentials, API implementations and form definitions belong to the host. Parameter strings are not resolved or packaged as assets.

```json
{"events":{"click":{"type":"scene","sceneId":"hall"},"pointerenter":{"type":"custom","actionId":"product.preview","params":{"visible":true}},"pointerleave":{"type":"custom","actionId":"product.preview","params":{"visible":false}}}}
```

Legacy `action` remains a click fallback; `events.click` wins. Editing or clearing click removes the legacy fallback. Loading a project does not migrate it. New event configurations require an updated viewer (project schemaVersion remains 1). Media without a click action still toggles playback; hover has no default action.

`ProjectScenes.onHotspotEvent(event)` receives `trigger`, `sceneId`, `hotspot`, `interaction` and `preventDefault()`. On clicks it runs before the existing `onHotspotClick`; either callback can cancel the action. `onCustomAction(event)` additionally receives `action` and may return a Promise. Dispatch by the stable `action.actionId`, validate business parameters and throw for unknown actions. Missing handlers, synchronous exceptions and rejected Promises reach `onHotspotError` with `trigger`. Requests, authentication, cancellation, duplicate prevention and response ordering are host responsibilities; events dispatch independently without automatic retries.

Hover runs once per logical hotspot boundary, skips touch and keyboard focus, and respects visibility and pointer interaction settings. Scene changes, hiding and unmounting clear hover state without executing leave actions. Existing tooltip behavior is independent. Custom renderers must forward `context.onHoverChange(hovered, interaction)` as well as `context.onClick`; `context.renderDefault()` wires both automatically.

`PanoEditor.customActions` supplies `{ id, label, description?, fields }` definitions. Fields use `{ name, label, type, required?, min?, max?, options?, defaultValue? }`, with types `string`, `textarea`, `number`, `boolean`, `select` (string options). Defaults apply only when selecting a new action; extra existing parameters survive edits. Invalid registered parameters block event tests, saving and both exports. Unregistered actions retain read-only parameters and can be saved/exported.

```tsx
const customActions = [{
  id: "product.preview", label: "Preview product",
  fields: [{ name: "visible", label: "Visible", type: "boolean" as const, defaultValue: true }],
}];
<PanoEditor defaultValue={project} customActions={customActions}
  onPreviewCustomAction={async ({ action, trigger, sceneId }) => {
    // Host-owned preview dispatcher: mock methods or explicitly chosen real methods.
    await previewActions.execute(action.actionId, action.params ?? {}, { trigger, sceneId });
  }} />;
```

The Interaction events panel configures and tests each trigger separately. Edit mode never executes business actions. Preview uses the separate `onPreviewCustomAction`; without it, testing reports that a preview handler is missing and saving remains available. Scene and popup references cover all events and show their trigger. Exported projects retain configuration; the player host still needs `ProjectScenes.onCustomAction`.
