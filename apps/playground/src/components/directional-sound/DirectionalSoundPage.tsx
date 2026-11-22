import { useRef, useState, useSyncExternalStore } from "react";
import {
  AudioHotspot,
  Gyro,
  PanoViewer,
  Sphere,
  WebVR,
  usePanoViewer,
  type AudioPlaybackState,
  type GyroHandle,
} from "@ericchen1990/pano-view";
import { pageControlsClassName, segmentedButtonClassName } from "../../ui";
import { ExamplePage } from "../ExamplePage";

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

export function DirectionalSoundPage() {
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(viewer.subscribeVR, viewer.getVRState, viewer.getVRState);
  const gyro = useRef<GyroHandle>(null);
  const [gyroAvailable, setGyroAvailable] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [playing, setPlaying] = useState<Partial<Record<SoundId, boolean>>>({});
  const [states, setStates] = useState<Partial<Record<SoundId, AudioPlaybackState>>>({});
  const [error, setError] = useState<string>();

  function toggleSound(id: SoundId) {
    if (!playing[id]) void viewer.activateMedia().catch(() => {});
    setPlaying((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <ExamplePage
      title="Directional 3D Sound"
      description="Select a sound marker to play or pause it. Use headphones and turn away from a playing sound to hear it fade. In a headset with positional tracking, step toward a source to hear it get louder."
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
          >
            Device motion
          </button>
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
          {vr.enabled ? "Exit VR" : "Enter VR"}
        </button>
        <span role="status" className="text-sm">
          {sources.map(({ id, name }) => `${name}: ${states[id] ?? "paused"}`).join(" · ")}
        </span>
      </div>
      {error && <p role="alert" className="px-6 text-sm">{error}</p>}
      <PanoViewer ref={viewer.ref} aria-label="Directional 3D Sound viewer" style={{ height: 540 }}>
        <Sphere src="/fixtures/panorama/panos/1/sphere.webp" previewUrl="preview.webp" />
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
            onError={() => setError(`Could not load ${name.toLowerCase()}.`)}
          />
        ))}
      </PanoViewer>
    </ExamplePage>
  );
}
