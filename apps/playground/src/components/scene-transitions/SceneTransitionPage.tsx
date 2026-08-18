import {
  ImageHotspot,
  KeyboardControls,
  Scenes,
  PanoViewer,
  cycleSceneId,
  type SceneTransitionPreset,
} from "@ericchen1990/pano-view";
import { useState } from "react";
import { TRANSITION_PRESETS, TRANSITION_SCENES } from "../../constants";
import { cn } from "../../cn";
import {
  controlInputClassName,
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
import { SiteHeader } from "../SiteHeader";

export function SceneTransitionPage() {
  const [activeSceneId, setActiveSceneId] = useState("sphere-1");
  const [preset, setPreset] = useState<SceneTransitionPreset>("crossfade");
  const [status, setStatus] = useState("Choose a scene and a KRpano-style blend.");

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
              GPU snapshot blending
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
          <label className={controlLabelClassName}>
            Blend
            <select
              className={controlInputClassName}
              onChange={(event) => setPreset(event.currentTarget.value as SceneTransitionPreset)}
              value={preset}
            >
              {TRANSITION_PRESETS.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </label>
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
