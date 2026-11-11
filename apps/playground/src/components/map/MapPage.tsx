import {
  isOverlayCorner,
  PanoMapOverlay,
  PANO_OVERLAY_ALIGNS,
  PanoOverlay,
  PanoViewer,
  ProjectScenes,
  loadPanoProject,
  type LoadedPanoProject,
  type PanoMapDefinition,
  type PanoOverlayAlign,
  type PanoOverlayAxis,
  PanoDataError,
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";
import { useEffect, useMemo, useState } from "react";
import { cn } from "../../cn";
import {
  controlLabelClassName,
  pageControlsClassName,
  pageHeadingTitleClassName,
  pageSectionClassName,
  segmentedButtonActiveClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

type PresentationMode = "panel" | "dialog";

const DEMO_MAP: PanoMapDefinition = {
  image: "/fixtures/maps/floor.svg",
  interaction: "zoom",
  controls: { collapse: true, zoom: true },
  iconSize: 28,
  maxScale: 4,
  sector: {
    angle: 70,
    radius: 56,
    followFov: false,
    color: "#ffffff",
    opacity: 0.75,
    gradient: {
      type: "radial",
      stops: [
        { offset: 0, color: "#ffffff", opacity: 1 },
        { offset: 1, color: "#ffffff", opacity: 0 },
      ],
    },
  },
  spots: [
    { id: "entrance-spot", sceneId: "entrance", x: 0.31, y: 0.5, heading: 20 },
    { id: "hall-spot", sceneId: "hall", x: 0.75, y: 0.5, heading: -40 },
  ],
};

function buildMapSnippet(
  presentation: PresentationMode,
  align: PanoOverlayAlign,
  axis: PanoOverlayAxis,
  customToggle: boolean,
): string {
  const width = presentation === "dialog" ? 52 : 260;
  const height = presentation === "dialog" ? 52 : 180;
  return `import { useEffect, useState } from "react";
import {
  PanoMapOverlay,
  PanoOverlay,
  PanoViewer,
  ProjectScenes,
  loadPanoProject,
  type LoadedPanoProject,
  type PanoMapDefinition,
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const map: PanoMapDefinition = {
  image: "/fixtures/maps/floor.svg",
  interaction: "zoom",
  controls: { collapse: true, zoom: true },
  iconSize: 28,
  maxScale: 4,
  sector: {
    angle: 70,
    radius: 56,
    followFov: false,
    color: "#ffffff",
    opacity: 0.75,
    gradient: {
      type: "radial",
      stops: [
        { offset: 0, color: "#ffffff", opacity: 1 },
        { offset: 1, color: "#ffffff", opacity: 0 },
      ],
    },
  },
  spots: [
    { id: "entrance-spot", sceneId: "entrance", x: 0.31, y: 0.5, heading: 20 },
    { id: "hall-spot", sceneId: "hall", x: 0.75, y: 0.5, heading: -40 },
  ],
};

const [project, setProject] = useState<LoadedPanoProject>();
const [activeSceneId, setActiveSceneId] = useState<string>();

useEffect(() => {
  void loadPanoProject("/tour/project.json").then((loaded) => {
    setProject({ ...loaded, map });
    setActiveSceneId(loaded.initialSceneId);
  });
}, []);

{project ? (
  <PanoViewer style={{ height: 560 }}>
    <ProjectScenes
      project={project}
      activeSceneId={activeSceneId}
      onActiveSceneIdChange={setActiveSceneId}
      transition="dissolve"
    />
    <PanoOverlay>
      <PanoMapOverlay
        map={map}
        activeSceneId={activeSceneId}
        presentation="${presentation}"
        anchor={{ align: "${align}"${isOverlayCorner(align) ? `, axis: "${axis}"` : ""}, inset: 16 }}
        width={${width}}
        height={${height}}
        dialogWidth={640}
        dialogHeight={480}
        onSelectScene={setActiveSceneId}
${customToggle ? `        toggle={{
          style: {
            background: "#0c4a6e",
            color: "#7dd3fc",
            border: "1px solid #7dd3fc",
          },
          icon: ({ collapsed }) => (collapsed ? "+" : "–"),
        }}
` : ""}      />
    </PanoOverlay>
  </PanoViewer>
) : null}`;
}

export function MapPage() {
  const [project, setProject] = useState<LoadedPanoProject>();
  const [error, setError] = useState<string>();
  const [activeSceneId, setActiveSceneId] = useState<string>();
  const [status, setStatus] = useState("Loading map demo…");
  const [presentation, setPresentation] = useState<PresentationMode>("panel");
  const [align, setAlign] = useState<PanoOverlayAlign>("bottom-left");
  const [axis, setAxis] = useState<PanoOverlayAxis>("horizontal");
  const [customToggle, setCustomToggle] = useState(false);
  const snippet = useMemo(
    () => buildMapSnippet(presentation, align, axis, customToggle),
    [align, axis, customToggle, presentation],
  );

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

  const map = project?.map;

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
            <div className={pageControlsClassName}>
              <div className={controlLabelClassName}>
                Presentation
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map presentation">
                  {(["panel", "dialog"] as const).map((mode) => (
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
                      {mode === "panel" ? "Panel" : "Dialog button"}
                    </button>
                  ))}
                </div>
              </div>
              <div className={controlLabelClassName}>
                Scene
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Scenes">
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
              </div>
            </div>
            <details className="border-b border-line">
              <summary className="px-6 py-4">Placement and appearance</summary>
              <div className={pageControlsClassName}>
              {presentation === "panel" ? (
                <div className={controlLabelClassName}>
                  Align
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map align">
                    {PANO_OVERLAY_ALIGNS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={cn(
                          segmentedButtonClassName,
                          align === value && segmentedButtonActiveClassName,
                        )}
                        aria-pressed={align === value}
                        onClick={() => setAlign(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {presentation === "panel" && isOverlayCorner(align) ? (
                <div className={controlLabelClassName}>
                  Axis
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map axis">
                    {(["horizontal", "vertical"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={cn(
                          segmentedButtonClassName,
                          axis === value && segmentedButtonActiveClassName,
                        )}
                        aria-pressed={axis === value}
                        onClick={() => setAxis(value)}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={controlLabelClassName}>
                Edge tab
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Map edge tab">
                  <button
                    type="button"
                    className={cn(
                      segmentedButtonClassName,
                      customToggle && segmentedButtonActiveClassName,
                    )}
                    aria-pressed={customToggle}
                    onClick={() => setCustomToggle((value) => !value)}
                  >
                    Custom toggle
                  </button>
                </div>
              </div>
              </div>
            </details>
            <PanoViewer style={{ height: 560 }}>
              <ProjectScenes
                project={project}
                activeSceneId={activeSceneId}
                onActiveSceneIdChange={setActiveSceneId}
                transition="dissolve"
                onSceneReady={(id) => setStatus(`Ready: ${id}`)}
              />
              <PanoOverlay>
                <PanoMapOverlay
                  key={presentation}
                  map={map}
                  activeSceneId={activeSceneId}
                  presentation={presentation}
                  anchor={{
                    align,
                    ...(isOverlayCorner(align) ? { axis } : {}),
                    inset: 16,
                  }}
                  width={presentation === "dialog" ? 52 : 260}
                  height={presentation === "dialog" ? 52 : 180}
                  dialogWidth={640}
                  dialogHeight={480}
                  onSelectScene={(sceneId) => {
                    setActiveSceneId(sceneId);
                    setStatus(`Map selected: ${sceneId}`);
                  }}
                  toggle={
                    customToggle
                      ? {
                          style: {
                            background: "#0c4a6e",
                            color: "#7dd3fc",
                            border: "1px solid #7dd3fc",
                          },
                          icon: ({ collapsed }) => (collapsed ? "+" : "–"),
                        }
                      : undefined
                  }
                />
              </PanoOverlay>
            </PanoViewer>
          </>
        ) : null}
        <CodeSnippet
          blurb="Mount PanoMapOverlay inside PanoOverlay and share activeSceneId with ProjectScenes. presentation switches between a panel and a dialog launcher. anchor.align uses the same eight positions as the scene menu."
          code={snippet}
          label="PanoMapOverlay"
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · floor plan map" />
    </main>
  );
}
