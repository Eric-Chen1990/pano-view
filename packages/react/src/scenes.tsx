import { normalizePanoYaw } from "./hotspot/position-math";
import type { PanoLevelCorrection } from "./level-correction";
import { HotspotLevelCorrectionContext } from "./level-rotation";
import type { PanoViewLimits } from "./view-limits";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MutableRefObject, ReactNode } from "react";
import {
  Camera,
  Color,
  LinearSRGBColorSpace,
  LinearFilter,
  PerspectiveCamera,
  Vector4,
  WebGLRenderTarget,
} from "three";
import { useSceneSelection } from "./use-scene-selection";
import { PanoramaViewContext } from "./panorama-view-runtime";
import { LittlePlanetIntroContext } from "./little-planet/host";
import {
  SceneDetailContext,
  type SceneDetailReporter,
} from "./scene-detail";
import { fitSnapshotSizes, type Snapshot } from "./scene-transitions/overlay-utils";
import { resolveTransition } from "./scene-transitions/presets";
import type { SceneTransition, SceneTransitionPreset } from "./scene-transitions/presets";
import { WebGPURuntimeContext } from "./pano-renderer";
import { createWebGPUTarget, withWebGPUState } from "./webgpu-frame";
import { SPATIAL_UI_MASK } from "./spatial/render-layer";
import { WebVRRuntimeContext, subscribeWebVRHost } from "./webvr/host";
import { WebGPUSnapshotOverlay } from "./scene-transitions/webgpu-snapshot-overlay";
import { SnapshotHold } from "./scene-transitions/snapshot-hold";
import {
  acceptDetailWait,
  normalizeTransitionWaitMs,
  pendingSceneUsesBaseLayer,
  phaseAfterSnapshot,
  planDetailHold,
  type DetailWait,
  type DetailWaitSignal,
  type SceneRuntimePhase,
} from "./scene-transition-policy";
import {
  markSceneVisited,
  notifyScenesHost,
  ScenesHostContext,
} from "./scenes-host";
import {
  SceneLoadProgressContext,
  SceneLoadSourceContext,
  type SceneLoadAttempt,
  type SceneLoadReporter,
} from "./scene-load-progress";
import { TransitionOverlay } from "./scene-transitions/transition-overlay";
import { SphereSource } from "./sphere";
import { matchesPortalSelection, PortalHostContext, type PortalHost, type PortalRequest, type PortalWindow } from "./hotspot/portal-host";
import { PortalPreviewPass } from "./hotspot/portal-preview-pass";
import { PortalEntry } from "./hotspot/portal-entry";
import { DEFAULT_PORTAL_VIEW, PORTAL_LOAD_TIMEOUT_MS } from "./hotspot/portal-projection";
import type { PanoViewerState } from "./types";
import { SphereTile } from "./sphere-tile/sphere-tile";
import type { SphereTileProps } from "./sphere-tile/types";
import {
  TileTextureManagerProvider,
  useSharedTileTextureManager,
} from "./tile/texture-manager-context";
import { Tile } from "./tile/tile";
import type { TileProps } from "./tile/types";

export type { SceneTransition, SceneTransitionPreset } from "./scene-transitions/presets";

type SceneViewOptions = {
  viewLimits?: PanoViewLimits;
  initialView?: Partial<PanoViewerState>;
  /** Viewer yaw when facing true north, in degrees. */
  northYaw?: number;
};

export type SphereScene = SceneViewOptions & {
  id: string;
  type: "sphere";
  src: string;
  previewUrl: string;
  yawOffset?: number;
  levelCorrection?: PanoLevelCorrection;
};

export type TileScene = Omit<
  TileProps,
  | "loadMode"
  | "visible"
  | "onReady"
  | "onPreviewError"
  | "onLoadProgress"
  | "onTileError"
  | "onLevelChange"
> & SceneViewOptions & {
  id: string;
  type: "tile";
};

export type SphereTileScene = Omit<
  SphereTileProps,
  | "loadMode"
  | "visible"
  | "onReady"
  | "onPreviewError"
  | "onLoadProgress"
  | "onTileError"
  | "onLevelChange"
> & SceneViewOptions & {
  id: string;
  type: "sphereTile";
};

export type Scene = SphereScene | TileScene | SphereTileScene;

export type SceneTransitionEndEvent = {
  previousSceneId: string;
  sceneId: string;
  preset: SceneTransitionPreset;
};

export type SceneTransitionErrorEvent = {
  sceneId: string;
  error: unknown;
};

export type ScenesProps = {
  scenes: readonly Scene[];
  /**
   * Controlled scene id. When provided, the parent owns the active scene.
   * Imperative `setScene` / `nextScene` / `previousScene` will call
   * `onActiveSceneIdChange` so the parent can update its state.
   */
  activeSceneId?: string;
  /**
   * Uncontrolled initial scene id. Used when `activeSceneId` is omitted.
   * Imperative calls update the internal state directly.
   */
  defaultActiveSceneId?: string;
  /** Called when imperative scene methods request a scene change in controlled mode. */
  onActiveSceneIdChange?: (id: string) => void;
  transition?: SceneTransition;
  /** Rendered only after a scene has finished transitioning in. */
  renderHotspots?: (scene: Scene) => ReactNode;
  /** First paintable scene, or an incoming scene taking over after snapshot capture.
   * The transition may still be running, and full detail may still be loading.
   * Safe to apply the incoming camera view here.
   */
  onSceneReady?: (sceneId: string) => void;
  /**
   * Extra milliseconds to hold the outgoing snapshot after it is captured and the
   * incoming scene has switched to full detail. `0` (default) starts the blend
   * immediately and keeps loading detail during it. A positive value starts the
   * blend early when the current view is already sharp, otherwise it waits at
   * most this long. The wait is separate from the blend duration. Negative and
   * non-finite values are treated as `0`. `transition="none"` cuts over directly
   * once the same condition is met.
   */
  transitionWaitForDetailMs?: number;
  onTransitionEnd?: (event: SceneTransitionEndEvent) => void;
  onTransitionError?: (event: SceneTransitionErrorEvent) => void;
  /** Render configured panorama previews without loading full images or tiles. */
  previewOnly?: boolean;
  /** Viewer-wide budget shared by every tile scene. Defaults to 128 MiB. */
  maxTextureMemoryMb?: number;
  /** Viewer-wide tile request limit. Defaults to 4. */
  maxConcurrentTileLoads?: number;
  /** Maximum physical-pixel area of the outgoing GPU snapshot, shared across WebGL XR eyes. */
  snapshotMaxPixels?: number;
};

type Phase = SceneRuntimePhase;

export function SceneSource({
  scene,
  visible,
  baseOnly,
  onReady,
  onError,
  onPreviewError,
  previewOnly = false,
}: {
  scene: Scene | null;
  visible: boolean;
  baseOnly: boolean;
  onReady: () => void;
  onError: (error: unknown) => void;
  onPreviewError?: (error: unknown) => void;
  previewOnly?: boolean;
}) {
  if (!scene) {
    return null;
  }

  switch (scene.type) {
    case "sphere": {
      return (
        <SphereSource
          src={scene.src}
          previewUrl={scene.previewUrl}
          yawOffset={scene.yawOffset}
          levelCorrection={scene.levelCorrection}
          visible={visible}
          previewOnly={previewOnly}
          onReady={onReady}
          onError={onError}
          onPreviewError={onPreviewError ?? (previewOnly ? onError : undefined)}
        />
      );
    }
    case "tile": {
      const { id: _id, type: _type, viewLimits: _limits, initialView: _view, northYaw: _northYaw, ...tileProps } = scene;
      return (
        <Tile
          {...tileProps}
          visible={visible}
          loadMode={previewOnly ? "preview" : baseOnly ? "base" : "full"}
          onReady={onReady}
          onPreviewError={onError}
        />
      );
    }
    case "sphereTile": {
      const { id: _id, type: _type, viewLimits: _limits, initialView: _view, northYaw: _northYaw, ...tileProps } = scene;
      return (
        <SphereTile
          {...tileProps}
          visible={visible}
          loadMode={previewOnly ? "preview" : baseOnly ? "base" : "full"}
          onReady={onReady}
          onPreviewError={onError}
        />
      );
    }
    default: {
      const exhaustive: never = scene;
      void exhaustive;
      return null;
    }
  }
}

function createWebGLSnapshotTarget(width: number, height: number) {
  const target = new WebGLRenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
  });
  // Both renderers write offscreen snapshots in the linear working space.
  target.texture.colorSpace = LinearSRGBColorSpace;
  target.texture.generateMipmaps = false;
  target.texture.minFilter = LinearFilter;
  target.texture.magFilter = LinearFilter;
  return target;
}

function SnapshotCapture({
  requestId,
  maxPixels,
  onCaptured,
}: {
  requestId: number;
  maxPixels: number;
  onCaptured: (snapshot: Snapshot) => void;
}) {
  const { camera, gl, scene, size } = useThree();
  const gpu = useContext(WebGPURuntimeContext)?.passes;
  const vr = useContext(WebVRRuntimeContext);
  const capturedRequestRef = useRef(0);
  const capture = useRef<Snapshot | null>(null);
  const eyeCamera = useRef(new Camera());
  eyeCamera.current.matrixWorldAutoUpdate = false;
  const viewport = useRef(new Vector4());
  const scissor = useRef(new Vector4());
  const clearColor = useRef(new Color());

  useEffect(
    () => () => {
      capture.current?.dispose();
    },
    [],
  );

  useFrame((state) => {
    if (requestId === 0 || requestId === capturedRequestRef.current) {
      return;
    }
    state.invalidate();

    const pixelRatio = gl.getPixelRatio();
    const sourceWidth = Math.max(1, Math.floor(size.width * pixelRatio));
    const sourceHeight = Math.max(1, Math.floor(size.height * pixelRatio));
    const scale = Math.min(1, Math.sqrt(maxPixels / (sourceWidth * sourceHeight)));
    const width = Math.max(1, Math.floor(sourceWidth * scale));
    const height = Math.max(1, Math.floor(sourceHeight * scale));
    if (gpu) {
      if (gpu.renderer.xr.isPresenting) return;
      const eyes = gpu.stereoEyes?.();
      const targets = (eyes ?? [camera]).map(() => createWebGPUTarget());
      try {
        withWebGPUState(gpu.renderer, () => {
          gpu.renderer.setScissorTest(false);
          gpu.renderer.autoClear = true;
          (eyes ?? [camera]).forEach((view, index) => {
            const target = targets[index];
            target.setSize(eyes ? Math.max(1, Math.floor(width / 2)) : width, height);
            gpu.renderer.setRenderTarget(target);
            const mask = view.layers.mask;
            if (eyes) view.layers.mask &= ~SPATIAL_UI_MASK;
            try { gpu.render(scene, view); }
            finally { view.layers.mask = mask; }
          });
        });
      } catch (error) {
        targets.forEach((target) => target.dispose());
        throw error;
      }
      const [left, right] = targets;
      publishCapture({
        texture: left.texture,
        eyeTextures: right ? [left.texture, right.texture] : undefined,
        dispose: () => targets.forEach((target) => target.dispose()),
      });
      return;
    }

    const presenting = gl.xr.isPresenting;
    let eyes: Camera[] | null = null;
    if (presenting) {
      if (camera instanceof PerspectiveCamera) gl.xr.updateCamera(camera);
      eyes = [...gl.xr.getCamera().cameras];
    } else if (vr?.stereoView.active) {
      eyes = [vr.stereoView.stereo.cameraL, vr.stereoView.stereo.cameraR];
    }

    if (!eyes) {
      const nextTarget = createWebGLSnapshotTarget(width, height);
      const previousTarget = gl.getRenderTarget();
      try {
        gl.setRenderTarget(nextTarget);
        gl.clear();
        gl.render(scene, camera);
      } catch (error) {
        nextTarget.dispose();
        throw error;
      } finally {
        gl.setRenderTarget(previousTarget);
      }
      publishCapture({ texture: nextTarget.texture, dispose: () => nextTarget.dispose() });
      return;
    }

    if (eyes.length === 0) return;
    const fallbackSize = { width: Math.max(1, Math.floor(width / 2)), height };
    const sizes = presenting ? fitSnapshotSizes(eyes.map((view) => {
      const rect = "viewport" in view ? view.viewport as Vector4 | undefined : undefined;
      return rect && rect.z > 0 && rect.w > 0
        ? { width: rect.z, height: rect.w }
        : fallbackSize;
    }), maxPixels) : eyes.map(() => fallbackSize);
    const targets = sizes.map(({ width, height }) => createWebGLSnapshotTarget(width, height));
    const previousTarget = gl.getRenderTarget();
    const face = gl.getActiveCubeFace();
    const level = gl.getActiveMipmapLevel();
    gl.getViewport(viewport.current);
    gl.getScissor(scissor.current);
    const scissorTest = gl.getScissorTest();
    const autoClear = gl.autoClear;
    const xr = gl.xr.enabled;
    gl.getClearColor(clearColor.current);
    const alpha = gl.getClearAlpha();
    const copy = eyeCamera.current;
    try {
      gl.xr.enabled = false;
      gl.autoClear = true;
      gl.setScissorTest(false);
      eyes.forEach((view, index) => {
        gl.setRenderTarget(targets[index]!);
        const mask = view.layers.mask;
        view.layers.mask &= ~SPATIAL_UI_MASK;
        try {
          copy.layers.mask = view.layers.mask;
          copy.matrixWorld.copy(view.matrixWorld);
          copy.matrixWorldInverse.copy(view.matrixWorldInverse);
          copy.projectionMatrix.copy(view.projectionMatrix);
          copy.projectionMatrixInverse.copy(view.projectionMatrixInverse);
          gl.clear();
          gl.render(scene, copy);
        } finally {
          view.layers.mask = mask;
        }
      });
    } catch (error) {
      targets.forEach((target) => target.dispose());
      throw error;
    } finally {
      gl.setViewport(viewport.current);
      gl.setScissor(scissor.current);
      gl.setScissorTest(scissorTest);
      gl.setRenderTarget(previousTarget, face, level);
      gl.setClearColor(clearColor.current, alpha);
      gl.autoClear = autoClear;
      gl.xr.enabled = xr;
    }

    const [left, right] = targets;
    publishCapture({
      texture: left!.texture,
      eyeTextures: right ? [left!.texture, right.texture] : undefined,
      dispose: () => targets.forEach((target) => target.dispose()),
    });
  });

  function publishCapture(snapshot: Snapshot) {
    capturedRequestRef.current = requestId;
    let disposed = false;
    const next = {
      ...snapshot,
      dispose() {
        if (disposed) return;
        disposed = true;
        if (capture.current === next) capture.current = null;
        snapshot.dispose();
      },
    };
    capture.current?.dispose();
    capture.current = next;
    onCaptured(next);
  }

  return null;
}

type ScenesControllerProps = Omit<
  ScenesProps,
  | "maxTextureMemoryMb"
  | "maxConcurrentTileLoads"
  | "defaultActiveSceneId"
  | "onActiveSceneIdChange"
> & {
  activeSceneId: string;
  phaseRef?: MutableRefObject<Phase>;
  requestSceneChange: (id: string) => void;
};

function ScenesController({
  scenes,
  activeSceneId,
  transition: transitionInput,
  renderHotspots,
  onSceneReady,
  onTransitionEnd,
  onTransitionError,
  previewOnly = false,
  snapshotMaxPixels = 3_686_400,
  transitionWaitForDetailMs,
  phaseRef: externalPhaseRef,
  requestSceneChange,
}: ScenesControllerProps) {
  const controlsRef = useContext(PanoramaViewContext);
  const scenesHost = useContext(ScenesHostContext);
  const loadStore = useContext(SceneLoadProgressContext);
  const gpu = useContext(WebGPURuntimeContext);
  const vr = useContext(WebVRRuntimeContext);
  const vrHost = vr?.host;
  const xrAudioPose = vr?.xrAudioPose;
  const mode = useSyncExternalStore(
    (listener) => vrHost ? subscribeWebVRHost(vrHost, listener) : () => {},
    () => vrHost?.snapshot.mode ?? null,
    () => null,
  );
  const nativeXR = Boolean(gpu && mode === "webxr");
  const manager = useSharedTileTextureManager();
  const transition = useMemo(
    () => resolveTransition(nativeXR ? "none" : transitionInput),
    [nativeXR, transitionInput],
  );
  const sceneMap = useMemo(
    () => new Map(scenes.map((scene) => [scene.id, scene])),
    [scenes],
  );
  useLayoutEffect(() => {
    if (!scenesHost) return;
    const northYaws = new Map<string, number>();
    for (const { id, northYaw } of scenes) {
      if (northYaw !== undefined && Number.isFinite(northYaw)) northYaws.set(id, normalizePanoYaw(northYaw));
    }
    scenesHost.sceneNorthYaws = northYaws;
    notifyScenesHost(scenesHost);
    return () => {
      if (scenesHost.sceneNorthYaws !== northYaws) return;
      scenesHost.sceneNorthYaws = undefined;
      notifyScenesHost(scenesHost);
    };
  }, [scenes, scenesHost]);
  const initialScene = sceneMap.get(activeSceneId) ?? null;
  const [slots, setSlots] = useState<[Scene | null, Scene | null]>([
    initialScene,
    null,
  ]);
  const [activeSlot, setActiveSlot] = useState(0);
  const [liveSlot, setLiveSlot] = useState(0);
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>(initialScene ? "idle" : "preloading");
  const [captureRequestId, setCaptureRequestId] = useState(0);
  const [transitionRunId, setTransitionRunId] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [recoveryKey, setRecoveryKey] = useState(0);
  const [portalRequest, setPortalRequest] = useState<PortalRequest | null>(null);
  const [portalEntry, setPortalEntry] = useState<{ window: PortalWindow; view: PanoViewerState } | null>(null);
  const portalRun = useRef<PortalRequest | null>(null);
  const portalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failedPortalId = useRef<string | null>(null);
  const portalWindows = useMemo(() => new Map<string, PortalWindow>(), []);
  const requestedSceneIdRef = useRef(activeSceneId);
  const captureReasonRef = useRef<"start" | "interrupt">("start");
  const interactionReleaseRef = useRef<(() => void) | null>(null);
  const slotsRef = useRef(slots);
  const phaseRef = useRef(phase);
  const liveSlotRef = useRef(liveSlot);
  const transitionFromRef = useRef<Scene | null>(initialScene);
  const readySceneRef = useRef<Scene | null>(null);
  const loadOwner = useMemo(() => ({}), []);
  const loadAttempt = useRef<{ id: string; attempt: SceneLoadAttempt } | null>(null);
  const hasRequestedScene = sceneMap.has(activeSceneId);
  useLayoutEffect(() => () => {
    loadAttempt.current = null;
    loadStore?.release(loadOwner);
  }, [loadOwner, loadStore]);
  useLayoutEffect(() => {
    if (!loadStore) return;
    if (!hasRequestedScene && !activeSceneId) {
      loadAttempt.current = null;
      loadStore.release(loadOwner);
      return;
    }
    const live = slotsRef.current[liveSlotRef.current];
    const ready = hasRequestedScene && live?.id === activeSceneId && readySceneRef.current === live;
    const attempt = loadStore.begin(loadOwner, activeSceneId, ready ? "ready" : "loading");
    loadAttempt.current = { id: activeSceneId, attempt };
    if (!hasRequestedScene) attempt.fail(new Error(`Unknown panorama scene: ${activeSceneId}`));
  }, [activeSceneId, hasRequestedScene, loadOwner, loadStore, recoveryKey]);

  const waitRef = useRef<DetailWait | null>(null);
  const waitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailGenerationRef = useRef(0);
  const [detailGeneration, setDetailGeneration] = useState(0);
  const mountedRef = useRef(true);
  const waitForDetailMsRef = useRef(0);
  waitForDetailMsRef.current = nativeXR ? 0 : normalizeTransitionWaitMs(transitionWaitForDetailMs);
  slotsRef.current = slots;
  phaseRef.current = phase;
  if (externalPhaseRef) {
    externalPhaseRef.current = phase;
  }
  liveSlotRef.current = liveSlot;

  // Read metadata from the latest definitions, without replacing texture-bearing slots.
  useEffect(() => {
    const ready = readySceneRef.current;
    if (ready) controlsRef?.current?.setSceneViewLimits(sceneMap.get(ready.id)?.viewLimits);
  }, [controlsRef, sceneMap]);
  useEffect(() => () => {
    controlsRef?.current?.setSceneViewLimits(undefined);
  }, [controlsRef]);

  const releaseInteraction = useCallback(() => {
    interactionReleaseRef.current?.();
    interactionReleaseRef.current = null;
  }, []);

  const clearPortalTimer = useCallback(() => {
    if (portalTimer.current !== null) clearTimeout(portalTimer.current);
    portalTimer.current = null;
  }, []);

  const cancelPortal = useCallback(() => {
    clearPortalTimer();
    portalRun.current = null;
    setPortalEntry(null);
    releaseInteraction();
  }, [clearPortalTimer, releaseInteraction]);

  const destinationView = useCallback((scene: Scene, override?: PanoViewerState) => {
    const view = override ?? { ...DEFAULT_PORTAL_VIEW, ...scene.initialView };
    return controlsRef?.current?.constrainSceneView(view, scene.viewLimits) ?? view;
  }, [controlsRef]);

  const portalHost = useMemo<PortalHost>(() => ({
    scenes: sceneMap, destinationView, spatial: mode !== null,
    register(id, window) {
      portalWindows.set(id, window);
      return () => {
        if (portalWindows.get(id) === window) portalWindows.delete(id);
      };
    },
    enter(hotspotId, targetId) {
      const source = slotsRef.current[liveSlotRef.current];
      if (!source || phaseRef.current !== "idle" || source.id === targetId ||
          !sceneMap.has(targetId)) return;
      failedPortalId.current = null;
      const window = portalWindows.get(hotspotId);
      const arrivalView = window?.targetId === targetId ? window.arrivalView : undefined;
      setPortalRequest({ sourceId: source.id, targetId, hotspotId, requestedAt: performance.now(), arrivalView });
      requestSceneChange(targetId);
    },
  }), [destinationView, mode, portalWindows, requestSceneChange, sceneMap]);

  const reportError = useCallback((sceneId: string, error: unknown) => {
    onTransitionError?.({ sceneId, error });
  }, [onTransitionError]);

  const clearDetailWait = useCallback((bumpGeneration: boolean) => {
    if (waitTimerRef.current !== null) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    const generation = waitRef.current?.generation;
    if (generation === undefined) {
      waitRef.current = null;
    } else {
      waitRef.current = acceptDetailWait(waitRef.current, {
        kind: "cancel",
        generation,
      }).wait;
    }
    if (!bumpGeneration || !mountedRef.current) {
      return;
    }
    const nextGeneration = detailGenerationRef.current + 1;
    detailGenerationRef.current = nextGeneration;
    setDetailGeneration(nextGeneration);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearDetailWait(false);
    };
  }, [clearDetailWait]);

  const intro = useContext(LittlePlanetIntroContext);
  const startPreload = useCallback((scene: Scene) => {
    if (slotsRef.current[liveSlotRef.current]) intro?.finish();
    clearDetailWait(true);
    const nextSlot = 1 - liveSlotRef.current;
    requestedSceneIdRef.current = scene.id;
    setSlots((current) => {
      const next: [Scene | null, Scene | null] = [...current] as [Scene | null, Scene | null];
      next[nextSlot] = scene;
      return next;
    });
    setPendingSlot(nextSlot);
    setPhase("preloading");
  }, [clearDetailWait, intro]);

  const failPortal = useCallback((run: PortalRequest) => {
    if (portalRun.current !== run) return;
    failedPortalId.current = run.targetId;
    cancelPortal();
    setPortalRequest(null);
    const live = liveSlotRef.current;
    setSlots((current) => live === 0 ? [current[0], null] : [null, current[1]]);
    setPendingSlot(null);
    setActiveSlot(live);
    setPhase("idle");
    const error = run.error ?? new Error("Portal destination took too long to load");
    if (loadAttempt.current?.id === run.targetId) loadAttempt.current.attempt.fail(error);
    reportError(run.targetId, error);
  }, [cancelPortal, reportError]);

  useEffect(() => {
    const requested = sceneMap.get(activeSceneId);
    const liveScene = slotsRef.current[liveSlotRef.current];
    const portal = portalRun.current;
    if (portal && requested?.id === portal.targetId) return;
    if (portal) {
      cancelPortal();
      setPortalRequest(null);
      if (requested?.id === liveScene?.id || !requested) {
        setSlots((current) => liveSlotRef.current === 0 ? [current[0], null] : [null, current[1]]);
        setActiveSlot(liveSlotRef.current);
        setPendingSlot(null);
        setPhase("idle");
        if (!requested) reportError(activeSceneId, new Error(`Unknown panorama scene: ${activeSceneId}`));
        return;
      }
      startPreload(requested);
      return;
    }
    if (!requested) {
      reportError(activeSceneId, new Error(`Unknown panorama scene: ${activeSceneId}`));
      return;
    }

    if (failedPortalId.current === requested.id) return;
    failedPortalId.current = null;
    if (portalRequest && phaseRef.current === "idle" &&
        matchesPortalSelection(portalRequest, liveScene?.id, requested.id, performance.now())) {
      portalRun.current = portalRequest;
      startPreload(requested);
      portalTimer.current = setTimeout(() => failPortal(portalRequest), PORTAL_LOAD_TIMEOUT_MS);
      return;
    }
    if (phaseRef.current === "idle" && liveScene?.id === requested.id) {
      requestedSceneIdRef.current = requested.id;
      return;
    }
    if (
      phaseRef.current === "preloading" &&
      liveScene?.id === requested.id &&
      readySceneRef.current === liveScene &&
      pendingSlot !== null
    ) {
      requestedSceneIdRef.current = requested.id;
      clearDetailWait(true);
      setSlots((current) => pendingSlot === 0 ? [null, current[1]] : [current[0], null]);
      setSnapshot(null);
      snapshot?.dispose();
      setPendingSlot(null);
      setActiveSlot(liveSlotRef.current);
      setPhase("idle");
      releaseInteraction();
      return;
    }
    if (
      phaseRef.current === "preloading" &&
      pendingSlot !== null &&
      slotsRef.current[pendingSlot]?.id === requested.id
    ) {
      requestedSceneIdRef.current = requested.id;
      return;
    }
    if (
      phaseRef.current === "transitioning" ||
      phaseRef.current === "capturing" ||
      phaseRef.current === "awaitingDetail"
    ) {
      // Readiness callbacks may rerender the parent with new callback/array identities.
      // Only a genuinely new target should interrupt the blend already in progress.
      if (requestedSceneIdRef.current === requested.id) return;
      requestedSceneIdRef.current = requested.id;
      captureReasonRef.current = "interrupt";
      clearDetailWait(true);
      setPhase("recapturing");
      setCaptureRequestId((current) => current + 1);
      return;
    }
    startPreload(requested);
  }, [activeSceneId, cancelPortal, clearDetailWait, failPortal, pendingSlot, portalRequest, releaseInteraction, reportError, sceneMap, snapshot, startPreload]);

  const notifySceneReady = useCallback((scene: Scene | null, landing?: PanoViewerState) => {
    if (!scene || readySceneRef.current === scene) return;
    if (readySceneRef.current?.id !== scene.id) xrAudioPose?.recenter();
    readySceneRef.current = scene;
    const metadata = sceneMap.get(scene.id) ?? scene;
    const controls = controlsRef?.current;
    controls?.setSceneViewLimits(metadata.viewLimits);
    const view = landing ?? (scenesHost?.recovery?.id !== scene.id ? metadata.initialView : undefined);
    if (view) controls?.setView(view, { immediate: true });
    if (scenesHost) {
      scenesHost.recovery = null;
      markSceneVisited(scenesHost, scene.id);
    }
    if (loadAttempt.current?.id === scene.id) loadAttempt.current.attempt.ready();
    onSceneReady?.(scene.id);
  }, [controlsRef, onSceneReady, sceneMap, scenesHost, xrAudioPose]);

  const finishPortal = useCallback(() => {
    const run = portalRun.current;
    if (!run || pendingSlot === null) return;
    const previousSlot = 1 - pendingSlot;
    cancelPortal();
    setPortalRequest(null);
    setSlots((current) => previousSlot === 0 ? [null, current[1]] : [current[0], null]);
    setActiveSlot(pendingSlot);
    setPendingSlot(null);
    setPhase("idle");
    onTransitionEnd?.({ previousSceneId: run.sourceId, sceneId: run.targetId, preset: "none" });
  }, [cancelPortal, onTransitionEnd, pendingSlot]);

  const takeOverPortal = useCallback((view: PanoViewerState) => {
    if (!portalRun.current || pendingSlot === null) return;
    setLiveSlot(pendingSlot);
    notifySceneReady(slotsRef.current[pendingSlot], view);
  }, [notifySceneReady, pendingSlot]);

  const handleReady = useCallback((slot: number) => {
    if (slot === liveSlotRef.current && pendingSlot === null && phaseRef.current === "idle") {
      notifySceneReady(slotsRef.current[slot]);
      return;
    }
    if (
      slot !== pendingSlot ||
      phaseRef.current !== "preloading" ||
      slotsRef.current[slot]?.id !== activeSceneId
    ) {
      return;
    }
    const run = portalRun.current;
    const nextScene = slotsRef.current[slot];
    if (run && nextScene) {
      clearPortalTimer();
      const view = destinationView(sceneMap.get(nextScene.id) ?? nextScene, run.arrivalView);
      const window = portalWindows.get(run.hotspotId);
      if (!window?.ready() || mode !== null || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        takeOverPortal(view);
        finishPortal();
      } else {
        interactionReleaseRef.current ??= controlsRef?.current?.acquireInteractionLock() ?? null;
        setPortalEntry({ window, view });
        setPhase("enteringPortal");
      }
      return;
    }
    if (transition.preset === "none" && waitForDetailMsRef.current === 0) {
      const previousSlot = liveSlotRef.current;
      const previousScene = slotsRef.current[previousSlot];
      const nextScene = slotsRef.current[slot];
      setSlots((current) => {
        const next: [Scene | null, Scene | null] = [...current] as [Scene | null, Scene | null];
        next[previousSlot] = null;
        return next;
      });
      setLiveSlot(slot);
      setActiveSlot(slot);
      setPendingSlot(null);
      setPhase("idle");
      notifySceneReady(nextScene);
      if (previousScene && nextScene) {
        onTransitionEnd?.({
          previousSceneId: previousScene.id,
          sceneId: nextScene.id,
          preset: "none",
        });
      }
      return;
    }
    interactionReleaseRef.current ??= controlsRef?.current?.acquireInteractionLock() ?? null;
    transitionFromRef.current = slotsRef.current[liveSlotRef.current];
    captureReasonRef.current = "start";
    setPhase("capturing");
    setCaptureRequestId((current) => current + 1);
  }, [activeSceneId, clearPortalTimer, controlsRef, destinationView, finishPortal, mode, notifySceneReady, onTransitionEnd, pendingSlot, portalWindows, sceneMap, takeOverPortal, transition.preset]);

  useLayoutEffect(() => {
    if (mode === null || !portalEntry || phase !== "enteringPortal") return;
    takeOverPortal(portalEntry.view);
    finishPortal();
  }, [finishPortal, mode, phase, portalEntry, takeOverPortal]);

  const finishTransition = useCallback(() => {
    const nextSlot = pendingSlot;
    const previousScene = transitionFromRef.current;
    const nextScene = nextSlot === null ? null : slotsRef.current[nextSlot];
    if (nextSlot === null || !nextScene) {
      releaseInteraction();
      setPhase("idle");
      return;
    }
    setActiveSlot(nextSlot);
    setLiveSlot(nextSlot);
    setPendingSlot(null);
    setPhase("idle");
    const oldSnapshot = snapshot;
    setSnapshot(null);
    oldSnapshot?.dispose();
    releaseInteraction();
    if (previousScene) {
      onTransitionEnd?.({
        previousSceneId: previousScene.id,
        sceneId: nextScene.id,
        preset: transition.preset,
      });
    }
  }, [onTransitionEnd, pendingSlot, releaseInteraction, snapshot, transition.preset]);

  useLayoutEffect(() => {
    if (!nativeXR || phaseRef.current === "idle" || phaseRef.current === "preloading" || phaseRef.current === "enteringPortal") return;
    clearDetailWait(true);
    setCaptureRequestId(0);
    if (phaseRef.current === "recapturing") {
      snapshot?.dispose();
      setSnapshot(null);
      releaseInteraction();
      const requested = sceneMap.get(activeSceneId);
      if (requested) startPreload(requested);
    } else {
      if (pendingSlot !== null) notifySceneReady(slotsRef.current[pendingSlot]);
      finishTransition();
    }
  }, [activeSceneId, clearDetailWait, finishTransition, nativeXR, notifySceneReady, pendingSlot,
    releaseInteraction, sceneMap, snapshot, startPreload]);

  const finishTransitionRef = useRef(finishTransition);
  finishTransitionRef.current = finishTransition;
  const transitionRef = useRef(transition);
  transitionRef.current = transition;

  const consumeDetailSignal = useCallback((signal: DetailWaitSignal) => {
    const decision = acceptDetailWait(waitRef.current, signal);
    waitRef.current = decision.wait;
    if (!decision.start) {
      return;
    }
    if (waitTimerRef.current !== null) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    if (!mountedRef.current) {
      return;
    }
    if (transitionRef.current.preset === "none") {
      finishTransitionRef.current();
      return;
    }
    setPhase("transitioning");
    setTransitionRunId((current) => current + 1);
  }, []);

  const handleCaptured = useCallback((nextSnapshot: Snapshot) => {
    if (captureReasonRef.current === "interrupt") {
      setSnapshot((current) => {
        current?.dispose();
        return nextSnapshot;
      });
      startPreload(sceneMap.get(requestedSceneIdRef.current)!);
      return;
    }

    const sourceSlot = liveSlotRef.current;
    const incoming = pendingSlot === null ? null : slotsRef.current[pendingSlot];
    setSlots((current) => {
      const next: [Scene | null, Scene | null] = [...current] as [Scene | null, Scene | null];
      next[sourceSlot] = null;
      return next;
    });
    manager?.releaseUnused();
    if (pendingSlot !== null && incoming) {
      notifySceneReady(incoming);
      setLiveSlot(pendingSlot);
    }

    if (waitTimerRef.current !== null) {
      clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    waitRef.current = null;
    let hold: DetailWait | null = null;
    if (incoming && waitForDetailMsRef.current > 0) {
      const now = performance.now();
      const generation = detailGenerationRef.current + 1;
      detailGenerationRef.current = generation;
      hold = planDetailHold({
        waitMs: waitForDetailMsRef.current,
        now,
        generation,
        sceneId: incoming.id,
      });
      if (hold) {
        const deadline = hold.deadline;
        waitRef.current = hold;
        setDetailGeneration(generation);
        waitTimerRef.current = setTimeout(() => {
          consumeDetailSignal({
            kind: "timeout",
            generation,
            now: deadline,
          });
        }, Math.max(0, deadline - performance.now()));
      }
    }

    const nextPhase = phaseAfterSnapshot(transition.preset, hold);
    if (nextPhase === "awaitingDetail") {
      setSnapshot((current) => {
        current?.dispose();
        return nextSnapshot;
      });
      setPhase("awaitingDetail");
      return;
    }
    if (nextPhase === "idle") {
      nextSnapshot.dispose();
      setSnapshot((current) => {
        current?.dispose();
        return null;
      });
      if (pendingSlot !== null) {
        setActiveSlot(pendingSlot);
      }
      setPendingSlot(null);
      setPhase("idle");
      releaseInteraction();
      const previousScene = transitionFromRef.current;
      if (previousScene && incoming) {
        onTransitionEnd?.({
          previousSceneId: previousScene.id,
          sceneId: incoming.id,
          preset: "none",
        });
      }
      return;
    }

    setSnapshot((current) => {
      current?.dispose();
      return nextSnapshot;
    });
    setPhase("transitioning");
    setTransitionRunId((current) => current + 1);
  }, [
    consumeDetailSignal,
    manager,
    notifySceneReady,
    onTransitionEnd,
    pendingSlot,
    releaseInteraction,
    sceneMap,
    startPreload,
    transition.preset,
  ]);

  const snapshotRef = useRef<Snapshot | null>(snapshot);
  snapshotRef.current = snapshot;
  useEffect(() => () => {
    clearPortalTimer();
    // Snapshot identity changes while the blend or detail wait is still running.
    // Releasing here would unlock the camera as soon as the outgoing frame is stored.
    releaseInteraction();
    snapshotRef.current?.dispose();
    snapshotRef.current = null;
  }, [clearPortalTimer, releaseInteraction]);

  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelPortal();
      setPortalRequest(null);
      releaseInteraction();
      clearDetailWait(true);
      loadStore?.release(loadOwner);
      loadAttempt.current = null;
      manager?.dispose();
      snapshot?.dispose();
      setSnapshot(null);
      setPendingSlot(null);
      setPhase("idle");
    };
    const onContextRestored = () => {
      readySceneRef.current = null;
      manager?.resume();
      setRecoveryKey((current) => current + 1);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
    };
  }, [cancelPortal, clearDetailWait, gl, loadOwner, loadStore, manager, releaseInteraction, snapshot]);

  const currentSource = (source: Scene | null): Scene | null => {
    if (!source) return null;
    const latest = sceneMap.get(source.id);
    // Slots own the textures and load lifecycle. Calibration is live metadata.
    if (latest?.type !== source.type ||
        (latest.levelCorrection === source.levelCorrection && latest.northYaw === source.northYaw)) return source;
    return { ...source, levelCorrection: latest.levelCorrection, northYaw: latest.northYaw };
  };
  const renderedScene = currentSource(slots[liveSlot]);
  const snapshotVisible = snapshot !== null && (
    phase === "transitioning" ||
    phase === "recapturing" ||
    phase === "preloading"
  );
  const slotSceneKey = `${slots[0]?.id ?? ""}\n${slots[1]?.id ?? ""}`;
  const detailReporters = useMemo((): [SceneDetailReporter, SceneDetailReporter] => {
    const [firstSceneId = "", secondSceneId = ""] = slotSceneKey.split("\n");
    const sceneIds = [firstSceneId, secondSceneId];
    return sceneIds.map((sceneId) => ({
      generation: detailGeneration,
      report: (ready: boolean) => {
        if (!ready || sceneId === "") {
          return;
        }
        consumeDetailSignal({
          kind: "ready",
          generation: detailGeneration,
          sceneId,
        });
      },
    })) as [SceneDetailReporter, SceneDetailReporter];
  }, [consumeDetailSignal, detailGeneration, slotSceneKey]);

  const loadReporters = useMemo(() => slots.map((source, slot): SceneLoadReporter => {
    const getAttempt = () =>
      source && slotsRef.current[slot] === source && loadAttempt.current?.id === source.id
        ? loadAttempt.current.attempt : null;
    return {
      isLoading: () => getAttempt()?.isLoading() ?? false,
      measure: (loaded, total) => getAttempt()?.measure(loaded, total),
      fail: (error) => getAttempt()?.fail(error),
    };
  }), [slots]);

  return (
    <PortalHostContext.Provider value={portalHost}>
      <PortalPreviewPass host={portalHost} windows={portalWindows} />
      <SnapshotCapture
        requestId={nativeXR ? 0 : captureRequestId}
        maxPixels={Math.max(1, snapshotMaxPixels)}
        onCaptured={handleCaptured}
      />
      {[0, 1].map((slot) => {
        const source = slots[slot];
        const isLive = slot === liveSlot;
        const isPending = slot === pendingSlot;
        return (
          <SceneDetailContext.Provider
            key={`${slot}:${source?.id ?? "empty"}:${recoveryKey}`}
            value={detailReporters[slot]}
          >
            <SceneLoadSourceContext.Provider value={loadReporters[slot]}>
              <SceneSource
                scene={currentSource(source)}
                visible={isLive}
                baseOnly={pendingSceneUsesBaseLayer(phase, isPending)}
                previewOnly={previewOnly}
                onReady={() => handleReady(slot)}
                onError={(error) => {
                  if (source) {
                    if (portalRun.current?.targetId === source.id) {
                      portalRun.current.error = error;
                      return;
                    }
                    reportError(source.id, error);
                  }
                }}
              />
            </SceneLoadSourceContext.Provider>
          </SceneDetailContext.Provider>
        );
      })}
      {gpu && !nativeXR && snapshot && (snapshotVisible || phase === "awaitingDetail") ? (
        <WebGPUSnapshotOverlay
          passes={gpu.passes}
          key={`${transitionRunId}:${snapshot.texture.id}`}
          snapshot={snapshot}
          transition={transition}
          running={phase === "transitioning"}
          holding={phase === "awaitingDetail" || phase === "preloading"}
          runId={transitionRunId}
          onFinish={finishTransition}
        />
      ) : null}
      {!gpu && snapshot !== null && phase === "awaitingDetail" ? (
        <SnapshotHold snapshot={snapshot} />
      ) : null}
      {!gpu && snapshotVisible ? (
        <TransitionOverlay
          snapshot={snapshot}
          transition={transition}
          running={phase === "transitioning"}
          runId={transitionRunId}
          onFinish={finishTransition}
        />
      ) : null}
      {(phase === "idle" || portalRun.current?.sourceId === renderedScene?.id) && renderedScene
        ? <HotspotLevelCorrectionContext.Provider value={renderedScene.levelCorrection}>
            {renderHotspots?.(renderedScene)}
          </HotspotLevelCorrectionContext.Provider> : null}
      {portalEntry ? <PortalEntry window={portalEntry.window} destination={portalEntry.view}
        maxPixels={Math.max(1, snapshotMaxPixels)} onTakeover={() => takeOverPortal(portalEntry.view)}
        onFinish={finishPortal} /> : null}
    </PortalHostContext.Provider>
  );
}

export function Scenes({
  maxTextureMemoryMb,
  maxConcurrentTileLoads,
  activeSceneId: controlledId,
  defaultActiveSceneId,
  onActiveSceneIdChange,
  scenes,
  ...rest
}: ScenesProps) {
  const phaseRef = useRef<Phase>("idle");
  const isTransitioning = useCallback(() => phaseRef.current !== "idle", []);
  const { resolvedId, requestSceneChange } = useSceneSelection({
    scenes, controlledId, defaultActiveSceneId, onActiveSceneIdChange, isTransitioning,
  });

  return (
    <TileTextureManagerProvider
      maxTextureMemoryMb={maxTextureMemoryMb}
      maxConcurrentLoads={maxConcurrentTileLoads}
    >
      <ScenesController
        {...rest}
        scenes={scenes}
        activeSceneId={resolvedId}
        requestSceneChange={requestSceneChange}
        phaseRef={phaseRef}
      />
    </TileTextureManagerProvider>
  );
}
