import {
  PanoMapOverlay,
  PanoViewer,
  ProjectScenes,
  loadPanoProject,
  type LoadedPanoProject,
  type PanoMapDefinition,
  PanoDataError,
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../cn";
import {
  pageHeadingTitleClassName,
  pageSectionClassName,
  segmentedButtonActiveClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

type PresentationMode = "docked" | "dialog";

const DEMO_MAP: PanoMapDefinition = {
  image: "/fixtures/maps/floor.svg",
  interaction: "zoom",
  controls: { collapse: true, zoom: true },
  iconSize: 28,
  sector: {
    angle: 70,
    radius: 56,
    followFov: false,
    gradient: {
      type: "radial",
      stops: [
        { offset: 0, color: "#ffffff", opacity: 0.75 },
        { offset: 1, color: "#ffffff", opacity: 0 },
      ],
    },
  },
  spots: [
    { id: "entrance-spot", sceneId: "entrance", x: 0.31, y: 0.5, heading: 20 },
    { id: "hall-spot", sceneId: "hall", x: 0.75, y: 0.5, heading: -40 },
  ],
};

function withPresentation(
  map: PanoMapDefinition,
  mode: PresentationMode,
): PanoMapDefinition {
  return {
    ...map,
    presentation: {
      mode,
      corner: "bottom-left",
      width: mode === "dialog" ? 52 : 260,
      height: mode === "dialog" ? 52 : 180,
      offsetX: 16,
      offsetY: 16,
    },
  };
}

export function MapPage() {
  const [project, setProject] = useState<LoadedPanoProject>();
  const [error, setError] = useState<string>();
  const [activeSceneId, setActiveSceneId] = useState<string>();
  const [status, setStatus] = useState("Loading map demo…");
  const [presentation, setPresentation] = useState<PresentationMode>("docked");

  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject("/fixtures/projects/tour/project.json", {
      requestInit: { signal: controller.signal },
    })
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setProject({ ...loaded, map: DEMO_MAP });
        setActiveSceneId(loaded.initialSceneId);
        setStatus("Ready");
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof PanoDataError
            ? `${cause.code}: ${cause.message}`
            : String(cause),
        );
      });
    return () => controller.abort();
  }, []);

  const map = useMemo(
    () => (project?.map ? withPresentation(project.map, presentation) : undefined),
    [project?.map, presentation],
  );

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section className={cn(pageSectionClassName, "mt-8")} aria-labelledby="map-title">
        <h1 className={pageHeadingTitleClassName} id="map-title">
          Floor plan map
        </h1>
        <p className="my-4 text-sm text-slate-300">
          Icons switch scenes. The active sector rotates with panorama yaw.
          Zoom scales only the floor image; icons and the radar keep their screen size.
        </p>
        <p role={error ? "alert" : "status"} className="my-4 text-sm text-slate-300">
          {error ?? status}
        </p>
        {project && map ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Map presentation">
              {(["docked", "dialog"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={cn(
                    segmentedButtonClassName,
                    presentation === mode && segmentedButtonActiveClassName,
                  )}
                  aria-pressed={presentation === mode}
                  onClick={() => setPresentation(mode)}
                >
                  {mode === "docked" ? "Docked panel" : "Dialog button"}
                </button>
              ))}
            </div>
            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Scenes">
              {project.scenes.map((entry) => (
                <button
                  key={entry.scene.id}
                  type="button"
                  className={cn(
                    segmentedButtonClassName,
                    activeSceneId === entry.scene.id && segmentedButtonActiveClassName,
                  )}
                  aria-pressed={activeSceneId === entry.scene.id}
                  onClick={() => setActiveSceneId(entry.scene.id)}
                >
                  {entry.title ?? entry.scene.id}
                </button>
              ))}
            </div>
            <PanoViewer
              style={{ height: 560 }}
              renderOverlay={() => (
                <PanoMapOverlay
                  key={presentation}
                  map={map}
                  activeSceneId={activeSceneId}
                  onSelectScene={(sceneId) => {
                    setActiveSceneId(sceneId);
                    setStatus(`Map selected: ${sceneId}`);
                  }}
                />
              )}
            >
              <ProjectScenes
                project={project}
                activeSceneId={activeSceneId}
                onActiveSceneIdChange={setActiveSceneId}
                transition="dissolve"
                onSceneReady={(id) => setStatus(`Ready: ${id}`)}
              />
            </PanoViewer>
          </>
        ) : null}
      </section>
      <SiteFooter label="@ericchen1990/pano-view · floor plan map" />
    </main>
  );
}
