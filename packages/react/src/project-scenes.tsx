import {
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type HTMLAttributeReferrerPolicy,
} from "react";
import { Scenes, type ScenesProps } from "./scenes";
import { PanoramaViewContext } from "./panorama-view-runtime";
import type { LoadedPanoProject, ProjectHotspotDefinition } from "./data";
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
export type ProjectHotspotErrorEvent = {
  sceneId: string;
  hotspot: ProjectHotspotDefinition;
  error: unknown;
};
export type ProjectHotspotRenderContext = {
  sceneId: string;
  playing: boolean;
  onClick: (event: HotspotInteractionEvent) => void;
  togglePlayback: () => void;
  reportError: (error: unknown) => void;
  renderDefault: () => ReactNode;
};
export type ProjectScenesProps = Omit<
  ScenesProps,
  "scenes" | "defaultActiveSceneId" | "renderHotspots"
> & {
  project: LoadedPanoProject;
  onHotspotClick?: (event: ProjectHotspotClickEvent) => void;
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
  toggle: () => void
): void {
  // Keyboard accessibility already prevents the browser's Enter/Space default.
  const nativeWasPrevented = interaction.nativeEvent.defaultPrevented;
  const event: ProjectHotspotClickEvent = {
    sceneId,
    hotspot,
    interaction,
    defaultPrevented: false,
    preventDefault: () => {
      event.defaultPrevented = true;
    },
  };
  callback?.(event);
  if (
    event.defaultPrevented ||
    (!nativeWasPrevented && interaction.nativeEvent.defaultPrevented)
  )
    return;
  if (hotspot.action) navigate(hotspot.action.sceneId);
  else if (isMedia(hotspot)) toggle();
}

function hotspotProps<T extends ProjectHotspotDefinition>({
  type: _type,
  action: _action,
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
  onEnded,
  onError,
}: {
  hotspot: ProjectHotspotDefinition;
  playing: boolean;
  onClick: (event: HotspotInteractionEvent) => void;
  onEnded: () => void;
  onError: (error: unknown) => void;
}) {
  const common = { ariaLabel: hotspot.label || hotspot.id, onClick };
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
  onHotspotError,
  renderHotspot,
}: {
  hotspot: ProjectHotspotDefinition;
  sceneId: string;
  navigate: (id: string) => void;
} & Pick<
  ProjectScenesProps,
  "onHotspotClick" | "onHotspotError" | "renderHotspot"
>) {
  const [playing, setPlaying] = useState(
    "playing" in hotspot ? hotspot.playing ?? false : false
  );
  const togglePlayback = () => setPlaying((value) => !value);
  const reportError = (error: unknown) => {
    if (isMedia(hotspot)) setPlaying(false);
    onHotspotError?.({ sceneId, hotspot, error });
  };
  const onClick = (interaction: HotspotInteractionEvent) =>
    handleProjectHotspotClick(
      hotspot,
      sceneId,
      interaction,
      onHotspotClick,
      navigate,
      togglePlayback
    );
  const renderDefault = () => (
    <ProjectHotspotSource
      hotspot={hotspot}
      playing={playing}
      onClick={onClick}
      onEnded={() => setPlaying(false)}
      onError={reportError}
    />
  );
  const rendered = renderHotspot?.(hotspot, {
    sceneId,
    playing,
    onClick,
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
  onHotspotError,
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
              onHotspotClick={onHotspotClick}
              onHotspotError={onHotspotError}
              renderHotspot={renderHotspot}
            />
          ))
      }
    />
  );
}
