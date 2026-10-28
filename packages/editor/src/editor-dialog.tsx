import { useId, useRef, useState, type RefObject } from "react";
import { LocalFiles } from "./local-files";
import { droppedDirectoryFiles } from "./dropped-files";
import { hotspotKinds, type HotspotKind } from "./document";
import type { Translate } from "./i18n";

export type EditorDialogState =
  | { kind: "hotspot" }
  | { kind: "scenes"; paths: string[]; selected: string[]; replace?: string }
  | {
      kind: "asset";
      field: string;
      hotspotId?: string;
      popupId?: string;
      blockId?: string;
      hotspotKind?: HotspotKind;
      selected: string;
    }
  | { kind: "source"; replace?: string; url: string; root: string }
  | { kind: "delete"; target: "scene"; id: string; title: string; hotspotCount: number }
  | { kind: "delete"; target: "hotspot"; id: string; sceneId: string; title: string; sceneTitle: string };

export function EditorDialog({
  dialog,
  local,
  busy,
  error,
  incoming,
  titleId,
  elementRef,
  onChange,
  onConfirm,
  onDirectory,
  onChooseHotspot,
  t,
}: {
  dialog: EditorDialogState;
  local?: LocalFiles;
  busy: boolean;
  error: string;
  incoming: number;
  titleId: string;
  elementRef: RefObject<HTMLDivElement | null>;
  onChange: (dialog: EditorDialogState | undefined) => void;
  onConfirm: () => Promise<void>;
  onDirectory: (files: File[] | Promise<File[]>) => Promise<void>;
  onChooseHotspot: (kind: HotspotKind) => void;
  t: Translate;
}) {
  const directoryRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [sourceMode, setSourceMode] = useState<"local" | "online">("local");
  const helpId = useId();
  const online = dialog.kind === "source" && sourceMode === "online";
  return (
    <div className="pne-modal-backdrop">
      <div
        ref={elementRef}
        className="pne-modal"
        role={dialog.kind === "delete" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={dialog.kind === "delete" ? `${helpId}-delete` : undefined}
      >
        <h2 id={titleId}>
          {t(
            dialog.kind === "hotspot"
              ? "Add hotspot"
              : dialog.kind === "scenes"
              ? "Choose scenes"
              : dialog.kind === "asset"
                ? "Browse assets"
                : dialog.kind === "delete"
                  ? (dialog.target === "scene" ? "Delete scene?" : "Delete hotspot?")
                  : "Scene source",
          )}
        </h2>
        <div className="pne-modal-body">
          {error ? <p role="alert">{error}</p> : null}
          {dialog.kind === "hotspot" ? (
            <>
              <p className="pne-source-help">{t("Choose a type, then place it in the current scene. Media types ask you to choose a resource first.")}</p>
              <div className="pne-hotspot-picker">
                {hotspotKinds.map((kind) => (
                  <button key={kind} type="button" onClick={() => onChooseHotspot(kind)}>
                    <b>{t(kind)}</b>
                    <span>{t(hotspotHelp[kind])}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}
          {dialog.kind === "source" ? (
            <div
              className="pne-source-method"
              role="group"
              aria-label={t("Scene location")}
            >
              {(["local", "online"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  disabled={busy}
                  aria-pressed={sourceMode === mode}
                  onClick={() => {
                    setSourceMode(mode);
                    onChange(dialog);
                  }}
                >
                  {t(mode === "local" ? "Local folder" : "Online URL")}
                </button>
              ))}
            </div>
          ) : null}
          {dialog.kind === "scenes" || (dialog.kind === "source" && !online) ? (
            <>
              <div
                className={`pne-directory-drop${dragging ? " pne-dragging" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!busy) {
                    event.dataTransfer.dropEffect = "copy";
                    setDragging(true);
                  }
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                    setDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  if (busy) return;
                  void onDirectory(droppedDirectoryFiles(event.dataTransfer));
                }}
              >
                <strong>{t("Drop a panorama directory here")}</strong>
                <p>
                  {t("Choose the entire folder containing viewer.json, previews and every tile level. Keep its directory structure; unzip ZIP files first.")}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => directoryRef.current?.click()}
                >
                  {t("Choose directory")}
                </button>
                <input
                  ref={(node) => {
                    directoryRef.current = node;
                    node?.setAttribute("webkitdirectory", "");
                  }}
                  type="file"
                  multiple
                  hidden
                  aria-label={t("Choose directory")}
                  disabled={busy}
                  onChange={(event) => {
                    const files = Array.from(event.currentTarget.files ?? []);
                    event.currentTarget.value = "";
                    void onDirectory(files);
                  }}
                />
                {busy ? <p role="status">{t("Reading local files…")}</p> : null}
              </div>
              <div className="pne-source-help">
                <p>{t("Selecting only viewer.json does not give this page permission to read nearby files. Drop one whole folder or use Choose directory in a desktop browser that supports folder selection.")}</p>
                <p>{t("Files are read locally and never uploaded. Original panorama images are not converted here.")}</p>
                <p>{t(dialog.replace
                  ? "Replacing a source requires a folder with exactly one viewer.json."
                  : "Adding a folder immediately adds every viewer.json in it as a scene and keeps your current edits.")}</p>
                <p>{t("Refreshing clears local files and edits. Export JSON before leaving; it does not include media. To host the result, arrange the files at the paths shown in the exported JSON.")}</p>
              </div>
            </>
          ) : null}
          {dialog.kind === "scenes" ? (
            <>
              {!dialog.paths.length ? (
                <p>{t("No viewer.json found")}</p>
              ) : (
                dialog.paths.map((path) => (
                  <label className="pne-choice" key={path}>
                    <input
                      type={dialog.replace ? "radio" : "checkbox"}
                      name="scene-source"
                      checked={dialog.selected.includes(path)}
                      onChange={(event) =>
                        onChange({
                          ...dialog,
                          selected: dialog.replace
                            ? [path]
                            : event.currentTarget.checked
                              ? [...dialog.selected, path]
                              : dialog.selected.filter((item) => item !== path),
                        })
                      }
                    />
                    {path}
                  </label>
                ))
              )}
            </>
          ) : dialog.kind === "asset" ? (
            <>
              <label>
                {t("Resource path")}
                <input
                  value={dialog.selected}
                  onChange={(event) =>
                    onChange({
                      ...dialog,
                      selected: event.currentTarget.value,
                    })
                  }
                />
              </label>
              {local ? (
                <div className="pne-file-list">
                  {[...local.files.keys()]
                    .filter((path) => !path.endsWith(".json"))
                    .map((path) => (
                      <button
                        type="button"
                        key={path}
                        aria-pressed={
                          dialog.selected === LocalFiles.reference(path)
                        }
                        onClick={() =>
                          onChange({
                            ...dialog,
                            selected: LocalFiles.reference(path),
                          })
                        }
                      >
                        {path}
                      </button>
                    ))}
                </div>
              ) : null}
            </>
          ) : dialog.kind === "delete" ? (
            <div className="pne-delete-details" id={`${helpId}-delete`}>
              <strong>{dialog.title}</strong>
              {dialog.target === "scene" ? <>
                <p>{t("This deletes the scene and all its hotspots, and removes incoming scene links. You can undo the deletion.")}</p>
                <p>{t("Hotspots")}: {dialog.hotspotCount} · {t("Incoming links")}: {incoming}</p>
              </> : <>
                <p>{t("Scene")}: {dialog.sceneTitle}</p>
                <p>{t("This removes only this hotspot from its scene. You can undo the deletion.")}</p>
              </>}
            </div>
          ) : online && dialog.kind === "source" ? (
            <>
              <div className="pne-source-help" id={`${helpId}-online`}>
                <p>{t("Use a public HTTP(S) address that opens viewer.json directly without signing in. The linked previews and every tile level must also be hosted online.")}</p>
                <p>{t("For files on another site, its server must allow this page to read them (CORS). Use HTTPS resource URLs when this editor is opened over HTTPS.")}</p>
                <p>{t("Use viewer.json from the panorama converter, rather than project.json or an image link. Online files stay at their original URLs; exporting JSON does not download or bundle them.")}</p>
              </div>
              <label>
                {t("Online viewer.json URL")}
                <input
                  inputMode="url"
                  placeholder="https://example.com/panorama/viewer.json"
                  aria-describedby={`${helpId}-online`}
                  value={dialog.url}
                  onChange={(event) =>
                    onChange({ ...dialog, url: event.currentTarget.value })
                  }
                />
              </label>
              <label>
                {t("Asset directory URL (optional)")}
                <input
                  inputMode="url"
                  placeholder="https://example.com/panorama/"
                  aria-describedby={`${helpId}-base`}
                  value={dialog.root}
                  onChange={(event) =>
                    onChange({
                      ...dialog,
                      root: event.currentTarget.value,
                    })
                  }
                />
              </label>
              <p className="pne-source-help" id={`${helpId}-base`}>
                {t("Usually leave this empty: relative preview and tile paths are resolved from viewer.json's directory. Set it only when those files are hosted in a different directory; include the trailing slash.")}
              </p>
            </>
          ) : null}
        </div>
        <div className="pne-modal-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChange(undefined)}
          >
            {t("Cancel")}
          </button>
          {(dialog.kind !== "source" && dialog.kind !== "hotspot") || online ? (
            <button
              type="button"
              className={dialog.kind === "delete" ? "pne-danger" : "pne-primary"}
              disabled={
                busy ||
                (dialog.kind === "scenes" && !dialog.selected.length) ||
                (dialog.kind === "source" && !dialog.url.trim())
              }
              onClick={() => void onConfirm()}
            >
              {t(dialog.kind === "delete"
                ? (dialog.target === "scene" ? "Delete scene" : "Delete hotspot")
                : dialog.kind === "source"
                ? (dialog.replace ? "Replace source" : "Add online scene")
                : "Confirm")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const hotspotHelp: Record<HotspotKind, string> = {
  graphic: "Shapes, arrows and scene links",
  text: "Text labels in the panorama",
  image: "A picture from an image resource",
  sequence: "An animated sprite sheet",
  video: "A video placed in the scene",
  audio: "An audio marker with playback controls",
  iframe: "An embedded web page",
  polygon: "Draw a closed area with three or more vertices",
  polyline: "Draw a line with two or more vertices",
};
