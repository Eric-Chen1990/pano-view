import { usePlaygroundLanguage } from "../../i18n/language";
import { useEffect, useState } from "react";
import {
  loadPanoProject, PanoGeoMapOverlay, PanoOverlay, PanoViewer, ProjectScenes,
  type LoadedPanoProject,
} from "@ericchen1990/pano-view";
import { ExampleCode } from "../ExampleCode";
import { SiteHeader } from "../SiteHeader";
import { SiteFooter } from "../SiteFooter";
import { GEO_MAP, GEO_MAP_SOURCES, OPEN_STREET_MAP } from "./geo-map-example";
import { pageHeadingTitleClassName, pageSectionClassName, shellClassName } from "../../ui";

const TOUR = "/fixtures/projects/tour/project.json";

function snippet(
  presentation: "panel" | "dialog",
  controlsLayout: "horizontal" | "vertical",
  markerLabels: "hover" | "always",
) {
  const geoMap = JSON.stringify({ ...GEO_MAP, presentation: { mode: presentation }, controlsLayout }, null, 2)
    .replace(/\n/g, "\n  ");
  return `import { useState } from "react";
import { PanoGeoMapOverlay, PanoOverlay, PanoViewer, ProjectScenes } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const sources = ${JSON.stringify([OPEN_STREET_MAP], null, 2)};

export function OnlineMapTour({ project }) {
  const [sceneId, setSceneId] = useState(project.initialSceneId);
  const geoMap = project.geoMap ?? ${geoMap};
  const sceneTitles = Object.fromEntries(project.scenes.map(({ scene, title }) => [scene.id, title ?? scene.id]));

  return (
    <PanoViewer style={{ width: "100%", height: 480 }}>
      <ProjectScenes project={project} activeSceneId={sceneId} onActiveSceneIdChange={setSceneId} />
      <PanoOverlay>
        <PanoGeoMapOverlay geoMap={geoMap} sources={sources} activeSceneId={sceneId}
          sceneTitles={sceneTitles} presentation="${presentation}" controlsLayout="${controlsLayout}"
          markerLabels="${markerLabels}" onSelectScene={setSceneId} />
      </PanoOverlay>
    </PanoViewer>
  );
}`;
}

export function GeoMapPage() {
  const { t } = usePlaygroundLanguage();
  const [presentation, setPresentation] = useState<"panel" | "dialog">("panel");
  const [controlsLayout, setControlsLayout] = useState<"horizontal" | "vertical">("horizontal");
  const [markerLabels, setMarkerLabels] = useState<"hover" | "always">("hover");
  const [project, setProject] = useState<LoadedPanoProject>();
  const [sceneId, setSceneId] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject(TOUR, { requestInit: { signal: controller.signal } }).then((result) => {
      if (controller.signal.aborted) return;
      setProject(result);
      setSceneId(result.initialSceneId);
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);
  const geoMap = { ...GEO_MAP, presentation: { mode: presentation }, controlsLayout };
  return <main className={shellClassName}>
    <SiteHeader />
    <section className={pageSectionClassName}>
      <h1 className={pageHeadingTitleClassName}>{t("Online scene map")}</h1>
      <p className="my-3 text-sm">{t("Choose a map marker to switch scenes. The example uses points near the Golden Gate Bridge in San Francisco.")}</p>
      <label className="my-2 flex items-center gap-2">{t("Map presentation")}<select className="rounded border border-line bg-surface p-1" value={presentation}
          onChange={(event) => setPresentation(event.target.value === "dialog" ? "dialog" : "panel")}>
          <option value="panel">{t("Panel")}</option><option value="dialog">{t("Dialog")}</option>
        </select>
      </label>
      <label className="my-2 flex items-center gap-2">{t("Map control layout")}<select className="rounded border border-line bg-surface p-1" value={controlsLayout}
          onChange={(event) => setControlsLayout(event.target.value === "vertical" ? "vertical" : "horizontal")}>
          <option value="horizontal">{t("Horizontal")}</option><option value="vertical">{t("Vertical")}</option>
        </select>
      </label>
      <label className="my-2 flex items-center gap-2">{t("Marker labels")}<select className="rounded border border-line bg-surface p-1" value={markerLabels}
          onChange={(event) => setMarkerLabels(event.target.value === "always" ? "always" : "hover")}>
          <option value="hover">{t("Hover")}</option><option value="always">{t("Always")}</option>
        </select>
      </label>
      {project ? <PanoViewer style={{ width: "100%", height: 480 }}>
        <ProjectScenes project={project} activeSceneId={sceneId} onActiveSceneIdChange={setSceneId} />
        <PanoOverlay>
          <PanoGeoMapOverlay translate={t} geoMap={geoMap} sources={GEO_MAP_SOURCES} activeSceneId={sceneId}
            sceneTitles={Object.fromEntries(project.scenes.map(({ scene, title }) => [scene.id, title ?? scene.id]))}
            markerLabels={markerLabels} onSelectScene={setSceneId} />
        </PanoOverlay>
      </PanoViewer> : failed ? <p role="alert">{t("Could not load the tour.") + " "}<button type="button"
        onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>{t("Retry")}</button></p>
        : <p role="status">{t("Loading tour…")}</p>}
      <ExampleCode react={{
        label: "PanoGeoMapOverlay", code: snippet(presentation, controlsLayout, markerLabels),
        blurb: t("Pass a tour from loadPanoProject. sceneTitles labels markers; markerLabels chooses hover or always-visible names."),
      }} json={{ format: "project", files: [{
        label: t("Online map configuration"), value: geoMap,
        blurb: t("Set the top-level geoMap field of project.json to this object. The spot scene IDs must exist in the project."),
      }] }} />
    </section>
    <SiteFooter label="@ericchen1990/pano-view · online scene map" />
  </main>;
}
