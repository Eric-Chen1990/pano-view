import { usePlaygroundLanguage } from "../../i18n/language";
import {
  PanoViewer,
  PortalHotspot,
  Scenes,
  type PanoViewerHandle,
  type PortalHotspotProps,
  type PanoProjectDefinition,
  type Scene,
} from "@ericchen1990/pano-view";
import { useRef, useState } from "react";
import { CUBE_VIEWER_CONFIG, cubeTileProps } from "../../constants";
import {
  controlInputClassName,
  controlLabelClassName,
  pageControlsClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { ExampleCode } from "../ExampleCode";
import { ExamplePage } from "../ExamplePage";
import source from "./PortalPage.tsx?raw";

const PORTAL_SCENES = [
  {
    id: "garden",
    name: "Garden path",
    type: "tile",
    ...cubeTileProps(1),
    initialView: { yaw: -20, pitch: 0, fov: 65 },
    viewLimits: { fov: { min: 20, max: 100 } },
  },
  {
    id: "lakeside",
    name: "Lakeside",
    type: "tile",
    ...cubeTileProps(3),
    initialView: { yaw: 0, pitch: 0, fov: 75 },
    viewLimits: { fov: { min: 20, max: 100 } },
  },
  {
    id: "courtyard",
    name: "Courtyard",
    type: "tile",
    ...cubeTileProps(2),
    initialView: { yaw: 12, pitch: 0, fov: 75 },
    viewLimits: { fov: { min: 20, max: 100 } },
  },
] as const satisfies readonly (Scene & { name: string })[];

type PortalSceneId = (typeof PORTAL_SCENES)[number]["id"];
type Door = Pick<PortalHotspotProps, "position" | "shape" | "width" | "height" | "scale" | "frame">;

const PORTALS = {
  garden: {
    courtyard: {
      position: { yaw: -20, pitch: 0 },
      shape: "rectangle",
      width: 22,
      height: 30,
    },
    lakeside: {
      position: { yaw: 14, pitch: 0 },
      shape: "circle",
      width: 22,
      height: 22,
    },
  },
  lakeside: {
    garden: {
      position: { yaw: 0, pitch: 0 },
      shape: "circle",
      width: 20,
      height: 20,
    },
    courtyard: {
      position: { yaw: 34, pitch: 0 },
      shape: "ellipse",
      width: 20,
      height: 30,
    },
  },
  courtyard: {
    lakeside: {
      position: { yaw: -6, pitch: -7 },
      shape: "ellipse",
      width: 25,
      height: 37,
      scale: 1.5,
      frame: { src: "/fixtures/hotspots/medieval-stone-portal-v2.webp", thickness: 0.14 },
    },
    garden: {
      position: { yaw: 36, pitch: -4 },
      shape: "rectangle",
      width: 22,
      height: 30,
    },
  },
} satisfies {
  [Source in PortalSceneId]: Partial<Record<Exclude<PortalSceneId, Source>, Door>>;
};

const INITIAL_SCENE_ID = "courtyard";

const project: PanoProjectDefinition = {
  schemaVersion: 1,
  initialSceneId: INITIAL_SCENE_ID,
  scenes: PORTAL_SCENES.map(({ id, name, initialView, viewLimits, baseUrl }) => ({
    id,
    title: name,
    initialView,
    viewLimits,
    source: { baseUrl, viewerConfig: CUBE_VIEWER_CONFIG },
    hotspots: Object.entries(PORTALS[id]).map(([target, door]) => ({
      id: `portal-${id}-${target}`,
      type: "portal",
      ...door,
      enterOnZoom: true,
      events: { click: { type: "scene", sceneId: target } },
    })),
  })),
};

function buildPortalSnippet(sceneId: string, renderer: "auto" | "webgl") {
  return `import { PanoViewer, PortalHotspot, Scenes, type PortalHotspotProps, type Scene } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const scenes: Scene[] = ${JSON.stringify(PORTAL_SCENES.map(({ name, ...scene }) => scene), null, 2)};
type Door = Omit<PortalHotspotProps, "id" | "targetSceneId">;
const doors: Record<string, Record<string, Door>> = ${JSON.stringify(PORTALS, null, 2)};

export function PortalTour() {
  return (
    <PanoViewer renderer="${renderer}" style={{ height: 540 }}>
      <Scenes
        scenes={scenes}
        defaultActiveSceneId="${sceneId}"
        renderHotspots={(scene) => Object.entries(doors[scene.id] ?? {}).map(([targetSceneId, door]) => (
          <PortalHotspot key={targetSceneId} id={targetSceneId} targetSceneId={targetSceneId} enterOnZoom {...door} />
        ))}
      />
    </PanoViewer>
  );
}`;
}

function renderDoors(scene: Scene) {
  const sourceScene = PORTAL_SCENES.find(({ id }) => id === scene.id);
  if (!sourceScene) return null;
  return Object.entries(PORTALS[sourceScene.id]).map(([targetSceneId, door]) => (
    <PortalHotspot
      key={targetSceneId}
      id={`portal-${sourceScene.id}-${targetSceneId}`}
      ariaLabel={`Enter ${PORTAL_SCENES.find(({ id }) => id === targetSceneId)?.name ?? targetSceneId}`}
      targetSceneId={targetSceneId}
      enterOnZoom
      {...door}
    />
  ));
}

export function PortalPage() {
  const { t } = usePlaygroundLanguage();
  const viewer = useRef<PanoViewerHandle>(null);
  const [sceneId, setSceneId] = useState(INITIAL_SCENE_ID);
  const [renderer, setRenderer] = useState<"auto" | "webgl">("auto");
  const [backend, setBackend] = useState("");
  const [error, setError] = useState("");
  const scene = PORTAL_SCENES.find(({ id }) => id === sceneId);

  return (
    <ExamplePage
      title={t("Panorama portals")}
      description={t("Click a doorway, or look directly at it and zoom in to travel.")}
    >
      <div className={pageControlsClassName}>
        <output className={controlLabelClassName} aria-label={t("Current panorama")}>
          {scene?.name}
        </output>
        <label className={controlLabelClassName}>{t("Renderer")}<select
            className={controlInputClassName}
            value={renderer}
            onChange={({ currentTarget }) => {
              setBackend("");
              setError("");
              setRenderer(currentTarget.value === "webgl" ? "webgl" : "auto");
            }}
          >
            <option value="auto">{t("Auto")}</option>
            <option value="webgl">WebGL</option>
          </select>
        </label>
        {backend && (
          <output className={controlLabelClassName} aria-label={t("Active renderer")}>
            {backend}
          </output>
        )}
        {error && <p role="status">{t(error)}</p>}
      </div>
      <PanoViewer
        key={renderer}
        ref={viewer}
        renderer={renderer}
        aria-label={t("Panorama portal demo")}
        style={{ height: "min(540px, 58dvh)" }}
      >
        <Scenes
          defaultActiveSceneId={sceneId}
          maxConcurrentTileLoads={3}
          maxTextureMemoryMb={96}
          scenes={PORTAL_SCENES}
          onSceneReady={(id) => {
            setSceneId(id);
            setBackend(viewer.current?.getRendererBackend() ?? "");
            setError("");
          }}
          onTransitionError={({ sceneId }) => {
            const target = PORTAL_SCENES.find(({ id }) => id === sceneId);
            setError(`Could not load ${target?.name ?? sceneId}. Try the doorway again.`);
          }}
          renderHotspots={renderDoors}
        />
      </PanoViewer>
      <ExampleCode
        react={{ label: "PortalHotspot", blurb: t("Render each doorway with the target scene ID and its position."), code: buildPortalSnippet(sceneId, renderer) }}
        json={{ format: "project", files: [{
          label: t("Three-scene portal project"),
          blurb: t("Load this project.json with loadPanoProject and pass it to ProjectScenes. Each portal’s click event points to its destination scene."),
          value: { ...project, initialSceneId: sceneId },
        }] }}
      />
      <details className="border-t border-line p-5">
        <summary>{t("Complete portal example")}</summary>
        <CodeSnippet
          label="PortalHotspot"
          blurb={t("Each source scene maps a doorway to each destination by scene ID.")}
          code={source}
        />
      </details>
    </ExamplePage>
  );
}
