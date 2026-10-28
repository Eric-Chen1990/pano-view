import { hotspotAction, setHotspotAction, projectHotspotTriggers, type ProjectHotspotTrigger } from "@ericchen1990/pano-view/data";
import { customActionIssue, validateCustomActions } from "./custom-actions";
import { PopupLibrary, PopupInspector } from "./popup-panels";
import { cursorImage, imageCursor } from "../../../shared/cursor-assets";
import { validateCursorImage } from "./cursor-image";
import { projectRoot } from "./sources";
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
  type PanoViewerState,
  type ProjectPopupDefinition,
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
  newId,
  readDocument,
  moveScene,
  removeScene,
  removePopup,
  type HotspotKind,
} from "./document";
import { LocalFiles } from "./local-files";
import { SceneSources } from "./sources";
import { ImportTask } from "./import-task";
import { translator } from "./i18n";
import { getField, setField } from "./fields";
import { FieldHelpProvider } from "./field-help";
import { HotspotInspector } from "./inspector";
import { EditorViewer, type HotspotTestRequest } from "./editor-viewer";
import { errorMessage } from "./errors";

export function PanoEditor(props: PanoEditorProps) {
  const hostManaged = Boolean(
    props.onSave ||
    props.onImportPanorama ||
    props.onPickAsset || props.onPickPopupAsset,
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
  const [directories, setDirectories] = useState<LocalFiles[]>([]);
  const retainedDirectories = useRef<LocalFiles[]>([]);
  const activeLocal =
    directories.find((files) => active && files.containsSource(active.source)) ?? local;
  const localSession = Boolean(local || directories.length);
  const [preview, setPreview] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<"scenes" | "popups">("scenes");
  const [selectedPopupId, setSelectedPopupId] = useState<string>();
  const selectedPopup = project.popups?.find((popup) => popup.id === selectedPopupId);
  const [testRequest, setTestRequest] = useState<HotspotTestRequest>();
  const testGeneration = useRef(0);
  const previewOrigin = useRef<{ sceneId: string; hotspotId?: string; view: PanoViewerState } | undefined>(undefined);
  const restoreView = useRef<{ sceneId: string; view: PanoViewerState } | undefined>(undefined);
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
  const [exportProgress, setExportProgress] = useState<{ completed: number; total: number }>();
  const exportController = useRef<AbortController | undefined>(undefined);
  const cursorInput = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const directoryRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<PanoViewerHandle>(null);
  const inspectorRef = useRef<HTMLElement>(null);
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
      exportController.current?.abort();
      for (const files of retainedDirectories.current) files.dispose();
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
  function enterPreview(hotspotId?: string, trigger: ProjectHotspotTrigger = "click") {
    end();
    if (!active) return;
    if (hotspotId) {
      const target = active.hotspots?.find(item => item.id === hotspotId);
      const action = target && hotspotAction(target, trigger);
      const issue = action?.type === "custom" ? customActionIssue(action, props.customActions) : undefined;
      if (issue) { report(new Error(issue)); return; }
    }
    previewOrigin.current = { sceneId: active.id, hotspotId: selectedId, view: viewerRef.current?.getView() ?? { yaw: 0, pitch: 0, fov: 75 } };
    void viewerRef.current?.activateMedia().catch(report);
    setTestRequest(hotspotId ? { sceneId: active.id, hotspotId, trigger, token: ++testGeneration.current } : undefined);
    setPreview(true);
    setTool(undefined); setPlacement(undefined); setDraft([]);
  }
  function leavePreview() {
    const origin = previewOrigin.current;
    setTestRequest(undefined);
    setPreview(false);
    if (origin && history.current.scenes.some((scene) => scene.id === origin.sceneId)) {
      restoreView.current = origin;
      setActiveId(origin.sceneId); setSelectedId(origin.hotspotId);
    }
    previewOrigin.current = undefined;
  }
  function updatePopup(popup: ProjectPopupDefinition) {
    publish({ ...history.current, popups: history.current.popups?.map((item) => item.id === popup.id ? popup : item) });
  }
  function createPopup(linkHotspot = false, trigger: ProjectHotspotTrigger = "click") {
    end();
    const names = new Set(history.current.popups?.map((popup) => popup.title));
    let index = 1;
    while (names.has(`${t("Popup")} ${index}`)) index++;
    const popup: ProjectPopupDefinition = { id: newId(), title: `${t("Popup")} ${index}`, blocks: [{ id: newId(), type: "text", text: "" }] };
    const next = { ...history.current, popups: [...history.current.popups ?? [], popup] };
    if (linkHotspot && active && selected) next.scenes = next.scenes.map((scene) => scene.id === active.id
      ? { ...scene, hotspots: scene.hotspots?.map((hotspot) => hotspot.id === selected.id ? setHotspotAction(hotspot, trigger, { type: "popup", popupId: popup.id }) : hotspot) } : scene);
    publish(next);
    setSelectedPopupId(popup.id); setSidebarMode("popups");
  }
  function setPopupResource(popupId: string, blockId: string, field: "src" | "poster", url: string) {
    const popup = history.current.popups?.find((item) => item.id === popupId);
    if (!popup) return;
    updatePopup({ ...popup, blocks: popup.blocks.map((block) => block.id === blockId && block.type !== "text" && (field !== "poster" || block.type === "video") ? { ...block, [field]: url } : block) });
  }
  async function pickPopupAsset(popupId: string, blockId: string, field: "src" | "poster") {
    end();
    const block = history.current.popups?.find((popup) => popup.id === popupId)?.blocks.find((item) => item.id === blockId);
    if (!block || block.type === "text") return;
    const token = ++pickerOperation.current;
    const documentToken = generation.current;
    if (!localSession && props.onPickPopupAsset) {
      try {
        const url = await props.onPickPopupAsset({ popupId, blockId, field, kind: field === "poster" ? "image" : block.type,
          currentUrl: field === "poster" && block.type === "video" ? block.poster : block.src });
        if (url && alive.current && token === pickerOperation.current && documentToken === generation.current)
          setPopupResource(popupId, blockId, field, url);
      } catch (cause) { report(cause); }
    } else setDialog({ kind: "asset", popupId, blockId, field, selected: field === "poster" && block.type === "video" ? block.poster ?? "" : block.src });
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
    if (field === "cursor") return { ...hotspot, cursor: imageCursor(url) };
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
    exportController.current?.abort();
    setBusy(false);
    setProgress(undefined);
    history.replace(next);
    setLocal(files);
    for (const directory of retainedDirectories.current) directory.dispose();
    retainedDirectories.current = [];
    setDirectories([]);
    setSaved(JSON.stringify(next));
    navigate(next.initialSceneId ?? next.scenes[0]?.id ?? "");
    setPreview(false);
    setTestRequest(undefined); previewOrigin.current = undefined; restoreView.current = undefined;
    setSidebarMode("scenes"); setSelectedPopupId(undefined);
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
  async function addDirectory(selection: File[] | Promise<File[]>) {
    if (busy) return;
    const token = ++operation.current;
    const documentToken = generation.current;
    const replace = dialog && "replace" in dialog ? dialog.replace : undefined;
    let selectedFiles: LocalFiles | undefined;
    setBusy(true);
    setError("");
    try {
      const files = await selection;
      if (
        !files.length ||
        !alive.current ||
        token !== operation.current ||
        documentToken !== generation.current
      )
        return;
      if (!files[0]!.webkitRelativePath.includes("/"))
        throw new Error(
          t("Select or drop a complete folder, including viewer.json, previews and tiles. Unzip ZIP files first."),
        );
      const prefix = `imports/${newId()}/${files[0]!.webkitRelativePath.split("/")[0]}/`;
      selectedFiles = new LocalFiles(files, prefix);
      const paths = selectedFiles.viewerPaths();
      if (!paths.length) throw new Error(t("No viewer.json found"));
      if (replace && paths.length !== 1)
        throw new Error(
          t("Choose a directory containing one viewer.json to replace a scene"),
        );
      await Promise.all(
        paths.map((path) =>
          selectedFiles!.source({ viewerUrl: LocalFiles.reference(path) }),
        ),
      );
      if (
        !alive.current ||
        token !== operation.current ||
        documentToken !== generation.current
      )
        return;
      const additions = paths.map((path) => ({
        id: newId(),
        title: path
          .slice(prefix.length)
          .replace(/\/viewer\.json$/, "")
          .replace(/^viewer\.json$/, selectedFiles!.name),
        source: { viewerUrl: LocalFiles.reference(path) },
        hotspots: [],
      }));
      if (replace) addScene(additions[0]!.source, additions[0]!.title, replace);
      else {
        publish({
          ...history.current,
          initialSceneId: history.current.initialSceneId ?? additions[0]!.id,
          scenes: [...history.current.scenes, ...additions],
        });
        navigate(additions[0]!.id);
      }
      retainedDirectories.current.push(selectedFiles);
      setDirectories([...retainedDirectories.current]);
      selectedFiles = undefined;
      setDialog(undefined);
    } catch (cause) {
      if (
        alive.current && token === operation.current &&
        documentToken === generation.current
      )
        report(cause);
    } finally {
      selectedFiles?.dispose();
      if (
        alive.current && token === operation.current &&
        documentToken === generation.current
      )
        setBusy(false);
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
        const viewerUrl = dialog.url.trim();
        const baseUrl = dialog.root.trim();
        const urlError = t("Use an HTTP(S) URL for online resources. For files on your computer, choose Local folder.");
        for (const path of [viewerUrl, baseUrl].filter(Boolean)) {
          let url: URL;
          try {
            url = new URL(path);
          } catch {
            throw new Error(urlError);
          }
          if (!/^https?:\/\//i.test(path) || !/^https?:$/.test(url.protocol))
            throw new Error(urlError);
        }
        const source = {
          viewerUrl,
          ...(baseUrl ? { baseUrl } : {}),
        };
        await new SceneSources({
          baseUrl: props.baseUrl,
          requestInit: props.requestInit,
          resolveAssetUrl: props.resolveAssetUrl,
          resolvePopupAssetUrl: props.resolvePopupAssetUrl,
        })
          .load("validate", source, new AbortController().signal)
          .catch((cause: unknown) => {
            throw new Error(`${t("Could not read viewer.json. Check the public URL, CORS permissions and JSON format.")} ${errorMessage(cause)}`);
          });
        if (!alive.current || token !== generation.current) return;
        addScene(source, "Scene", dialog.replace);
      } else if (dialog.kind === "asset") {
        if (!dialog.selected.trim()) throw new Error("Choose a resource path");
        const assetLocal = directories.find((files) => files.containsPath(dialog.selected)) ?? local;
        if (assetLocal) assetLocal.file(dialog.selected);
        if (dialog.popupId && dialog.blockId) {
          setPopupResource(dialog.popupId, dialog.blockId, dialog.field as "src" | "poster", dialog.selected);
        } else if (dialog.hotspotId && active) {
          const hotspot = active.hotspots?.find(
            (item) => item.id === dialog.hotspotId,
          );
          if (hotspot)
            updateHotspot(assetHotspot(hotspot, dialog.field, dialog.selected));
        } else if (dialog.hotspotKind) {
          setPlacement(
            newHotspot(
              dialog.hotspotKind,
              { yaw: 0, pitch: 0 },
              dialog.selected,
            ),
          );
          setTool(dialog.hotspotKind);
        }
      } else if (dialog.kind === "delete") {
        if (dialog.target === "scene") {
          const next = removeScene(history.current, dialog.id);
          publish(next);
          if (active?.id === dialog.id)
            navigate(next.initialSceneId ?? next.scenes[0]?.id ?? "");
        } else {
          updateScene(dialog.sceneId, (scene) => ({
            ...scene,
            hotspots: scene.hotspots?.filter((hotspot) => hotspot.id !== dialog.id),
          }));
          if (active?.id === dialog.sceneId && selectedId === dialog.id)
            setSelectedId(undefined);
        }
        requestAnimationFrame(() => {
          const root = rootRef.current;
          const target = root?.querySelector<HTMLElement>(
            dialog.target === "scene" ? ".pne-scene[aria-pressed='true']" : ".pne-add-hotspot",
          ) ?? root?.querySelector<HTMLElement>(".pne-add-scene button") ?? root;
          target?.focus();
        });
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
          resolvePopupAssetUrl: props.resolvePopupAssetUrl,
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
    if (field === "cursor" && (localSession || !props.onPickAsset)) {
      cursorInput.current?.click();
      return;
    }
    const pickerToken = ++pickerOperation.current;
    if (!localSession && props.onPickAsset) {
      const token = generation.current;
      const sceneId = active.id;
      const hotspot = hotspotKind
        ? newHotspot(hotspotKind, { yaw: 0, pitch: 0 })
        : selected;
      const request: PanoAssetRequest = {
        kind:
          field === "cursor"
            ? "image"
            : (hotspotKind ?? hotspot?.type) === "video" && field === "src"
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
          ? field === "cursor"
            ? cursorImage(hotspot.cursor)
            : String(getField(hotspot, field) ?? "")
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
  async function importCursor(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !active || !selected) return;
    const sceneId = active.id,
      hotspotId = selected.id,
      token = generation.current;
    try {
      await validateCursorImage(file);
      const imageUrl = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = imageUrl;
        await image.decode();
      } catch {
        throw new Error("Choose a PNG cursor image up to 32 × 32 pixels.");
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
      if (!alive.current || generation.current !== token) return;
      const files = LocalFiles.imported(file, `assets/cursors/${newId()}/`);
      const path = LocalFiles.reference([...files.files.keys()][0]!);
      updateScene(sceneId, (scene) => ({
        ...scene,
        hotspots: scene.hotspots?.map((hotspot) =>
          hotspot.id === hotspotId
            ? { ...hotspot, cursor: imageCursor(path) }
            : hotspot,
        ),
      }));
      retainedDirectories.current.push(files);
      setDirectories((current) => [...current, files]);
      setError("");
    } catch (cause) {
      report(t(errorMessage(cause)));
    }
  }
  let cursorPreviewUrl: string | undefined;
  const cursorPath = cursorImage(selected?.cursor);
  if (cursorPath && selected && active) {
    try {
      const files =
        directories.find((entry) => entry.containsPath(cursorPath)) ?? local;
      const context = {
        kind: "hotspot" as const,
        sceneId: active.id,
        hotspotId: selected.id,
        defaultUrl: new URL(
          cursorPath,
          files ? "https://pano-editor.invalid/" : projectRoot(props.baseUrl),
        ).href,
      };
      cursorPreviewUrl = files
        ? files.resolve(cursorPath, context)
        : props.resolveAssetUrl?.(cursorPath, context) ?? context.defaultUrl;
    } catch {
      /* The viewer reports missing resources; keep the inspector usable. */
    }
  }
  function newHotspot(kind: HotspotKind, position: HotspotPosition, src = "") {
    return createHotspot(kind, position, src, { hotspots: active?.hotspots, t });
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
        setPlacement(newHotspot(kind, { yaw: 0, pitch: 0 }));
    }
  }
  function selectHotspot(id: string) {
    setSelectedId(id);
    setTool(undefined);
    setPlacement(undefined);
    setDraft([]);
  }
  function editHotspot(id: string) {
    selectHotspot(id);
    requestAnimationFrame(() => {
      inspectorRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
    });
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
      ...newHotspot(tool, { yaw: 0, pitch: 0 }),
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
  function requestDeleteHotspot(id = selected?.id) {
    const hotspot = active?.hotspots?.find((item) => item.id === id);
    if (active && hotspot) {
      end();
      setError("");
      setDialog({
        kind: "delete",
        target: "hotspot",
        id: hotspot.id,
        sceneId: active.id,
        title: hotspot.label || hotspot.id,
        sceneTitle: active.title ?? active.id,
      });
    }
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented || (event.target as HTMLElement).closest("[data-pano-dialog]")) return;
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
    if (!preview && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
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
      requestDeleteHotspot();
    }
  }
  async function save(download: boolean) {
    const token = generation.current;
    try {
      end();
      validateCustomActions(history.current, props.customActions);
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
  async function exportPackage() {
    if (exportController.current) return;
    end();
    try { validateCustomActions(history.current, props.customActions); } catch (error) { report(error); return; }
    const controller = new AbortController();
    exportController.current = controller;
    const token = generation.current;
    const snapshot = JSON.stringify(history.current);
    setExportProgress({ completed: 0, total: 0 });
    setError("");
    try {
      const { buildProjectPackage } = await import("./project-package");
      const blob = await buildProjectPackage(
        JSON.parse(snapshot) as PanoProjectDefinition,
        {
          baseUrl: props.baseUrl,
          requestInit: props.requestInit,
          resolveAssetUrl: props.resolveAssetUrl,
          resolvePopupAssetUrl: props.resolvePopupAssetUrl,
          local,
          directories,
          signal: controller.signal,
          onProgress: (value) => {
            if (
              alive.current &&
              token === generation.current &&
              !controller.signal.aborted
            )
              setExportProgress(value);
          },
        },
      );
      if (
        !alive.current ||
        token !== generation.current ||
        controller.signal.aborted
      )
        return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "panorama-project.zip";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setSaved(snapshot);
    } catch (cause) {
      if (
        alive.current &&
        token === generation.current &&
        !controller.signal.aborted
      ) {
        const message = errorMessage(cause);
        const separator = message.indexOf(": ");
        setError(
          separator < 0
            ? t(message)
            : `${message.slice(0, separator)}: ${t(
                message.slice(separator + 2),
              )}`,
        );
      }
    } finally {
      if (exportController.current === controller)
        exportController.current = undefined;
      if (alive.current) setExportProgress(undefined);
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
    dialog?.kind === "delete" && dialog.target === "scene"
      ? project.scenes
          .flatMap((scene) => scene.hotspots ?? [])
          .filter((hotspot) => projectHotspotTriggers.some(trigger => { const action = hotspotAction(hotspot, trigger); return action?.type === "scene" && action.sceneId === dialog.id; })).length
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
      <FieldHelpProvider>
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
          {props.onImportPanorama && !localSession ? (
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
              if (preview) leavePreview(); else enterPreview();
            }}
          >
            {t(preview ? "Edit" : "Preview")}
          </button>
          <button type="button" onClick={() => void toggleFullscreen()}>
            {t(fullscreen ? "Exit fullscreen" : "Fullscreen")}
          </button>
          {props.onSave && !localSession ? (
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
            disabled={!project.scenes.length || saving || Boolean(exportProgress)}
            title={t("Export configuration only; assets are not included.")}
            onClick={() => void save(true)}
          >
            {t("Export JSON")}
          </button>
          <button type="button" className="pne-primary" disabled={!project.scenes.length || saving || Boolean(exportProgress)} onClick={() => void exportPackage()}>
            {t("Export project package")}
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
      <input ref={cursorInput} type="file" accept="image/png,.png" hidden aria-label={t("Choose cursor image")} onChange={event => void importCursor(event)} />
      {props.onImportPanorama && !localSession ? (
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
          {localSession
            ? t("Local session · files stay on your computer")
            : hostManaged
              ? t(
                  "Host-managed session · uploads and saving use your application",
                )
              : project.scenes.length
                ? t("Browser session · export before leaving")
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
      {exportProgress ? <div className="pne-progress" role="status">
        {t("Preparing project package")} · {exportProgress.total ? `${exportProgress.completed} / ${exportProgress.total}` : t("Collecting resources…")}
        <button type="button" onClick={() => exportController.current?.abort()}>{t("Cancel")}</button>
      </div> : null}
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
        <div className="pne-library-sidebar">
          {!preview ? <div className="pne-sidebar-tabs" role="group" aria-label={t("Project library")}>
            <button type="button" aria-pressed={sidebarMode === "scenes"} onClick={() => { end(); setSidebarMode("scenes"); }}>{t("Scenes")}</button>
            <button type="button" aria-pressed={sidebarMode === "popups"} onClick={() => { end(); setSidebarMode("popups"); }}>{t("Popup content")}</button>
          </div> : null}
          {sidebarMode === "popups" && !preview ? <PopupLibrary project={project} selectedId={selectedPopupId} onSelect={(id) => { end(); setSelectedPopupId(id); }} onAdd={() => createPopup()} t={t} /> : <SceneSidebar
          project={project}
          activeId={active?.id}
          selectedId={selectedId}
          preview={preview}
          busy={busy}
          t={t}
          onBegin={begin}
          onEnd={end}
          onTitle={(title) => publish({ ...history.current, title })}
          onNavigate={navigate}
          onSelectHotspot={selectHotspot}
          onEditHotspot={editHotspot}
          onDeleteHotspot={requestDeleteHotspot}
          onAdd={() => sourceDialog()}
          onDelete={(id) => {
            const scene = history.current.scenes.find((item) => item.id === id);
            if (!scene) return;
            end();
            setError("");
            setDialog({ kind: "delete", target: "scene", id, title: scene.title ?? id, hotspotCount: scene.hotspots?.length ?? 0 });
          }}
          onReorder={(id, beforeId) => {
            end();
            publish(moveScene(history.current, id, beforeId));
          }}
        />}
        </div>
        <section className="pne-center" aria-label={t("Panorama editor")}>
          {!preview && active ? (
            <div className="pne-tools">
              <span className="pne-view-context">{active.title ?? active.id}</span>
              <button
                type="button"
                className="pne-primary pne-add-hotspot"
                disabled={busy}
                onClick={() => {
                  end();
                  setDialog({ kind: "hotspot" });
                }}
              >
                {t("Add hotspot")}
              </button>
              {tool ? (
                <>
                  <span className="pne-tool-kind">{t(tool)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setTool(undefined);
                      setPlacement(undefined);
                      setDraft([]);
                    }}
                  >
                    {t("Cancel placement")}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
          <EditorViewer
            project={project}
            local={local}
            directories={directories}
            options={props}
            activeId={active?.id}
            selectedId={selectedId}
            preview={preview}
            draft={draft}
            draftKind={draftKind}
            placing={Boolean(placement)}
            viewerRef={viewerRef}
            onActive={navigate}
            onSelect={selectHotspot}
            onUpdate={patchHotspot}
            onBegin={begin}
            onEnd={end}
            onPlace={place}
            onError={(message) => { setError(message); setTestRequest(undefined); }}
            onReady={(id) => {
              const restore = restoreView.current;
              if (!preview && restore?.sceneId === id) {
                viewerRef.current?.setView(restore.view, { immediate: true }); restoreView.current = undefined;
              }
            }}
            testRequest={testRequest}
            onTestConsumed={() => setTestRequest(undefined)}
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
          <aside ref={inspectorRef} className="pne-inspector" aria-label={t("Appearance")}>
            <div className="pne-panel-title">
              {sidebarMode === "popups" ? selectedPopup?.title || t("Popup content") : selected
                ? selected.label || selected.id
                : (active?.title ?? t("Scene source"))}
            </div>
            {sidebarMode === "popups" ? selectedPopup ? <PopupInspector
              key={selectedPopup.id} popup={selectedPopup} project={project} onChange={updatePopup}
              onBegin={begin} onEnd={end} onPick={(blockId, field) => void pickPopupAsset(selectedPopup.id, blockId, field)}
              onDuplicate={() => {
                end();
                const popup = { ...structuredClone(selectedPopup), id: newId(), title: `${selectedPopup.title} (${t("Copy")})`, blocks: selectedPopup.blocks.map((block) => ({ ...block, id: newId() })) };
                publish({ ...history.current, popups: [...history.current.popups ?? [], popup] }); setSelectedPopupId(popup.id);
              }}
              onDelete={() => { end(); publish(removePopup(history.current, selectedPopup.id)); setSelectedPopupId(undefined); }}
              onReference={(sceneId, hotspotId) => { navigate(sceneId); setSelectedId(hotspotId); setSidebarMode("scenes"); }} t={t}
            /> : <p className="pne-hint">{t("Select or create a shared popup.")}</p> : selected ? (
              <>
                <div className="pne-inspector-context">
                  <span>{active?.title ?? active?.id} / {t("Hotspot properties")}</span>
                  <button
                    type="button"
                    className="pne-subtle"
                    onClick={() => setSelectedId(undefined)}
                  >
                    {t("Back to scene")}
                  </button>
                </div>
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
                    {t("Duplicate hotspot")}
                  </button>
                  <button type="button" onClick={() => requestDeleteHotspot()}>
                    {t("Delete hotspot")}
                  </button>
                </div>
                <p className="pne-edit-hint">{t("Edit properties below. Drag the hotspot or its vertex handles in the panorama to change its position.")}</p>
                <p className="pne-edit-hint">{t("Editing keeps hotspots selectable and draggable, and pauses media. Use Preview or Test this hotspot to check visitor behavior.")}</p>
                <HotspotInspector
                  customActions={props.customActions}
                  key={selected.id}
                  hotspot={selected}
                  scenes={project.scenes}
                  popups={project.popups}
                  getView={() => viewerRef.current?.getView() ?? { yaw: 0, pitch: 0, fov: 75 }}
                  onCreatePopup={(trigger) => createPopup(true, trigger)}
                  onEditPopup={(id) => { end(); setSelectedPopupId(id); setSidebarMode("popups"); }}
                  onTest={(trigger) => enterPreview(selected.id, trigger)}
                  onChange={updateHotspot}
                  onBegin={begin}
                  onEnd={end}
                  onPick={(field) => void pickAsset(field)}
                  cursorPreviewUrl={cursorPreviewUrl}
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
                  props.onImportPanorama && !localSession
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
          local={dialog.kind === "asset" ? dialog.popupId ? directories.find((files) => files.containsPath(dialog.selected)) ?? local ?? directories[0] : activeLocal : local}
          busy={busy}
          error={error}
          incoming={incoming}
          titleId={dialogTitleId}
          elementRef={dialogRef}
          onChange={(next) => {
            setError("");
            setDialog(next);
          }}
          onConfirm={confirmDialog}
          onDirectory={addDirectory}
          onChooseHotspot={(kind) => {
            setDialog(undefined);
            chooseTool(kind);
          }}
          t={t}
        />
      ) : null}
      </FieldHelpProvider>
    </div>
  );
}
