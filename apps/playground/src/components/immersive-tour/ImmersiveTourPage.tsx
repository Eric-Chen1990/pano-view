import { usePlaygroundLanguage } from "../../i18n/language";
import fullSource from "./ImmersiveTourPage.tsx?raw";
import {
  SceneMovie,
  SceneMovieControls,
} from "../spatial-controls/media-examples";
import spatialControlsCode from "../spatial-controls/media-examples.tsx?raw";
import { type PanoMediaController } from "@ericchen1990/pano-view";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AutoRotate,
  WebVR,
  PanoOverlay,
  PanoViewer,
  ProjectScenes,
  loadPanoProject,
  usePanoOverlay,
  usePanoViewer,
  type LoadedPanoProject,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view";
import { PanoDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/ui/styles.css";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import { ExampleCode } from "../ExampleCode";
import { CodeSnippet } from "../CodeSnippet";
import { ComposedHotspotDialog } from "../overlays/composed-dialog-example";
import composedDialogCode from "../overlays/composed-dialog-example.tsx?raw";
import { POPUPS_BY_SCENE, type PopupSelection } from "./tour-content";
import multiHotspotCode from "./tour-content.tsx?raw";
import { ThirdPartyDialog } from "../overlays/third-party-dialog-example";
import thirdPartyDialogCode from "../overlays/third-party-dialog-example.tsx?raw";
import { cn } from "../../cn";
import {
  controlLabelClassName,
  pageSectionClassName,
  pageHeadingWrapClassName,
  pageHeadingTitleClassName,
  pageHeadingStatusClassName,
  pageControlsClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
  shellClassName,
  viewerChromeButtonClassName,
} from "../../ui";

const projectUrl = "/fixtures/projects/tour/project.json";
const reactCode = `import { useEffect, useState } from "react";
import {
  loadPanoProject, PanoOverlay, PanoViewer, ProjectScenes, WebVR,
  usePanoViewer, type LoadedPanoProject, type ProjectPopupDefinition,
} from "@ericchen1990/pano-view";
import { ProjectPopupDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";

export function ImmersiveTour() {
  const viewer = usePanoViewer();
  const [project, setProject] = useState<LoadedPanoProject>();
  const [popup, setPopup] = useState<ProjectPopupDefinition | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject(${JSON.stringify(projectUrl)}, { requestInit: { signal: controller.signal } })
      .then((loaded) => {
        if (!controller.signal.aborted) setProject(loaded);
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Loading tour…</p>;

  return (
    <>
      <button type="button" onClick={() => void viewer.toggleVR().catch(console.error)}>Toggle VR</button>
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <WebVR />
        <ProjectScenes project={project} onPopupRequest={({ popup }) => setPopup(popup)} />
        <PanoOverlay>
          <ProjectPopupDialog popup={popup} onOpenChange={(open) => { if (!open) setPopup(null); }} />
        </PanoOverlay>
      </PanoViewer>
    </>
  );
}`;

type DialogMode = "default" | "composed" | "custom";

function dialogSnippet(mode: DialogMode): {
  label: string;
  blurb: string;
  code: string;
} {
  switch (mode) {
    case "default":
      return {
        label: "Multiple hotspots → one dialog",
        blurb:
          "Look up content by scene ID and hotspot ID, then update the shared dialog’s title and body. The content registry and shared-dialog wiring below are used by this tour; the complete page integration follows.",
        code: multiHotspotCode,
      };
    case "composed":
      return {
        label: "Compose parts",
        blurb:
          "The header, orange border, and backdrop are assembled from dialog parts. Positioning and the modal lock stay inside those parts. Default dialog shows the shared hotspot-to-content example.",
        code: composedDialogCode,
      };
    case "custom":
      return {
        label: "Third-party dialog",
        blurb:
          "Radix Dialog is portaled into the viewer, positioned from visibleRect, and holds the viewer modal lock while open. Default dialog shows the shared hotspot-to-content example.",
        code: thirdPartyDialogCode,
      };
    default: {
      const exhaustive: never = mode;
      throw new Error(`Unhandled dialog mode: ${String(exhaustive)}`);
    }
  }
}

function NestedTooltip() {
  const { t } = usePlaygroundLanguage();
  const { portalContainer } = usePanoOverlay();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <button
        type="button"
        className={segmentedButtonClassName}
        aria-describedby={visible ? "overlay-tip" : undefined}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onPointerEnter={() => setVisible(true)}
        onPointerLeave={() => setVisible(false)}
      >{t("About this story")}</button>
      {visible && portalContainer
        ? createPortal(
            <div
              id="overlay-tip"
              role="tooltip"
              className="absolute top-16 right-4 max-w-64 border border-cyan-300 bg-slate-900 p-3 text-sm text-white"
            >{t("This tooltip shares the dialog’s fullscreen container.")}</div>,
            portalContainer,
          )
        : null}
    </>
  );
}

function OverlayDialogs({
  mode,
  selected,
  onClose,
}: {
  mode: DialogMode;
  selected: PopupSelection | null;
  onClose: () => void;
}) {
  const { t } = usePlaygroundLanguage();
  const popup = selected
    ? POPUPS_BY_SCENE[selected.sceneId]?.[selected.hotspotId]
    : undefined;
  const open = popup !== undefined;
  const title = popup?.title ?? "Hotspot content";
  const content =
    popup && selected ? (
      <div key={JSON.stringify([selected.sceneId, selected.hotspotId])}>
        {popup.body}
        {popup.kind === "article" ? <NestedTooltip /> : null}
      </div>
    ) : null;
  const onOpenChange = (next: boolean) => {
    if (!next) onClose();
  };
  if (mode === "custom")
    return (
      <ThirdPartyDialog open={open} onOpenChange={onOpenChange} title={title}>
        {content}
      </ThirdPartyDialog>
    );
  if (mode === "composed")
    return (
      <ComposedHotspotDialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
      >
        {content}
      </ComposedHotspotDialog>
    );
  return (
    <PanoDialog closeLabel={t("Close")}
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={t("Explore this hotspot without leaving the panorama.")}
    >
      {content}
    </PanoDialog>
  );
}

function OverlayChrome({
  activeSceneId,
  mode,
  onClose,
  onNextScene,
  onSelect,
  projectReady,
  selected,
  toggleFullscreen,
}: {
  activeSceneId: string;
  mode: DialogMode;
  onClose: () => void;
  onNextScene: () => void;
  onSelect: (selection: PopupSelection) => void;
  projectReady: boolean;
  selected: PopupSelection | null;
  toggleFullscreen: () => void;
}) {
  const { t } = usePlaygroundLanguage();
  const { isFullscreen } = usePanoOverlay();
  return (
    <>
      <div
        className="absolute right-4 bottom-4 left-4 flex flex-wrap justify-center gap-2"
        style={{ pointerEvents: "auto" }}
      >
        {Object.entries(POPUPS_BY_SCENE[activeSceneId] ?? {}).map(
          ([hotspotId, popup]) =>
            popup ? (
              <button
                type="button"
                className={viewerChromeButtonClassName}
                key={hotspotId}
                onClick={() => onSelect({ sceneId: activeSceneId, hotspotId })}
              >{t("Open") + " "}{popup.title}
              </button>
            ) : null,
        )}
        <button
          type="button"
          className={viewerChromeButtonClassName}
          onClick={toggleFullscreen}
        >
          {isFullscreen ? t("Exit fullscreen") : t("Enter fullscreen")}
        </button>
        <button
          type="button"
          className={viewerChromeButtonClassName}
          disabled={!projectReady}
          onClick={onNextScene}
        >{t("Next scene")}</button>
      </div>
      <OverlayDialogs mode={mode} selected={selected} onClose={onClose} />
    </>
  );
}

export function ImmersiveTourPage() {
  const { t } = usePlaygroundLanguage();
  const viewer = usePanoViewer();
  const [movieController, setMovieController] =
    useState<PanoMediaController | null>(null);
  const [mode, setMode] = useState<DialogMode>("default");
  const [selected, setSelected] = useState<PopupSelection | null>(() =>
    new URLSearchParams(window.location.search).has("initialOpen")
      ? { sceneId: "entrance", hotspotId: "story" }
      : null,
  );
  const [activeSceneId, setActiveSceneId] = useState("entrance");
  const [project, setProject] = useState<LoadedPanoProject>();
  const [error, setError] = useState<string>();
  const [autoRotate, setAutoRotate] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject(projectUrl, {
      requestInit: { signal: controller.signal },
    })
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setActiveSceneId(loaded.initialSceneId);
        setProject({
          ...loaded,
          scenes: loaded.scenes.map((entry) => ({
            ...entry,
            hotspots: [
              ...Object.entries(POPUPS_BY_SCENE[entry.scene.id] ?? {}).flatMap(
                ([id, popup], index): ProjectHotspotDefinition[] =>
                  popup
                    ? [
                        {
                          type: "graphic",
                          id,
                          label: popup.title,
                          position: { yaw: (index - 2) * 32, pitch: 0 },
                          width: 7,
                          height: 7,
                          graphic: {
                            kind: "circle",
                            fill: "#df6b42",
                            stroke: "#ffffff",
                            strokeWidth: 3,
                          },
                          tooltip: popup.title,
                        },
                      ]
                    : [],
              ),
              {
                type: "graphic",
                id: "next-room",
                label: "Go to next room",
                position: { yaw: 0, pitch: -28 },
                width: 7,
                height: 7,
                graphic: { kind: "arrow", fill: "#67e8f9" },
                tooltip: "Go to next room",
                action: {
                  type: "scene",
                  sceneId: entry.scene.id === "entrance" ? "hall" : "entrance",
                },
              },
            ],
          })),
        });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(String(cause));
      });
    return () => controller.abort();
  }, []);

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section
        className={cn(pageSectionClassName, "mt-8")}
        aria-labelledby="overlay-title"
      >
        <div className={pageHeadingWrapClassName}>
          <h1 className={pageHeadingTitleClassName} id="overlay-title">{t("Immersive tour")}</h1>
          <p className={pageHeadingStatusClassName}>{t("Combine scene navigation, shared dialogs, media, models and VR. Each marker opens its own content; the arrow navigates to the next scene.")}</p>
        </div>
        <div className={pageControlsClassName}>
          <div className={controlLabelClassName}>{t("Dialog implementation")}<div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={t("Dialog implementation")}
            >
              {(["default", "composed", "custom"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(
                    segmentedButtonClassName,
                    mode === value && segmentedButtonActiveClassName,
                  )}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {
                    {
                      default: t("Default dialog"),
                      composed: t("Compose parts"),
                      custom: t("Third-party dialog"),
                    }[value]
                  }
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className={segmentedButtonClassName}
            onClick={() => void viewer.toggleVR()}
          >{t("Toggle VR")}</button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRotate}
              onChange={(event) => setAutoRotate(event.target.checked)}
            />{t("Auto rotate")}</label>
        </div>
        <PanoViewer
          ref={viewer.ref}
          aria-label={t("Immersive tour viewer")}
          style={{ height: 560 }}
        >
          <WebVR />
          <SceneMovie mode="surface" onController={setMovieController} />
          <AutoRotate enabled={autoRotate} speed={8} />
          {project ? (
            <ProjectScenes
              project={project}
              activeSceneId={activeSceneId}
              transition="dissolve"
              onActiveSceneIdChange={(id) => {
                setActiveSceneId(id);
                setSelected(null);
              }}
              onHotspotClick={(event) => {
                const popup =
                  POPUPS_BY_SCENE[event.sceneId]?.[event.hotspot.id];
                if (!popup) return;
                event.preventDefault();
                setSelected({
                  sceneId: event.sceneId,
                  hotspotId: event.hotspot.id,
                });
              }}
            />
          ) : null}
          <PanoOverlay>
            <SceneMovieControls mode="surface" controller={movieController} />
            <OverlayChrome
              activeSceneId={activeSceneId}
              mode={mode}
              onClose={() => setSelected(null)}
              onNextScene={() => {
                setSelected(null);
                viewer.nextScene();
              }}
              onSelect={setSelected}
              projectReady={Boolean(project)}
              selected={selected}
              toggleFullscreen={() => void viewer.toggleFullscreen()}
            />
          </PanoOverlay>
        </PanoViewer>
        {error ? (
          <p role="alert" className="p-4">
            {t(error)}
          </p>
        ) : null}
        <section
          aria-labelledby="hotspot-mapping-title"
          className="overflow-x-auto border-t border-[#244047] p-5"
        >
          <h2 id="hotspot-mapping-title" className="m-0 text-lg font-semibold">{t("Hotspot → content")}</h2>
          <p className="my-3 text-sm text-slate-300" aria-live="polite">{t("Scene:") + " "}{activeSceneId}{t(". Both scenes reuse these IDs with their own titles and content. Close the dialog before choosing another marker.")}</p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">{t("Hotspot ID")}</th>
                <th className="p-2">{t("Content type")}</th>
                <th className="p-2">{t("Dialog title")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(POPUPS_BY_SCENE[activeSceneId] ?? {}).map(
                ([id, popup]) =>
                  popup ? (
                    <tr key={id} className="border-t border-[#244047]">
                      <td className="p-2 font-mono">{id}</td>
                      <td className="p-2">{popup.kind}</td>
                      <td className="p-2">{popup.title}</td>
                    </tr>
                  ) : null,
              )}
            </tbody>
          </table>
        </section>
        <p className="p-4 text-sm">{t("In VR, hold your gaze to operate icons. Translucent arrows appear at the edges where content can scroll. Look right for the scene video, which stays on the panorama surface. Outside VR, drag the model and scroll to zoom.")}</p>
        <p className="p-4 text-sm">{t("This tour combines") + " "}<a href="/overlays">{t("dialogs")}</a>,{" "}
          <a href="/spatial-controls">{t("spatial controls")}</a>,{" "}
          <a href="/webvr">VR</a>{" " + t("and")}{" "}
          <a href="/scene-transitions">{t("scene transitions")}</a>{t(". Choose a topic to learn its individual setup.")}</p>
        <ExampleCode
          react={{ label: t("Immersive JSON tour"), blurb: t("Load scenes and shared popup content, then enable headset entry with WebVR."), code: reactCode }}
          json={{ format: "project", files: [{
            label: "project.json",
            blurb: t("This file supplies the base scenes and hotspots. The tour adds its interactive dialog content in React."),
            url: projectUrl,
          }] }}
        />
        <details className="border-t border-line p-5">
          <summary>{t("Complete tour integration and selected dialog")}</summary>
          <CodeSnippet
            label={t("VR media controls")}
            blurb={t("Scene video, shared media controls, and a 360° video control bar.")}
            code={spatialControlsCode}
          />
          <CodeSnippet key={mode} {...dialogSnippet(mode)} />
          <CodeSnippet
            label={t("Immersive tour page")}
            blurb={t("Full page wiring: project loading, marker mapping, scene navigation, dialog selection, automatic rotation and spatial media. The supporting content and dialog implementations are included here or on their linked topic pages.")}
            code={fullSource}
          />
        </details>
      </section>
      <SiteFooter label="@ericchen1990/pano-view · immersive tour" />
    </main>
  );
}
