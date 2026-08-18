import {
  GraphicHotspot,
  PanoEvents,
  PanoViewer,
  Scenes,
  WebVR,
  type Scene,
  type WebVRHandle,
} from "@ericchen1990/pano-view";
import { useRef, useState } from "react";
import {
  eyebrowClassName,
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { SiteHeader } from "../SiteHeader";

const TILE_SCENE = {
  type: "tile" as const,
  multires: "512,1000,2000",
  urlTemplate: "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
  previewUrl: "previews/cube-vertical.webp",
};

const VR_SCENES = [
  { id: "tile-1", ...TILE_SCENE, baseUrl: "/fixtures/panorama/cube-tiles/1" },
  { id: "tile-2", ...TILE_SCENE, baseUrl: "/fixtures/panorama/cube-tiles/2" },
  { id: "tile-3", ...TILE_SCENE, baseUrl: "/fixtures/panorama/cube-tiles/3" },
  { id: "tile-4", ...TILE_SCENE, baseUrl: "/fixtures/panorama/cube-tiles/4" },
] satisfies readonly Scene[];

const INITIAL_SCENE_ID = VR_SCENES[0]!.id;

const PREV_GRAPHIC = {
  kind: "arrow" as const,
  fill: "#df6b42",
  stroke: "#f5fbfc",
  strokeWidth: 10,
};

const NEXT_GRAPHIC = {
  kind: "arrow" as const,
  fill: "#75cbd3",
  stroke: "#f5fbfc",
  strokeWidth: 10,
};

const SCENE_LINKS = {
  "tile-1": [
    {
      id: "prev",
      label: "Tile 4",
      targetSceneId: "tile-4",
      position: { yaw: -32, pitch: -6 },
      rotation: 180,
      graphic: PREV_GRAPHIC,
    },
    {
      id: "next",
      label: "Tile 2",
      targetSceneId: "tile-2",
      position: { yaw: 48, pitch: 2 },
      rotation: 0,
      graphic: NEXT_GRAPHIC,
    },
  ],
  "tile-2": [
    {
      id: "prev",
      label: "Tile 1",
      targetSceneId: "tile-1",
      position: { yaw: 155, pitch: 4 },
      rotation: 210,
      graphic: PREV_GRAPHIC,
    },
    {
      id: "next",
      label: "Tile 3",
      targetSceneId: "tile-3",
      position: { yaw: -78, pitch: -12 },
      rotation: 15,
      graphic: NEXT_GRAPHIC,
    },
  ],
  "tile-3": [
    {
      id: "prev",
      label: "Tile 2",
      targetSceneId: "tile-2",
      position: { yaw: 22, pitch: 18 },
      rotation: 160,
      graphic: PREV_GRAPHIC,
    },
    {
      id: "next",
      label: "Tile 4",
      targetSceneId: "tile-4",
      position: { yaw: -140, pitch: -3 },
      rotation: -25,
      graphic: NEXT_GRAPHIC,
    },
  ],
  "tile-4": [
    {
      id: "prev",
      label: "Tile 3",
      targetSceneId: "tile-3",
      position: { yaw: 88, pitch: -8 },
      rotation: 195,
      graphic: PREV_GRAPHIC,
    },
    {
      id: "next",
      label: "Tile 1",
      targetSceneId: "tile-1",
      position: { yaw: -18, pitch: 10 },
      rotation: 40,
      graphic: NEXT_GRAPHIC,
    },
  ],
} as const;

export function WebVRPage() {
  const webVRRef = useRef<WebVRHandle>(null);
  const [status, setStatus] = useState("Detecting VR capabilities…");
  const [activeSceneId, setActiveSceneId] = useState(INITIAL_SCENE_ID);
  const [lastClick, setLastClick] = useState("Look at a hotspot in VR to switch scenes");

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section className={`${pageSectionClassName} mt-6`}>
        <div className={pageHeadingWrapClassName}>
          <div>
            <p className={eyebrowClassName}>Immersive viewer</p>
            <h1 className={pageHeadingTitleClassName}>WebVR</h1>
          </div>
          <p className={pageHeadingStatusClassName}>
            WebXR is preferred on headsets. Phones fall back to stereoscopic
            gyro viewing, while desktop browsers can preview simulated VR. In
            VR, look at a hotspot until the reticle ring fills to switch scenes.
          </p>
        </div>
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <button
            className={segmentedButtonClassName}
            onClick={() => void webVRRef.current?.toggleVR()}
            type="button"
          >
            Toggle VR
          </button>
          <span className="font-mono text-xs text-muted-2">{status}</span>
          <span className="font-mono text-xs text-muted-2">
            Scene: {activeSceneId}
          </span>
          <span className="font-mono text-xs text-muted-2">{lastClick}</span>
        </div>
        <div className="h-[min(68vh,680px)] min-h-105">
          <PanoViewer contextMenu={false} style={{ height: "100%" }}>
            <PanoEvents
              onVRAvailable={() => setStatus("VR is available")}
              onVRDenied={(error) =>
                setStatus(
                  error instanceof Error
                    ? `VR denied: ${error.message}`
                    : "VR permission was denied",
                )
              }
              onVREnter={(mode) => setStatus(`Active mode: ${mode}`)}
              onVRExit={() => setStatus("VR session ended")}
              onVRUnavailable={() => setStatus("VR is unavailable")}
              onVRUnknownDevice={() =>
                setStatus("Unknown screen size — open VR Setup to calibrate")
              }
            />
            <WebVR
              ref={webVRRef}
              chrome={{
                accent: "#75cbd3",
                background: "rgba(7, 19, 22, 0.82)",
              }}
            />
            <Scenes
              activeSceneId={activeSceneId}
              maxConcurrentTileLoads={3}
              maxTextureMemoryMb={96}
              onTransitionEnd={({ previousSceneId, sceneId }) => {
                setLastClick(`${previousSceneId} → ${sceneId}`);
              }}
              onTransitionError={({ sceneId }) => {
                setLastClick(`Could not prepare ${sceneId}; current scene remains visible.`);
              }}
              renderHotspots={(scene) => {
                const links = SCENE_LINKS[scene.id as keyof typeof SCENE_LINKS];
                if (!links) {
                  return null;
                }
                return links.map((target) => (
                  <GraphicHotspot
                    ariaLabel={`Go to ${target.label}`}
                    graphic={target.graphic}
                    height={10}
                    id={`${scene.id}-${target.id}`}
                    key={`${scene.id}-${target.id}`}
                    onClick={() => setActiveSceneId(target.targetSceneId)}
                    position={target.position}
                    rotation={target.rotation}
                    tooltip={target.label}
                    tooltipTrigger="hover"
                    width={10}
                  />
                ));
              }}
              scenes={VR_SCENES}
              transition="crossfade"
            />
          </PanoViewer>
        </div>
      </section>
    </main>
  );
}
