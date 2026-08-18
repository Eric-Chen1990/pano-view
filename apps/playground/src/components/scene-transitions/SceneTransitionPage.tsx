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
import { SiteHeader } from "../SiteHeader";

export function SceneTransitionPage() {
  const [activeSceneId, setActiveSceneId] = useState("sphere-1");
  const [preset, setPreset] = useState<SceneTransitionPreset>("crossfade");
  const [status, setStatus] = useState("Choose a scene and a KRpano-style blend.");

  return (
    <main className="app-shell">
      <SiteHeader />
      <section className="transition-bench" aria-labelledby="transition-bench-title">
        <div className="transition-bench-heading">
          <div>
            <p className="eyebrow">Scene transition bench</p>
            <h1 id="transition-bench-title">GPU snapshot blending</h1>
          </div>
          <p>{status}</p>
        </div>
        <div className="transition-bench-controls">
          <div className="scene-buttons" role="group" aria-label="Target panorama scene">
            {TRANSITION_SCENES.map((scene) => (
              <button
                className={activeSceneId === scene.id ? "active" : ""}
                key={scene.id}
                onClick={() => setActiveSceneId(scene.id)}
                type="button"
              >
                {scene.id}
              </button>
            ))}
          </div>
          <label>
            Blend
            <select
              onChange={(event) => setPreset(event.currentTarget.value as SceneTransitionPreset)}
              value={preset}
            >
              {TRANSITION_PRESETS.map((entry) => (
                <option key={entry.value} value={entry.value}>{entry.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="transition-viewer">
          <PanoViewer
            aria-label="Panorama scene transition demo"
            controls={{ keyboard: false }}
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
      <footer>
        <span>@ericchen1990/pano-view · panorama scene transitions</span>
        <span>Stage 6 of 6</span>
      </footer>
    </main>
  );
}
