import { useState } from "react";
import { BackgroundAudio, PanoViewer, Scenes } from "@ericchen1990/pano-view";
import { TRANSITION_SCENES } from "../../constants";
import { cn } from "../../cn";
import {
  pageControlsClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
} from "../../ui";
import { ExamplePage } from "../ExamplePage";
import { CodeSnippet } from "../CodeSnippet";

const sharedSource = "/fixtures/bgm/ambient-light.mp3";
const sources = {
  "sphere-1": sharedSource,
  "sphere-2": "/fixtures/bgm/death-scene.mp3",
  "tile-3": "/fixtures/bgm/building-scene.mp3",
  "tile-4": "/fixtures/bgm/motorcycle-scene.mp3",
};

export function BackgroundAudioPage() {
  const [sceneId, setSceneId] = useState("sphere-1");
  const [mode, setMode] = useState<"shared" | "per-scene">("shared");
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState(
    "Paused. Press Play to start audio, then switch scenes.",
  );
  const [error, setError] = useState<string>();
  const audioProps =
    mode === "shared"
      ? `src=${JSON.stringify(sharedSource)}`
      : `sceneId={sceneId} sources={sources}`;
  const code = `import { useState } from "react";
import { BackgroundAudio, PanoViewer, Scenes, type Scene } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const scenes = ${JSON.stringify(TRANSITION_SCENES, null, 2)} satisfies readonly Scene[];
${mode === "per-scene" ? `const sources = ${JSON.stringify(sources, null, 2)};\n` : ""}
export function AudioTour() {
  const [sceneId, setSceneId] = useState("sphere-1");
  const [playing, setPlaying] = useState(false);
  return <>
    <button onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button>
    {scenes.map((scene) => <button key={scene.id} onClick={() => setSceneId(scene.id)}>{scene.id}</button>)}
    <PanoViewer style={{ height: 540 }}>
      <BackgroundAudio ${audioProps} playing={playing} onPlaybackStateChange={console.log} onPlaybackError={console.error} />
      <Scenes scenes={scenes} activeSceneId={sceneId} onActiveSceneIdChange={setSceneId} transition="dissolve" />
    </PanoViewer>
  </>;
}`;
  return (
    <ExamplePage
      title="Background audio"
      description="Mount BackgroundAudio beside Scenes. A shared track continues across navigation; per-scene sources change the soundtrack as scenes change. Playback starts only after you press Play."
    >
      <div
        className={pageControlsClassName}
        role="group"
        aria-label="Audio mode"
      >
        {(["shared", "per-scene"] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={mode === value}
            className={cn(
              segmentedButtonClassName,
              mode === value && segmentedButtonActiveClassName,
            )}
            onClick={() => {
              setMode(value);
              setError(undefined);
            }}
          >
            {value === "shared" ? "Shared track" : "Per-scene tracks"}
          </button>
        ))}
        <button
          type="button"
          className={segmentedButtonClassName}
          aria-pressed={playing}
          onClick={() => {
            setError(undefined);
            setPlaying((value) => !value);
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>
      </div>
      <div
        className={pageControlsClassName}
        role="group"
        aria-label="Audio tour scenes"
      >
        {TRANSITION_SCENES.map((scene) => (
          <button
            type="button"
            key={scene.id}
            aria-pressed={sceneId === scene.id}
            className={cn(
              segmentedButtonClassName,
              sceneId === scene.id && segmentedButtonActiveClassName,
            )}
            onClick={() => setSceneId(scene.id)}
          >
            {scene.id}
          </button>
        ))}
      </div>
      <p role={error ? "alert" : "status"} className="px-6 text-sm">
        {error ?? status}
      </p>
      <p className="px-6 text-sm text-muted-2">
        Track:{" "}
        {mode === "shared"
          ? sharedSource
          : sources[sceneId as keyof typeof sources]}
      </p>
      <PanoViewer aria-label="Background audio viewer" style={{ height: 540 }}>
        <BackgroundAudio
          src={mode === "shared" ? sharedSource : undefined}
          sources={mode === "per-scene" ? sources : undefined}
          sceneId={mode === "per-scene" ? sceneId : undefined}
          playing={playing}
          onPlaybackStateChange={(state) => {
            setStatus(`Audio: ${state}`);
            if (state === "blocked") setPlaying(false);
          }}
          onPlaybackError={() => {
            setPlaying(false);
            setError("Playback failed. Press Play to retry.");
          }}
          onError={() => {
            setPlaying(false);
            setError(
              "Audio could not load. Check the resource and press Play to retry.",
            );
          }}
        />
        <Scenes
          scenes={TRANSITION_SCENES}
          activeSceneId={sceneId}
          onActiveSceneIdChange={setSceneId}
          transition="dissolve"
          onTransitionError={() =>
            setError(
              "The next scene could not load; the current scene remains visible.",
            )
          }
        />
      </PanoViewer>
      <CodeSnippet
        label="BackgroundAudio + Scenes"
        blurb="The selected soundtrack configuration and play/pause state are separate from scene loading. This example logs the playback callbacks; the demo displays their status above."
        code={code}
      />
    </ExamplePage>
  );
}
