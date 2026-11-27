import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  CircleGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Vector3,
} from "three";
import { PanoEventBusContext } from "../pano-event-bus";
import { WebVRRuntimeContext } from "../webvr/host";
import {
  DEFAULT_CALLOUT_LOOK_ANGLE,
  DEFAULT_CALLOUT_LOOK_DELAY,
  DEFAULT_CALLOUT_MARKER_COLOR,
  directionAngleDegrees,
  fovScaledLookAngle,
  resolveCalloutContent,
  stepLookGate,
  type CalloutAnimation,
  type CalloutAppearance,
  type CalloutContent,
  type CalloutLine,
  type CalloutMarker,
  type CalloutTrigger,
  type LookGateState,
} from "./callout-layout";
import { CalloutOverlay } from "./callout-overlay";
import { HotspotAnchor } from "./hotspot-anchor";
import { SpatialCallout } from "./spatial-callout";
import type { HotspotCommonProps, HotspotInteractionEvent } from "./types";
import { useCalloutReveal } from "./use-callout-reveal";

const MARKER_SEGMENTS = 32;
const markerGeometry = new CircleGeometry(0.5, MARKER_SEGMENTS);
markerGeometry.translate(0, 0, 0.002);
const haloGeometry = new CircleGeometry(0.5, MARKER_SEGMENTS);
haloGeometry.translate(0, 0, 0.001);
const hitGeometry = new CircleGeometry(0.5, MARKER_SEGMENTS);

/** Solid disc scale in the hotspot unit plane (diameter 1 at scale 1). */
const DOT_SCALE = 0.36;
/** Halo scale relative to the unit plane; keeps a soft ring around the smaller dot. */
const HALO_SCALE_MIN = 1.05;
const HALO_SCALE_MAX = 1.45;
/** Invisible hit disc; covers the pulsing halo so the small solid dot stays easy to click. */
const HIT_SCALE = HALO_SCALE_MAX;
const HALO_OPACITY_MAX = 0.34;
const HALO_OPACITY_MIN = 0.1;
const HALO_PULSE_HZ = 0.55;
const DEFAULT_MARKER_SIZE = 3.2;
const DEFAULT_REFERENCE_FOV = 75;

function subscribeReducedMotion(onStoreChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) {
    return () => undefined;
  }
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function reducedMotionSnapshot() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function CalloutMarkerVisual({
  color,
  renderOrder = 0,
}: {
  color: string;
  renderOrder?: number;
}) {
  const haloRef = useRef<Mesh>(null);
  const haloMaterialRef = useRef<MeshBasicMaterial>(null);
  const phase = useRef(0);
  const invalidate = useThree((state) => state.invalidate);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    () => false,
  );
  const resolved = useMemo(() => new Color(color), [color]);

  useFrame((_, delta) => {
    const halo = haloRef.current;
    const material = haloMaterialRef.current;
    if (!halo || !material) return;
    if (reducedMotion) {
      halo.scale.setScalar(HALO_SCALE_MIN);
      material.opacity = HALO_OPACITY_MAX;
      return;
    }
    phase.current =
      (phase.current + delta * HALO_PULSE_HZ) % 1;
    const wave = 0.5 - 0.5 * Math.cos(phase.current * Math.PI * 2);
    const scale = HALO_SCALE_MIN + (HALO_SCALE_MAX - HALO_SCALE_MIN) * wave;
    const opacity =
      HALO_OPACITY_MAX - (HALO_OPACITY_MAX - HALO_OPACITY_MIN) * wave;
    halo.scale.setScalar(scale);
    material.opacity = opacity;
    invalidate();
  });

  return (
    <group>
      <mesh geometry={hitGeometry} scale={HIT_SCALE}>
        <meshBasicMaterial
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        ref={haloRef}
        geometry={haloGeometry}
        renderOrder={renderOrder}
        scale={HALO_SCALE_MIN}
        raycast={() => {}}
      >
        <meshBasicMaterial
          ref={haloMaterialRef}
          color={resolved}
          transparent
          opacity={HALO_OPACITY_MAX}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh
        geometry={markerGeometry}
        renderOrder={(renderOrder ?? 0) + 1}
        scale={DOT_SCALE}
        raycast={() => {}}
      >
        <meshBasicMaterial
          color={resolved}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

const lookScratch = {
  cameraDir: new Vector3(),
  hotspotDir: new Vector3(),
  cameraPos: new Vector3(),
};

export type CalloutHotspotProps = Omit<
  HotspotCommonProps,
  | "tooltip"
  | "tooltipTrigger"
  | "tooltipPlacement"
  | "tooltipMode"
  | "tooltipScaleMode"
  | "tooltipOffset"
  | "tooltipAppearance"
> & {
  content: CalloutContent;
  trigger?: CalloutTrigger;
  line?: CalloutLine;
  appearance?: CalloutAppearance;
  animation?: CalloutAnimation;
  marker?: CalloutMarker;
  lookAngle?: number;
  lookDelay?: number;
};

function isTouchPointer(event: HotspotInteractionEvent): boolean {
  const native = event.nativeEvent;
  return (
    "pointerType" in native &&
    typeof native.pointerType === "string" &&
    native.pointerType === "touch"
  );
}

export function CalloutHotspot({
  content,
  trigger = "hover",
  line,
  appearance,
  animation,
  marker,
  lookAngle = DEFAULT_CALLOUT_LOOK_ANGLE,
  lookDelay = DEFAULT_CALLOUT_LOOK_DELAY,
  width = DEFAULT_MARKER_SIZE,
  height = DEFAULT_MARKER_SIZE,
  mode = "billboard",
  scaleMode = "fixed",
  referenceFov = DEFAULT_REFERENCE_FOV,
  onClick,
  onHoverChange,
  ...anchorProps
}: CalloutHotspotProps) {
  const resolvedContent = useMemo(
    () => resolveCalloutContent(content),
    [content],
  );
  const markerColor = marker?.color?.trim() || DEFAULT_CALLOUT_MARKER_COLOR;
  const inVR = Boolean(useContext(WebVRRuntimeContext)?.mode);
  const eventBus = useContext(PanoEventBusContext);
  const [pinned, setPinned] = useState(trigger === "always");
  const [hovered, setHovered] = useState(false);
  const [lookOpen, setLookOpen] = useState(false);
  const lookGate = useRef<LookGateState>({
    inside: false,
    since: null,
    open: false,
  });
  const groupRef = useRef<{ getWorldPosition: (target: Vector3) => Vector3 } | null>(
    null,
  );

  const open = (() => {
    switch (trigger) {
      case "always":
        return true;
      case "click":
        return pinned;
      case "hover":
        return hovered || pinned;
      case "look":
        return lookOpen;
      default: {
        const exhaustive: never = trigger;
        return exhaustive;
      }
    }
  })();

  const { progress, mounted } = useCalloutReveal(open && resolvedContent !== null, animation);

  useEffect(() => {
    if (trigger === "always") {
      setPinned(true);
      return;
    }
    if (trigger !== "click" && trigger !== "hover") {
      setPinned(false);
    }
  }, [trigger]);

  useEffect(() => {
    if (trigger !== "click" && !(trigger === "hover" && pinned)) {
      return;
    }
    if (trigger === "hover" && !pinned) {
      return;
    }
    return eventBus?.subscribe("click", () => {
      setPinned(false);
    });
  }, [eventBus, pinned, trigger]);

  useEffect(() => {
    if (trigger !== "look") {
      lookGate.current = { inside: false, since: null, open: false };
      setLookOpen(false);
    }
  }, [trigger]);

  useFrame((state) => {
    if (trigger !== "look" || !resolvedContent) return;
    const camera = state.camera;
    camera.getWorldDirection(lookScratch.cameraDir);
    camera.getWorldPosition(lookScratch.cameraPos);
    const anchor = groupRef.current;
    if (!anchor) return;
    anchor.getWorldPosition(lookScratch.hotspotDir);
    lookScratch.hotspotDir.sub(lookScratch.cameraPos).normalize();
    const angle = directionAngleDegrees(
      lookScratch.cameraDir.x,
      lookScratch.cameraDir.y,
      lookScratch.cameraDir.z,
      lookScratch.hotspotDir.x,
      lookScratch.hotspotDir.y,
      lookScratch.hotspotDir.z,
    );
    const currentFov =
      camera instanceof PerspectiveCamera ? camera.fov : DEFAULT_REFERENCE_FOV;
    const enterAngle = fovScaledLookAngle(
      lookAngle,
      currentFov,
      referenceFov,
    );
    const next = stepLookGate(
      lookGate.current,
      angle,
      enterAngle,
      lookDelay,
      performance.now(),
    );
    lookGate.current = next;
    if (next.open !== lookOpen) {
      setLookOpen(next.open);
    }
  });

  const handleClick = (event: HotspotInteractionEvent) => {
    switch (trigger) {
      case "click":
        setPinned((current) => !current);
        break;
      case "hover":
        if (isTouchPointer(event) || event.source === "keyboard") {
          setPinned((current) => !current);
        }
        break;
      case "look":
        if (event.source === "keyboard") {
          setLookOpen((current) => !current);
        }
        break;
      case "always":
        break;
      default: {
        const exhaustive: never = trigger;
        return exhaustive;
      }
    }
    onClick?.(event);
  };

  const handleHoverChange = (
    next: boolean,
    event: HotspotInteractionEvent,
  ) => {
    if (trigger === "hover") {
      setHovered(next);
      if (next) setPinned(false);
    }
    onHoverChange?.(next, event);
  };

  if (!resolvedContent) {
    return (
      <HotspotAnchor
        {...anchorProps}
        width={width}
        height={height}
        mode={mode}
        scaleMode={scaleMode}
        referenceFov={referenceFov}
        onClick={onClick}
        onHoverChange={onHoverChange}
      >
        <CalloutMarkerVisual
          color={markerColor}
          renderOrder={anchorProps.renderOrder}
        />
      </HotspotAnchor>
    );
  }

  return (
    <HotspotAnchor
      {...anchorProps}
      width={width}
      height={height}
      mode={mode}
      scaleMode={scaleMode}
      referenceFov={referenceFov}
      onClick={handleClick}
      onHoverChange={handleHoverChange}
    >
      <group
        ref={(node) => {
          groupRef.current = node;
        }}
      >
        <CalloutMarkerVisual
          color={markerColor}
          renderOrder={anchorProps.renderOrder}
        />
        {mounted ? (
          inVR ? (
            <SpatialCallout
              content={resolvedContent}
              line={line}
              appearance={appearance}
              progress={progress}
            />
          ) : (
            <CalloutOverlay
              content={resolvedContent}
              line={line}
              appearance={appearance}
              progress={progress}
            />
          )
        ) : null}
      </group>
    </HotspotAnchor>
  );
}
