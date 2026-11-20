import fullSource from "./SceneTransitionPage.tsx?raw";
import {
  ImageHotspot,
  Scenes,
  PanoViewer,
  PortalHotspot,
  type PanoViewerHandle,
  type SceneTransitionPreset,
} from "@ericchen1990/pano-view";
import { useMemo, useRef, useState } from "react";
import { TRANSITION_SCENES } from "../../constants";
import { cn } from "../../cn";
import {
  controlLabelClassName,
  eyebrowClassName,
  pageControlsClassName,
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  segmentedButtonActiveClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { BlendSelect } from "./BlendSelect";
import { CodeSnippet } from "../CodeSnippet";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const PORTAL_TARGETS: Record<string, string> = {
  "sphere-1": "tile-3", "tile-3": "sphere-tiles", "sphere-tiles": "sphere-1",
};

function buildSceneTransitionSnippet(preset: SceneTransitionPreset): string {
  return `import {
  PortalHotspot,
  PanoViewer,
  Scenes,
} from "@ericchen1990/pano-view";

const scenes = [/* sphere + cube scenes */];
const [activeSceneId, setActiveSceneId] = useState("sphere-1");

<PanoViewer
  style={{ height: "min(540px, 68dvh)" }}
>
  <Scenes
    activeSceneId={activeSceneId}
    onActiveSceneIdChange={setActiveSceneId}
    scenes={scenes}
    transition="${preset}"
    renderHotspots={(scene) => (
      scene.id === "sphere-1" ? (
        <PortalHotspot
          id="door"
          position={{ yaw: 0, pitch: 0 }}
          targetSceneId="tile-3"
        />
      ) : null
    )}
  />
</PanoViewer>`;
}

export function SceneTransitionPage() {
  const [activeSceneId, setActiveSceneId] = useState("sphere-1");
  const [renderer, setRenderer] = useState<"auto" | "webgl">("auto");
  const [backend, setBackend] = useState("");
  const viewer = useRef<PanoViewerHandle>(null);
  const [preset, setPreset] = useState<SceneTransitionPreset>("dissolve");
  const [status, setStatus] = useState(
    "Compare transition presets across sphere and cube scenes. Choose a scene and a blend.",
  );
  const snippet = useMemo(() => buildSceneTransitionSnippet(preset), [preset]);

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section
        aria-labelledby="transition-bench-title"
        className={cn(pageSectionClassName, "mt-8")}
      >
        <div className={pageHeadingWrapClassName}>
          <div>
            <p className={eyebrowClassName}>Scene transition bench</p>
            <h1
              className={pageHeadingTitleClassName}
              id="transition-bench-title"
            >
              Blend between scenes
            </h1>
          </div>
          <p className={pageHeadingStatusClassName}>{status}</p>
        </div>
        <div className={pageControlsClassName}>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Target panorama scene"
          >
            {TRANSITION_SCENES.map((scene) => (
              <button
                className={cn(
                  segmentedButtonClassName,
                  activeSceneId === scene.id && segmentedButtonActiveClassName,
                )}
                key={scene.id}
                onClick={() => setActiveSceneId(scene.id)}
                type="button"
              >
                {scene.id}
              </button>
            ))}
          </div>
          <div className={controlLabelClassName}>
            Blend
            <BlendSelect onChange={setPreset} value={preset} />
          </div>
          <label className={controlLabelClassName}>
            Renderer
            <select value={renderer} onChange={({ currentTarget }) => {
              setBackend("");
              setRenderer(currentTarget.value === "webgl" ? "webgl" : "auto");
            }}>
              <option value="auto">Auto</option>
              <option value="webgl">WebGL</option>
            </select>
          </label>
          {backend ? <output className={controlLabelClassName} aria-label="Active renderer">{backend}</output> : null}
        </div>
        <div className="bg-[#020607] p-0">
          <PanoViewer
            key={renderer}
            ref={viewer}
            renderer={renderer}
            aria-label="Panorama scene transition demo"
            style={{ height: "min(540px, 68dvh)" }}
          >
            <Scenes
              activeSceneId={activeSceneId}
              onActiveSceneIdChange={setActiveSceneId}
              maxConcurrentTileLoads={3}
              maxTextureMemoryMb={96}
              scenes={TRANSITION_SCENES}
              transition={preset}
              onSceneReady={() => setBackend(viewer.current?.getRendererBackend() ?? "")}
              onTransitionEnd={({
                previousSceneId,
                sceneId,
                preset: completedPreset,
              }) => {
                setStatus(
                  `${previousSceneId} → ${sceneId} · ${completedPreset}`,
                );
              }}
              onTransitionError={({ sceneId }) => {
                setStatus(
                  `Could not prepare ${sceneId}; current scene remains visible.`,
                );
              }}
              renderHotspots={(scene) => PORTAL_TARGETS[scene.id] ? (
                <>
                  <PortalHotspot id={`portal-${scene.id}`} position={{ yaw: scene.initialView?.yaw ?? 0, pitch: 0 }}
                    ariaLabel={`Enter ${PORTAL_TARGETS[scene.id]}`}
                    shape={scene.id === "tile-3" ? "circle" : "rectangle"}
                    targetSceneId={PORTAL_TARGETS[scene.id]} width={20} height={32} />
                  {scene.id === "tile-3" ? <PortalHotspot id="portal-return"
                    position={{ yaw: 25, pitch: 0 }} ariaLabel="Return to sphere-1"
                    targetSceneId="sphere-1" width={15} height={25} shape="ellipse"
                    frame={{ color: "#f5c984", thickness: 0.07 }} /> : null}
                </>
              ) : (
                <ImageHotspot
                  ariaLabel={`${scene.id} scene marker`}
                  height={6}
                  id={`transition-marker-${scene.id}`}
                  position={{ yaw: 18, pitch: 5 }}
                  src="/fixtures/hotspots/signal.svg"
                  width={6}
                />
              )}
            />
          </PanoViewer>
        </div>
        <CodeSnippet
          blurb="Choose a scene to compare transition presets, or enter the doorway to try portal navigation. The three doorways form a loop."
          code={snippet}
          label="Scenes: transition presets"
        />
        <details className="border-t border-line p-5">
          <summary>Complete running example</summary>
          <CodeSnippet
            label="Scene transitions page"
            blurb="Full page implementation, including the displayed controls, loading/error status and example code generation."
            code={fullSource}
          />
        </details>
      </section>
      <SiteFooter label="@ericchen1990/pano-view · panorama scene transitions" />
    </main>
  );
}
