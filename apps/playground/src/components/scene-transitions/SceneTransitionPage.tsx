import fullSource from "./SceneTransitionPage.tsx?raw";
import {
  ImageHotspot,
  Scenes,
  PanoViewer,
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

function buildSceneTransitionSnippet(preset: SceneTransitionPreset): string {
  return `import {
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
    "Choose a scene to compare transition effects.",
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
              renderHotspots={(scene) => (
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
          blurb="Set the transition preset and update the active scene to compare effects."
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
