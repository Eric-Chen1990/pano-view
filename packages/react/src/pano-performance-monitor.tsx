import {
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { cn } from "./cn";
import {
  overlayBoxStyle,
  resolveOverlayAnchor,
  type PanoOverlayAnchor,
} from "./overlay/align";
import { PanoOverlayOutletContext } from "./overlay/pano-overlay";
import {
  DEFAULT_PERFORMANCE_UPDATE_MS,
  IDLE_PANO_PERFORMANCE,
  PERFORMANCE_IDLE_INTERVAL_MS,
  PanoPerformanceHostContext,
  type PanoPerformanceSnapshot,
} from "./performance/host";
import { usePanoUiTranslation } from "./ui-translation";

export type { PanoPerformanceSnapshot } from "./performance/host";

export type PanoPerformanceMonitorProps = {
  /** Screen-edge placement. Defaults to top-left with a 12px inset. */
  anchor?: PanoOverlayAnchor;
  /** Snapshot publish interval in milliseconds. Defaults to 500. */
  updateIntervalMs?: number;
  /** Show the recent frame-time graph. Defaults to true. */
  showGraph?: boolean;
  /** Show a control that collapses the panel to FPS, average frame time, and the graph. Defaults to true. */
  collapsible?: boolean;
  /** Uncontrolled expanded state when `collapsible` is true. Defaults to true. */
  defaultExpanded?: boolean;
  /** Controlled expanded state when `collapsible` is true. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_INSET = 8;
const PANEL_WIDTH = 196;
const COMPACT_WIDTH = 168;
const GRAPH_BARS = 56;
const GRAPH_HEIGHT = 32;
/** Visible window. Times outside it saturate so 60fps jitter stays readable. */
const GRAPH_FLOOR_MS = 8;
const GRAPH_CEIL_MS = 34;
/** 60fps budget. Taller bars are faster and rise above this line. */
const FRAME_BUDGET_MS = 1000 / 60;
const GOOD_FRAME_MS = 20;
const WARN_FRAME_MS = 34;

type FrameBand = "good" | "warn" | "bad" | "idle";

function formatNumber(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const compact = (scale: number, suffix: string) => {
    const scaled = value / scale;
    const digits = Math.abs(scaled) >= 100 ? 0 : 1;
    return `${scaled.toFixed(digits).replace(/\.0$/, "")}${suffix}`;
  };
  if (abs >= 1_000_000) return compact(1_000_000, "M");
  if (abs >= 10_000) return compact(1_000, "k");
  return String(Math.round(value));
}

function formatDpr(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (Number.isInteger(value)) return `${value}×`;
  return `${value.toFixed(2).replace(/0$/, "")}×`;
}

function frameBand(intervalMs: number): FrameBand {
  if (intervalMs > PERFORMANCE_IDLE_INTERVAL_MS) return "idle";
  if (intervalMs <= GOOD_FRAME_MS) return "good";
  if (intervalMs <= WARN_FRAME_MS) return "warn";
  return "bad";
}

function fpsHealth(snapshot: PanoPerformanceSnapshot): FrameBand {
  if (snapshot.fps === null || snapshot.frameloop !== "always") return "idle";
  if (snapshot.fps >= 50) return "good";
  if (snapshot.fps >= 30) return "warn";
  return "bad";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="pano-performance-monitor__metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function graphTop(intervalMs: number): number {
  const span = GRAPH_CEIL_MS - GRAPH_FLOOR_MS;
  const clamped = Math.min(Math.max(intervalMs, GRAPH_FLOOR_MS), GRAPH_CEIL_MS);
  return ((clamped - GRAPH_FLOOR_MS) / span) * GRAPH_HEIGHT;
}

function DetailChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
      <path
        d={expanded ? "M2.5 7.5 6 4.5 9.5 7.5" : "M2.5 4.5 6 7.5 9.5 4.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FrameGraph({ history, compact = false }: { history: readonly number[]; compact?: boolean }) {
  const samples = history.slice(-GRAPH_BARS);
  const offset = GRAPH_BARS - samples.length;
  const budgetY = graphTop(FRAME_BUDGET_MS);
  return (
    <svg
      className={cn(
        "pano-performance-monitor__graph",
        compact && "pano-performance-monitor__graph--compact",
      )}
      viewBox={`0 0 ${GRAPH_BARS} ${GRAPH_HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect className="pano-performance-monitor__graph-well" width={GRAPH_BARS} height={GRAPH_HEIGHT} />
      {samples.map((interval, index) => {
        const band = frameBand(interval);
        const y = band === "idle" ? GRAPH_HEIGHT - 1.5 : graphTop(interval);
        const height = Math.max(1.5, GRAPH_HEIGHT - y);
        return (
          <rect
            key={offset + index}
            data-band={band}
            x={offset + index + 0.18}
            y={GRAPH_HEIGHT - height}
            width={0.64}
            height={height}
          />
        );
      })}
      <line
        className="pano-performance-monitor__budget"
        x1="0"
        x2={GRAPH_BARS}
        y1={budgetY}
        y2={budgetY}
      />
    </svg>
  );
}

function formatBackend(backend: PanoPerformanceSnapshot["backend"], t: (message: string) => string) {
  switch (backend) {
    case "webgpu":
      return "WebGPU";
    case "webgl":
      return "WebGL";
    case null:
      return t("Pending");
    default: {
      const exhaustive: never = backend;
      return exhaustive;
    }
  }
}

/** Render inside PanoOverlay to show live viewer performance counters. */
export function PanoPerformanceMonitor({
  anchor,
  updateIntervalMs = DEFAULT_PERFORMANCE_UPDATE_MS,
  showGraph = true,
  collapsible = true,
  defaultExpanded = true,
  expanded: expandedProp,
  onExpandedChange,
  className,
  style,
}: PanoPerformanceMonitorProps) {
  const inOverlay = useContext(PanoOverlayOutletContext);
  const host = useContext(PanoPerformanceHostContext);
  const t = usePanoUiTranslation();
  const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded);
  const expanded = collapsible ? (expandedProp ?? uncontrolledExpanded) : true;
  const collapsed = collapsible && !expanded;
  const snapshot = useSyncExternalStore(
    host?.subscribe ?? (() => () => {}),
    host?.getSnapshot ?? (() => IDLE_PANO_PERFORMANCE),
    () => IDLE_PANO_PERFORMANCE,
  );

  useEffect(() => {
    if (!host) return;
    return host.acquire(updateIntervalMs);
  }, [host, updateIntervalMs]);

  const resolvedAnchor = useMemo(
    () => resolveOverlayAnchor(anchor, { align: "top-left", inset: DEFAULT_INSET }),
    [anchor],
  );
  const boxStyle = useMemo(
    () => overlayBoxStyle(
      resolvedAnchor.align,
      resolvedAnchor.inset,
      collapsed ? COMPACT_WIDTH : PANEL_WIDTH,
      undefined,
    ),
    [collapsed, resolvedAnchor],
  );
  const setExpanded = (next: boolean) => {
    if (!collapsible) return;
    if (expandedProp === undefined) setUncontrolledExpanded(next);
    onExpandedChange?.(next);
  };

  if (!inOverlay || !host) return null;

  const fpsText = snapshot.fps === null ? "—" : String(snapshot.fps);
  const frameAvg = formatNumber(snapshot.frameTimeMs.avg, 1);
  const frameMax = formatNumber(snapshot.frameTimeMs.max, 1);
  const cpu = formatNumber(snapshot.cpuTimeMs, 1);
  const label = t("Performance");
  const backend = formatBackend(snapshot.backend, t);
  const health = fpsHealth(snapshot);
  const sizeText = snapshot.canvas.width > 0 && snapshot.canvas.height > 0
    ? `${snapshot.canvas.width}×${snapshot.canvas.height}`
    : "—";

  return (
    <div
      className={cn("pano-performance-monitor", className)}
      data-align={resolvedAnchor.align}
      data-collapsed={collapsed ? "true" : "false"}
      data-health={health}
      aria-label={`${label}: ${fpsText} ${t("FPS")}`}
      onClick={collapsed ? () => setExpanded(true) : undefined}
      style={{
        ...boxStyle,
        ...style,
        pointerEvents: collapsed ? "auto" : "none",
      }}
    >
      <div className="pano-performance-monitor__fps">
        <span className="pano-performance-monitor__fps-label">{t("FPS")}</span>
        <span className="pano-performance-monitor__fps-value">{fpsText}</span>
        {collapsed ? (
          <span className="pano-performance-monitor__compact-ms">
            {frameAvg} {t("ms")}
          </span>
        ) : null}
        {collapsible ? (
          <button
            type="button"
            className="pano-performance-monitor__toggle"
            aria-expanded={expanded}
            aria-label={expanded ? t("Collapse performance") : t("Expand performance")}
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <DetailChevron expanded={expanded} />
          </button>
        ) : null}
      </div>
      {expanded ? (
        <>
          <div className="pano-performance-monitor__timing">
            {showGraph ? <FrameGraph history={snapshot.history} /> : null}
            <p className="pano-performance-monitor__frame">
              <span>{frameAvg} <span className="pano-performance-monitor__unit">{t("avg")}</span></span>
              <span>{frameMax} <span className="pano-performance-monitor__unit">{t("max")}</span></span>
            </p>
          </div>
          <dl className="pano-performance-monitor__metrics">
            <Metric label={t("CPU")} value={cpu === "—" ? cpu : `${cpu} ${t("ms")}`} />
            <Metric label={t("Draws")} value={formatCount(snapshot.drawCalls)} />
            <Metric label={t("Tris")} value={formatCount(snapshot.triangles)} />
            <Metric label={t("Geom")} value={formatCount(snapshot.geometries)} />
            <Metric label={t("Tex")} value={formatCount(snapshot.textures)} />
          </dl>
          <p className="pano-performance-monitor__meta">
            <span>{backend}</span>
            <span>{snapshot.frameloop}</span>
            <span>{formatDpr(snapshot.dpr)}</span>
            <span>{sizeText}</span>
          </p>
        </>
      ) : showGraph ? (
        <FrameGraph history={snapshot.history} compact />
      ) : null}
    </div>
  );
}
