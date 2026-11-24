import { message, type LocalizedMessage } from "../../i18n/locale";
import { usePlaygroundLanguage } from "../../i18n/language";
import { ProjectPopupDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/ui/styles.css";
import { useEffect, useState } from "react";
import {
  PanoOverlay,
  PanoViewer,
  ProjectScenes,
  PanoDataError,
  loadPanoProject,
  type LoadedPanoProject,
  type ProjectPopupDefinition,
} from "@ericchen1990/pano-view";
import { ExampleCode } from "../ExampleCode";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import {
  controlLabelClassName,
  pageSectionClassName,
  shellClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
} from "../../ui";
import { cn } from "../../cn";
import { PageHeading } from "../PageHeading";

const projectUrl = "/fixtures/projects/tour/project-v2.json";

const PROJECT_SNIPPET = `import { useEffect, useState } from "react";
import {
  PanoOverlay,
  PanoViewer,
  ProjectScenes,
  loadPanoProject,
  type LoadedPanoProject,
  type ProjectPopupDefinition,
} from "@ericchen1990/pano-view";
import { ProjectPopupDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";

export function Tour() {
  const [project, setProject] = useState<LoadedPanoProject>();
  const [activeSceneId, setActiveSceneId] = useState<string>();
  const [error, setError] = useState<string>();
  const [popup, setPopup] = useState<ProjectPopupDefinition | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject(${JSON.stringify(projectUrl)}, {
      requestInit: { signal: controller.signal },
    })
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setProject(loaded);
        setActiveSceneId(loaded.initialSceneId);
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => controller.abort();
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Loading tour…</p>;

  return (
    <PanoViewer style={{ height: 560 }}>
      <ProjectScenes
        project={project}
        activeSceneId={activeSceneId}
        onActiveSceneIdChange={(id) => {
          setActiveSceneId(id);
          setPopup(null);
        }}
        onPopupRequest={({ popup }) => setPopup(popup)}
        transition="dissolve"
      />
      <PanoOverlay>
        <ProjectPopupDialog
          popup={popup}
          onOpenChange={(open) => {
            if (!open) setPopup(null);
          }}
        />
      </PanoOverlay>
    </PanoViewer>
  );
}`;

export function ProjectPage() {
  const { t } = usePlaygroundLanguage();
  const [popup, setPopup] = useState<ProjectPopupDefinition | null>(null);
  const [project, setProject] = useState<LoadedPanoProject>();
  const [error, setError] = useState<string>();
  const [activeSceneId, setActiveSceneId] = useState<string>();
  const [status, setStatus] = useState<LocalizedMessage>("Loading project.json…");
  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject(projectUrl, {
      requestInit: { signal: controller.signal },
    })
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setProject(loaded);
        setActiveSceneId(loaded.initialSceneId);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          cause instanceof PanoDataError
            ? `${cause.code}: ${cause.message}`
            : String(cause)
        );
      });
    return () => controller.abort();
  }, []);

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section
        className={cn(pageSectionClassName, "mt-8")}
        aria-labelledby="project-title"
      >
        <PageHeading
          id="project-title"
          eyebrow={t("Projects & tools")}
          title={t("Static JSON tour")}
          description={t("One project.json connects two viewer.json files, scene links, labels spatial audio, view actions and shared popup content. No database. This integration demonstrates data-driven navigation and popup requests; use the related examples below to learn individual components.")}
        />
        <p
          role={error ? "alert" : "status"}
          className="m-0 border-b border-[#244047] px-6 py-3 text-sm text-[#9ab1b7]"
        >
          {t(error ?? status)}
        </p>
        {project ? (
          <>
            <div className={cn(controlLabelClassName, "mb-4")}>{t("Scene")}<div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label={t("Project scenes")}
              >
                {project.scenes.map((entry) => (
                  <button
                    key={entry.scene.id}
                    type="button"
                    className={cn(
                      segmentedButtonClassName,
                      activeSceneId === entry.scene.id &&
                        segmentedButtonActiveClassName
                    )}
                    aria-pressed={activeSceneId === entry.scene.id}
                    onClick={() => { setActiveSceneId(entry.scene.id); setPopup(null); }}
                  >
                    {entry.title ?? entry.scene.id}
                  </button>
                ))}
              </div>
            </div>
            <PanoViewer style={{ height: 560 }}>
              <ProjectScenes
                project={project}
                activeSceneId={activeSceneId}
                onActiveSceneIdChange={(id) => { setActiveSceneId(id); setPopup(null); }}
                onPopupRequest={({ popup }) => setPopup(popup)}
                transition="dissolve"
                onSceneReady={(id) => setStatus(message("Ready: {scene}", { scene: id }))}
                onTransitionError={({ sceneId }) =>
                  setStatus(message("Could not load {name}", { name: sceneId }))
                }
                onHotspotClick={({ hotspot }) =>
                  setStatus(message("Clicked: {label}", { label: hotspot.label ?? hotspot.id }))
                }
                onHotspotError={({ hotspot }) =>
                  setStatus(
                    message("Could not play or load {label}", { label: hotspot.label ?? hotspot.id })
                  )
                }
              />
              <PanoOverlay>
                <ProjectPopupDialog closeLabel={t("Close")} popup={popup} onOpenChange={(open) => { if (!open) setPopup(null); }} />
              </PanoOverlay>
            </PanoViewer>
          </>
        ) : null}
        <ExampleCode
          json={{ format: "project", files: [{
            label: "project.json",
            blurb: t("Open the source in its demo directory to preserve its relative viewer and media URLs."),
            url: projectUrl,
          }] }}
          react={{
            blurb: t("loadPanoProject resolves viewer.json and hotspot assets. ProjectScenes drives navigation; onPopupRequest hands shared content to ProjectPopupDialog."),
            code: PROJECT_SNIPPET,
            label: "loadPanoProject + ProjectScenes",
          }}
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · static projects" />
    </main>
  );
}
