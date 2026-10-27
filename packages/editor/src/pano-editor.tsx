import { SceneSidebar, SceneSettings } from "./scene-panels";
import {
  EditorDialog,
  type EditorDialogState as Dialog,
} from "./editor-dialog";
import {
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  parsePanoProject,
  type PanoProjectDefinition,
  type PanoProjectSceneDefinition,
  type ProjectHotspotDefinition,
  type HotspotPosition,
  type PanoViewerHandle,
} from "@ericchen1990/pano-view";
import type {
  PanoAssetRequest,
  PanoEditorProps,
  PanoImportProgress,
} from "./types";
import { DocumentHistory } from "./history";
import {
  createHotspot,
  emptyProject,
  exportDocument,
  geometryIssue,
  hotspotKinds,
  newId,
  readDocument,
  removeScene,
  type HotspotKind,
} from "./document";
import { LocalFiles } from "./local-files";
import { SceneSources } from "./sources";
import { ImportTask } from "./import-task";
import { translator } from "./i18n";
import { getField, setField } from "./fields";
import { HotspotInspector } from "./inspector";
import { EditorViewer } from "./editor-viewer";
import { errorMessage } from "./errors";

export function PanoEditor(props: PanoEditorProps) {
  const hostManaged = Boolean(
    props.value ||
    props.defaultValue ||
    props.baseUrl ||
    props.onChange ||
    props.onSave ||
    props.onImportPanorama ||
    props.onPickAsset,
  );
  const t = useMemo(() => translator(props.locale ?? "en"), [props.locale]);
  const [history] = useState(
    () =>
      new DocumentHistory(
        readDocument(props.value ?? props.defaultValue ?? emptyProject()),
      ),
  );
  const [, render] = useReducer((value: number) => value + 1, 0);
  if (
    props.value &&
    JSON.stringify(props.value) !== JSON.stringify(history.current)
  )
    history.replace(readDocument(props.value));
  const project = history.current;
  const [activeId, setActiveId] = useState(
    project.initialSceneId ?? project.scenes[0]?.id,
  );
  const active =
    project.scenes.find((scene) => scene.id === activeId) ?? project.scenes[0];
  const [selectedId, setSelectedId] = useState<string>();
  const selected = active?.hotspots?.find(
    (hotspot) => hotspot.id === selectedId,
  );
  const [local, setLocal] = useState<LocalFiles>();
  const [preview, setPreview] = useState(false);
  const [tool, setTool] = useState<HotspotKind>();
  const [placement, setPlacement] = useState<ProjectHotspotDefinition>();
  const [draft, setDraft] = useState<HotspotPosition[]>([]);
  const [dialog, setDialog] = useState<Dialog>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PanoImportProgress>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(() => JSON.stringify(project));
  const dirty = JSON.stringify(project) !== saved;
  const [fullscreen, setFullscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const directoryRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<PanoViewerHandle>(null);
  const [task] = useState(() => new ImportTask());
  const alive = useRef(true);
  const generation = useRef(0);
  const operation = useRef(0);
  const pickerOperation = useRef(0);
  const focusBeforeDialog = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const importTarget = useRef<string | undefined>(undefined);
  const dialogTitleId = useId();
  const end = () => {
    history.end();
    render();
  };
  const begin = () => history.begin();
  const report = (cause: unknown) => setError(errorMessage(cause));

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      generation.current++;
      operation.current++;
      task.cancel();
    };
  }, [task]);
  useEffect(() => () => local?.dispose(), [local]);
  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirty]);
  useEffect(() => {
    const listener = () =>
      setFullscreen(
        (document.fullscreenElement ??
          (document as Document & { webkitFullscreenElement?: Element })
            .webkitFullscreenElement) === rootRef.current,
      );
    document.addEventListener("fullscreenchange", listener);
    document.addEventListener("webkitfullscreenchange", listener);
    return () => {
      document.removeEventListener("fullscreenchange", listener);
      document.removeEventListener("webkitfullscreenchange", listener);
    };
  }, []);
  useEffect(() => {
    if (!dialog) return;
    focusBeforeDialog.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current
      ?.querySelector<HTMLElement>("button, input, select, textarea")
      ?.focus();
    return () => focusBeforeDialog.current?.focus();
  }, [dialog?.kind]);

  function publish(next: PanoProjectDefinition) {
    const checked = readDocument(next);
    if (history.commit(checked)) {
      props.onChange?.(checked);
      render();
    }
  }
  function updateScene(
    id: string,
    change: (scene: PanoProjectSceneDefinition) => PanoProjectSceneDefinition,
  ) {
    publish({
      ...history.current,
      scenes: history.current.scenes.map((scene) =>
        scene.id === id ? change(scene) : scene,
      ),
    });
  }
  function updateHotspot(next: ProjectHotspotDefinition) {
    const current = history.current.scenes
      .find((scene) => scene.id === active?.id)
      ?.hotspots?.find((hotspot) => hotspot.id === next.id);
    if (!current || next.type !== current.type)
      throw new Error("Unknown hotspot");
    const issue = geometryIssue(next);
    if (issue) throw new Error(issue);
    updateScene(active!.id, (scene) => ({
      ...scene,
      hotspots: scene.hotspots?.map((hotspot) =>
        hotspot.id === next.id ? next : hotspot,
      ),
    }));
  }
  function assetHotspot(
    hotspot: ProjectHotspotDefinition,
    field: string,
    url: string,
  ): ProjectHotspotDefinition {
    if (field === "graphic.src" && hotspot.type === "graphic")
      return { ...hotspot, graphic: { kind: "svg", src: url } };
    const value =
      field.startsWith("tooltip.") && typeof hotspot.tooltip === "string"
        ? { ...hotspot, tooltip: { text: hotspot.tooltip } }
        : hotspot;
    return setField(
      value,
      field,
      hotspot.type === "audio" && field === "src" ? [url] : url,
    );
  }
  function patchHotspot(
    id: string,
    patch: { position?: HotspotPosition; vertices?: HotspotPosition[] },
  ) {
    const hotspot = history.current.scenes
      .find((scene) => scene.id === active?.id)
      ?.hotspots?.find((item) => item.id === id);
    if (!hotspot) return;
    try {
      updateHotspot({ ...hotspot, ...patch } as ProjectHotspotDefinition);
    } catch (cause) {
      report(cause);
    }
  }
  function navigate(id: string) {
    history.end();
    pickerOperation.current++;
    setActiveId(id);
    setSelectedId(undefined);
    setPlacement(undefined);
    setTool(undefined);
    setDraft([]);
  }
  function resetDocument(next: PanoProjectDefinition, files?: LocalFiles) {
    generation.current++;
    operation.current++;
    task.cancel();
    setBusy(false);
    setProgress(undefined);
    history.replace(next);
    setLocal(files);
    setSaved(JSON.stringify(next));
    navigate(next.initialSceneId ?? next.scenes[0]?.id ?? "");
    setPreview(false);
    setError("");
    props.onChange?.(next);
    render();
  }
  async function openDirectory(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (
      !files.length ||
      (dirty && !window.confirm(t("Leave without exporting your changes?")))
    )
      return;
    const token = ++operation.current;
    let selectedFiles: LocalFiles | undefined;
    try {
      selectedFiles = new LocalFiles(files);
      const imported = await selectedFiles.project();
      if (!alive.current || token !== operation.current) {
        selectedFiles.dispose();
        return;
      }
      resetDocument(imported ?? emptyProject(), selectedFiles);
      if (!imported)
        setDialog({
          kind: "scenes",
          paths: selectedFiles.viewerPaths(),
          selected: selectedFiles.viewerPaths(),
        });
    } catch (cause) {
      selectedFiles?.dispose();
      report(cause);
    }
  }
  function addScene(
    source: PanoProjectSceneDefinition["source"],
    title: string,
    replace?: string,
  ) {
    const id = replace ?? newId();
    const next = replace
      ? {
          ...history.current,
          scenes: history.current.scenes.map((scene) =>
            scene.id === replace ? { ...scene, source } : scene,
          ),
        }
      : {
          ...history.current,
          initialSceneId: history.current.initialSceneId ?? id,
          scenes: [
            ...history.current.scenes,
            { id, title, source, hotspots: [] },
          ],
        };
    publish(next);
    navigate(id);
  }
  async function confirmDialog() {
    if (!dialog) return;
    const token = generation.current;
    setBusy(true);
    setError("");
    try {
      if (dialog.kind === "scenes" && local) {
        const paths = dialog.replace
          ? dialog.selected.slice(0, 1)
          : dialog.selected;
        await Promise.all(
          paths.map((path) =>
            local.source({ viewerUrl: LocalFiles.reference(path) }),
          ),
        );
        if (!alive.current || token !== generation.current) return;
        const additions = paths.map((path) => ({
          id: newId(),
          title: path
            .replace(/\/viewer\.json$/, "")
            .replace(/^viewer\.json$/, local.name),
          source: { viewerUrl: LocalFiles.reference(path) },
          hotspots: [],
        }));
        if (dialog.replace && additions[0])
          addScene(additions[0].source, additions[0].title, dialog.replace);
        else if (additions.length) {
          publish({
            ...history.current,
            initialSceneId: history.current.initialSceneId ?? additions[0]!.id,
            scenes: [...history.current.scenes, ...additions],
          });
          navigate(additions[0]!.id);
        }
      } else if (dialog.kind === "source") {
        const source = {
          viewerUrl: dialog.url,
          ...(dialog.root ? { baseUrl: dialog.root } : {}),
        };
        await new SceneSources({
          baseUrl: props.baseUrl,
          requestInit: props.requestInit,
          resolveAssetUrl: props.resolveAssetUrl,
        }).load("validate", source, new AbortController().signal);
        if (!alive.current || token !== generation.current) return;
        addScene(source, "Scene", dialog.replace);
      } else if (dialog.kind === "asset") {
        if (!dialog.selected.trim()) throw new Error("Choose a resource path");
        if (local) local.file(dialog.selected);
        if (dialog.hotspotId && active) {
          const hotspot = active.hotspots?.find(
            (item) => item.id === dialog.hotspotId,
          );
          if (hotspot)
            updateHotspot(assetHotspot(hotspot, dialog.field, dialog.selected));
        } else if (dialog.hotspotKind) {
          setPlacement(
            createHotspot(
              dialog.hotspotKind,
              { yaw: 0, pitch: 0 },
              dialog.selected,
            ),
          );
          setTool(dialog.hotspotKind);
        }
      } else if (dialog.kind === "delete") {
        publish(removeScene(history.current, dialog.id));
        navigate(history.current.scenes[0]?.id ?? "");
      }
      setDialog(undefined);
    } catch (cause) {
      report(cause);
    } finally {
      if (alive.current && token === generation.current) setBusy(false);
    }
  }
  async function importPanorama(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !props.onImportPanorama) return;
    const token = generation.current;
    const replace = importTarget.current;
    setBusy(true);
    setProgress({ stage: "upload" });
    setError("");
    try {
      const source = await task.run(
        file,
        props.onImportPanorama,
        setProgress,
        async (result, signal) => {
          parsePanoProject({
            schemaVersion: 1,
            scenes: [{ id: "validate", source: result }],
          });
          await new SceneSources({
            baseUrl: props.baseUrl,
            requestInit: props.requestInit,
            resolveAssetUrl: props.resolveAssetUrl,
          }).load("validate", result, signal);
        },
      );
      if (source && alive.current && token === generation.current)
        addScene(source, file.name.replace(/\.[^.]+$/, ""), replace);
    } catch (cause) {
      if (alive.current && token === generation.current) report(cause);
    } finally {
      if (alive.current && token === generation.current) {
        setBusy(false);
        setProgress(undefined);
      }
    }
  }
  async function pickAsset(field: string, hotspotKind?: HotspotKind) {
    if (!active) return;
    const pickerToken = ++pickerOperation.current;
    if (!local && props.onPickAsset) {
      const token = generation.current;
      const sceneId = active.id;
      const hotspot = hotspotKind
        ? createHotspot(hotspotKind, { yaw: 0, pitch: 0 })
        : selected;
      const request: PanoAssetRequest = {
        kind:
          (hotspotKind ?? hotspot?.type) === "video" && field === "src"
            ? "video"
            : (hotspotKind ?? hotspot?.type) === "audio" && field === "src"
              ? "audio"
              : (hotspotKind ?? hotspot?.type) === "iframe"
                ? "document"
                : "image",
        sceneId,
        hotspotId: hotspot?.id ?? "",
        field,
        currentUrl: hotspot
          ? String(getField(hotspot, field) ?? "")
          : undefined,
      };
      try {
        const url = await props.onPickAsset(request);
        if (
          !url ||
          !alive.current ||
          generation.current !== token ||
          pickerOperation.current !== pickerToken
        )
          return;
        if (hotspotKind) {
          setPlacement(assetHotspot(hotspot!, field, url));
          setTool(hotspotKind);
        } else if (hotspot)
          updateScene(sceneId, (scene) => ({
            ...scene,
            hotspots: scene.hotspots?.map((item) =>
              item.id === hotspot.id ? assetHotspot(item, field, url) : item,
            ),
          }));
      } catch (cause) {
        report(cause);
      }
    } else
      setDialog({
        kind: "asset",
        field,
        hotspotId: hotspotKind ? undefined : selectedId,
        hotspotKind,
        selected: "",
      });
  }
  function chooseTool(kind: HotspotKind) {
    history.end();
    setDraft([]);
    setPlacement(undefined);
    setSelectedId(undefined);
    setError("");
    if (["image", "sequence", "video", "audio", "iframe"].includes(kind)) {
      setTool(undefined);
      void pickAsset("src", kind);
    } else {
      setTool(kind);
      if (kind !== "polygon" && kind !== "polyline")
        setPlacement(createHotspot(kind, { yaw: 0, pitch: 0 }));
    }
  }
  function appendHotspot(hotspot: ProjectHotspotDefinition) {
    if (!active) return;
    updateScene(active.id, (scene) => ({
      ...scene,
      hotspots: [...(scene.hotspots ?? []), hotspot],
    }));
    setSelectedId(hotspot.id);
    setTool(undefined);
    setPlacement(undefined);
    setDraft([]);
  }
  function finishDrawing() {
    if (tool !== "polygon" && tool !== "polyline") return;
    const hotspot = {
      ...createHotspot(tool, { yaw: 0, pitch: 0 }),
      vertices: draft,
    } as ProjectHotspotDefinition;
    const issue = geometryIssue(hotspot);
    if (issue) {
      setError(issue);
      return;
    }
    try {
      appendHotspot(hotspot);
      setError("");
    } catch (cause) {
      report(cause);
    }
  }
  function place(position: HotspotPosition) {
    if (tool === "polygon" || tool === "polyline")
      setDraft((vertices) => [...vertices, position]);
    else if (placement && "position" in placement)
      appendHotspot({ ...placement, position });
    else setSelectedId(undefined);
  }
  function undo(redo = false) {
    end();
    const next = redo ? history.redo() : history.undo();
    props.onChange?.(next);
    render();
  }
  function deleteHotspot() {
    if (active && selected) {
      updateScene(active.id, (scene) => ({
        ...scene,
        hotspots: scene.hotspots?.filter(
          (hotspot) => hotspot.id !== selected.id,
        ),
      }));
      setSelectedId(undefined);
    }
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (dialog) {
      if (event.key === "Escape" && !busy) {
        setDialog(undefined);
        event.stopPropagation();
      }
      if (event.key === "Tab") {
        const nodes = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']",
          ) ?? [],
        );
        const index = nodes.indexOf(document.activeElement as HTMLElement);
        if (nodes.length) {
          event.preventDefault();
          nodes[
            (index + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length
          ]?.focus();
        }
      }
      return;
    }
    if (
      (event.target as HTMLElement).closest(
        "input,textarea,select,[contenteditable='true']",
      )
    )
      return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo(event.shiftKey);
    } else if (event.key === "Escape") {
      setTool(undefined);
      setPlacement(undefined);
      setDraft([]);
    } else if (
      !preview &&
      (tool === "polygon" || tool === "polyline") &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      finishDrawing();
    } else if (!preview && draft.length && event.key === "Backspace") {
      event.preventDefault();
      setDraft((vertices) => vertices.slice(0, -1));
    } else if (
      !preview &&
      selected &&
      ["Delete", "Backspace"].includes(event.key)
    ) {
      event.preventDefault();
      deleteHotspot();
    }
  }
  async function save(download: boolean) {
    const token = generation.current;
    try {
      end();
      const text = exportDocument(history.current);
      const snapshot = JSON.stringify(history.current);
      if (download) {
        const url = URL.createObjectURL(
          new Blob([text], { type: "application/json" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "project.json";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setSaving(true);
        await props.onSave?.(JSON.parse(text) as PanoProjectDefinition);
      }
      if (alive.current && token === generation.current) {
        setSaved(snapshot);
        setError("");
      }
    } catch (cause) {
      if (alive.current && token === generation.current) report(cause);
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  async function toggleFullscreen() {
    try {
      if (fullscreen) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else
          await (
            document as Document & { webkitExitFullscreen?: () => void }
          ).webkitExitFullscreen?.();
      } else if (rootRef.current?.requestFullscreen)
        await rootRef.current.requestFullscreen();
      else
        await (
          rootRef.current as
            | (HTMLDivElement & { webkitRequestFullscreen?: () => void })
            | null
        )?.webkitRequestFullscreen?.();
    } catch (cause) {
      report(cause);
    }
  }
  const draftKind =
    tool === "polygon" || tool === "polyline" ? tool : undefined;
  const sourceDialog = (replace?: string) =>
    local
      ? setDialog({
          kind: "scenes",
          paths: local.viewerPaths(),
          selected: [],
          replace,
        })
      : setDialog({ kind: "source", url: "", root: "", replace });
  const incoming =
    dialog?.kind === "delete"
      ? project.scenes
          .flatMap((scene) => scene.hotspots ?? [])
          .filter((hotspot) => hotspot.action?.sceneId === dialog.id).length
      : 0;

  return (
    <div
      ref={rootRef}
      className={`pne-root ${props.className ?? ""}`}
      style={props.style}
      lang={props.locale ?? "en"}
      onKeyDown={keyDown}
      tabIndex={-1}
      aria-label={t("Panorama editor")}
    >
      <div className="pne-topbar">
        <div className="pne-brand">
          <span className="pne-brand-dot" />
          {t("Panorama editor")}
          <small>{local?.name ?? "PANO / VIEW"}</small>
        </div>
        <div className="pne-toolbar">
          <button
            type="button"
            disabled={busy}
            onClick={() => directoryRef.current?.click()}
          >
            {t("Open directory")}
          </button>
          {props.onImportPanorama && !local ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                importTarget.current = undefined;
                importRef.current?.click();
              }}
            >
              {t("Import image")}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!history.past.length || preview}
            onClick={() => undo()}
          >
            {t("Undo")}
          </button>
          <button
            type="button"
            disabled={!history.future.length || preview}
            onClick={() => undo(true)}
          >
            {t("Redo")}
          </button>
          <button
            type="button"
            disabled={!project.scenes.length}
            aria-pressed={preview}
            onClick={() => {
              end();
              setPreview((value) => !value);
              setTool(undefined);
              setPlacement(undefined);
              setDraft([]);
            }}
          >
            {t(preview ? "Edit" : "Preview")}
          </button>
          <button type="button" onClick={() => void toggleFullscreen()}>
            {t(fullscreen ? "Exit fullscreen" : "Fullscreen")}
          </button>
          {props.onSave && !local ? (
            <button
              type="button"
              disabled={!project.scenes.length || saving}
              onClick={() => void save(false)}
            >
              {t("Save")}
            </button>
          ) : null}
          <button
            type="button"
            className="pne-primary"
            disabled={!project.scenes.length || saving}
            onClick={() => void save(true)}
          >
            {t("Export JSON")}
          </button>
        </div>
      </div>
      <input
        ref={(node) => {
          directoryRef.current = node;
          if (node) node.setAttribute("webkitdirectory", "");
        }}
        type="file"
        multiple
        hidden
        aria-label={t("Open directory")}
        onChange={(event) => void openDirectory(event)}
      />
      {props.onImportPanorama && !local ? (
        <input
          ref={importRef}
          type="file"
          accept="image/*"
          hidden
          aria-label={t("Import image")}
          onChange={(event) => void importPanorama(event)}
        />
      ) : null}
      <div className="pne-session">
        <span>
          {local
            ? t("Local session · files stay on your computer")
            : hostManaged
              ? t(
                  "Host-managed session · uploads and saving use your application",
                )
              : t(
                  "Select a project directory containing viewer.json and tiles. Nothing is uploaded or saved. Export project.json before leaving.",
                )}
        </span>
        <span>{t(dirty ? "Unsaved changes" : "No pending changes")}</span>
      </div>
      {error ? (
        <div className="pne-alert" role="alert">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label={t("Close")}
          >
            ×
          </button>
        </div>
      ) : null}
      {progress ? (
        <div className="pne-progress" role="status">
          {t("Conversion in progress")} · {t(progress.stage)}
          {progress.progress !== undefined
            ? ` ${Math.round(progress.progress * 100)}%`
            : "…"}
          <button
            type="button"
            onClick={() => {
              generation.current++;
              task.cancel();
              setBusy(false);
              setProgress(undefined);
            }}
          >
            {t("Cancel")}
          </button>
        </div>
      ) : null}
      <div className={`pne-workspace ${preview ? "pne-preview" : ""}`}>
        <SceneSidebar
          project={project}
          canAdd={Boolean(local) || hostManaged}
          activeId={active?.id}
          selectedId={selectedId}
          preview={preview}
          busy={busy}
          t={t}
          onBegin={begin}
          onEnd={end}
          onTitle={(title) => publish({ ...history.current, title })}
          onNavigate={navigate}
          onSelectHotspot={(id) => {
            setSelectedId(id);
            setTool(undefined);
            setPlacement(undefined);
            setDraft([]);
          }}
          onAdd={() => sourceDialog()}
          onDuplicate={() => {
            if (!active) return;
            const id = newId();
            publish({
              ...project,
              scenes: [
                ...project.scenes,
                {
                  ...structuredClone(active),
                  id,
                  title: `${active.title ?? "Scene"} (copy)`,
                },
              ],
            });
            navigate(id);
          }}
          onDelete={() => {
            if (active) setDialog({ kind: "delete", id: active.id });
          }}
          onMove={(offset) => {
            const index = project.scenes.findIndex(
              (scene) => scene.id === active?.id,
            );
            const scenes = [...project.scenes];
            [scenes[index], scenes[index + offset]] = [
              scenes[index + offset]!,
              scenes[index]!,
            ];
            publish({ ...project, scenes });
          }}
        />
        <section className="pne-center" aria-label={t("Panorama editor")}>
          {!preview && active ? (
            <div className="pne-tools">
              <button
                type="button"
                aria-pressed={!tool}
                onClick={() => {
                  setTool(undefined);
                  setPlacement(undefined);
                  setDraft([]);
                }}
              >
                {t("Navigate")}
              </button>
              {hotspotKinds.map((kind) => (
                <button
                  type="button"
                  key={kind}
                  aria-pressed={tool === kind}
                  onClick={() => chooseTool(kind)}
                >
                  {t(kind)}
                </button>
              ))}
            </div>
          ) : null}
          <EditorViewer
            project={project}
            local={local}
            options={props}
            activeId={active?.id}
            selectedId={selectedId}
            preview={preview}
            draft={draft}
            draftKind={draftKind}
            placing={Boolean(placement)}
            viewerRef={viewerRef}
            onActive={navigate}
            onSelect={setSelectedId}
            onUpdate={patchHotspot}
            onBegin={begin}
            onEnd={end}
            onPlace={place}
            onError={setError}
            t={t}
          />
          <div className="pne-canvas-status" role="status">
            <span>
              {draftKind
                ? t("Click to draw vertices; Enter finishes; Escape cancels")
                : placement
                  ? t("Click the panorama to place a hotspot")
                  : (active?.title ?? t("Select a scene to begin"))}
            </span>
            {draftKind ? (
              <>
                <button type="button" onClick={finishDrawing}>
                  {t("Finish drawing")}
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((vertices) => vertices.slice(0, -1))}
                >
                  {t("Remove last vertex")}
                </button>
              </>
            ) : null}
          </div>
        </section>
        {!preview ? (
          <aside className="pne-inspector" aria-label={t("Appearance")}>
            <div className="pne-panel-title">
              {selected
                ? selected.label || selected.id
                : (active?.title ?? t("Scene source"))}
            </div>
            {selected ? (
              <>
                <div className="pne-fields pne-button-grid">
                  <button
                    type="button"
                    onClick={() =>
                      appendHotspot({
                        ...structuredClone(selected),
                        id: newId(),
                      })
                    }
                  >
                    {t("Duplicate")}
                  </button>
                  <button type="button" onClick={deleteHotspot}>
                    {t("Delete")}
                  </button>
                </div>
                <HotspotInspector
                  key={selected.id}
                  hotspot={selected}
                  scenes={project.scenes}
                  onChange={updateHotspot}
                  onBegin={begin}
                  onEnd={end}
                  onPick={(field) => void pickAsset(field)}
                  getViewPosition={() =>
                    viewerRef.current?.getView() ?? { yaw: 0, pitch: 0 }
                  }
                  t={t}
                />
              </>
            ) : active ? (
              <SceneSettings
                key={active.id}
                scene={active}
                initialSceneId={project.initialSceneId}
                busy={busy}
                t={t}
                onBegin={begin}
                onEnd={end}
                onChange={(scene) => updateScene(active.id, () => scene)}
                onSetInitial={() =>
                  publish({ ...project, initialSceneId: active.id })
                }
                getView={() => viewerRef.current?.getView()}
                onReplace={() => sourceDialog(active.id)}
                onImport={
                  props.onImportPanorama && !local
                    ? () => {
                        importTarget.current = active.id;
                        importRef.current?.click();
                      }
                    : undefined
                }
              />
            ) : (
              <p className="pne-hint">{t("Select a scene to begin")}</p>
            )}
          </aside>
        ) : null}
      </div>
      {dialog ? (
        <EditorDialog
          dialog={dialog}
          local={local}
          busy={busy}
          error={error}
          incoming={incoming}
          titleId={dialogTitleId}
          elementRef={dialogRef}
          onChange={setDialog}
          onConfirm={confirmDialog}
          t={t}
        />
      ) : null}
    </div>
  );
}
