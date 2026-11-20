import type { PanoViewLimits } from "./view-limits";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Fragment,
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
  LinearSRGBColorSpace,
  LinearFilter,
  WebGLRenderTarget,
} from "three";
import { useSceneSelection } from "./use-scene-selection";
import { PanoramaViewContext } from "./panorama-view-runtime";
import {
  SceneDetailContext,
  type SceneDetailReporter,
} from "./scene-detail";
import type { Snapshot } from "./scene-transitions/overlay-utils";
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
  ScenesHostContext,
} from "./scenes-host";
import { TransitionOverlay } from "./scene-transitions/transition-overlay";
import { Sphere } from "./sphere";
import { SphereTile } from "./sphere-tile/sphere-tile";
import type { SphereTileProps } from "./sphere-tile/types";
import {
  TileTextureManagerProvider,
  useSharedTileTextureManager,
} from "./tile/texture-manager-context";
import { Tile } from "./tile/tile";
import type { TileProps } from "./tile/types";

export type { SceneTransition, SceneTransitionPreset } from "./scene-transitions/presets";

type SceneViewOptions = { viewLimits?: PanoViewLimits };

export type SphereScene = SceneViewOptions & {
  id: string;
  type: "sphere";
  src: string;
  previewUrl: string;
  yawOffset?: number;
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
  /** Viewer-wide budget shared by every tile scene. Defaults to 128 MiB. */
  maxTextureMemoryMb?: number;
  /** Viewer-wide tile request limit. Defaults to 4. */
  maxConcurrentTileLoads?: number;
  /** Maximum physical-pixel area of the outgoing GPU snapshot. */
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
    case "sphere":
      return (
        <Sphere
          src={scene.src}
          previewUrl={scene.previewUrl}
          yawOffset={scene.yawOffset}
          visible={visible}
          onReady={onReady}
          onError={onError}
          onPreviewError={onPreviewError}
        />
      );
    case "tile": {
      const { id: _id, type: _type, viewLimits: _limits, ...tileProps } = scene;
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
      const { id: _id, type: _type, viewLimits: _limits, ...tileProps } = scene;
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
  const capturedRequestRef = useRef(0);
  const capture = useRef<Snapshot | null>(null);

  useEffect(
    () => () => {
      capture.current?.dispose();
    },
    [],
  );

  useFrame(() => {
    if (requestId === 0 || requestId === capturedRequestRef.current) {
      return;
    }

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
    const nextTarget = new WebGLRenderTarget(width, height, {
      depthBuffer: false,
      stencilBuffer: false,
    });
    // Both renderers write offscreen snapshots in the linear working space.
    nextTarget.texture.colorSpace = LinearSRGBColorSpace;
    nextTarget.texture.generateMipmaps = false;
    nextTarget.texture.minFilter = LinearFilter;
    nextTarget.texture.magFilter = LinearFilter;

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
};

function ScenesController({
  scenes,
  activeSceneId,
  transition: transitionInput,
  renderHotspots,
  onSceneReady,
  onTransitionEnd,
  onTransitionError,
  snapshotMaxPixels = 3_686_400,
  transitionWaitForDetailMs,
  phaseRef: externalPhaseRef,
}: ScenesControllerProps) {
  const controlsRef = useContext(PanoramaViewContext);
  const scenesHost = useContext(ScenesHostContext);
  const gpu = useContext(WebGPURuntimeContext);
  const vrHost = useContext(WebVRRuntimeContext)?.host;
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
  const requestedSceneIdRef = useRef(activeSceneId);
  const captureReasonRef = useRef<"start" | "interrupt">("start");
  const interactionReleaseRef = useRef<(() => void) | null>(null);
  const slotsRef = useRef(slots);
  const phaseRef = useRef(phase);
  const liveSlotRef = useRef(liveSlot);
  const transitionFromRef = useRef<Scene | null>(initialScene);
  const readySceneRef = useRef<Scene | null>(null);
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

  const startPreload = useCallback((scene: Scene) => {
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
  }, [clearDetailWait]);

  useEffect(() => {
    const requested = sceneMap.get(activeSceneId);
    if (!requested) {
      reportError(activeSceneId, new Error(`Unknown panorama scene: ${activeSceneId}`));
      return;
    }

    const liveScene = slotsRef.current[liveSlotRef.current];
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
  }, [activeSceneId, clearDetailWait, pendingSlot, releaseInteraction, reportError, sceneMap, snapshot, startPreload]);

  const notifySceneReady = useCallback((scene: Scene | null) => {
    if (!scene || readySceneRef.current === scene) return;
    readySceneRef.current = scene;
    controlsRef?.current?.setSceneViewLimits(sceneMap.get(scene.id)?.viewLimits);
    if (scenesHost) {
      scenesHost.recovery = null;
      markSceneVisited(scenesHost, scene.id);
    }
    onSceneReady?.(scene.id);
  }, [controlsRef, onSceneReady, sceneMap, scenesHost]);

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
  }, [activeSceneId, controlsRef, notifySceneReady, onTransitionEnd, pendingSlot, transition.preset]);

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
    if (!nativeXR || phaseRef.current === "idle" || phaseRef.current === "preloading") return;
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
    // Snapshot identity changes while the blend or detail wait is still running.
    // Releasing here would unlock the camera as soon as the outgoing frame is stored.
    releaseInteraction();
    snapshotRef.current?.dispose();
    snapshotRef.current = null;
  }, [releaseInteraction]);

  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      releaseInteraction();
      clearDetailWait(true);
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
  }, [clearDetailWait, gl, manager, releaseInteraction, snapshot]);

  const renderedScene = slots[liveSlot];
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

  return (
    <Fragment>
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
            <SceneSource
              scene={source}
              visible={isLive}
              baseOnly={pendingSceneUsesBaseLayer(phase, isPending)}
              onReady={() => handleReady(slot)}
              onError={(error) => {
                if (source) {
                  reportError(source.id, error);
                }
              }}
            />
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
      {phase === "idle" && renderedScene ? renderHotspots?.(renderedScene) : null}
    </Fragment>
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
  const resolvedId = useSceneSelection({
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
        phaseRef={phaseRef}
      />
    </TileTextureManagerProvider>
  );
}
