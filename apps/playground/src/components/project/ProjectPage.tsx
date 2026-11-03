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
import { CodeSnippet } from "../CodeSnippet";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import {
  pageSectionClassName,
  pageHeadingTitleClassName,
  shellClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
} from "../../ui";
import { cn } from "../../cn";

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
import "@ericchen1990/pano-view/ui/styles.css";

export function Tour() {
  const [project, setProject] = useState<LoadedPanoProject>();
  const [activeSceneId, setActiveSceneId] = useState<string>();
  const [popup, setPopup] = useState<ProjectPopupDefinition | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject("/tour/project.json", {
      requestInit: { signal: controller.signal },
    })
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setProject(loaded);
        setActiveSceneId(loaded.initialSceneId);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

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
  const [popup, setPopup] = useState<ProjectPopupDefinition | null>(null);
  const [project, setProject] = useState<LoadedPanoProject>();
  const [error, setError] = useState<string>();
  const [activeSceneId, setActiveSceneId] = useState<string>();
  const [status, setStatus] = useState("Loading project.json…");
  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject("/fixtures/projects/tour/project.json", {
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
        <h1 className={pageHeadingTitleClassName} id="project-title">
          A tour from static JSON
        </h1>
        <p className="my-4 text-sm text-slate-300">
          One project.json connects two viewer.json files, scene links, labels
          spatial audio, view actions and shared popup content. No database.
        </p>
        <p
          role={error ? "alert" : "status"}
          className="my-4 text-sm text-slate-300"
        >
          {error ?? status}
        </p>
        {project ? (
          <>
            <div
              className="mb-4 flex flex-wrap gap-2"
              role="group"
              aria-label="Project scenes"
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
            <PanoViewer style={{ height: 560 }}>
              <ProjectScenes
                project={project}
                activeSceneId={activeSceneId}
                onActiveSceneIdChange={(id) => { setActiveSceneId(id); setPopup(null); }}
                onPopupRequest={({ popup }) => setPopup(popup)}
                transition="dissolve"
                onSceneReady={(id) => setStatus(`Ready: ${id}`)}
                onTransitionError={({ sceneId }) =>
                  setStatus(`Could not load ${sceneId}`)
                }
                onHotspotClick={({ hotspot }) =>
                  setStatus(`Clicked: ${hotspot.label ?? hotspot.id}`)
                }
                onHotspotError={({ hotspot }) =>
                  setStatus(
                    `Could not play or load ${hotspot.label ?? hotspot.id}`
                  )
                }
              />
              <PanoOverlay>
                <ProjectPopupDialog popup={popup} onOpenChange={(open) => { if (!open) setPopup(null); }} />
              </PanoOverlay>
            </PanoViewer>
          </>
        ) : null}
        <a
          className="mt-4 inline-block text-sm text-cyan-300 underline"
          href="/fixtures/projects/tour/project.json"
        >
          View project.json
        </a>
        <CodeSnippet
          blurb="loadPanoProject resolves viewer.json and hotspot assets. ProjectScenes drives navigation; onPopupRequest hands shared content to ProjectPopupDialog."
          code={PROJECT_SNIPPET}
          label="loadPanoProject + ProjectScenes"
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · static projects" />
    </main>
  );
}
