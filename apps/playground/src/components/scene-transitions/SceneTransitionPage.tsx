import {
  BackgroundAudio,
  ImageHotspot,
  KeyboardControls,
  Scenes,
  PanoViewer,
  cycleSceneId,
  type SceneTransitionPreset,
} from "@ericchen1990/pano-view";
import { useState } from "react";
import { TRANSITION_SCENES } from "../../constants";
import { cn } from "../../cn";
import {
  controlLabelClassName,
  eyebrowClassName,
  footerClassName,
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
import { SiteHeader } from "../SiteHeader";

const FOUNTAIN_BGM = "/fixtures/hotspots/fountain.mp3";

const PER_SCENE_BACKGROUND = {
  "sphere-1": FOUNTAIN_BGM,
  "sphere-2": "",
  "tile-3": FOUNTAIN_BGM,
  "tile-4": "",
} as const;

export function SceneTransitionPage() {
  const [activeSceneId, setActiveSceneId] = useState("sphere-1");
  const [preset, setPreset] = useState<SceneTransitionPreset>("dissolve");
  const [status, setStatus] = useState("Choose a scene and a blend.");
  const [backgroundMode, setBackgroundMode] = useState<"shared" | "per-scene">(
    "shared",
  );
  const [backgroundPlaying, setBackgroundPlaying] = useState(true);

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
            <h1 className={pageHeadingTitleClassName} id="transition-bench-title">
              Blend between scenes
            </h1>
          </div>
          <p className={pageHeadingStatusClassName}>{status}</p>
        </div>
        <div className={pageControlsClassName}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Target panorama scene">
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
          <div className={controlLabelClassName}>
            Background
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Background audio mode"
            >
              <button
                className={cn(
                  segmentedButtonClassName,
                  backgroundMode === "shared" && segmentedButtonActiveClassName,
                )}
                onClick={() => setBackgroundMode("shared")}
                type="button"
              >
                Shared
              </button>
              <button
                className={cn(
                  segmentedButtonClassName,
                  backgroundMode === "per-scene" &&
                    segmentedButtonActiveClassName,
                )}
                onClick={() => setBackgroundMode("per-scene")}
                type="button"
              >
                Per scene
              </button>
            </div>
          </div>
          <div className={controlLabelClassName}>
            BGM
            <button
              className={cn(
                segmentedButtonClassName,
                backgroundPlaying && segmentedButtonActiveClassName,
              )}
              onClick={() => setBackgroundPlaying((playing) => !playing)}
              type="button"
            >
              {backgroundPlaying ? "Playing" : "Paused"}
            </button>
          </div>
        </div>
        <div className="bg-[#020607] p-0">
          <PanoViewer
            aria-label="Panorama scene transition demo"
            style={{ height: 540 }}
          >
            <KeyboardControls
              onNextScene={() => {
                const next = cycleSceneId(TRANSITION_SCENES, activeSceneId, 1);
                if (next) {
                  setActiveSceneId(next);
                }
              }}
              onPreviousScene={() => {
                const next = cycleSceneId(TRANSITION_SCENES, activeSceneId, -1);
                if (next) {
                  setActiveSceneId(next);
                }
              }}
            />
            <BackgroundAudio
              playing={backgroundPlaying}
              sceneId={
                backgroundMode === "per-scene" ? activeSceneId : undefined
              }
              sources={
                backgroundMode === "per-scene" ? PER_SCENE_BACKGROUND : undefined
              }
              src={backgroundMode === "shared" ? FOUNTAIN_BGM : undefined}
            />
            <Scenes
              activeSceneId={activeSceneId}
              maxConcurrentTileLoads={3}
              maxTextureMemoryMb={96}
              scenes={TRANSITION_SCENES}
              transition={preset}
              onTransitionEnd={({ previousSceneId, sceneId, preset: completedPreset }) => {
                setStatus(`${previousSceneId} → ${sceneId} · ${completedPreset}`);
              }}
              onTransitionError={({ sceneId }) => {
                setStatus(`Could not prepare ${sceneId}; current scene remains visible.`);
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
      </section>
      <footer className={footerClassName}>
        <span>@ericchen1990/pano-view · panorama scene transitions</span>
        <span>Stage 6 of 6</span>
      </footer>
    </main>
  );
}
