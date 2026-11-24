import { usePanoUiTranslation } from "./ui-translation";
import { useContext, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { PanoOverlayOutletContext } from "./overlay/pano-overlay";
import { IDLE_SCENE_LOAD_PROGRESS, SceneLoadProgressContext, type SceneLoadProgress } from "./scene-load-progress";
import { cn } from "./cn";

export type PanoSceneLoadProgressVariant = "bar" | "ring" | "spinner" | "dots" | "wave" | "pulse";

export type PanoSceneLoadProgressAppearance = {
  background?: string;
  color?: string;
  accentColor?: string;
  trackColor?: string;
  /** Panel width in CSS pixels. The panel stays within the viewer. */
  width?: number;
  /** Thickness of the horizontal bar in CSS pixels. */
  barHeight?: number;
  /** Width of the circular or animated indicator in CSS pixels. */
  indicatorSize?: number;
  fontFamily?: string;
};

const DEFAULT_SHOW_DELAY_MS = 300;

export type PanoSceneLoadProgressProps = {
  /** Visible label and accessible name. Defaults to "Loading...". */
  label?: string;
  /** Defaults to "bar". */
  variant?: PanoSceneLoadProgressVariant;
  /** Show the measured percentage when available. Defaults to true. */
  showPercentage?: boolean;
  /** Wait before showing viewer progress. Defaults to 300 ms. Set to 0 to show immediately. */
  showDelayMs?: number;
  /** Supply progress from another source. The caller controls when it appears. */
  progress?: SceneLoadProgress;
  appearance?: PanoSceneLoadProgressAppearance;
  /** Replaces the built-in indicator inside the panel. Called while the indicator is visible. */
  renderIndicator?: (progress: LoadingProgress) => ReactNode;
  className?: string;
  style?: CSSProperties;
};

type LoadingProgress = Extract<SceneLoadProgress, { status: "loading" }>;
type PanelProps = Omit<PanoSceneLoadProgressProps, "progress" | "showDelayMs">;

const getIdle = () => IDLE_SCENE_LOAD_PROGRESS;
const subscribeIdle = () => () => {};

function BuiltInIndicator({
  variant,
  percent,
}: {
  variant: PanoSceneLoadProgressVariant;
  percent: number | null;
}) {
  switch (variant) {
    case "bar":
      return (
        <div className="pano-scene-load-progress__track">
          <div
            className="pano-scene-load-progress__fill"
            style={percent === null ? undefined : { width: `${percent}%` }}
          />
        </div>
      );
    case "ring":
    case "spinner":
    case "pulse":
      return <div className={`pano-scene-load-progress__${variant}`} />;
    case "dots":
    case "wave":
      return (
        <div className={`pano-scene-load-progress__${variant}`}>
          <span />
          <span />
          <span />
          {variant === "wave" && <><span /><span /></>}
        </div>
      );
  }
}

const pixels = (value?: number) => value === undefined ? undefined : `${value}px`;

/** Render inside PanoOverlay to show viewer progress or a caller-supplied snapshot. */
export function PanoSceneLoadProgress({
  progress,
  showDelayMs = DEFAULT_SHOW_DELAY_MS,
  ...panelProps
}: PanoSceneLoadProgressProps) {
  const inOverlay = useContext(PanoOverlayOutletContext);
  if (!inOverlay) return null;
  if (progress === undefined) {
    return <ViewerSceneLoadProgress showDelayMs={showDelayMs} {...panelProps} />;
  }
  return progress.status === "loading" ? <ProgressPanel progress={progress} {...panelProps} /> : null;
}

function ViewerSceneLoadProgress({
  showDelayMs,
  ...panelProps
}: PanelProps & { showDelayMs: number }) {
  const store = useContext(SceneLoadProgressContext);
  const progress = useSyncExternalStore(
    store?.subscribe ?? subscribeIdle,
    store?.getSnapshot ?? getIdle,
    getIdle,
  );
  const loadingAttempt = store?.getLoadingAttempt() ?? null;
  const [shownAttempt, setShownAttempt] = useState<typeof loadingAttempt>(null);
  const delay = Number.isFinite(showDelayMs) ? Math.max(0, showDelayMs) : DEFAULT_SHOW_DELAY_MS;

  useEffect(() => {
    if (!loadingAttempt || loadingAttempt === shownAttempt) return;
    const show = () => {
      if (store?.getLoadingAttempt() === loadingAttempt) setShownAttempt(loadingAttempt);
    };
    const remaining = delay - (performance.now() - loadingAttempt.startedAt);
    if (remaining <= 0) {
      show();
      return;
    }
    const timer = setTimeout(show, remaining);
    return () => clearTimeout(timer);
  }, [delay, loadingAttempt, shownAttempt, store]);

  if (!loadingAttempt || progress.status !== "loading" ||
      (delay > 0 && shownAttempt !== loadingAttempt)) return null;

  return <ProgressPanel progress={progress} {...panelProps} />;
}

function ProgressPanel({
  progress,
  label: labelProp,
  variant = "bar",
  showPercentage = true,
  appearance,
  renderIndicator,
  className,
  style,
}: PanelProps & { progress: LoadingProgress }) {
  const t = usePanoUiTranslation();
  const label = labelProp ?? t("Loading...");
  const { percent } = progress;
  const panelStyle: CSSProperties & Record<`--pano-load-${string}`, string | undefined> = {
    "--pano-load-background": appearance?.background,
    "--pano-load-color": appearance?.color,
    "--pano-load-accent": appearance?.accentColor,
    "--pano-load-track": appearance?.trackColor,
    "--pano-load-width": pixels(appearance?.width),
    "--pano-load-bar-height": pixels(appearance?.barHeight),
    "--pano-load-indicator-size": pixels(appearance?.indicatorSize),
    "--pano-load-font-family": appearance?.fontFamily,
    "--pano-load-angle": percent === null ? undefined : `${percent * 3.6}deg`,
    ...style,
    pointerEvents: "none",
  };
  return (
    <div
      className={cn("pano-scene-load-progress", className)}
      data-variant={variant}
      data-indeterminate={percent === null ? "" : undefined}
      style={panelStyle}
    >
      <progress className="pano-sr-only" aria-label={label} max={100} value={percent ?? undefined} />
      <div className="pano-scene-load-progress__heading" aria-hidden="true">
        <span className="pano-scene-load-progress__label">{label}</span>
        {showPercentage && percent !== null && (
          <span className="pano-scene-load-progress__percent">{Math.floor(percent)}%</span>
        )}
      </div>
      <div className="pano-scene-load-progress__indicator" aria-hidden="true">
        {renderIndicator ? renderIndicator(progress) : <BuiltInIndicator variant={variant} percent={percent} />}
      </div>
    </div>
  );
}
