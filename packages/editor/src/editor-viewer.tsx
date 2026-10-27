import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  PanoViewer,
  Scenes,
  ProjectScenes,
  type PanoViewerHandle,
  type HotspotPosition,
} from "@ericchen1990/pano-view";
import {
  resolveProjectHotspotAssets,
  type PanoProjectDefinition,
  type LoadedPanoProject,
  type LoadedProjectScene,
} from "@ericchen1990/pano-view/data";
import { SceneSources, projectRoot } from "./sources";
import { LocalFiles, LOCAL_ROOT } from "./local-files";
import { HotspotLayer } from "./hotspot-layer";
import type { PanoEditorProps } from "./types";
import type { Translate } from "./i18n";
import { errorMessage } from "./errors";

class ViewerBoundary extends Component<
  { children: ReactNode },
  { error?: string }
> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error: errorMessage(error) };
  }
  render() {
    return this.state.error ? (
      <p role="alert" className="pne-empty">
        {this.state.error}
      </p>
    ) : (
      this.props.children
    );
  }
}

export function EditorViewer({
  project,
  local,
  directories,
  options,
  activeId,
  selectedId,
  preview,
  draft,
  draftKind,
  placing,
  viewerRef,
  onActive,
  onSelect,
  onUpdate,
  onBegin,
  onEnd,
  onPlace,
  onError,
  t,
}: {
  project: PanoProjectDefinition;
  local?: LocalFiles;
  directories: readonly LocalFiles[];
  options: PanoEditorProps;
  activeId?: string;
  selectedId?: string;
  preview: boolean;
  draft: HotspotPosition[];
  draftKind?: "polygon" | "polyline";
  placing: boolean;
  viewerRef: RefObject<PanoViewerHandle | null>;
  onActive: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdate: (
    id: string,
    patch: { position?: HotspotPosition; vertices?: HotspotPosition[] },
  ) => void;
  onBegin: () => void;
  onEnd: () => void;
  onPlace: (position: HotspotPosition) => void;
  onError: (message: string) => void;
  t: Translate;
}) {
  const loader = useMemo(
    () =>
      new SceneSources(
        {
          baseUrl: options.baseUrl,
          requestInit: options.requestInit,
          resolveAssetUrl: options.resolveAssetUrl,
        },
        local,
        directories,
      ),
    [local, directories, options.baseUrl, options.requestInit, options.resolveAssetUrl],
  );
  const sourceKey = JSON.stringify(
    project.scenes
      .map(({ id, source }) => ({ id, source }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
  const [sources, setSources] = useState<
    Map<string, LoadedProjectScene["scene"]>
  >(new Map());
  const [errors, setErrors] = useState<string[]>([]);
  const [localIssues, setLocalIssues] = useState<string[]>([]);
  useEffect(() => {
    const files = [...(local ? [local] : []), ...directories];
    const update = () => setLocalIssues(files.flatMap((entry) => [...entry.issues]));
    update();
    const unsubscribe = files.map((entry) => entry.subscribe(update));
    return () => unsubscribe.forEach((stop) => stop());
  }, [local, directories]);
  const priorSources = useRef({ loader, keys: new Map<string, string>() });
  useEffect(() => {
    const controller = new AbortController();
    const definitions: PanoProjectDefinition["scenes"] = JSON.parse(sourceKey);
    const previous = priorSources.current;
    const keys = new Map(
      definitions.map(({ id, source }) => [id, JSON.stringify(source)]),
    );
    setSources(
      (current) =>
        new Map(
          [...current].filter(
            ([id]) =>
              previous.loader === loader &&
              keys.get(id) === previous.keys.get(id),
          ),
        ),
    );
    priorSources.current = { loader, keys };
    setErrors([]);
    void Promise.all(
      definitions.map(async ({ id, source }) => {
        try {
          const scene = await loader.load(id, source, controller.signal);
          if (!controller.signal.aborted)
            setSources((current) => new Map(current).set(id, scene));
        } catch (error) {
          if (!controller.signal.aborted)
            setErrors((current) => [
              ...current,
              `${id}: ${errorMessage(error)}`,
            ]);
        }
      }),
    );
    return () => controller.abort();
  }, [loader, sourceKey]);

  const runtime = useMemo(() => {
    const issues: string[] = [];
    const scenes: LoadedProjectScene[] = [];
    for (const definition of project.scenes) {
      const scene = sources.get(definition.id);
      if (!scene) continue;
      const hotspots: LoadedProjectScene["hotspots"] = [];
      const assetFiles = (path: string) =>
        directories.find((files) => files.containsPath(path)) ?? local;
      for (const hotspot of definition.hotspots ?? []) {
        try {
          const resolved = resolveProjectHotspotAssets(
            hotspot,
            local ? LOCAL_ROOT : projectRoot(options.baseUrl),
            definition.id,
            (path, context) => {
              const files = assetFiles(path);
              return files
                ? files.resolve(path, {
                    ...context,
                    defaultUrl: new URL(path, LOCAL_ROOT).href,
                  })
                : (options.resolveAssetUrl?.(path, context) ?? context.defaultUrl);
            },
          );
          // Local sessions only preview documents. Keep authored permissions in
          // the saved definition, but never execute local HTML scripts or forms.
          if (
            resolved.type === "iframe" &&
            hotspot.type === "iframe" &&
            assetFiles(hotspot.src)
          )
            resolved.sandbox = "";
          if (
            resolved.type === "audio" &&
            hotspot.type === "audio" &&
            !resolved.format &&
            (Array.isArray(hotspot.src) ? hotspot.src : [hotspot.src])
              .every((src) => assetFiles(src))
          ) {
            resolved.format = (
              Array.isArray(hotspot.src) ? hotspot.src : [hotspot.src]
            ).map((src) => {
              const file = assetFiles(src)!.file(src);
              const extension = file.name.split(".").pop()?.toLowerCase();
              const mime = file.type.split("/")[1]?.split(";")[0];
              return extension &&
                [
                  "mp3",
                  "ogg",
                  "oga",
                  "opus",
                  "wav",
                  "aac",
                  "caf",
                  "m4a",
                  "m4b",
                  "mp4",
                  "webm",
                  "weba",
                  "flac",
                ].includes(extension)
                ? extension
                : mime === "mpeg"
                  ? "mp3"
                  : (mime ?? "mp3");
            });
          }
          hotspots.push(resolved);
        } catch (error) {
          issues.push(`${definition.id}/${hotspot.id}: ${errorMessage(error)}`);
        }
      }
      scenes.push({
        scene,
        title: definition.title,
        initialView: definition.initialView
          ? { yaw: 0, pitch: 0, fov: 75, ...definition.initialView }
          : undefined,
        hotspots,
      });
    }
    const loaded: LoadedPanoProject = {
      title: project.title,
      initialSceneId: project.initialSceneId ?? scenes[0]?.scene.id ?? "",
      scenes,
    };
    return { loaded, issues };
  }, [project, sources, local, directories, options.baseUrl, options.resolveAssetUrl]);
  const scenes = useMemo(
    () => runtime.loaded.scenes.map((entry) => entry.scene),
    [sources, sourceKey],
  );
  const active = runtime.loaded.scenes.find(
    (entry) => entry.scene.id === activeId,
  );
  const ready = (id: string) => {
    const initialView = project.scenes.find(
      (scene) => scene.id === id,
    )?.initialView;
    if (initialView)
      viewerRef.current?.setView(initialView, { immediate: true });
  };
  return (
    <div className="pne-viewer-area">
      {errors.length || runtime.issues.length || localIssues.length ? (
        <div className="pne-resource-errors" role="alert">
          {[...new Set([...errors, ...runtime.issues, ...localIssues])].map(
            (message) => (
              <div key={message}>{message}</div>
            ),
          )}
        </div>
      ) : null}
      {!active ? (
        <p className="pne-empty" role="status">
          {t(
            errors.some((message) => message.startsWith(`${activeId}:`))
              ? "Could not load this scene"
              : project.scenes.length
                ? "Loading scene…"
                : "Select a scene to begin",
          )}
        </p>
      ) : (
        <ViewerBoundary key={`${activeId}:${sourceKey}`}>
          <PanoViewer
            ref={viewerRef}
            className="pne-viewer"
            aria-label={t("Panorama editor")}
            controls={
              placing || Boolean(draftKind)
                ? false
                : { keyboard: { enabled: false } }
            }
            onPanoramaClick={({ position }) => {
              if (!preview) onPlace(position);
            }}
          >
            {preview ? (
              <ProjectScenes
                project={runtime.loaded}
                activeSceneId={activeId}
                onActiveSceneIdChange={onActive}
                transition="none"
                onHotspotError={({ hotspot, error }) =>
                  onError(`${hotspot.id}: ${String(error)}`)
                }
              />
            ) : (
              <Scenes
                scenes={scenes}
                activeSceneId={activeId}
                transition="none"
                onSceneReady={ready}
                onTransitionError={({ error }) => onError(String(error))}
                renderHotspots={() => (
                  <HotspotLayer
                    hotspots={active.hotspots}
                    selectedId={selectedId}
                    drawing={placing || Boolean(draftKind)}
                    draft={draft}
                    draftKind={draftKind}
                    onSelect={onSelect}
                    onUpdate={onUpdate}
                    onBegin={onBegin}
                    onEnd={onEnd}
                    onError={onError}
                  />
                )}
              />
            )}
          </PanoViewer>
        </ViewerBoundary>
      )}
    </div>
  );
}
