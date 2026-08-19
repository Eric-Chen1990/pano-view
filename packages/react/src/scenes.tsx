import { useFrame, useThree } from "@react-three/fiber";
import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MutableRefObject, ReactNode } from "react";
import {
  LinearSRGBColorSpace,
  LinearFilter,
  WebGLRenderTarget,
} from "three";
import { cycleSceneId } from "./keyboard-controls";
import { PanoramaViewContext } from "./panorama-view-runtime";
import type { Snapshot } from "./scene-transitions/overlay-utils";
import { resolveTransition } from "./scene-transitions/presets";
import type { SceneTransition, SceneTransitionPreset } from "./scene-transitions/presets";
import {
  notifyScenesHost,
  ScenesHostContext,
  type ScenesController,
} from "./scenes-host";
import { TransitionOverlay } from "./scene-transitions/transition-overlay";
import { Sphere } from "./sphere";
import {
  TileTextureManagerProvider,
  useSharedTileTextureManager,
} from "./tile/texture-manager-context";
import { Tile } from "./tile/tile";
import type { TileProps } from "./tile/types";

export type { SceneTransition, SceneTransitionPreset } from "./scene-transitions/presets";

export type SphereScene = {
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
> & {
  id: string;
  type: "tile";
};

export type Scene = SphereScene | TileScene;

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
  onTransitionEnd?: (event: SceneTransitionEndEvent) => void;
  onTransitionError?: (event: SceneTransitionErrorEvent) => void;
  /** Viewer-wide budget shared by every tile scene. Defaults to 128 MiB. */
  maxTextureMemoryMb?: number;
  /** Viewer-wide tile request limit. Defaults to 4. */
  maxConcurrentTileLoads?: number;
  /** Maximum physical-pixel area of the outgoing GPU snapshot. */
  snapshotMaxPixels?: number;
};

type Phase = "idle" | "preloading" | "capturing" | "recapturing" | "transitioning";

function SceneSource({
  scene,
  visible,
  baseOnly,
  onReady,
  onError,
}: {
  scene: Scene | null;
  visible: boolean;
  baseOnly: boolean;
  onReady: () => void;
  onError: (error: unknown) => void;
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
        />
      );
    case "tile": {
      const { id: _id, type: _type, ...tileProps } = scene;
      return (
        <Tile
          {...tileProps}
          visible={visible}
          loadMode={baseOnly ? "base" : "full"}
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
  const capturedRequestRef = useRef(0);
  const renderTargetRef = useRef<WebGLRenderTarget | null>(null);

  useEffect(
    () => () => {
      renderTargetRef.current?.dispose();
      renderTargetRef.current = null;
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
    const nextTarget = new WebGLRenderTarget(width, height, {
      depthBuffer: false,
      stencilBuffer: false,
    });
    // WebGLRenderer renders non-XR targets in its linear working color space.
    // Keep this metadata accurate so the snapshot is not treated as display-encoded.
    nextTarget.texture.colorSpace = LinearSRGBColorSpace;
    nextTarget.texture.generateMipmaps = false;
    nextTarget.texture.minFilter = LinearFilter;
    nextTarget.texture.magFilter = LinearFilter;

    // This one-off render keeps the transfer entirely on the GPU and permits
    // downscaling the snapshot before its texture is retained for blending.
    const previousTarget = gl.getRenderTarget();
    gl.setRenderTarget(nextTarget);
    gl.clear();
    gl.render(scene, camera);
    gl.setRenderTarget(previousTarget);

    capturedRequestRef.current = requestId;
    const previous = renderTargetRef.current;
    renderTargetRef.current = nextTarget;
    previous?.dispose();
    onCaptured({
      texture: nextTarget.texture,
      dispose: () => {
        if (renderTargetRef.current === nextTarget) {
          renderTargetRef.current = null;
        }
        nextTarget.dispose();
      },
    });
  });

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
  onTransitionEnd,
  onTransitionError,
  snapshotMaxPixels = 3_686_400,
  phaseRef: externalPhaseRef,
}: ScenesControllerProps) {
  const controlsRef = useContext(PanoramaViewContext);
  const manager = useSharedTileTextureManager();
  const transition = useMemo(
    () => resolveTransition(transitionInput),
    [transitionInput],
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
  slotsRef.current = slots;
  phaseRef.current = phase;
  if (externalPhaseRef) {
    externalPhaseRef.current = phase;
  }
  liveSlotRef.current = liveSlot;

  const releaseInteraction = useCallback(() => {
    interactionReleaseRef.current?.();
    interactionReleaseRef.current = null;
  }, []);

  const reportError = useCallback((sceneId: string, error: unknown) => {
    onTransitionError?.({ sceneId, error });
  }, [onTransitionError]);

  const startPreload = useCallback((scene: Scene) => {
    const nextSlot = 1 - liveSlotRef.current;
    requestedSceneIdRef.current = scene.id;
    setSlots((current) => {
      const next: [Scene | null, Scene | null] = [...current] as [Scene | null, Scene | null];
      next[nextSlot] = scene;
      return next;
    });
    setPendingSlot(nextSlot);
    setPhase("preloading");
  }, []);

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
      pendingSlot !== null &&
      slotsRef.current[pendingSlot]?.id === requested.id
    ) {
      requestedSceneIdRef.current = requested.id;
      return;
    }
    if (phaseRef.current === "transitioning" || phaseRef.current === "capturing") {
      requestedSceneIdRef.current = requested.id;
      captureReasonRef.current = "interrupt";
      setPhase("recapturing");
      setCaptureRequestId((current) => current + 1);
      return;
    }
    startPreload(requested);
  }, [activeSceneId, pendingSlot, reportError, sceneMap, startPreload]);

  const handleReady = useCallback((slot: number) => {
    if (slot !== pendingSlot || phaseRef.current !== "preloading") {
      return;
    }
    if (transition.preset === "none") {
      const previousScene = slotsRef.current[liveSlotRef.current];
      const nextScene = slotsRef.current[slot];
      setSlots((current) => {
        const next: [Scene | null, Scene | null] = [...current] as [Scene | null, Scene | null];
        next[liveSlotRef.current] = null;
        return next;
      });
      setLiveSlot(slot);
      setActiveSlot(slot);
      setPendingSlot(null);
      setPhase("idle");
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
  }, [controlsRef, onTransitionEnd, pendingSlot, transition.preset]);

  const handleCaptured = useCallback((nextSnapshot: Snapshot) => {
    setSnapshot((current) => {
      current?.dispose();
      return nextSnapshot;
    });

    if (captureReasonRef.current === "interrupt") {
      startPreload(sceneMap.get(requestedSceneIdRef.current)!);
      return;
    }

    const sourceSlot = liveSlotRef.current;
    setSlots((current) => {
      const next: [Scene | null, Scene | null] = [...current] as [Scene | null, Scene | null];
      next[sourceSlot] = null;
      return next;
    });
    manager?.releaseUnused();
    if (pendingSlot !== null) {
      setLiveSlot(pendingSlot);
    }
    setPhase("transitioning");
    setTransitionRunId((current) => current + 1);
  }, [manager, pendingSlot, sceneMap, startPreload]);

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

  useEffect(() => () => {
    releaseInteraction();
    snapshot?.dispose();
  }, [releaseInteraction, snapshot]);

  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      releaseInteraction();
      manager?.dispose();
      snapshot?.dispose();
      setSnapshot(null);
      setPendingSlot(null);
      setPhase("idle");
    };
    const onContextRestored = () => {
      manager?.resume();
      setRecoveryKey((current) => current + 1);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
    };
  }, [gl, manager, releaseInteraction, snapshot]);

  const renderedScene = slots[liveSlot];
  const snapshotVisible = snapshot !== null && (
    phase === "transitioning" ||
    phase === "recapturing" ||
    phase === "preloading"
  );

  return (
    <Fragment>
      <SnapshotCapture
        requestId={captureRequestId}
        maxPixels={Math.max(1, snapshotMaxPixels)}
        onCaptured={handleCaptured}
      />
      {[0, 1].map((slot) => {
        const source = slots[slot];
        const isLive = slot === liveSlot;
        const isPending = slot === pendingSlot;
        return (
          <SceneSource
            key={`${slot}:${source?.id ?? "empty"}:${recoveryKey}`}
            scene={source}
            visible={isLive}
            baseOnly={isPending && phase !== "idle"}
            onReady={() => handleReady(slot)}
            onError={(error) => {
              if (source) {
                reportError(source.id, error);
              }
            }}
          />
        );
      })}
      {snapshotVisible ? (
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
  const isControlled = controlledId !== undefined;
  const [internalId, setInternalId] = useState(
    () => controlledId ?? defaultActiveSceneId ?? scenes[0]?.id ?? "",
  );

  const resolvedId = isControlled ? controlledId : internalId;

  const requestSceneChange = useCallback(
    (id: string) => {
      if (isControlled) {
        onActiveSceneIdChange?.(id);
      } else {
        setInternalId(id);
      }
    },
    [isControlled, onActiveSceneIdChange],
  );

  const scenesRef = useRef(scenes);
  scenesRef.current = scenes;
  const resolvedIdRef = useRef(resolvedId);
  resolvedIdRef.current = resolvedId;

  const host = useContext(ScenesHostContext);
  const phaseRef = useRef<Phase>("idle");

  useEffect(() => {
    if (!host) {
      return;
    }

    const controller: ScenesController = {
      setScene: (id) => {
        const match = scenesRef.current.find((s) => s.id === id);
        if (!match) {
          return false;
        }
        requestSceneChange(id);
        return true;
      },
      nextScene: () => {
        const next = cycleSceneId(
          scenesRef.current,
          resolvedIdRef.current,
          1,
        );
        if (next === null) {
          return false;
        }
        requestSceneChange(next);
        return true;
      },
      previousScene: () => {
        const next = cycleSceneId(
          scenesRef.current,
          resolvedIdRef.current,
          -1,
        );
        if (next === null) {
          return false;
        }
        requestSceneChange(next);
        return true;
      },
      getActiveSceneId: () => resolvedIdRef.current,
      getSceneIds: () => scenesRef.current.map((s) => s.id),
      isTransitioning: () => phaseRef.current !== "idle",
    };

    host.controller = controller;
    notifyScenesHost(host);
    return () => {
      if (host.controller === controller) {
        host.controller = null;
        notifyScenesHost(host);
      }
    };
  }, [host, requestSceneChange]);

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
