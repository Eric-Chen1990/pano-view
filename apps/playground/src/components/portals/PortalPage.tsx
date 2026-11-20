import {
  PanoViewer,
  PortalHotspot,
  Scenes,
  type PanoViewerHandle,
  type PortalHotspotProps,
  type Scene,
} from "@ericchen1990/pano-view";
import { useRef, useState } from "react";
import {
  controlInputClassName,
  controlLabelClassName,
  pageControlsClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { ExamplePage } from "../ExamplePage";
import source from "./PortalPage.tsx?raw";

const PORTAL_SCENES = [
  {
    id: "garden",
    name: "Garden path",
    type: "sphereTile",
    baseUrl: "/fixtures/panorama/sphere-tiles-v2/",
    multires: "512,512x256,2048x1024,4096x2048,8000x4000",
    previewUrl: "previews/400.webp",
    urlTemplate: "tiles/%l/%h_%v.webp",
    yawOffset: 30,
    initialView: { yaw: 10, pitch: 0, fov: 65 },
    viewLimits: { fov: { min: 20, max: 100 } },
  },
  {
    id: "lakeside",
    name: "Lakeside",
    type: "tile",
    baseUrl: "/fixtures/panorama/cube-tiles/3",
    multires: "512,1000,2000",
    previewUrl: "previews/cube-vertical.webp",
    urlTemplate: "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
    initialView: { yaw: 0, pitch: 0, fov: 75 },
    viewLimits: { fov: { min: 20, max: 100 } },
  },
  {
    id: "courtyard",
    name: "Courtyard",
    type: "sphere",
    src: "/fixtures/panorama/panos/2/sphere.webp",
    previewUrl: "preview.webp",
    yawOffset: 12,
    initialView: { yaw: 0, pitch: 0, fov: 75 },
    viewLimits: { fov: { min: 20, max: 100 } },
  },
] as const satisfies readonly (Scene & { name: string })[];

type PortalSceneId = (typeof PORTAL_SCENES)[number]["id"];
type Door = Pick<PortalHotspotProps, "position" | "shape" | "width" | "height" | "scale" | "frame">;

const PORTALS = {
  garden: {
    courtyard: {
      position: { yaw: 10, pitch: 0 },
      shape: "rectangle",
      width: 22,
      height: 30,
    },
    lakeside: {
      position: { yaw: 44, pitch: 0 },
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
      position: { yaw: -18, pitch: -7 },
      shape: "ellipse",
      width: 25,
      height: 37,
      scale: 1.5,
      frame: { src: "/fixtures/hotspots/medieval-stone-portal-v2.webp", thickness: 0.14 },
    },
    garden: {
      position: { yaw: 24, pitch: -4 },
      shape: "rectangle",
      width: 22,
      height: 30,
    },
  },
} satisfies {
  [Source in PortalSceneId]: Partial<Record<Exclude<PortalSceneId, Source>, Door>>;
};

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
  const viewer = useRef<PanoViewerHandle>(null);
  const [sceneId, setSceneId] = useState("courtyard");
  const [renderer, setRenderer] = useState<"auto" | "webgl">("auto");
  const [backend, setBackend] = useState("");
  const [error, setError] = useState("");
  const scene = PORTAL_SCENES.find(({ id }) => id === sceneId);

  return (
    <ExamplePage
      title="Panorama portals"
      description="Click a doorway, or look directly at it and zoom in to travel."
    >
      <div className={pageControlsClassName}>
        <output className={controlLabelClassName} aria-label="Current panorama">
          {scene?.name}
        </output>
        <label className={controlLabelClassName}>
          Renderer
          <select
            className={controlInputClassName}
            value={renderer}
            onChange={({ currentTarget }) => {
              setBackend("");
              setError("");
              setRenderer(currentTarget.value === "webgl" ? "webgl" : "auto");
            }}
          >
            <option value="auto">Auto</option>
            <option value="webgl">WebGL</option>
          </select>
        </label>
        {backend && (
          <output className={controlLabelClassName} aria-label="Active renderer">
            {backend}
          </output>
        )}
        {error && <p role="status">{error}</p>}
      </div>
      <PanoViewer
        key={renderer}
        ref={viewer}
        renderer={renderer}
        aria-label="Panorama portal demo"
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
      <details className="border-t border-line p-5">
        <summary>Portal example code</summary>
        <CodeSnippet
          label="PortalHotspot"
          blurb="Each source scene maps a doorway to each destination by scene ID."
          code={source}
        />
      </details>
    </ExamplePage>
  );
}
