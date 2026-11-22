import fullSource from "./BasicsPage.tsx?raw";
import { useEffect, useState } from "react";
import {
  PanoViewer,
  Sphere,
  Tile,
  usePanoViewer,
  type PanoLittlePlanetIntroOptions,
  type TileLoadProgress,
} from "@ericchen1990/pano-view";
import { cn } from "../../cn";
import {
  controlInputClassName,
  controlLabelClassName,
  pageControlsClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { ExampleCode } from "../ExampleCode";
import { ExamplePage } from "../ExamplePage";

const sphere = {
  src: "/fixtures/panorama/panos/1/sphere.webp",
  previewUrl: "preview.webp",
};
const tile = {
  baseUrl: "/fixtures/panorama/cube-tiles/4",
  multires: "512,1000,2000",
  urlTemplate: "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
  previewUrl: "previews/cube-vertical.webp",
};

const defaultIntro: Required<PanoLittlePlanetIntroOptions> = {
  holdDuration: 500,
  duration: 3000,
  easing: "easeOutQuad",
  yawRotation: 180,
  startPitch: -90,
  planetScale: 1,
};
const introFields = [
  { key: "holdDuration", label: "Hold", unit: " ms", min: 0, max: 5000, step: 50 },
  { key: "duration", label: "Duration", unit: " ms", min: 0, max: 10000, step: 50 },
  { key: "yawRotation", label: "Yaw rotation", unit: "°", min: -360, max: 360, step: 1 },
  { key: "startPitch", label: "Start pitch", unit: "°", min: -90, max: 90, step: 1 },
  { key: "planetScale", label: "Planet size", unit: "×", min: 0.5, max: 2, step: 0.05 },
] as const;
const introEasings = {
  easeOutQuad: "Ease out",
  easeInOutCubic: "Ease in and out",
  linear: "Linear",
} as const;

function SourceExample({ source, renderer, intro }: {
  source: "sphere" | "tile";
  renderer: "auto" | "webgl";
  intro: false | PanoLittlePlanetIntroOptions;
}) {
  const viewer = usePanoViewer();
  const [displayed, setDisplayed] = useState(source);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<TileLoadProgress>();
  const [level, setLevel] = useState(1);
  useEffect(() => setError(undefined), [source]);

  return (
    <>
      {error ? (
        <p className="px-6 text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <PanoViewer ref={viewer.ref} renderer={renderer} littlePlanetIntro={intro} aria-label="Panorama basics viewer" style={{ height: 540 }}>
        {source === "sphere" || displayed === "sphere" ? (
          <Sphere
            {...sphere}
            visible={displayed === "sphere"}
            onReady={() => {
              if (source === "sphere") setDisplayed("sphere");
            }}
            onError={() =>
              source === "sphere" && setError("Full image could not load. Reload to retry.")
            }
          />
        ) : null}
        {source === "tile" || displayed === "tile" ? (
          <Tile
            {...tile}
            visible={displayed === "tile"}
            loadMode={displayed === "tile" ? "full" : "base"}
            onReady={() => {
              if (source === "tile") setDisplayed("tile");
            }}
            onPreviewError={() =>
              source === "tile" && setError("Preview could not load. Reload to retry.")
            }
            onTileError={() =>
              source === "tile" && setError(
                "Some tiles could not load; the preview remains available.",
              )
            }
            onLoadProgress={setProgress}
            onLevelChange={setLevel}
          />
        ) : null}
      </PanoViewer>
      {source === "tile" ? (
        <p className="px-6 text-sm" aria-live="polite">
          Level {level} · tiles {progress?.loaded ?? 0}/
          {progress?.requested ?? 0} · failed {progress?.failed ?? 0}. Counts
          change as you look around and zoom.
        </p>
      ) : null}
    </>
  );
}

export function BasicsPage() {
  const [source, setSource] = useState<"sphere" | "tile">("sphere");
  const [renderer, setRenderer] = useState<"auto" | "webgl">("auto");
  const [intro, setIntro] = useState(defaultIntro);
  const [playback, setPlayback] = useState<{ key: number; options: false | PanoLittlePlanetIntroOptions }>(
    { key: 0, options: false },
  );
  const introEnabled = playback.options !== false;
  const replayIntro = () => setPlayback((current) => ({ key: current.key + 1, options: intro }));
  const props = source === "sphere" ? sphere : tile;
  const component = source === "sphere" ? "Sphere" : "Tile";
  const introCode = introEnabled
    ? ` littlePlanetIntro={{\n${Object.entries(intro).map(([key, value]) => `  ${key}: ${JSON.stringify(value)},`).join("\n")}\n}}`
    : "";
  const sourceProps = Object.entries(props)
    .map(([key, value]) => `        ${key}=${JSON.stringify(value)}`)
    .join("\n");
  const code = `import { PanoViewer, ${component} } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function Panorama() {
  return (
    <PanoViewer renderer="${renderer}"${introCode} style={{ height: 540 }}>
      <${component}
${sourceProps}
      />
    </PanoViewer>
  );
}`;
  return (
    <ExamplePage
      title="Panorama basics"
      description="Start with one panorama source. Compare a 2:1 image with multiresolution cube tiles, then inspect the required resource paths and loading state."
    >
      <div
        className={pageControlsClassName}
        role="group"
        aria-label="Panorama source"
      >
        {(["sphere", "tile"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={source === value}
            className={cn(
              segmentedButtonClassName,
              source === value && segmentedButtonActiveClassName,
            )}
            onClick={() => setSource(value)}
          >
            {value === "sphere" ? "Sphere" : "Cube tiles"}
          </button>
        ))}
      </div>
      <div className={pageControlsClassName} role="group" aria-label="Renderer preference">
        {(["auto", "webgl"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={renderer === value}
            className={cn(segmentedButtonClassName, renderer === value && segmentedButtonActiveClassName)}
            onClick={() => setRenderer(value)}
          >
            {value === "auto" ? "Auto" : "WebGL"}
          </button>
        ))}
      </div>
      <fieldset className={cn(pageControlsClassName, "min-w-0")}>
        <legend className="px-6 text-sm">Little Planet Intro</legend>
        <label className="inline-flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={introEnabled}
            className="size-4 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2"
            onChange={(event) => {
              if (event.currentTarget.checked) replayIntro();
              else setPlayback((current) => ({ ...current, options: false }));
            }}
          />
          Enable intro
        </label>
        {introEnabled && (
          <div className="flex w-full flex-wrap items-end gap-4">
            {introFields.map(({ key, label, unit, min, max, step }) => (
              <label className={cn(controlLabelClassName, "w-32 max-w-full")} key={key}>
                <span>{label} <span className="font-mono normal-case">{intro[key]}{unit}</span></span>
                <input
                  type="range"
                  aria-label={label}
                  min={min}
                  max={max}
                  step={step}
                  value={intro[key]}
                  className="h-7 w-full accent-brand focus-visible:outline-2 focus-visible:outline-offset-2"
                  onChange={(event) => {
                    const value = event.currentTarget.valueAsNumber;
                    setIntro((current) => ({ ...current, [key]: value }));
                  }}
                />
              </label>
            ))}
            <label className={controlLabelClassName}>
              Easing
              <select
                aria-label="Easing"
                value={intro.easing}
                className={cn(controlInputClassName, "focus-visible:outline-2 focus-visible:outline-offset-2")}
                onChange={(event) => {
                  const easing = event.currentTarget.value as keyof typeof introEasings;
                  setIntro((current) => ({ ...current, easing }));
                }}
              >
                {Object.entries(introEasings).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <button type="button" className={segmentedButtonClassName} onClick={replayIntro}>Replay intro</button>
          </div>
        )}
      </fieldset>
      <SourceExample key={`${renderer}:${playback.key}`} source={source} renderer={renderer} intro={playback.options} />
      <p className="px-6 text-sm text-muted-2">
        Sphere previews resolve beside the image. Tile previews and tile
        templates resolve below baseUrl. Use the template and multires values
        matching your converted files.
      </p>
      <ExampleCode
        key={source}
        json={{ format: "viewer", files: source === "tile" ? [{
          label: "viewer.json",
          blurb: "Keep this file beside the tile folders. Pass its URL to loadSceneFromJson and give the returned scene to Scenes.",
          url: `${tile.baseUrl}/viewer.json`,
        }] : [] }}
        react={{
          label: `${component}: minimal setup`,
          blurb: "The demo reports load failures and, for cube tiles, the current level and tile counts. These callbacks observe loading without changing the source configuration.",
          code: code,
        }}
      />
      <details className="border-t border-line p-5">
        <summary>Complete running example</summary>
        <CodeSnippet
          label="Panorama basics page"
          blurb="Full page implementation, including the displayed controls, error status and example code generation."
          code={fullSource}
        />
      </details>
    </ExamplePage>
  );
}
