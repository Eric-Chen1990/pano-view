import { SceneLoadSourceContext } from "../scene-load-progress";
import {
  Fragment,
  memo,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import type { Group } from "three";

import { CompareRenderer, type PairGroups } from "./renderer";
import { PanoramaViewContext } from "../panorama-view-runtime";
import { SceneSource, type SphereScene, type SphereTileScene, type TileScene } from "../scenes";
import { markSceneVisited, ScenesHostContext } from "../scenes-host";
import { TileTextureManagerProvider } from "../tile/texture-manager-context";
import type { PanoViewerState } from "../types";
import { useSceneSelection } from "../use-scene-selection";
import { subscribeWebVRHost, WebVRRuntimeContext } from "../webvr/host";
import { useCompareSplit } from "./split";
import {
  CompareHostContext,
  CompareSourceSideContext,
  type CompareDividerAppearance,
  type PanoCompareLayout,
  type PanoComparePresentation,
  type PanoCompareSide,
} from "./view";

export type PanoCompareSource =
  | Omit<SphereScene, "id" | "viewLimits">
  | Omit<TileScene, "id" | "viewLimits">
  | Omit<SphereTileScene, "id" | "viewLimits">;

export type PanoCompareScene = {
  id: string;
  before: PanoCompareSource;
  after: PanoCompareSource;
  /** Apply the specified camera fields when this pair becomes visible. */
  initialView?: Partial<PanoViewerState>;
};

export type PanoCompareSceneError = {
  sceneId: string;
  side: PanoCompareSide;
  error: unknown;
};

export type PanoCompareProps = CompareDividerAppearance & {
  scenes: readonly PanoCompareScene[];
  activeSceneId?: string;
  defaultActiveSceneId?: string;
  onActiveSceneIdChange?: (id: string) => void;
  presentation?: PanoComparePresentation;
  layout?: PanoCompareLayout;
  /** Fraction occupied by the before source in wipe mode, in the range 0–1. */
  split?: number;
  defaultSplit?: number;
  /** Reports wipe input, coalesced to the latest position per frame during dragging. */
  onSplitChange?: (split: number) => void;
  renderHotspots?: (scene: PanoCompareScene) => ReactNode;
  onSceneReady?: (sceneId: string) => void;
  onSceneError?: (event: PanoCompareSceneError) => void;
};

function CompareSource({
  id, side, source, active, onReady, onError,
}: {
  id: string;
  side: PanoCompareSide;
  source: PanoCompareSource;
  active: boolean;
  onReady: (side: PanoCompareSide) => void;
  onError: (side: PanoCompareSide, error: unknown) => void;
}) {
  const ready = useRef(false);
  const previewFailed = useRef(false);
  const fullFailure = useRef<{ error: unknown } | null>(null);
  return (
    <CompareSourceSideContext.Provider value={side}>
      <SceneLoadSourceContext.Provider value={null}>
        <SceneSource
          scene={{ ...source, id }}
          baseOnly={false}
          previewOnly={!active}
          visible
          onReady={() => {
            ready.current = true;
            onReady(side);
          }}
          onError={(error) => {
            if (ready.current) return;
            if (source.type !== "sphere" || previewFailed.current) onError(side, error);
            else fullFailure.current = { error };
          }}
          onPreviewError={() => {
            previewFailed.current = true;
            if (!ready.current && fullFailure.current) onError(side, fullFailure.current.error);
          }}
        />
      </SceneLoadSourceContext.Provider>
    </CompareSourceSideContext.Provider>
  );
}

const ComparePair = memo(function ComparePair({
  scene, active, groups, onReady, onError,
}: {
  scene: PanoCompareScene;
  active: boolean;
  groups: RefObject<PairGroups | null>;
  onReady: (scene: PanoCompareScene) => void;
  onError: (event: PanoCompareSceneError) => void;
}) {
  const before = useRef<Group>(null);
  const after = useRef<Group>(null);
  const ready = useRef(new Set<PanoCompareSide>());
  const reportReady = (side: PanoCompareSide) => {
    ready.current.add(side);
    if (ready.current.size === 2) onReady(scene);
  };
  const reportError = (side: PanoCompareSide, error: unknown) => onError({ sceneId: scene.id, side, error });
  useLayoutEffect(() => {
    if (!active || !before.current || !after.current) return;
    const pair = { before: before.current, after: after.current };
    groups.current = pair;
    return () => { if (groups.current === pair) groups.current = null; };
  }, [active, groups]);
  return (
    <>
      <group ref={before} visible={active}>
        <CompareSource id={scene.id} side="before" source={scene.before}
          active={active} onReady={reportReady} onError={reportError} />
      </group>
      <group ref={after} visible={false}>
        <CompareSource id={scene.id} side="after" source={scene.after}
          active={active} onReady={reportReady} onError={reportError} />
      </group>
    </>
  );
});

export function PanoCompare({
  scenes, activeSceneId, defaultActiveSceneId, onActiveSceneIdChange,
  presentation = "wipe", layout = "left-right",
  dividerColor, dividerWidth, showDividerHandle,
  split: controlledSplit, defaultSplit = 0.5, onSplitChange,
  onSceneReady, onSceneError, renderHotspots,
}: PanoCompareProps) {
  const host = useContext(CompareHostContext);
  const scenesHost = useContext(ScenesHostContext);
  const controls = useContext(PanoramaViewContext);
  const vrHost = useContext(WebVRRuntimeContext)?.host;
  const vrActive = useSyncExternalStore(
    (listener) => vrHost ? subscribeWebVRHost(vrHost, listener) : () => {},
    () => vrHost?.snapshot.mode != null,
    () => false,
  );
  const groups = useRef<PairGroups | null>(null);
  const transitioning = useRef(false);
  const isTransitioning = useCallback(() => transitioning.current, []);
  const { resolvedId: selectedId } = useSceneSelection({
    scenes, controlledId: activeSceneId, defaultActiveSceneId, onActiveSceneIdChange, isTransitioning,
    fallbackToFirst: true,
  });
  const requested = scenes.find((scene) => scene.id === selectedId);
  const [shown, setShown] = useState<PanoCompareScene | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const split = useCompareSplit(defaultSplit, controlledSplit, onSplitChange);
  const visible = scenes.length ? shown : null;
  const pending = requested && requested.id !== visible?.id && requested.id !== failed ? requested : null;
  transitioning.current = Boolean(pending);
  const pendingId = useRef(pending?.id);
  pendingId.current = pending?.id;
  const announced = useRef<PanoCompareScene | null>(null);

  useLayoutEffect(() => {
    if (failed !== null && failed !== selectedId) setFailed(null);
    if (!scenes.length && shown) setShown(null);
  }, [failed, scenes.length, selectedId, shown]);

  useLayoutEffect(() => {
    if (!visible) {
      announced.current = null;
      return;
    }
    if (announced.current === visible) return;
    announced.current = visible;
    const runtime = controls?.current;
    if (visible.initialView && runtime) {
      runtime.setView({ ...runtime.getView(), ...visible.initialView });
    }
    if (scenesHost) markSceneVisited(scenesHost, visible.id);
    onSceneReady?.(visible.id);
  }, [controls, onSceneReady, scenesHost, visible]);

  const compareActive = Boolean(visible) && !vrActive;
  useLayoutEffect(() => {
    if (compareActive && host) {
      host.setConfig({ layout, presentation, split, dividerColor, dividerWidth, showDividerHandle });
    }
  }, [compareActive, host, layout, presentation, split, dividerColor, dividerWidth, showDividerHandle]);
  useLayoutEffect(() => {
    if (compareActive && host) return () => host.setConfig(null);
  }, [compareActive, host]);

  const ready = useCallback((scene: PanoCompareScene) => {
    if (pendingId.current !== scene.id) return;
    pendingId.current = undefined;
    setShown(scene);
  }, []);
  const error = useCallback((event: PanoCompareSceneError) => {
    if (pendingId.current !== event.sceneId) return;
    pendingId.current = undefined;
    setFailed(event.sceneId);
    onSceneError?.(event);
  }, [onSceneError]);
  const hotspots = useMemo(() => visible && renderHotspots?.(visible), [renderHotspots, visible]);

  if (!host) throw new Error("PanoCompare must be mounted in PanoViewer.");
  return (
    <TileTextureManagerProvider>
      {[visible, pending].map((scene) => scene && (
        <ComparePair key={scene.id} scene={scene} active={visible === scene}
          groups={groups} onReady={ready} onError={error} />
      ))}
      {visible && <Fragment key={visible.id}>{hotspots}</Fragment>}
      {compareActive && <CompareRenderer groups={groups} />}
    </TileTextureManagerProvider>
  );
}
