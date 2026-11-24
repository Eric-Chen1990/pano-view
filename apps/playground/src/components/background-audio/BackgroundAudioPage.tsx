import { message, type LocalizedMessage } from "../../i18n/locale";
import { usePlaygroundLanguage } from "../../i18n/language";
import { useState } from "react";
import { BackgroundAudio, PanoViewer, Scenes } from "@ericchen1990/pano-view";
import { CUBE_SCENES, INITIAL_CUBE_SCENE_ID } from "../../constants";
import { cn } from "../../cn";
import {
  controlLabelClassName,
  pageControlsClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
} from "../../ui";
import { ExamplePage } from "../ExamplePage";
import { ExampleCode } from "../ExampleCode";

const sharedSource = "/fixtures/bgm/ambient-light.mp3";
const sources = {
  "tile-1": sharedSource,
  "tile-2": "/fixtures/bgm/death-scene.mp3",
  "tile-3": "/fixtures/bgm/building-scene.mp3",
  "tile-4": "/fixtures/bgm/motorcycle-scene.mp3",
} satisfies Record<(typeof CUBE_SCENES)[number]["id"], string>;

export function BackgroundAudioPage() {
  const { t } = usePlaygroundLanguage();
  const [sceneId, setSceneId] = useState<string>(INITIAL_CUBE_SCENE_ID);
  const [mode, setMode] = useState<"shared" | "per-scene">("shared");
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<LocalizedMessage>(
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

const scenes = ${JSON.stringify(CUBE_SCENES, null, 2)} satisfies readonly Scene[];
${mode === "per-scene" ? `const sources = ${JSON.stringify(sources, null, 2)};\n` : ""}
export function AudioTour() {
  const [sceneId, setSceneId] = useState(${JSON.stringify(sceneId)});
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
      eyebrow={t("Media")}
      title={t("Background audio")}
      description={t("Mount BackgroundAudio beside Scenes. A shared track continues across navigation; per-scene sources change the soundtrack as scenes change. Playback starts only after you press Play.")}
    >
      <div className={pageControlsClassName}>
        <div className={controlLabelClassName}>{t("Audio mode")}<div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t("Audio mode")}
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
                {value === "shared" ? t("Shared track") : t("Per-scene tracks")}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={segmentedButtonClassName}
          aria-pressed={playing}
          onClick={() => {
            setError(undefined);
            setPlaying((value) => !value);
          }}
        >
          {playing ? t("Pause") : t("Play")}
        </button>
      </div>
      <div className={pageControlsClassName}>
        <div className={controlLabelClassName}>{t("Scene")}<div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t("Audio tour scenes")}
          >
            {CUBE_SCENES.map((scene) => (
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
        </div>
      </div>
      <p role={error ? "alert" : "status"} className="px-6 text-sm">
        {t(error ?? status)}
      </p>
      <PanoViewer aria-label={t("Background audio viewer")} style={{ height: 540 }}>
        <BackgroundAudio
          src={mode === "shared" ? sharedSource : undefined}
          sources={mode === "per-scene" ? sources : undefined}
          sceneId={mode === "per-scene" ? sceneId : undefined}
          playing={playing}
          onPlaybackStateChange={(state) => {
            setStatus(message("Audio: {state}", { state }));
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
          scenes={CUBE_SCENES}
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
      <ExampleCode
        react={{
          label: "BackgroundAudio + Scenes",
          blurb: t("The selected soundtrack configuration and play/pause state are separate from scene loading. This example logs the playback callbacks; the demo displays their status above."),
          code: code,
        }}
      />
    </ExamplePage>
  );
}
