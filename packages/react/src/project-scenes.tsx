import { hotspotAction } from "./data";
import type { ProjectHotspotTrigger, ProjectCustomHotspotAction } from "./data";
import {
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type HTMLAttributeReferrerPolicy,
} from "react";
import { Scenes, type ScenesProps } from "./scenes";
import { PanoramaViewContext } from "./panorama-view-runtime";
import type { LoadedPanoProject, ProjectHotspotDefinition, ProjectHotspotAction, ProjectPopupDefinition } from "./data";
import type { HotspotInteractionEvent } from "./hotspot/types";
import { ImageHotspot } from "./hotspot/image-hotspot";
import { GraphicHotspot } from "./hotspot/graphic-hotspot";
import { SequenceHotspot } from "./hotspot/sequence-hotspot";
import { VideoHotspot } from "./hotspot/video-hotspot";
import { AudioHotspot } from "./hotspot/audio-hotspot";
import { TextHotspot } from "./hotspot/text-hotspot";
import { IframeHotspot } from "./hotspot/iframe-hotspot";
import { PolygonHotspot } from "./hotspot/polygon-hotspot";
import { PolylineHotspot } from "./hotspot/polyline-hotspot";

export type ProjectHotspotClickEvent = {
  sceneId: string;
  hotspot: ProjectHotspotDefinition;
  interaction: HotspotInteractionEvent;
  defaultPrevented: boolean;
  preventDefault: () => void;
};
export type ProjectHotspotEvent = ProjectHotspotClickEvent & { trigger: ProjectHotspotTrigger };
export type ProjectCustomActionEvent = ProjectHotspotEvent & { action: ProjectCustomHotspotAction };
export type ProjectPopupRequestEvent = {
  sceneId: string;
  hotspot: ProjectHotspotDefinition;
  popup: ProjectPopupDefinition;
};
export type ProjectHotspotErrorEvent = {
  sceneId: string;
  hotspot: ProjectHotspotDefinition;
  error: unknown;
  trigger?: ProjectHotspotTrigger;
};
export type ProjectHotspotRenderContext = {
  sceneId: string;
  playing: boolean;
  onClick: (event: HotspotInteractionEvent) => void;
  onHoverChange: (hovered: boolean, event: HotspotInteractionEvent) => void;
  togglePlayback: () => void;
  reportError: (error: unknown) => void;
  renderDefault: () => ReactNode;
};
export type ProjectScenesProps = Omit<
  ScenesProps,
  "scenes" | "defaultActiveSceneId" | "renderHotspots"
> & {
  project: LoadedPanoProject;
  onHotspotEvent?: (event: ProjectHotspotEvent) => void;
  onCustomAction?: (event: ProjectCustomActionEvent) => void | Promise<void>;
  onHotspotClick?: (event: ProjectHotspotClickEvent) => void;
  onPopupRequest?: (event: ProjectPopupRequestEvent) => void;
  onHotspotError?: (event: ProjectHotspotErrorEvent) => void;
  /** Return undefined for the default renderer, or null to hide this hotspot. */
  renderHotspot?: (
    hotspot: ProjectHotspotDefinition,
    context: ProjectHotspotRenderContext
  ) => ReactNode;
};

function isMedia(hotspot: ProjectHotspotDefinition): boolean {
  return (
    hotspot.type === "audio" ||
    hotspot.type === "video" ||
    hotspot.type === "sequence"
  );
}

export function handleProjectHotspotClick(
  hotspot: ProjectHotspotDefinition,
  sceneId: string,
  interaction: HotspotInteractionEvent,
  callback: ProjectScenesProps["onHotspotClick"],
  navigate: (id: string) => void,
  toggle: () => void,
  execute?: (action: Exclude<ProjectHotspotAction, { type: "scene" }>, event: ProjectHotspotEvent) => void | Promise<void>,
  trigger: ProjectHotspotTrigger = "click",
  onEvent?: ProjectScenesProps["onHotspotEvent"],
): void | Promise<void> {
  // Keyboard accessibility already prevents the browser's Enter/Space default.
  const nativeWasPrevented = interaction.nativeEvent.defaultPrevented;
  const event: ProjectHotspotEvent = {
    trigger,
    sceneId,
    hotspot,
    interaction,
    defaultPrevented: false,
    preventDefault: () => {
      event.defaultPrevented = true;
    },
  };
  onEvent?.(event);
  if (trigger === "click") callback?.(event);
  if (
    event.defaultPrevented ||
    (!nativeWasPrevented && interaction.nativeEvent.defaultPrevented)
  )
    return;
  const action = hotspotAction(hotspot, trigger);
  if (action?.type === "scene") navigate(action.sceneId);
  else if (action) {
    if (!execute) throw new Error("No handler for hotspot action");
    return execute(action, event);
  } else if (trigger === "click" && isMedia(hotspot)) toggle();
}

function hotspotProps<T extends ProjectHotspotDefinition>({
  type: _type,
  action: _action,
  events: _events,
  label: _label,
  ...props
}: T) {
  return props;
}

/** Shares one mapping for the default renderer and custom renderDefault calls. */
export function ProjectHotspotSource({
  hotspot,
  playing,
  onClick,
  onHoverChange,
  onEnded,
  onError,
}: {
  hotspot: ProjectHotspotDefinition;
  playing: boolean;
  onClick: (event: HotspotInteractionEvent) => void;
  onHoverChange?: (hovered: boolean, event: HotspotInteractionEvent) => void;
  onEnded: () => void;
  onError: (error: unknown) => void;
}) {
  const common = { ariaLabel: hotspot.label || hotspot.id, onClick, onHoverChange };
  // Narrow each variant before passing serializable data to its existing component.
  switch (hotspot.type) {
    case "image":
      return (
        <ImageHotspot
          {...hotspotProps(hotspot)}
          {...common}
          onError={onError}
        />
      );
    case "graphic":
      return (
        <GraphicHotspot
          {...hotspotProps(hotspot)}
          {...common}
          onError={onError}
        />
      );
    case "text":
      return (
        <TextHotspot {...hotspotProps(hotspot)} {...common} onError={onError} />
      );
    case "iframe":
      return (
        <IframeHotspot
          {...hotspotProps(hotspot)}
          {...common}
          referrerPolicy={
            hotspot.referrerPolicy as HTMLAttributeReferrerPolicy | undefined
          }
          onError={onError}
        />
      );
    case "polygon":
      return <PolygonHotspot {...hotspotProps(hotspot)} {...common} />;
    case "polyline":
      return <PolylineHotspot {...hotspotProps(hotspot)} {...common} />;
    case "sequence":
      return (
        <SequenceHotspot
          {...hotspotProps(hotspot)}
          {...common}
          playing={playing}
          onEnded={onEnded}
          onError={onError}
        />
      );
    case "video":
      return (
        <VideoHotspot
          {...hotspotProps(hotspot)}
          {...common}
          playing={playing}
          onEnded={onEnded}
          onError={onError}
          onPlaybackError={onError}
        />
      );
    case "audio":
      return (
        <AudioHotspot
          {...hotspotProps(hotspot)}
          {...common}
          playing={playing}
          onEnded={onEnded}
          onError={onError}
          onPlaybackError={onError}
        />
      );
  }
}

function ProjectHotspot({
  hotspot,
  sceneId,
  navigate,
  onHotspotClick,
  onHotspotEvent,
  onHotspotError,
  renderHotspot,
  execute,
}: {
  hotspot: ProjectHotspotDefinition;
  sceneId: string;
  navigate: (id: string) => void;
  execute: (action: Exclude<ProjectHotspotAction, { type: "scene" }>, event: ProjectHotspotEvent) => void | Promise<void>;
} & Pick<
  ProjectScenesProps,
  "onHotspotClick" | "onHotspotEvent" | "onHotspotError" | "renderHotspot"
>) {
  const [playing, setPlaying] = useState(
    "playing" in hotspot ? hotspot.playing ?? false : false
  );
  const togglePlayback = () => setPlaying((value) => !value);
  const reportError = (error: unknown) => {
    if (isMedia(hotspot)) setPlaying(false);
    onHotspotError?.({ sceneId, hotspot, error });
  };
  const dispatch = (trigger: ProjectHotspotTrigger, interaction: HotspotInteractionEvent) => {
    if (hotspot.visible === false || hotspot.interactive === false || (interaction.source === "pointer" && hotspot.pointerEvents === "none")) return;
    if (trigger !== "click" && (interaction.source !== "pointer" || ("pointerType" in interaction.nativeEvent && interaction.nativeEvent.pointerType === "touch"))) return;
    const failed = (error: unknown) => onHotspotError?.({ sceneId, hotspot, error, trigger });
    try {
      const result = handleProjectHotspotClick(hotspot, sceneId, interaction, onHotspotClick, navigate, togglePlayback, execute, trigger, onHotspotEvent);
      if (result) void Promise.resolve(result).catch(failed);
    } catch (error) { failed(error); }
  };
  const onClick = (event: HotspotInteractionEvent) => dispatch("click", event);
  const onHoverChange = (hovered: boolean, event: HotspotInteractionEvent) => dispatch(hovered ? "pointerenter" : "pointerleave", event);
  const renderDefault = () => (
    <ProjectHotspotSource
      hotspot={hotspot}
      playing={playing}
      onClick={onClick}
      onHoverChange={onHoverChange}
      onEnded={() => setPlaying(false)}
      onError={reportError}
    />
  );
  const rendered = renderHotspot?.(hotspot, {
    sceneId,
    playing,
    onClick,
    onHoverChange,
    togglePlayback,
    reportError,
    renderDefault,
  });
  return rendered === undefined ? renderDefault() : rendered;
}

export function ProjectScenes({
  project,
  activeSceneId,
  onActiveSceneIdChange,
  onSceneReady,
  onHotspotClick,
  onHotspotEvent,
  onHotspotError,
  onPopupRequest,
  onCustomAction,
  renderHotspot,
  ...options
}: ProjectScenesProps) {
  const controls = useContext(PanoramaViewContext);
  if (!controls)
    throw new Error("<ProjectScenes> must be rendered inside <PanoViewer>.");
  const [selection, setSelection] = useState({
    project,
    id: project.initialSceneId,
  });
  // Reset uncontrolled selection when a different loaded project is supplied.
  if (selection.project !== project)
    setSelection({ project, id: project.initialSceneId });
  const currentId =
    activeSceneId ??
    (selection.project === project ? selection.id : project.initialSceneId);
  const entries = useMemo(
    () => new Map(project.scenes.map((entry) => [entry.scene.id, entry])),
    [project]
  );
  const scenes = useMemo(
    () => project.scenes.map((entry) => entry.scene),
    [project]
  );
  const navigate = (id: string) => {
    if (!entries.has(id)) return;
    if (activeSceneId === undefined) setSelection({ project, id });
    onActiveSceneIdChange?.(id);
  };
  return (
    <Scenes
      {...options}
      scenes={scenes}
      activeSceneId={currentId}
      onActiveSceneIdChange={navigate}
      onSceneReady={(id) => {
        const view = entries.get(id)?.initialView;
        if (view) controls.current?.setView(view, { immediate: true });
        onSceneReady?.(id);
      }}
      renderHotspots={(scene) =>
        entries
          .get(scene.id)
          ?.hotspots.map((hotspot) => (
            <ProjectHotspot
              key={`${scene.id}:${hotspot.id}`}
              hotspot={hotspot}
              sceneId={scene.id}
              navigate={navigate}
              execute={(action, event) => {
                if (action.type === "view") {
                  return controls.current?.lookTo(action.view, { fov: action.view.fov, duration: action.duration }).then(() => {});
                } else if (action.type === "custom") {
                  if (!onCustomAction) throw new Error("Custom action requires an onCustomAction handler");
                  return onCustomAction({ ...event, action });
                } else {
                  const popup = project.popups?.find((entry) => entry.id === action.popupId);
                  if (!popup) throw new Error(`Popup does not exist: ${action.popupId}`);
                  if (!onPopupRequest) throw new Error("Popup action requires an onPopupRequest handler");
                  onPopupRequest({ sceneId: scene.id, hotspot, popup });
                }
              }}
              onHotspotEvent={onHotspotEvent}
              onHotspotClick={onHotspotClick}
              onHotspotError={onHotspotError}
              renderHotspot={renderHotspot}
            />
          ))
      }
    />
  );
}
