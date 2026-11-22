import { ImageHotspot, PanoViewer, Scenes, VideoHotspot, type PanoViewerHandle } from "@ericchen1990/pano-view";
import { ChromaKeyColorSampler } from "@ericchen1990/pano-view/ui";
import { useRef, useState } from "react";
import { DEFAULT_CHROMA_KEY, isChromaKeyColor } from "../../../../../shared/chroma-key";
import { controlInputClassName, controlLabelClassName, segmentedButtonClassName } from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { ExamplePage } from "../ExamplePage";

const media = {
  image: { label: "Green-screen image", src: "/fixtures/chroma-key-v1/robot-green.png", color: "#00B140" },
  video: { label: "Blue-screen video", src: "/fixtures/chroma-key-v1/robot-blue.mp4", color: "#1853E6" },
} as const;
const position = { yaw: 0, pitch: 0 };
const scenes = [{ id: "chroma-key", type: "sphere", src: "/fixtures/panorama/panos/1/sphere.webp", previewUrl: "preview.webp" }] as const;
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75cbd3]";
const button = `${segmentedButtonClassName} ${focus}`;

export function ChromaKeyPage() {
  const viewer = useRef<PanoViewerHandle>(null);
  const [kind, setKind] = useState<keyof typeof media>("image");
  const [enabled, setEnabled] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [sampler, setSampler] = useState(false);
  const [hex, setHex] = useState<string>();
  const [language, setLanguage] = useState<"tsx" | "json">("tsx");
  const [renderer, setRenderer] = useState<"auto" | "webgl">("auto");
  const [backend, setBackend] = useState<string>();
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<typeof DEFAULT_CHROMA_KEY>({ ...DEFAULT_CHROMA_KEY });
  const source = media[kind];
  const json = JSON.stringify(enabled ? { chromaKey: settings } : {}, null, 2);
  const component = kind === "image" ? "ImageHotspot" : "VideoHotspot";
  const code = language === "json" ? json : `<${component}
  id="robot"
  src="${source.src}"
  position={{ yaw: 0, pitch: 0 }}
  width={42}
  height={42}${kind === "video" ? "\n  playing\n  loop\n  muted" : ""}${enabled ? `\n  chromaKey={{ color: "${settings.color}", threshold: ${settings.threshold}, smoothing: ${settings.smoothing} }}` : ""}
 />`;

  function setColor(color: string) {
    setSettings(current => ({ ...current, color }));
  }

  return (
    <ExamplePage title="Chroma key" description="Remove a solid color from an image or video hotspot and blend the subject into a panorama.">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_20rem]">
        <PanoViewer
          key={renderer} ref={viewer} renderer={renderer} aria-label="Chroma key panorama"
          style={{ height: "clamp(320px, 62dvh, 600px)" }} initialView={{ ...position, fov: 62 }}
        >
          <Scenes scenes={scenes} onSceneReady={() => setBackend(viewer.current?.getRendererBackend() ?? undefined)} />
          {kind === "image" ? (
            <ImageHotspot id="robot" src={source.src} position={position} width={42} height={42}
              chromaKey={enabled ? settings : undefined} interactive={false} onError={() => setError("Could not load the image.")} />
          ) : (
            <VideoHotspot id="robot" src={source.src} poster="/fixtures/chroma-key-v1/robot-blue.png"
              position={position} width={42} height={42} interactive={false}
              chromaKey={enabled ? settings : undefined} playing={playing} muted loop
              onError={() => setError("Could not load the video.")}
              onPlaybackError={() => { setPlaying(false); setError("Press Play video to start playback."); }} />
          )}
        </PanoViewer>
        <div className="grid content-start gap-4 border-t border-[#244047] p-5 lg:border-t-0 lg:border-l">
          <label className={controlLabelClassName}>
            Source
            <select value={kind} className={`${controlInputClassName} ${focus}`}
              onChange={event => {
                const next = event.currentTarget.value as keyof typeof media;
                setKind(next);
                setSettings({ ...DEFAULT_CHROMA_KEY, color: media[next].color });
                setHex(undefined);
                setError("");
              }}>
              {Object.entries(media).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} aria-pressed={enabled} onClick={() => setEnabled(value => !value)}>
              Chroma key
            </button>
            {kind === "video" && (
              <button type="button" className={button} onClick={() => { setError(""); setPlaying(value => !value); }}>
                {playing ? "Pause video" : "Play video"}
              </button>
            )}
          </div>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
            <label className={controlLabelClassName}>
              Key color
              <input type="color" className={`h-9 w-14 ${focus}`} value={settings.color}
                onChange={event => { setHex(undefined); setColor(event.currentTarget.value.toUpperCase()); }} />
            </label>
            <label className={controlLabelClassName}>
              HEX
              <input type="text" className={`${controlInputClassName} ${focus}`}
                value={hex ?? settings.color} maxLength={7} spellCheck={false}
                aria-invalid={hex !== undefined && !isChromaKeyColor(hex)}
                onBlur={() => setHex(undefined)}
                onChange={event => {
                  const color = event.currentTarget.value;
                  setHex(color);
                  if (isChromaKeyColor(color)) setColor(color.toUpperCase());
                }} />
            </label>
          </div>
          {(["threshold", "smoothing"] as const).map(name => (
            <label key={name} className={controlLabelClassName}>
              <span className="flex justify-between">
                {name === "threshold" ? "Threshold" : "Edge smoothing"}
                <span aria-hidden="true">{settings[name].toFixed(2)}</span>
              </span>
              <input type="range" className={focus} min={0} max={1} step={0.01} value={settings[name]}
                onChange={event => {
                  const value = event.currentTarget.valueAsNumber;
                  setSettings(current => ({ ...current, [name]: value }));
                }} />
            </label>
          ))}
          <button type="button" className={button} aria-expanded={sampler} onClick={() => setSampler(value => !value)}>
            {sampler ? "Close color sampler" : "Sample from source"}
          </button>
          {sampler && <ChromaKeyColorSampler kind={kind} src={source.src} className="grid gap-3 text-sm [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-white"
            onPick={color => { setHex(undefined); setColor(color); }} />}
          {error && <p role="status" className="text-sm">{error}</p>}
          <label className={controlLabelClassName}>
            Renderer
            <select value={renderer} className={`${controlInputClassName} ${focus}`}
              onChange={event => {
                setBackend(undefined);
                setRenderer(event.currentTarget.value === "webgl" ? "webgl" : "auto");
              }}>
              <option value="auto">Auto</option>
              <option value="webgl">WebGL</option>
            </select>
          </label>
          {backend && <output aria-label="Active renderer" className={controlLabelClassName}>{backend}</output>}
        </div>
      </div>
      <div className="grid gap-3 border-t border-[#244047] p-5">
        <div className="flex gap-2">
          <button type="button" className={button} aria-pressed={language === "tsx"} onClick={() => setLanguage("tsx")}>React JSX</button>
          <button type="button" className={button} aria-pressed={language === "json"} onClick={() => setLanguage("json")}>Project JSON</button>
        </div>
        <CodeSnippet code={code} label={language === "json" ? "Hotspot settings" : component} language={language}
          blurb={language === "json" ? "Apply these settings to an image or video hotspot in project.json." : "Use these props on a hotspot inside PanoViewer."} />
      </div>
    </ExamplePage>
  );
}
