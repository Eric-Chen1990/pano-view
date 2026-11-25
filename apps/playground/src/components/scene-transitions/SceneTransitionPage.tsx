import { message, type LocalizedMessage } from "../../i18n/locale";
import { usePlaygroundLanguage } from "../../i18n/language";
import fullSource from "./SceneTransitionPage.tsx?raw";
import {
  ImageHotspot,
  Scenes,
  PanoOverlay,
  PanoSceneLoadProgress,
  PanoViewer,
  type PanoSceneLoadProgressAppearance,
  type PanoSceneLoadProgressVariant,
  type PanoViewerHandle,
  type SceneTransitionPreset,
} from "@ericchen1990/pano-view";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CUBE_SCENES, INITIAL_CUBE_SCENE_ID } from "../../constants";
import { cn } from "../../cn";
import {
  controlInputClassName,
  controlLabelClassName,
  pageControlsClassName,
  pageSectionClassName,
  playgroundViewerHeight,
  segmentedButtonActiveClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { BlendSelect } from "./BlendSelect";
import { CodeSnippet } from "../CodeSnippet";
import { ExampleCode } from "../ExampleCode";
import { PageHeading } from "../PageHeading";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const loadingIndicators = [
  { value: "bar", label: "Progress bar" },
  { value: "ring", label: "Progress ring" },
  { value: "spinner", label: "Spinner" },
  { value: "dots", label: "Bouncing dots" },
  { value: "wave", label: "Wave" },
  { value: "pulse", label: "Pulse" },
] satisfies { value: PanoSceneLoadProgressVariant; label: string }[];

function buildSceneTransitionSnippet(
  preset: SceneTransitionPreset,
  variant: PanoSceneLoadProgressVariant,
  showPercentage: boolean,
  label: string,
  appearance: PanoSceneLoadProgressAppearance,
  sceneId: string,
  renderer: "auto" | "webgl",
): string {
  return `import { useState } from "react";
import {
  PanoOverlay,
  PanoSceneLoadProgress,
  PanoViewer,
  Scenes,
  type Scene,
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const scenes: Scene[] = ${JSON.stringify(CUBE_SCENES, null, 2)};

export function SceneTransitions() {
  const [activeSceneId, setActiveSceneId] = useState("${sceneId}");

  return (
    <>
      {scenes.map(({ id }) => (
        <button key={id} type="button" onClick={() => setActiveSceneId(id)}>{id}</button>
      ))}
      <PanoViewer
        renderer="${renderer}"
        style={{ height: ${JSON.stringify(playgroundViewerHeight)} }}
      >
        <Scenes
          activeSceneId={activeSceneId}
          onActiveSceneIdChange={setActiveSceneId}
          scenes={scenes}
          transition="${preset}"
        />
        <PanoOverlay>
          <PanoSceneLoadProgress
            variant="${variant}"
            showPercentage={${showPercentage}}
            label={${JSON.stringify(label)}}
            appearance={{ accentColor: "${appearance.accentColor}", color: "${appearance.color}" }}
          />
        </PanoOverlay>
      </PanoViewer>
    </>
  );
}`;
}

const DEFAULT_LOADING_LABEL = "Loading...";
const PREVIEW_INDETERMINATE_MS = 600;
const PREVIEW_MEASURED_MS = 3400;

function LoadingIndicatorPreview({
  label,
  variant,
  showPercentage,
  appearance,
  onFinish,
}: {
  label: string;
  variant: PanoSceneLoadProgressVariant;
  showPercentage: boolean;
  appearance: PanoSceneLoadProgressAppearance;
  onFinish: () => void;
}) {
  const [percent, setPercent] = useState<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - start - PREVIEW_INDETERMINATE_MS;
      if (elapsed >= PREVIEW_MEASURED_MS) {
        window.clearInterval(timer);
        onFinish();
      } else if (elapsed >= 0) {
        setPercent(Math.floor((elapsed / PREVIEW_MEASURED_MS) * 100));
      }
    }, 60);
    return () => window.clearInterval(timer);
  }, [onFinish]);

  return (
    <PanoSceneLoadProgress
      label={label}
      progress={{ status: "loading", sceneId: null, percent }}
      variant={variant}
      showPercentage={showPercentage}
      appearance={appearance}
    />
  );
}

export function SceneTransitionPage() {
  const { t } = usePlaygroundLanguage();
  const [activeSceneId, setActiveSceneId] = useState<string>(INITIAL_CUBE_SCENE_ID);
  const [renderer, setRenderer] = useState<"auto" | "webgl">("auto");
  const [backend, setBackend] = useState("");
  const viewer = useRef<PanoViewerHandle>(null);
  const [indicator, setIndicator] = useState<PanoSceneLoadProgressVariant>("bar");
  const [showPercentage, setShowPercentage] = useState(true);
  const [accentColor, setAccentColor] = useState("#72f3d0");
  const [textColor, setTextColor] = useState("#f0fffc");
  const [loadingText, setLoadingText] = useState<string>();
  const defaultLoadingLabel = t(DEFAULT_LOADING_LABEL);
  const loadingLabel = loadingText?.trim() || defaultLoadingLabel;
  const [previewing, setPreviewing] = useState(false);
  const stopPreview = useCallback(() => setPreviewing(false), []);
  const selectScene = useCallback((id: string) => {
    stopPreview();
    setActiveSceneId(id);
  }, [stopPreview]);
  const appearance = useMemo(() => ({ accentColor, color: textColor }), [accentColor, textColor]);
  const [preset, setPreset] = useState<SceneTransitionPreset>("dissolve");
  const [status, setStatus] = useState<LocalizedMessage>(
    "Choose a scene to compare transition effects.",
  );
  const snippet = useMemo(
    () => buildSceneTransitionSnippet(preset, indicator, showPercentage, loadingLabel, appearance, activeSceneId, renderer),
    [preset, indicator, showPercentage, loadingLabel, appearance, activeSceneId, renderer],
  );

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section
        aria-labelledby="transition-bench-title"
        className={cn(pageSectionClassName, "mt-8")}
      >
        <PageHeading
          id="transition-bench-title"
          eyebrow={t("Scenes")}
          title={t("Blend between scenes")}
          description={t(status)}
        />
        <div className={pageControlsClassName}>
          <div className={controlLabelClassName}>{t("Scene")}<div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={t("Target panorama scene")}
            >
              {CUBE_SCENES.map((scene) => (
                <button
                  className={cn(
                    segmentedButtonClassName,
                    activeSceneId === scene.id && segmentedButtonActiveClassName,
                  )}
                  key={scene.id}
                  onClick={() => selectScene(scene.id)}
                  type="button"
                >
                  {scene.id}
                </button>
              ))}
            </div>
          </div>
          <div className={controlLabelClassName}>{t("Blend")}<BlendSelect onChange={setPreset} value={preset} />
          </div>
          <label className={controlLabelClassName}>{t("Renderer")}<select value={renderer} onChange={({ currentTarget }) => {
              stopPreview();
              setBackend("");
              setRenderer(currentTarget.value === "webgl" ? "webgl" : "auto");
            }}>
              <option value="auto">{t("Auto")}</option>
              <option value="webgl">WebGL</option>
            </select>
          </label>
          {backend ? <output className={controlLabelClassName} aria-label={t("Active renderer")}>{backend}</output> : null}
        </div>
        <div className={pageControlsClassName} role="group" aria-label={t("Loading indicator settings")}>
          <label className={controlLabelClassName}>{t("Loading indicator")}<select value={indicator} onChange={({ currentTarget }) => {
              const selected = loadingIndicators.find(({ value }) => value === currentTarget.value);
              if (selected) setIndicator(selected.value);
            }}>
              {loadingIndicators.map(({ value, label }) => <option key={value} value={value}>{t(label)}</option>)}
            </select>
          </label>
          <label className={controlLabelClassName}>
            <input
              type="checkbox"
              checked={showPercentage}
              onChange={({ currentTarget }) => setShowPercentage(currentTarget.checked)}
            />{t("Show percentage")}</label>
          <label className={controlLabelClassName}>{t("Indicator color")}<input type="color" value={accentColor} onChange={({ currentTarget }) => setAccentColor(currentTarget.value)} />
          </label>
          <label className={controlLabelClassName}>{t("Loading label color")}<input type="color" value={textColor} onChange={({ currentTarget }) => setTextColor(currentTarget.value)} />
          </label>
          <label className={controlLabelClassName}>{t("Loading text")}<input
              className={cn(controlInputClassName, "w-36 focus-visible:outline-2 focus-visible:outline-brand")}
              type="text"
              value={loadingText ?? defaultLoadingLabel}
              onChange={({ currentTarget }) => setLoadingText(currentTarget.value)}
            />
          </label>
          <button
            type="button"
            className={cn(segmentedButtonClassName, previewing && segmentedButtonActiveClassName)}
            onClick={() => setPreviewing((current) => !current)}
          >
            {previewing ? t("Stop simulation") : t("Simulate loading")}
          </button>
        </div>
        <div className="bg-[#020607] p-0">
          <PanoViewer
            key={renderer}
            ref={viewer}
            renderer={renderer}
            aria-label={t("Panorama scene transition demo")}
            style={{ height: playgroundViewerHeight }}
          >
            <Scenes
              activeSceneId={activeSceneId}
              onActiveSceneIdChange={selectScene}
              maxConcurrentTileLoads={3}
              maxTextureMemoryMb={96}
              scenes={CUBE_SCENES}
              transition={preset}
              onSceneReady={() => setBackend(viewer.current?.getRendererBackend() ?? "")}
              onTransitionEnd={({
                previousSceneId,
                sceneId,
                preset: completedPreset,
              }) => {
                setStatus(
                  `${previousSceneId} → ${sceneId} · ${completedPreset}`,
                );
              }}
              onTransitionError={({ sceneId }) => {
                setStatus(
                  message("Could not prepare {scene}; current scene remains visible.", { scene: sceneId }),
                );
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
            <PanoOverlay>
              {previewing ? (
                <LoadingIndicatorPreview
                  label={loadingLabel}
                  variant={indicator}
                  showPercentage={showPercentage}
                  appearance={appearance}
                  onFinish={stopPreview}
                />
              ) : (
                <PanoSceneLoadProgress
                  label={loadingLabel}
                  variant={indicator}
                  showPercentage={showPercentage}
                  appearance={appearance}
                />
              )}
            </PanoOverlay>
          </PanoViewer>
        </div>
        <ExampleCode
          react={{
            blurb: t("Switch scenes to compare transitions, or simulate loading to preview the selected indicator, colors, and loading text."),
            code: snippet,
            label: t("Scenes: transition presets"),
          }}
        />
        <details className="border-t border-line p-5">
          <summary>{t("Complete running example")}</summary>
          <CodeSnippet
            label={t("Scene transitions page")}
            blurb={t("Full page implementation, including the displayed controls, loading/error status and example code generation.")}
            code={fullSource}
          />
        </details>
      </section>
      <SiteFooter label="@ericchen1990/pano-view · panorama scene transitions" />
    </main>
  );
}
