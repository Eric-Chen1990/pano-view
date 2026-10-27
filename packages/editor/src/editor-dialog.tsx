import type { RefObject } from "react";
import { LocalFiles } from "./local-files";
import type { HotspotKind } from "./document";
import type { Translate } from "./i18n";

export type EditorDialogState =
  | { kind: "scenes"; paths: string[]; selected: string[]; replace?: string }
  | {
      kind: "asset";
      field: string;
      hotspotId?: string;
      hotspotKind?: HotspotKind;
      selected: string;
    }
  | { kind: "source"; replace?: string; url: string; root: string }
  | { kind: "delete"; id: string };

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
  t: Translate;
}) {
  return (
    <div className="pne-modal-backdrop">
      <div
        ref={elementRef}
        className="pne-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>
          {t(
            dialog.kind === "scenes"
              ? "Choose scenes"
              : dialog.kind === "asset"
                ? "Browse assets"
                : dialog.kind === "delete"
                  ? "Delete scene and remove links to it?"
                  : "Scene source",
          )}
        </h2>
        <div className="pne-modal-body">
          {error ? <p role="alert">{error}</p> : null}
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
            <p>
              {t("Incoming links")}: {incoming}
            </p>
          ) : (
            <>
              <label>
                viewer.json URL
                <input
                  value={dialog.url}
                  onChange={(event) =>
                    onChange({ ...dialog, url: event.currentTarget.value })
                  }
                />
              </label>
              <label>
                baseUrl
                <input
                  value={dialog.root}
                  onChange={(event) =>
                    onChange({
                      ...dialog,
                      root: event.currentTarget.value,
                    })
                  }
                />
              </label>
            </>
          )}
        </div>
        <div className="pne-modal-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChange(undefined)}
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="pne-primary"
            disabled={
              busy || (dialog.kind === "scenes" && !dialog.selected.length)
            }
            onClick={() => void onConfirm()}
          >
            {t("Confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
