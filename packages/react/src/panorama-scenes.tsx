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
import type { ReactNode } from "react";
import {
  DoubleSide,
  LinearSRGBColorSpace,
  LinearFilter,
  Mesh,
  PlaneGeometry,
  PerspectiveCamera,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderTarget,
} from "three";
import { PanoramaControlsContext } from "./auto-rotate";
import { Sphere } from "./sphere";
import {
  TileTextureManagerProvider,
  useSharedTileTextureManager,
} from "./tile/texture-manager-context";
import { Tile } from "./tile/tile";
import type { TileProps } from "./tile/types";

export type PanoramaTransitionPreset =
  | "none"
  | "crossfade"
  | "zoom"
  | "blackout"
  | "whiteFlash"
  | "slideRightToLeft"
  | "slideTopToBottom"
  | "slideDiagonal"
  | "circleOpen"
  | "verticalOpen"
  | "horizontalOpen"
  | "ellipticZoomOpen";

export type PanoramaTransition =
  | PanoramaTransitionPreset
  | {
      preset: PanoramaTransitionPreset;
      /** Overrides the KRpano-compatible default duration in seconds. */
      duration?: number;
    };

export type SpherePanoramaScene = {
  id: string;
  type: "sphere";
  src: string;
  yawOffset?: number;
};

export type TilePanoramaScene = Omit<
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

export type PanoramaScene = SpherePanoramaScene | TilePanoramaScene;

export type PanoramaTransitionEndEvent = {
  previousSceneId: string;
  sceneId: string;
  preset: PanoramaTransitionPreset;
};

export type PanoramaTransitionErrorEvent = {
  sceneId: string;
  error: unknown;
};

export type PanoramaScenesProps = {
  scenes: readonly PanoramaScene[];
  activeSceneId: string;
  transition?: PanoramaTransition;
  /** Rendered only after a scene has finished transitioning in. */
  renderHotspots?: (scene: PanoramaScene) => ReactNode;
  onTransitionEnd?: (event: PanoramaTransitionEndEvent) => void;
  onTransitionError?: (event: PanoramaTransitionErrorEvent) => void;
  /** Viewer-wide budget shared by every tile scene. Defaults to 128 MiB. */
  maxTextureMemoryMb?: number;
  /** Viewer-wide tile request limit. Defaults to 4. */
  maxConcurrentTileLoads?: number;
  /** Maximum physical-pixel area of the outgoing GPU snapshot. */
  snapshotMaxPixels?: number;
};

type TransitionDefinition = {
  preset: PanoramaTransitionPreset;
  duration: number;
};

type Snapshot = {
  texture: Texture;
  dispose: () => void;
};

type Phase = "idle" | "preloading" | "capturing" | "recapturing" | "transitioning";

const TRANSITION_DEFAULTS: Record<PanoramaTransitionPreset, {
  duration: number;
  krpanoBlend: string;
}> = {
  none: { duration: 0, krpanoBlend: "NOBLEND" },
  crossfade: { duration: 1, krpanoBlend: "BLEND(1.0, easeInCubic)" },
  zoom: { duration: 2, krpanoBlend: "ZOOMBLEND(2.0, 2.0, easeInOutSine)" },
  blackout: { duration: 2, krpanoBlend: "COLORBLEND(2.0, 0x000000, easeOutSine)" },
  whiteFlash: { duration: 1, krpanoBlend: "LIGHTBLEND(1.0, 0xFFFFFF, 2.0, linear)" },
  slideRightToLeft: { duration: 1, krpanoBlend: "SLIDEBLEND(1.0, 0.0, 0.2, linear)" },
  slideTopToBottom: { duration: 1, krpanoBlend: "SLIDEBLEND(1.0, 90.0, 0.01, linear)" },
  slideDiagonal: { duration: 1, krpanoBlend: "SLIDEBLEND(1.0, 135.0, 0.4, linear)" },
  circleOpen: { duration: 1, krpanoBlend: "OPENBLEND(1.0, 0.0, 0.2, 0.0, linear)" },
  verticalOpen: { duration: 0.7, krpanoBlend: "OPENBLEND(0.7, 1.0, 0.1, 0.0, linear)" },
  horizontalOpen: { duration: 1, krpanoBlend: "OPENBLEND(1.0, -1.0, 0.3, 0.0, linear)" },
  ellipticZoomOpen: { duration: 1, krpanoBlend: "OPENBLEND(1.0, -0.5, 0.3, 0.8, linear)" },
};

const EFFECT_INDEX: Record<PanoramaTransitionPreset, number> = {
  none: 0,
  crossfade: 1,
  zoom: 2,
  blackout: 3,
  whiteFlash: 4,
  slideRightToLeft: 5,
  slideTopToBottom: 6,
  slideDiagonal: 7,
  circleOpen: 8,
  verticalOpen: 9,
  horizontalOpen: 10,
  ellipticZoomOpen: 11,
};

function resolveTransition(transition: PanoramaTransition | undefined): TransitionDefinition {
  const preset = typeof transition === "string" ? transition : transition?.preset ?? "crossfade";
  return {
    preset,
    duration: Math.max(
      0,
      transition && typeof transition === "object" && Number.isFinite(transition.duration)
        ? transition.duration!
        : TRANSITION_DEFAULTS[preset].duration,
    ),
  };
}

function SceneSource({
  scene,
  visible,
  baseOnly,
  onReady,
  onError,
}: {
  scene: PanoramaScene | null;
  visible: boolean;
  baseOnly: boolean;
  onReady: () => void;
  onError: (error: unknown) => void;
}) {
  if (!scene) {
    return null;
  }

  if (scene.type === "sphere") {
    return (
      <Sphere
        src={scene.src}
        yawOffset={scene.yawOffset}
        visible={visible}
        onLoad={onReady}
        onError={onError}
      />
    );
  }

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

function SnapshotOverlay({
  snapshot,
  transition,
  running,
  runId,
  onFinish,
}: {
  snapshot: Snapshot;
  transition: TransitionDefinition;
  running: boolean;
  runId: number;
  onFinish: () => void;
}) {
  const { camera, size } = useThree();
  const meshRef = useRef<Mesh>(null);
  const startRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const directionRef = useRef(new Vector3());
  const material = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          map: { value: snapshot.texture },
          progress: { value: 0 },
          effect: { value: EFFECT_INDEX[transition.preset] },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D map;
          uniform float progress;
          uniform float effect;
          varying vec2 vUv;

          float easeInCubic(float t) { return t * t * t; }
          float easeOutSine(float t) { return sin(t * 1.57079632679); }
          float easeInOutSine(float t) { return -(cos(3.14159265359 * t) - 1.0) * 0.5; }

          void main() {
            float t = clamp(progress, 0.0, 1.0);
            vec2 uv = vUv;
            vec4 old = texture2D(map, uv);
            float alpha = 1.0;

            if (effect == 1.0) {
              alpha = 1.0 - easeInCubic(t);
            } else if (effect == 2.0) {
              float eased = easeInOutSine(t);
              // ZOOMBLEND(2.0, 2.0, easeInOutSine): reach 2x zoom.
              uv = 0.5 + (vUv - 0.5) / mix(1.0, 2.0, eased);
              old = texture2D(map, uv);
              alpha = 1.0 - eased;
            } else if (effect == 3.0) {
              // COLORBLEND(2.0, 0x000000, easeOutSine).
              float blackout = easeOutSine(min(1.0, t * 2.0));
              float reveal = easeOutSine(max(0.0, (t - 0.5) * 2.0));
              old.rgb = mix(old.rgb, vec3(0.0), blackout);
              alpha = 1.0 - reveal;
            } else if (effect == 4.0) {
              // LIGHTBLEND(1.0, 0xFFFFFF, 2.0, linear).
              float flash = min(1.0, 2.0 * sin(t * 3.14159265359));
              old.rgb = mix(old.rgb, vec3(1.0), flash);
              alpha = 1.0 - t;
            } else if (effect >= 5.0 && effect <= 7.0) {
              vec2 direction = effect == 5.0 ? vec2(1.0, 0.0) : (effect == 6.0 ? vec2(0.0, 1.0) : normalize(vec2(-1.0, 1.0)));
              float coordinate = dot(vUv - 0.5, direction) + 0.5;
              float softness = effect == 5.0 ? 0.2 : (effect == 6.0 ? 0.01 : 0.4);
              alpha = smoothstep(t - softness, t + softness, coordinate);
            } else if (effect >= 8.0) {
              vec2 point = vUv - 0.5;
              vec2 scale = effect == 9.0 ? vec2(4.0, 1.0) : (effect == 10.0 ? vec2(1.0, 4.0) : vec2(1.35, 0.8));
              float distanceFromCenter = length(point * scale);
              float edge = effect == 8.0 ? 0.2 : (effect == 9.0 ? 0.1 : 0.3);
              float radius = t * (effect == 9.0 ? 1.1 : 1.45);
              alpha = smoothstep(radius, radius + edge, distanceFromCenter);
              if (effect == 11.0) {
                // OPENBLEND(1.0, -0.5, 0.3, 0.8, linear).
                old = texture2D(map, 0.5 + point / (1.0 + 0.8 * t));
              }
            }
            gl_FragColor = vec4(old.rgb, old.a * alpha);
            // The snapshot is linear. Encode it for the drawing buffer so it
            // matches the newly rendered panorama beneath this overlay.
            #include <colorspace_fragment>
          }
        `,
      }),
    [snapshot.texture, transition.preset],
  );

  useEffect(() => () => material.dispose(), [material]);
  useEffect(() => {
    startRef.current = null;
    finishedRef.current = false;
    material.uniforms.progress.value = 0;
  }, [material, runId]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh || !(camera as { isPerspectiveCamera?: boolean }).isPerspectiveCamera) {
      return;
    }
    const perspectiveCamera = camera as PerspectiveCamera;
    const distance = Math.max(perspectiveCamera.near * 1.1, 0.11);
    camera.getWorldDirection(directionRef.current);
    mesh.position.copy(camera.position).addScaledVector(directionRef.current, distance);
    mesh.quaternion.copy(camera.quaternion);
    const height = 2 * distance * Math.tan((perspectiveCamera.fov * Math.PI) / 360);
    mesh.scale.set(height * perspectiveCamera.aspect, height, 1);

    if (!running || finishedRef.current) {
      return;
    }
    if (startRef.current === null) {
      startRef.current = state.clock.elapsedTime;
    }
    const progress = transition.duration === 0
      ? 1
      : Math.min(1, (state.clock.elapsedTime - startRef.current) / transition.duration);
    material.uniforms.progress.value = progress;
    if (progress === 1) {
      finishedRef.current = true;
      onFinish();
    }
  });

  return (
    <mesh ref={meshRef} renderOrder={10_000} frustumCulled={false}>
      <primitive attach="geometry" object={FULLSCREEN_PLANE} />
      <primitive attach="material" object={material} />
    </mesh>
  );
}

const FULLSCREEN_PLANE = new PlaneGeometry(1, 1);

function PanoramaScenesController({
  scenes,
  activeSceneId,
  transition: transitionInput,
  renderHotspots,
  onTransitionEnd,
  onTransitionError,
  snapshotMaxPixels = 3_686_400,
}: Omit<PanoramaScenesProps, "maxTextureMemoryMb" | "maxConcurrentTileLoads">) {
  const controlsRef = useContext(PanoramaControlsContext);
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
  const [slots, setSlots] = useState<[PanoramaScene | null, PanoramaScene | null]>([
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
  const transitionFromRef = useRef<PanoramaScene | null>(initialScene);
  slotsRef.current = slots;
  phaseRef.current = phase;
  liveSlotRef.current = liveSlot;

  const releaseInteraction = useCallback(() => {
    interactionReleaseRef.current?.();
    interactionReleaseRef.current = null;
  }, []);

  const reportError = useCallback((sceneId: string, error: unknown) => {
    onTransitionError?.({ sceneId, error });
  }, [onTransitionError]);

  const startPreload = useCallback((scene: PanoramaScene) => {
    const nextSlot = 1 - liveSlotRef.current;
    requestedSceneIdRef.current = scene.id;
    setSlots((current) => {
      const next: [PanoramaScene | null, PanoramaScene | null] = [...current] as [PanoramaScene | null, PanoramaScene | null];
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
        const next: [PanoramaScene | null, PanoramaScene | null] = [...current] as [PanoramaScene | null, PanoramaScene | null];
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
      const next: [PanoramaScene | null, PanoramaScene | null] = [...current] as [PanoramaScene | null, PanoramaScene | null];
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
        <SnapshotOverlay
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

export function PanoramaScenes({
  maxTextureMemoryMb,
  maxConcurrentTileLoads,
  ...props
}: PanoramaScenesProps) {
  return (
    <TileTextureManagerProvider
      maxTextureMemoryMb={maxTextureMemoryMb}
      maxConcurrentLoads={maxConcurrentTileLoads}
    >
      <PanoramaScenesController {...props} />
    </TileTextureManagerProvider>
  );
}
