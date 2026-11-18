import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CompareDivider } from "../compare/chrome";
import { useCompareSplit } from "../compare/split";
import type {
  CompareConfig, PanoCompareLayout, PanoComparePresentation, PanoCompareSide,
} from "../compare/view";
import { loadPlanarManifest } from "./manifest";
import {
  mountPlanarSurfaces, type PlanarStatus, type PlanarViewOptions,
} from "./runtime";
import type { PlanarTileViewerProps } from "./planar-tile-viewer";
import { PlanarZoomControls } from "./zoom-controls";

export type PlanarTileCompareSource = Pick<PlanarTileViewerProps, "manifestUrl" | "alt">;
export type PlanarTileCompareScene = {
  id: string;
  title?: string;
  before: PlanarTileCompareSource;
  after: PlanarTileCompareSource;
};
export type PlanarTileCompareSceneError = {
  sceneId: string;
  side: PanoCompareSide;
  error: unknown;
};

export type PlanarTileCompareProps = PlanarViewOptions & {
  scenes: readonly PlanarTileCompareScene[];
  activeSceneId?: string;
  defaultActiveSceneId?: string;
  onActiveSceneIdChange?: (id: string) => void;
  presentation?: PanoComparePresentation;
  layout?: PanoCompareLayout;
  /** Fraction occupied by the before image in wipe mode, in the range 0–1. */
  split?: number;
  defaultSplit?: number;
  /** Reports wipe input, coalesced to the latest position per frame during dragging. */
  onSplitChange?: (split: number) => void;
  /** Shows a native scene selector when multiple scenes are available. Defaults to true. */
  showScenePicker?: boolean;
  showZoomControls?: boolean;
  onSceneReady?: (sceneId: string) => void;
  onSceneError?: (event: PlanarTileCompareSceneError) => void;
  "aria-label"?: string;
  className?: string;
  style?: CSSProperties;
};

type PairControls = ReturnType<typeof mountPlanarSurfaces>;
type ShownPair = { scene: PlanarTileCompareScene; key: string; controls: PairControls };
type PairFailure = { key: string; side: PanoCompareSide };
const pairKey = ({ id, before, after }: PlanarTileCompareScene) =>
  JSON.stringify([id, before.manifestUrl, after.manifestUrl]);

function PlanarPair({
  scene, active, comparison, options, label, getPreviousView, onReady, onError,
}: {
  scene: PlanarTileCompareScene;
  active: boolean;
  comparison: CompareConfig;
  options: PlanarViewOptions;
  label: string;
  getPreviousView: () => ReturnType<PairControls["getView"]> | undefined;
  onReady: (controls: PairControls) => void;
  onError: (side: PanoCompareSide, error: unknown) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const before = useRef<HTMLCanvasElement>(null);
  const after = useRef<HTMLCanvasElement>(null);
  const controls = useRef<PairControls | null>(null);
  const settings = useRef({ comparison, options, getPreviousView, onReady, onError });
  const beforeUrl = scene.before.manifestUrl;
  const afterUrl = scene.after.manifestUrl;

  useLayoutEffect(() => {
    settings.current = { comparison, options, getPreviousView, onReady, onError };
    controls.current?.configure(options);
    controls.current?.setComparison(comparison);
  }, [comparison, options, getPreviousView, onReady, onError]);

  useLayoutEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const element = viewport.current!;
    let settled = false;
    const status: Record<PanoCompareSide, PlanarStatus> = { before: "loading", after: "loading" };

    function fail(side: PanoCompareSide, error: unknown) {
      if (signal.aborted || settled) return;
      settled = true;
      controller.abort();
      settings.current.onError(side, error);
    }

    function report(side: PanoCompareSide, value: PlanarStatus, error?: unknown) {
      if (signal.aborted || settled) return;
      status[side] = value;
      if (value === "error") {
        // Finish the current render before disposing the canvases.
        queueMicrotask(() => {
          if (status[side] === "error") fail(side, error);
        });
      } else if (status.before === "ready" && status.after === "ready") {
        queueMicrotask(() => {
          if (signal.aborted || settled || status.before !== "ready" || status.after !== "ready") return;
          const mounted = controls.current!;
          const previous = settings.current.getPreviousView();
          const staging = mounted.getView();
          settled = true;
          // An image with no preview might not have tiles for the updated view yet.
          if (previous && !mounted.setView(previous)) mounted.setView(staging);
          settings.current.onReady(mounted);
        });
      }
    }

    async function load(side: PanoCompareSide, canvas: HTMLCanvasElement, url: string) {
      try {
        const manifest = await loadPlanarManifest(url, signal);
        if (signal.aborted) return;
        if (!canvas.getContext("2d")) throw new Error("Canvas 2D is unavailable");
        return {
          manifest, canvas,
          report: (value: PlanarStatus, error?: unknown) => report(side, value, error),
        };
      } catch (error) {
        fail(side, error);
      }
    }

    void Promise.all([load("before", before.current!, beforeUrl), load("after", after.current!, afterUrl)])
      .then(([first, second]) => {
        if (signal.aborted || !first || !second) return;
        const current = settings.current;
        const mounted = mountPlanarSurfaces(element, [first, second], signal, current.options, current.comparison);
        controls.current = mounted;
        const previous = current.getPreviousView();
        if (previous) mounted.setView(previous);
      })
      .catch((error: unknown) => fail("before", error));

    return () => {
      controller.abort();
      controls.current = null;
    };
  }, [beforeUrl, afterUrl]);

  return (
    <div ref={viewport} className="pano-planar-viewport pano-planar-pair"
      data-staging={active ? undefined : ""} role="region" aria-label={label}
      aria-hidden={active ? undefined : true} tabIndex={active ? 0 : -1}
    >
      <canvas ref={before} role="img" aria-label={scene.before.alt} data-side="before" />
      <canvas ref={after} role="img" aria-label={scene.after.alt} data-side="after" />
    </div>
  );
}

export function PlanarTileCompare({
  scenes, activeSceneId, defaultActiveSceneId, onActiveSceneIdChange,
  presentation = "wipe", layout = "left-right", split: controlledSplit, defaultSplit = 0.5, onSplitChange,
  initialScale, maxScale, dragMotion, showScenePicker = true, showZoomControls = true,
  onSceneReady, onSceneError, "aria-label": label = "Image comparison", className, style,
}: PlanarTileCompareProps) {
  const [internalId, setInternalId] = useState(() => defaultActiveSceneId ?? scenes[0]?.id);
  const [shown, setShown] = useState<ShownPair | null>(null);
  const [failure, setFailure] = useState<PairFailure | null>(null);
  const split = useCompareSplit(defaultSplit, controlledSplit, onSplitChange);
  const announced = useRef<ShownPair | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const restoreViewportFocus = useRef(false);

  const requested = activeSceneId === undefined
    ? scenes.find(({ id }) => id === internalId) ?? scenes[0]
    : scenes.find(({ id }) => id === activeSceneId);
  const requestedKey = requested ? pairKey(requested) : null;
  const displayedScene = shown && scenes.find(({ id }) => id === shown.scene.id);
  const visible = displayedScene ? shown : null;
  const error = requestedKey === failure?.key ? failure : null;
  const pending = requested && requestedKey !== visible?.key && !error ? requested : null;
  const comparison = useMemo(() => ({ layout, presentation, split }), [layout, presentation, split]);
  const options = useMemo(() => ({ initialScale, maxScale, dragMotion }), [initialScale, maxScale, dragMotion]);

  useLayoutEffect(() => {
    const element = root.current!;
    const sync = (value: number) => element.style.setProperty("--pano-compare-split", `${value * 100}%`);
    sync(split.get());
    return split.subscribe(sync);
  }, [split]);

  useLayoutEffect(() => {
    if (shown && !displayedScene) setShown(null);
    if (failure && failure.key !== requestedKey) setFailure(null);
  }, [displayedScene, failure, requestedKey, shown]);

  useLayoutEffect(() => {
    if (!visible) {
      announced.current = null;
      return;
    }
    if (visible !== announced.current) {
      announced.current = visible;
      if (restoreViewportFocus.current) {
        restoreViewportFocus.current = false;
        root.current?.querySelector<HTMLElement>(".pano-planar-pair:not([data-staging])")
          ?.focus({ preventScroll: true });
      }
      onSceneReady?.(visible.scene.id);
    }
  }, [onSceneReady, visible]);

  return (
    <div ref={root} tabIndex={-1}
      className={className ? `pano-planar-viewer ${className}` : "pano-planar-viewer"}
      data-planar-presentation={presentation} data-planar-layout={layout}
      style={style}
    >
      {[visible?.scene, pending].map((scene) => {
        if (!scene) return null;
        const key = pairKey(scene);
        const active = key === visible?.key;
        const current = active && displayedScene && pairKey(displayedScene) === key ? displayedScene : scene;
        return (
          <PlanarPair key={key} scene={current} active={active} comparison={comparison} options={options}
            label={label} getPreviousView={() => visible?.controls.getView()}
            onReady={(controls) => {
              const focused = root.current?.ownerDocument.activeElement;
              restoreViewportFocus.current = Boolean(focused?.classList.contains("pano-planar-pair")
                && root.current?.contains(focused));
              setShown({ scene, key, controls });
            }}
            onError={(side, cause) => {
              setFailure({ key, side });
              onSceneError?.({ sceneId: scene.id, side, error: cause });
            }}
          />
        );
      })}
      {visible && (
        <div className="pano-compare-chrome" data-layout={layout}>
          <CompareDivider {...comparison} />
        </div>
      )}
      {showScenePicker && scenes.length > 1 && (
        <div className="pano-planar-scene-picker">
          <select aria-label="Image pair" value={requested?.id ?? ""}
            onChange={(event) => {
              const id = event.currentTarget.value;
              if (activeSceneId === undefined) setInternalId(id);
              onActiveSceneIdChange?.(id);
            }}
          >
            {!requested && <option value="" disabled>Select image pair</option>}
            {scenes.map(({ id, title }) => <option key={id} value={id}>{title ?? id}</option>)}
          </select>
        </div>
      )}
      {(pending || error || !visible) && (
        <div className="pano-planar-status">
          <span role="status">
            {error ? `Could not load the ${error.side} image.` : pending ? "Loading image pair…" : "No image pair selected."}
          </span>
          {error && <button type="button" onClick={() => {
            root.current?.focus({ preventScroll: true });
            setFailure(null);
          }}>Retry</button>}
        </div>
      )}
      {showZoomControls && <PlanarZoomControls controls={visible?.controls ?? null} ready={Boolean(visible)} maxScale={maxScale} />}
    </div>
  );
}
