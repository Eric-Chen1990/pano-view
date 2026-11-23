import { resolveEditorHotspotAsset } from "./hotspot-asset-url";
import { customActionIssue } from "./custom-actions";
import { hotspotAction, type ProjectHotspotTrigger } from "@ericchen1990/pano-view/data";
import { ProjectPopupDialog } from "@ericchen1990/pano-view/ui";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  PanoViewer,
  PanoEvents,
  getHotspotCornerCenter,
  PanoMapOverlay,
  PanoGeoMapOverlay,
  type PanoGeoMapEdit,
  type PanoGeoMapSource,
  PanoOverlay,
  Scenes,
  ProjectScenes,
  type PanoViewerHandle,
  type PanoViewerState,
  type HotspotPosition,
  type ProjectHotspotDefinition,
  type ProjectHotspotRenderContext,
  type PanoMapDefinition,
  type PanoMapSpotDefinition,
} from "@ericchen1990/pano-view";
import {
  resolveProjectHotspotAssets,
  resolveProjectPopupAssets,
  resolvePanoMapAssets,
  resolvePanoGeoMapAssets,
  toSourcePanoPosition,
  type PanoProjectDefinition,
  type LoadedPanoProject,
  type LoadedProjectScene,
} from "@ericchen1990/pano-view/data";
import { SceneSources, projectRoot } from "./sources";
import { LocalFiles, LOCAL_ROOT } from "./local-files";
import { audioExtension } from "./local-media";
import { sceneStartingView, type HotspotGeometryPatch } from "./document";
import { HotspotLayer } from "./hotspot-layer";
import type { PanoEditorProps } from "./types";
import type { Translate } from "./i18n";
import { errorMessage } from "./errors";

class ViewerBoundary extends Component<
  { children: ReactNode; sceneId?: string },
  { error?: string }
> {
  state: { error?: string } = {};
  static getDerivedStateFromError(error: unknown) {
    return { error: errorMessage(error) };
  }
  componentDidUpdate(previous: Readonly<{ sceneId?: string }>) {
    if (this.state.error && previous.sceneId !== this.props.sceneId) {
      this.setState({ error: undefined });
    }
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

export type HotspotTestRequest = {
  sceneId: string;
  hotspotId: string;
  trigger?: ProjectHotspotTrigger;
  fromView: PanoViewerState;
  token: number;
};
function PreviewHotspot({ context, hotspot, test }: {
  context: ProjectHotspotRenderContext;
  hotspot: ProjectHotspotDefinition;
  test: (hotspot: ProjectHotspotDefinition, context: ProjectHotspotRenderContext, portalReady: boolean) => void;
}) {
  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => test(hotspot, context, portalReady), [test, hotspot, context, portalReady]);
  return context.renderDefault({ onPortalPreviewReady: () => setPortalReady(true) });
}

function ArrivalViewPreview({ scene, view, t }: {
  scene: LoadedProjectScene["scene"];
  view: PanoViewerState;
  t: Translate;
}) {
  const viewer = useRef<PanoViewerHandle>(null);
  const scenes = useMemo(() => [scene], [scene]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (loaded) viewer.current?.setView(view, { immediate: true });
  }, [loaded, view]);
  return failed ? <p className="pne-empty" role="status">{t("Could not load this scene")}</p> : (
    <>
      <PanoViewer ref={viewer} controls={false} initialView={view} aria-label={t("Arrival view preview")}>
        <Scenes scenes={scenes} activeSceneId={scene.id} transition="none" previewOnly
          onSceneReady={() => {
            viewer.current?.setView(view, { immediate: true });
            setLoaded(true);
          }}
          onTransitionError={() => setFailed(true)} />
      </PanoViewer>
      {!loaded ? <p className="pne-arrival-loading" role="status">{t("Loading scene…")}</p> : null}
    </>
  );
}

export function EditorViewer({
  project,
  local,
  directories,
  media,
  options,
  activeId,
  selectedId,
  preview,
  showHorizon,
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
  onReady,
  testRequest,
  arrivalPreviewSlot,
  onTestConsumed,
  mapEditing = false,
  geoEditing,
  geoSpotId,
  geoPlacement,
  onGeoSelect,
  onGeoEdit,
  onGeoSourceChange,
  geoMapEmptyLabel,
  selectedMapSpotId,
  placementSceneId,
  onSelectedMapSpotIdChange,
  onMapSpotsChange,
  t,
}: {
  project: PanoProjectDefinition;
  local?: LocalFiles;
  directories: readonly LocalFiles[];
  media: readonly LocalFiles[];
  options: PanoEditorProps;
  activeId?: string;
  selectedId?: string;
  preview: boolean;
  showHorizon: boolean;
  draft: HotspotPosition[];
  draftKind?: "polygon" | "polyline";
  placing: boolean;
  viewerRef: RefObject<PanoViewerHandle | null>;
  onActive: (id: string) => void;
  onSelect: (id: string) => void;
  onUpdate: (
    id: string,
    patch: HotspotGeometryPatch,
  ) => void;
  onBegin: () => void;
  onEnd: () => void;
  onPlace: (position: HotspotPosition) => void;
  onError: (message: string) => void;
  onReady?: (id: string) => void;
  testRequest?: HotspotTestRequest;
  arrivalPreviewSlot?: HTMLDivElement | null;
  onTestConsumed?: () => void;
  mapEditing?: boolean;
  geoEditing?: boolean;
  geoSpotId?: string;
  geoPlacement?: { sceneId: string } | { spotId: string };
  onGeoSelect?: (spotId: string) => void;
  onGeoEdit?: (edit: PanoGeoMapEdit) => void;
  onGeoSourceChange?: (source: PanoGeoMapSource | undefined) => void;
  /** Translation key shown on the map when the editing basemap has no credentials yet. */
  geoMapEmptyLabel?: string;
  selectedMapSpotId?: string;
  placementSceneId?: string;
  onSelectedMapSpotIdChange?: (id: string | null) => void;
  onMapSpotsChange?: (spots: PanoMapSpotDefinition[], selectedSpotId?: string | null) => void;
  t: Translate;
}) {
  const [popupSelection, setPopupSelection] = useState<{ id?: string; sceneId?: string; preview: boolean }>({ sceneId: activeId, preview });
  if (popupSelection.sceneId !== activeId || popupSelection.preview !== preview)
    setPopupSelection({ sceneId: activeId, preview });
  const [readyScene, setReadyScene] = useState<{ id: string; preview: boolean }>();
  const readyId = readyScene?.id;
  const [viewportHeight, setViewportHeight] = useState(768);
  const horizonGuide = useRef<HTMLDivElement | null>(null);
  function projectHorizon(view: PanoViewerState) {
    const guide = horizonGuide.current;
    if (!guide) return;
    guide.hidden = Math.abs(view.pitch) >= view.fov / 2;
    if (!guide.hidden) {
      const pitch = view.pitch * Math.PI / 180;
      const halfFov = view.fov * Math.PI / 360;
      guide.style.top = `${50 * (1 + Math.tan(pitch) / Math.tan(halfFov))}%`;
    }
  }
  const tested = useRef<number | undefined>(undefined);
  const portalAimStarted = useRef<number | undefined>(undefined);
  const [aimedPortal, setAimedPortal] = useState<number>();
  const pendingTest = useRef(testRequest);
  pendingTest.current = testRequest;
  const reportTestError = useRef(onError);
  reportTestError.current = onError;
  useEffect(() => {
    if (!testRequest || aimedPortal !== testRequest.token) return;
    const timer = window.setTimeout(() => reportTestError.current(t("The portal preview did not load in time.")), 12_000);
    return () => window.clearTimeout(timer);
  }, [aimedPortal, testRequest, t]);
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
  useEffect(() => {
    if (!testRequest) return;
    const failure = errors.find((message) => message.startsWith(`${testRequest.sceneId}:`));
    if (failure) { onTestConsumed?.(); onError(failure); }
  }, [errors, testRequest, onTestConsumed, onError]);
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
    const assetFiles = (path: string) =>
      media.find((files) => files.containsPath(path))
      ?? directories.find((files) => files.containsPath(path)) ?? local;
    for (const definition of project.scenes) {
      const scene = sources.get(definition.id);
      if (!scene) continue;
      const hotspots: LoadedProjectScene["hotspots"] = [];
      for (const hotspot of definition.hotspots ?? []) {
        try {
          const resolved = resolveProjectHotspotAssets(
            hotspot,
            local ? LOCAL_ROOT : projectRoot(options.baseUrl),
            definition.id,
            (path, context) => resolveEditorHotspotAsset(path, context, assetFiles(path), options.resolveAssetUrl),
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
                : (audioExtension(file.type) ?? mime ?? "mp3");
            });
          }
          hotspots.push(resolved);
        } catch (error) {
          issues.push(`${definition.id}/${hotspot.id}: ${errorMessage(error)}`);
        }
      }
      scenes.push({
        scene: {
          ...scene,
          ...(definition.viewLimits === undefined ? {} : { viewLimits: definition.viewLimits }),
          northYaw: definition.northYaw,
          levelCorrection: definition.levelCorrection,
        },
        title: definition.title,
        initialView: sceneStartingView(definition),
        hotspots,
      });
    }
    const popups: NonNullable<LoadedPanoProject["popups"]> = [];
    for (const popup of project.popups ?? []) {
      try {
        popups.push(resolveProjectPopupAssets(popup, local ? LOCAL_ROOT : projectRoot(options.baseUrl), (path, context) => {
          const files = assetFiles(path);
          return files ? files.resolveFrom(path, { ...context, defaultUrl: new URL(path, LOCAL_ROOT).href }, LOCAL_ROOT)
            : (options.resolvePopupAssetUrl?.(path, context) ?? context.defaultUrl);
        }));
      } catch (error) { issues.push(`${popup.title || popup.id}: ${errorMessage(error)}`); }
    }
    let map: PanoMapDefinition | undefined;
    if (project.map?.image) {
      try {
        map = resolvePanoMapAssets(
          project.map,
          local ? LOCAL_ROOT : projectRoot(options.baseUrl),
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
      } catch (error) {
        issues.push(`map: ${errorMessage(error)}`);
      }
    }
    let geoMap: LoadedPanoProject["geoMap"];
    if (project.geoMap) {
      try {
        geoMap = resolvePanoGeoMapAssets(project.geoMap, local ? LOCAL_ROOT : projectRoot(options.baseUrl), (path, context) => {
          const files = assetFiles(path);
          return files ? files.resolve(path, { ...context, defaultUrl: new URL(path, LOCAL_ROOT).href })
            : (options.resolveAssetUrl?.(path, context) ?? context.defaultUrl);
        });
      } catch (error) {
        issues.push(`geoMap: ${errorMessage(error)}`);
        geoMap = { ...project.geoMap, spots: project.geoMap.spots.map((spot) => ({ ...spot, icon: undefined })) };
      }
    }
    const loaded: LoadedPanoProject = {
      title: project.title,
      initialSceneId: project.initialSceneId ?? scenes[0]?.scene.id ?? "",
      scenes,
      ...(project.popups === undefined ? {} : { popups }),
      ...(map === undefined ? {} : { map }),
      ...(geoMap === undefined ? {} : { geoMap }),
    };
    return { loaded, issues };
  }, [project, sources, local, directories, media, options.baseUrl, options.resolveAssetUrl, options.resolvePopupAssetUrl]);
  const sceneTitles = useMemo(() => Object.fromEntries(
    project.scenes.map((scene) => [scene.id, scene.title ?? scene.id]),
  ), [project.scenes]);
  const scenes = useMemo(
    () => runtime.loaded.scenes.map(({ scene, initialView }) => ({ ...scene, initialView })),
    [runtime.loaded.scenes],
  );
  const active = runtime.loaded.scenes.find(
    (entry) => entry.scene.id === activeId,
  );
  const selected = active?.hotspots.find((hotspot) => hotspot.id === selectedId);
  const arrivalView = selected?.type === "portal" ? selected.arrivalView : undefined;
  const arrivalAction = arrivalView && selected ? hotspotAction(selected, "click") : undefined;
  const arrivalSceneId = arrivalAction?.type === "scene" ? arrivalAction.sceneId : undefined;
  const arrivalScene = runtime.loaded.scenes.find(({ scene }) => scene.id === arrivalSceneId)?.scene;
  const viewerSceneId = active?.scene.id ??
    (activeId && scenes.some((scene) => scene.id === readyId) ? readyId : undefined);
  const canEditScene = activeId !== undefined && readyId === activeId;
  const ready = (id: string) => {
    setReadyScene({ id, preview });
    const initialView = runtime.loaded.scenes.find(({ scene }) => scene.id === id)?.initialView;
    const startTest = preview && testRequest?.sceneId === id && (testRequest.trigger ?? "click") === "click" &&
      active?.hotspots.some((hotspot) => hotspot.id === testRequest.hotspotId && hotspot.type === "portal");
    // ProjectScenes applies the starting view or a portal's arrival view in Preview.
    if (startTest) {
      viewerRef.current?.setView(testRequest.fromView, { immediate: true });
    } else if (!preview) {
      viewerRef.current?.setView(initialView ?? { yaw: 0, pitch: 0, fov: 75 }, { immediate: true });
    }
    onReady?.(id);
  };
  return (
    <div className="pne-viewer-area">
      {!preview && arrivalPreviewSlot && arrivalView && arrivalSceneId ? createPortal(
        arrivalScene ? <ViewerBoundary key={sourceKey} sceneId={arrivalSceneId}>
          <ArrivalViewPreview key={arrivalSceneId} scene={arrivalScene} view={arrivalView} t={t} />
        </ViewerBoundary> : <p className="pne-empty" role="status">
          {t(errors.some((message) => message.startsWith(`${arrivalSceneId}:`)) ? "Could not load this scene" : "Loading scene…")}
        </p>,
        arrivalPreviewSlot,
      ) : null}
      {errors.length || runtime.issues.length || localIssues.length ? (
        <div className="pne-resource-errors" role="alert">
          {[...new Set([...errors, ...runtime.issues, ...localIssues])].map(
            (message) => (
              <div key={message}>{message}</div>
            ),
          )}
        </div>
      ) : null}
      {!viewerSceneId ? (
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
        <ViewerBoundary key={sourceKey} sceneId={activeId}>
          <PanoViewer
            ref={viewerRef}
            className="pne-viewer"
            aria-label={t("Tour editor")}
            controls={
              placing || Boolean(draftKind)
                ? false
                : { keyboard: { enabled: false } }
            }
            onViewChange={showHorizon ? projectHorizon : undefined}
            onPanoramaClick={({ position }) => {
              if (!preview && canEditScene) onPlace(toSourcePanoPosition(position, active?.scene.levelCorrection));
            }}
          >
            {!preview ? (
              <PanoEvents onResize={({ height }) => {
                if (height > 0) setViewportHeight(height);
              }} />
            ) : null}
            {preview ? (
              <ProjectScenes
                project={runtime.loaded}
                activeSceneId={viewerSceneId}
                onActiveSceneIdChange={onActive}
                transition="none"
                onSceneReady={ready}
                onTransitionError={({ error }) => onError(errorMessage(error))}
                onCustomAction={event => {
                  const issue = customActionIssue(event.action, options.customActions);
                  if (issue) throw new Error(issue);
                  if (!options.customActions?.some(item => item.id === event.action.actionId)) throw new Error(t("Action is not registered in this environment"));
                  if (!options.onPreviewCustomAction) throw new Error(t("No custom action preview handler"));
                  return options.onPreviewCustomAction(event);
                }}
                onPopupRequest={({ popup, sceneId }) => setPopupSelection({ id: popup.id, sceneId, preview: true })}
                renderHotspot={(hotspot, context) => <PreviewHotspot hotspot={hotspot} context={context} test={(item, runtimeContext, portalReady) => {
                  if (!testRequest || testRequest.sceneId !== activeId || readyId !== activeId || !readyScene?.preview ||
                      testRequest.hotspotId !== item.id || tested.current === testRequest.token) return;
                  if (item.visible === false || item.interactive === false || item.pointerEvents === "none") {
                    onError(t("Show the hotspot and enable pointer interaction to test a click.")); return;
                  }
                  const trigger = testRequest.trigger ?? "click";
                  if (item.type === "portal" && trigger === "click") {
                    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                    const viewer = viewerRef.current;
                    if (!viewer) return;
                    if (portalAimStarted.current !== testRequest.token) {
                      const request = testRequest;
                      portalAimStarted.current = request.token;
                      void viewer.lookToHotspot(item.id, { duration: reducedMotion ? 0 : 650 }).then(({ status }) => {
                        if (pendingTest.current?.token !== request.token || viewer.getActiveSceneId() !== request.sceneId) return;
                        if (status === "completed") setAimedPortal(request.token);
                        else if (status === "not-found") reportTestError.current(t("Could not aim at this portal."));
                        else onTestConsumed?.();
                      });
                    }
                    if (aimedPortal !== testRequest.token || (!portalReady && !reducedMotion)) return;
                  }
                  tested.current = testRequest.token;
                  onTestConsumed?.();
                  const center = (item.type === "image" || item.type === "video") && item.corners
                    ? getHotspotCornerCenter(item.corners) : null;
                  const interaction = { id: item.id, position: center ?? ("position" in item ? item.position : item.vertices[0]!), source: "pointer", nativeEvent: new MouseEvent("click", { cancelable: true }) } as const;
                  if (trigger === "click") runtimeContext.onClick(interaction);
                  else runtimeContext.onHoverChange(trigger === "pointerenter", interaction);
                }} />}
                onHotspotError={({ hotspot, error }) =>
                  onError(`${hotspot.id}: ${String(error)}`)
                }
              />
            ) : (
              <Scenes
                scenes={scenes}
                activeSceneId={viewerSceneId}
                onActiveSceneIdChange={onActive}
                transition="none"
                onSceneReady={ready}
                onTransitionError={({ error }) => onError(String(error))}
                renderHotspots={(scene) => active?.scene.id === scene.id && canEditScene ? (
                  <HotspotLayer
                    hotspots={active.hotspots}
                    selectedId={selectedId}
                    viewportHeight={viewportHeight}
                    drawing={placing || Boolean(draftKind)}
                    draft={draft}
                    draftKind={draftKind}
                    onSelect={onSelect}
                    onUpdate={onUpdate}
                    onBegin={onBegin}
                    onEnd={onEnd}
                    onError={onError}
                    t={t}
                  />
                ) : null}
              />
            )}
            <PanoOverlay>
              {showHorizon && canEditScene ? <div aria-hidden="true" className="pne-horizon-guide"
                ref={(node) => {
                  horizonGuide.current = node;
                  const view = viewerRef.current?.getView();
                  if (view) projectHorizon(view);
                }} /> : null}
              <ProjectPopupDialog
                popup={preview && popupSelection.sceneId === activeId ? runtime.loaded.popups?.find((popup) => popup.id === popupSelection.id) ?? null : null}
                onOpenChange={(open) => { if (!open) setPopupSelection({ sceneId: activeId, preview }); }} closeLabel={t("Close")}
                onMediaError={(block) => onError(`${block.id}: ${t("Could not load popup media")}`)}
              />
              {runtime.loaded.geoMap && (geoEditing || (!mapEditing || preview)) ? (
                <PanoGeoMapOverlay
                  geoMap={runtime.loaded.geoMap}
                  sources={options.geoMapSources ?? []}
                  activeSceneId={activeId}
                  sceneTitles={sceneTitles}
                  selectedSpotId={geoEditing ? geoSpotId : undefined}
                  placement={geoEditing ? geoPlacement : undefined}
                  onSelectSpot={geoEditing ? onGeoSelect : undefined}
                  onEdit={geoEditing ? onGeoEdit : undefined}
                  onSourceChange={onGeoSourceChange}
                  emptyLabel={geoMapEmptyLabel}
                  onSelectScene={geoEditing ? undefined : onActive}
                  editorSurface={!preview}
                  anchor={!geoEditing && runtime.loaded.map && !runtime.loaded.geoMap.presentation?.anchor ? { align: "top-right" } : undefined}
                  translate={t}
                />
              ) : null}
              {runtime.loaded.map && !geoEditing ? (
                <PanoMapOverlay
                  map={runtime.loaded.map}
                  activeSceneId={activeId}
                  openLabel={t("Map")}
                  closeLabel={t("Close")}
                  title={t("Floor plan")}
                  editorSurface={mapEditing && !preview}
                  mode={mapEditing && !preview ? "edit" : "view"}
                  selectedSpotId={selectedMapSpotId}
                  placementSceneId={mapEditing && !preview ? placementSceneId : undefined}
                  onSelectedSpotIdChange={(id) => {
                    onSelectedMapSpotIdChange?.(id);
                    if (id) {
                      const spot = runtime.loaded.map?.spots.find((entry) => entry.id === id);
                      if (spot) onActive(spot.sceneId);
                    }
                  }}
                  onEditChange={(change) => {
                    if (change.spots) onMapSpotsChange?.(change.spots, change.selectedSpotId);
                  }}
                  onSelectScene={(sceneId) => onActive(sceneId)}
                />
              ) : null}
            </PanoOverlay>
          </PanoViewer>
        </ViewerBoundary>
      )}
    </div>
  );
}
