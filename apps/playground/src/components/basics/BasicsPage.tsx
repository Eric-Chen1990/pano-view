import { usePlaygroundLanguage } from "../../i18n/language";
import fullSource from "./BasicsPage.tsx?raw";
import { useEffect, useState } from "react";
import {
  PanoViewer,
  Sphere,
  SphereTile,
  Tile,
  usePanoViewer,
  type PanoLittlePlanetIntroOptions,
  type TileLoadProgress,
  type SphereTileProps,
} from "@ericchen1990/pano-view";
import { cubeTileProps } from "../../constants";
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
const tile = cubeTileProps(4);
const sphereTile = {
  baseUrl: "/fixtures/panorama/sphere-tiles-v2",
  multires: "512,512x256,2048x1024,4096x2048,8000x4000",
  previewUrl: "previews/400.webp",
  urlTemplate: "tiles/%l/%h_%v.webp",
  indexBase: 1,
} satisfies SphereTileProps;

const sources = {
  tile: { label: "Cube tiles", component: "Tile", props: tile },
  sphere: { label: "Single image", component: "Sphere", props: sphere },
  sphereTile: { label: "Sphere tiles", component: "SphereTile", props: sphereTile },
} as const;
const sourceOrder = ["tile", "sphere", "sphereTile"] as const;
type SourceKind = (typeof sourceOrder)[number];

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

function SourceExample({ source, renderer, frameloop, intro }: {
  source: SourceKind;
  renderer: "auto" | "webgl";
  frameloop: "always" | "demand";
  intro: false | PanoLittlePlanetIntroOptions;
}) {
  const { t } = usePlaygroundLanguage();
  const viewer = usePanoViewer();
  const [displayed, setDisplayed] = useState(source);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<TileLoadProgress>();
  const [level, setLevel] = useState(1);
  useEffect(() => setError(undefined), [source]);

  function tileLoading(kind: "tile" | "sphereTile") {
    return {
      visible: displayed === kind,
      loadMode: displayed === kind ? "full" as const : "base" as const,
      onReady: () => {
        if (source === kind) setDisplayed(kind);
      },
      onPreviewError: () => {
        if (source === kind) setError("Preview could not load. Reload to retry.");
      },
      onTileError: () => {
        if (source === kind) setError("Some tiles could not load; the preview remains available.");
      },
      onLoadProgress: setProgress,
      onLevelChange: setLevel,
    };
  }

  return (
    <>
      {error ? (
        <p className="px-6 text-sm" role="alert">
          {t(error)}
        </p>
      ) : null}
      <PanoViewer ref={viewer.ref} renderer={renderer} frameloop={frameloop} littlePlanetIntro={intro} aria-label={t("Panorama basics viewer")} style={{ height: 540 }}>
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
          <Tile {...tile} {...tileLoading("tile")} />
        ) : null}
        {source === "sphereTile" || displayed === "sphereTile" ? (
          <SphereTile {...sphereTile} {...tileLoading("sphereTile")} />
        ) : null}
      </PanoViewer>
      {source !== "sphere" ? (
        <p className="px-6 text-sm" aria-live="polite">{t("Level") + " "}{level}{" " + t("· tiles") + " "}{progress?.loaded ?? 0}/
          {progress?.requested ?? 0}{" " + t("· failed") + " "}{progress?.failed ?? 0}{t(". Counts change as you look around and zoom.")}</p>
      ) : null}
    </>
  );
}

export function BasicsPage() {
  const { t } = usePlaygroundLanguage();
  const [source, setSource] = useState<SourceKind>("tile");
  const [renderer, setRenderer] = useState<"auto" | "webgl">("auto");
  const [frameloop, setFrameloop] = useState<"always" | "demand">("always");
  const [intro, setIntro] = useState(defaultIntro);
  const [playback, setPlayback] = useState<{ key: number; options: false | PanoLittlePlanetIntroOptions }>(
    { key: 0, options: false },
  );
  const introEnabled = playback.options !== false;
  const replayIntro = () => setPlayback((current) => ({ key: current.key + 1, options: intro }));
  const { component, props } = sources[source];
  const viewerUrl = source === "sphere" ? undefined : `${sources[source].props.baseUrl}/viewer.json`;
  const introCode = introEnabled
    ? `      littlePlanetIntro={{
${Object.entries(intro).map(([key, value]) => `        ${key}: ${JSON.stringify(value)},`).join("\n")}
      }}\n`
    : "";
  const sourceProps = Object.entries(props)
    .map(([key, value]) => typeof value === "string"
      ? `        ${key}=${JSON.stringify(value)}`
      : `        ${key}={${JSON.stringify(value)}}`)
    .join("\n");
  const code = `import { PanoViewer, ${component} } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function Panorama() {
  return (
    <PanoViewer
      renderer="${renderer}"
      frameloop="${frameloop}"
${introCode}      style={{ height: 540 }}
    >
      <${component}
${sourceProps}
      />
    </PanoViewer>
  );
}`;
  return (
    <ExamplePage
      eyebrow={t("Start")}
      title={t("Panorama basics")}
      description={t("Start with one panorama source. Try multiresolution cube tiles, a single 2:1 image, and multiresolution spherical tiles. Inspect the resource paths and loading state for each source.")}
    >
      <div className={pageControlsClassName}>
        <div className={controlLabelClassName}>{t("Panorama source")}<div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t("Panorama source")}
          >
            {sourceOrder.map((value) => (
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
                {t(sources[value].label)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={pageControlsClassName}>
        <div className={controlLabelClassName}>{t("Renderer preference")}<div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t("Renderer preference")}
          >
            {(["auto", "webgl"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={renderer === value}
                className={cn(segmentedButtonClassName, renderer === value && segmentedButtonActiveClassName)}
                onClick={() => setRenderer(value)}
              >
                {value === "auto" ? t("Auto") : "WebGL"}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={pageControlsClassName}>
        <div className={controlLabelClassName}>{t("Render loop")}<div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t("Render loop")}
          >
            {(["always", "demand"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={frameloop === value}
                className={cn(segmentedButtonClassName, frameloop === value && segmentedButtonActiveClassName)}
                onClick={() => setFrameloop(value)}
              >
                {value === "always" ? t("Always render") : t("On demand")}
              </button>
            ))}
          </div>
        </div>
      </div>
      <fieldset className={cn(pageControlsClassName, "min-w-0")}>
        <legend className="px-6 text-sm">{t("Little Planet Intro")}</legend>
        <label className="inline-flex min-h-9 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={introEnabled}
            className="size-4 accent-brand focus-visible:outline-2 focus-visible:outline-offset-2"
            onChange={(event) => {
              if (event.currentTarget.checked) replayIntro();
              else setPlayback((current) => ({ ...current, options: false }));
            }}
          />{t("Enable intro")}</label>
        {introEnabled && (
          <div className="flex w-full flex-wrap items-end gap-4">
            {introFields.map(({ key, label, unit, min, max, step }) => (
              <label className={cn(controlLabelClassName, "w-32 max-w-full")} key={key}>
                <span>{t(label)} <span className="font-mono normal-case">{intro[key]}{unit}</span></span>
                <input
                  type="range"
                  aria-label={t(label)}
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
            <label className={controlLabelClassName}>{t("Easing")}<select
                aria-label={t("Easing")}
                value={intro.easing}
                className={cn(controlInputClassName, "focus-visible:outline-2 focus-visible:outline-offset-2")}
                onChange={(event) => {
                  const easing = event.currentTarget.value as keyof typeof introEasings;
                  setIntro((current) => ({ ...current, easing }));
                }}
              >
                {Object.entries(introEasings).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}
              </select>
            </label>
            <button type="button" className={segmentedButtonClassName} onClick={replayIntro}>{t("Replay intro")}</button>
          </div>
        )}
      </fieldset>
      <SourceExample key={`${renderer}:${frameloop}:${playback.key}`} source={source} renderer={renderer} frameloop={frameloop} intro={playback.options} />
      <p className="px-6 text-sm text-muted-2">{t("Single-image previews resolve beside the image. Cube and spherical tile previews and templates resolve below baseUrl. Use the template and multires values from your converted files.")}</p>
      <ExampleCode
        key={source}
        json={{ format: "viewer", files: viewerUrl ? [{
          label: "viewer.json",
          blurb: t("Keep this file beside the tile folders. Pass its URL to loadSceneFromJson and give the returned scene to Scenes."),
          url: viewerUrl,
        }] : [] }}
        react={{
          label: t("{component}: minimal setup", { component }),
          blurb: t("The demo reports load failures and, for tiled sources, the current level and tile counts. These callbacks observe loading without changing the source configuration."),
          code: code,
        }}
      />
      <details className="border-t border-line p-5">
        <summary>{t("Complete running example")}</summary>
        <CodeSnippet
          label={t("Panorama basics page")}
          blurb={t("Full page implementation, including the displayed controls, error status and example code generation.")}
          code={fullSource}
        />
      </details>
    </ExamplePage>
  );
}
