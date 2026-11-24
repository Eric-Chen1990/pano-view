import { PlaygroundVRViewer } from "../webvr/PlaygroundVRViewer";
import { message, type LocalizedMessage } from "../../i18n/locale";
import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileJsx, cubeTileProps } from "../../constants";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  AudioHotspot,
  Gyro,
  Tile,
  WebVR,
  usePanoViewer,
  type AudioPlaybackState,
  type GyroHandle,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view";
import { pageControlsClassName, segmentedButtonClassName } from "../../ui";
import { ExamplePage } from "../ExamplePage";
import { ExampleCode } from "../ExampleCode";

const panorama = cubeTileProps();

const sources = [
  {
    id: "fountain",
    name: "Fountain",
    src: "/fixtures/hotspots/fountain.mp3",
    position: { yaw: -35, pitch: -15 },
    soundDistance: 2,
  },
  {
    id: "music",
    name: "Music",
    src: "/fixtures/bgm/ambient-light.mp3",
    position: { yaw: 130, pitch: 25 },
    soundDistance: 3,
  },
] as const;

type SoundId = (typeof sources)[number]["id"];

const projectHotspots: ProjectHotspotDefinition[] = sources.map(({ name, ...source }) => ({
  ...source,
  type: "audio",
  label: name,
  tooltip: name,
  tooltipTrigger: "always",
  spatialAudio: true,
  loop: true,
  playing: false,
}));

const code = `import { useState } from "react";
import { AudioHotspot, PanoViewer, Tile, usePanoViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const sources = ${JSON.stringify(sources, null, 2)};

export function DirectionalSound() {
  const viewer = usePanoViewer();
  const [playing, setPlaying] = useState<Record<string, boolean>>({});

  return (
    <PanoViewer ref={viewer.ref} style={{ height: 540 }}>
      ${cubeTileJsx(panorama)}
      {sources.map(({ name, ...source }) => (
        <AudioHotspot
          key={source.id}
          {...source}
          ariaLabel={name}
          tooltip={name}
          tooltipTrigger="always"
          spatialAudio
          loop
          playing={playing[source.id] ?? false}
          onClick={() => {
            if (!playing[source.id]) void viewer.activateMedia().catch(console.error);
            setPlaying((current) => ({ ...current, [source.id]: !current[source.id] }));
          }}
        />
      ))}
    </PanoViewer>
  );
}`;

export function DirectionalSoundPage() {
  const { t } = usePlaygroundLanguage();
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(viewer.subscribeVR, viewer.getVRState, viewer.getVRState);
  const gyro = useRef<GyroHandle>(null);
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [playing, setPlaying] = useState<Partial<Record<SoundId, boolean>>>({});
  const [states, setStates] = useState<Partial<Record<SoundId, AudioPlaybackState>>>({});
  const [error, setError] = useState<LocalizedMessage>();

  function toggleSound(id: SoundId) {
    if (!playing[id]) void viewer.activateMedia().catch(() => {});
    setPlaying((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <ExamplePage
      eyebrow={t("Media")}
      title={t("Directional 3D Sound")}
      description={t("Select a sound marker to play or pause it. Use headphones and turn away from a playing sound to hear it fade. In a headset with positional tracking, step toward a source to hear it get louder.")}
    >
      <div className={pageControlsClassName}>
        {gyroAvailable && (
          <button
            type="button"
            className={segmentedButtonClassName}
            aria-pressed={gyroEnabled}
            onClick={() => {
              if (gyroEnabled) setGyroEnabled(false);
              else void gyro.current?.requestPermission().then(setGyroEnabled);
            }}
          >{t("Device motion")}</button>
        )}
        <button
          type="button"
          className={segmentedButtonClassName}
          disabled={!vr.available}
          onClick={() => {
            setError(undefined);
            if (vr.enabled) {
              void viewer.exitVR().catch(() => setError("VR could not exit."));
            } else {
              void viewer.enterVR().then((entered) => {
                if (!entered) setError("VR could not start.");
              }).catch(() => setError("VR could not start."));
            }
          }}
        >
          {vr.enabled ? t("Exit VR") : t("Enter VR")}
        </button>
        <span role="status" className="text-sm">
          {sources.map(({ id, name }) => `${name}: ${t(states[id] ?? "paused")}`).join(" · ")}
        </span>
      </div>
      {error && <p role="alert" className="px-6 text-sm">{t(error)}</p>}
      <PlaygroundVRViewer viewer={viewer} aria-label={t("Directional 3D Sound viewer")} style={{ height: 540 }}>
        <Tile {...panorama} />
        <Gyro
          ref={gyro}
          enabled={gyroEnabled && !vr.enabled}
          onAvailable={() => setGyroAvailable(true)}
          onUnavailable={() => setGyroAvailable(false)}
          onDenied={() => setError("Device motion permission was denied.")}
        />
        <WebVR />
        {sources.map(({ name, ...source }) => (
          <AudioHotspot
            key={source.id}
            {...source}
            ariaLabel={`${playing[source.id] ? "Pause" : "Play"} ${name.toLowerCase()} in panorama`}
            tooltip={name}
            tooltipTrigger="always"
            onClick={() => toggleSound(source.id)}
            spatialAudio
            playing={playing[source.id] ?? false}
            loop
            onPlaybackStateChange={(state) => setStates((current) => ({ ...current, [source.id]: state }))}
            onError={() => setError(message("Could not load {name}.", { name: name.toLowerCase() }))}
          />
        ))}
      </PlaygroundVRViewer>
      <ExampleCode
        react={{ label: "AudioHotspot", blurb: t("Click a marker to activate audio and toggle that source. soundDistance places the source along its yaw and pitch direction."), code }}
        json={{ format: "project", files: [{
          label: t("Directional audio hotspots"),
          blurb: t("Add these entries to the scene’s hotspots array in project.json. ProjectScenes toggles each source on marker click."),
          value: projectHotspots,
        }] }}
      />
    </ExamplePage>
  );
}
