import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import {
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import type { ReactNode } from "react";
import {
  EdgesGeometry,
  MathUtils,
  Matrix4,
  Object3D,
  PlaneGeometry,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import { PanoramaControlsContext } from "../auto-rotate";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";
import { useHotspotAccessibility } from "./accessibility";
import {
  normalizePanoPosition,
  panoPositionToVector3,
  vector3ToPanoPosition,
} from "./coordinates";
import type {
  HotspotCommonProps,
  HotspotInteractionEvent,
  HotspotPosition,
} from "./types";

const DEFAULT_FLOATING_DISTANCE = 10;
const PANORAMA_RADIUS = DEFAULT_PANORAMA_RADIUS;
// Keep a stable gap from the shell; a sub-unit gap z-fights at radius 1000.
const PANORAMA_SURFACE_INSET = 4;
const DEFAULT_REFERENCE_FOV = 75;
const MIN_ANGULAR_SIZE = 0.01;
const MAX_ANGULAR_SIZE = 179;
const DRAG_EPSILON_DEGREES = 0.001;
const LOCAL_FORWARD = new Vector3(0, 0, 1);

type DragState = {
  pointerId: number;
  startPosition: HotspotPosition;
  releaseInteractionLock: () => void;
  moved: boolean;
};

export type HotspotAnchorProps = Omit<HotspotCommonProps, "opacity"> & {
  width: number;
  height: number;
  /** Internal escape hatch for world-space children such as polygons. */
  useAngularScale?: boolean;
  focusContent?: ReactNode;
  children?: ReactNode;
};

function angularSizeToWorldSize(size: number, radius: number): number {
  const safeSize = Number.isFinite(size)
    ? MathUtils.clamp(Math.abs(size), MIN_ANGULAR_SIZE, MAX_ANGULAR_SIZE)
    : MIN_ANGULAR_SIZE;
  return 2 * radius * Math.tan(MathUtils.degToRad(safeSize) / 2);
}

function resolveDistance(
  placement: "surface" | "floating",
  distance: number | undefined,
  width: number,
  height: number,
): number {
  const maximumDistance = maximumHotspotDistance(width, height);
  if (placement === "surface") {
    return maximumDistance;
  }
  if (!Number.isFinite(distance)) {
    return DEFAULT_FLOATING_DISTANCE;
  }
  return MathUtils.clamp(Math.abs(distance!), 0.1, maximumDistance);
}

function maximumHotspotDistance(width: number, height: number): number {
  const safeWidth = MathUtils.clamp(
    Math.abs(Number.isFinite(width) ? width : MIN_ANGULAR_SIZE),
    MIN_ANGULAR_SIZE,
    MAX_ANGULAR_SIZE,
  );
  const safeHeight = MathUtils.clamp(
    Math.abs(Number.isFinite(height) ? height : MIN_ANGULAR_SIZE),
    MIN_ANGULAR_SIZE,
    MAX_ANGULAR_SIZE,
  );
  const cornerFactor = Math.hypot(
    1,
    Math.tan(MathUtils.degToRad(safeWidth) / 2),
    Math.tan(MathUtils.degToRad(safeHeight) / 2),
  );
  return (PANORAMA_RADIUS - PANORAMA_SURFACE_INSET) / cornerFactor;
}

function fixedScaleFactor(cameraFov: number, referenceFov: number): number {
  const safeReferenceFov = MathUtils.clamp(referenceFov, 1, 179);
  return (
    Math.tan(MathUtils.degToRad(cameraFov) / 2) /
    Math.tan(MathUtils.degToRad(safeReferenceFov) / 2)
  );
}

function createSurfaceQuaternion(position: HotspotPosition): Quaternion {
  const outward = panoPositionToVector3(position).normalize();
  const inward = outward.clone().negate();
  const pitch = MathUtils.degToRad(position.pitch);
  const yaw = MathUtils.degToRad(position.yaw);
  const localUp = new Vector3(
    -Math.sin(pitch) * Math.sin(yaw),
    Math.cos(pitch),
    Math.sin(pitch) * Math.cos(yaw),
  ).normalize();
  const localRight = localUp.clone().cross(inward).normalize();
  const basis = new Matrix4().makeBasis(localRight, localUp, inward);
  return new Quaternion().setFromRotationMatrix(basis);
}

function makeInteractionEvent(
  id: string,
  position: HotspotPosition,
  event: ThreeEvent<MouseEvent | PointerEvent>,
): HotspotInteractionEvent {
  return {
    id,
    position: normalizePanoPosition(position),
    source: "pointer",
    nativeEvent: event.nativeEvent,
  };
}

function angularDistance(a: HotspotPosition, b: HotspotPosition): number {
  const aVector = panoPositionToVector3(a);
  const bVector = panoPositionToVector3(b);
  return MathUtils.radToDeg(aVector.angleTo(bVector));
}

/** Internal spatial and interaction primitive shared by concrete hotspots. */
export function HotspotAnchor({
  id,
  position,
  width,
  height,
  useAngularScale = true,
  focusContent,
  placement = "floating",
  distance,
  orientation = "billboard",
  scaleMode = "fov",
  referenceFov = DEFAULT_REFERENCE_FOV,
  rotation = 0,
  renderOrder = 0,
  visible = true,
  draggable = false,
  ariaLabel,
  children,
  onClick,
  onHoverChange,
  onDragStart,
  onPositionChange,
  onDragEnd,
}: HotspotAnchorProps) {
  const controlsRef = useContext(PanoramaControlsContext);
  const groupRef = useRef<Object3D>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const normalizedPosition = normalizePanoPosition(position);
  const resolvedDistance = resolveDistance(placement, distance, width, height);
  const worldPosition = useMemo(
    () => panoPositionToVector3(normalizedPosition, resolvedDistance),
    [normalizedPosition.pitch, normalizedPosition.yaw, resolvedDistance],
  );
  const surfaceQuaternion = useMemo(
    () => createSurfaceQuaternion(normalizedPosition),
    [normalizedPosition.pitch, normalizedPosition.yaw],
  );
  const worldWidth = angularSizeToWorldSize(width, resolvedDistance);
  const worldHeight = angularSizeToWorldSize(height, resolvedDistance);
  const focusGeometry = useMemo(() => {
    const planeGeometry = new PlaneGeometry(1, 1);
    const geometry = new EdgesGeometry(planeGeometry);
    planeGeometry.dispose();
    return geometry;
  }, []);
  const focused = useHotspotAccessibility({
    id,
    ariaLabel,
    onActivate: visible && onClick
      ? (event) => {
          onClick({
            id,
            position: normalizedPosition,
            source: "keyboard",
            nativeEvent: event,
          });
        }
      : undefined,
  });

  useEffect(
    () => () => {
      dragStateRef.current?.releaseInteractionLock();
      dragStateRef.current = null;
    },
    [],
  );

  useEffect(() => () => focusGeometry.dispose(), [focusGeometry]);

  useFrame(({ camera }) => {
    if (!groupRef.current) {
      return;
    }
    if (orientation === "billboard") {
      groupRef.current.quaternion.copy(camera.quaternion);
    } else {
      groupRef.current.quaternion.copy(surfaceQuaternion);
    }
    groupRef.current.rotateOnAxis(
      LOCAL_FORWARD,
      MathUtils.degToRad(rotation),
    );
    const scaleFactor =
      scaleMode === "fixed" && camera instanceof PerspectiveCamera
        ? fixedScaleFactor(camera.fov, referenceFov)
        : 1;
    groupRef.current.scale.set(
      (useAngularScale ? worldWidth : 1) * scaleFactor,
      (useAngularScale ? worldHeight : 1) * scaleFactor,
      1,
    );
  });

  const stopPointerEvent = (event: ThreeEvent<MouseEvent | PointerEvent>) => {
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
  };

  const releasePointer = (
    event: ThreeEvent<PointerEvent>,
    emitDragEnd: boolean,
  ) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    stopPointerEvent(event);
    const target = event.target as Element;
    if (target.hasPointerCapture?.(event.pointerId)) {
      target.releasePointerCapture?.(event.pointerId);
    }
    const nextPosition = vector3ToPanoPosition(event.ray.direction);
    if (emitDragEnd) {
      onDragEnd?.({
        ...makeInteractionEvent(id, nextPosition, event),
        source: "pointer",
        startPosition: dragState.startPosition,
      });
    }
    suppressNextClickRef.current = dragState.moved;
    dragState.releaseInteractionLock();
    dragStateRef.current = null;
  };

  return (
    <group
      ref={groupRef}
      position={worldPosition}
      renderOrder={renderOrder}
      scale={[worldWidth, worldHeight, 1]}
      visible={visible}
      onClick={(event) => {
        stopPointerEvent(event);
        if (!suppressNextClickRef.current) {
          onClick?.(makeInteractionEvent(id, normalizedPosition, event));
        }
        suppressNextClickRef.current = false;
      }}
      onLostPointerCapture={(event) => releasePointer(event, false)}
      onPointerCancel={(event) => releasePointer(event, false)}
      onPointerDown={(event) => {
        stopPointerEvent(event);
        if (!draggable || dragStateRef.current) {
          return;
        }
        const releaseInteractionLock =
          controlsRef?.current?.acquireInteractionLock() ?? (() => undefined);
        const target = event.target as Element;
        target.setPointerCapture?.(event.pointerId);
        const startPosition = { ...normalizedPosition };
        dragStateRef.current = {
          pointerId: event.pointerId,
          startPosition,
          releaseInteractionLock,
          moved: false,
        };
        onDragStart?.({
          ...makeInteractionEvent(id, startPosition, event),
          source: "pointer",
          startPosition,
        });
      }}
      onPointerMove={(event) => {
        const dragState = dragStateRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) {
          return;
        }
        stopPointerEvent(event);
        const nextPosition = vector3ToPanoPosition(event.ray.direction);
        dragState.moved ||=
          angularDistance(dragState.startPosition, nextPosition) >
          DRAG_EPSILON_DEGREES;
        onPositionChange?.({
          ...makeInteractionEvent(id, nextPosition, event),
          source: "pointer",
          startPosition: dragState.startPosition,
        });
      }}
      onPointerOut={(event) => {
        if (!dragStateRef.current) {
          onHoverChange?.(
            false,
            makeInteractionEvent(id, normalizedPosition, event),
          );
        }
      }}
      onPointerOver={(event) => {
        if (!dragStateRef.current) {
          onHoverChange?.(
            true,
            makeInteractionEvent(id, normalizedPosition, event),
          );
        }
      }}
      onPointerUp={(event) => releasePointer(event, true)}
    >
      {focused ? (focusContent ?? (
        <lineSegments
          geometry={focusGeometry}
          position={[0, 0, 0.01]}
          renderOrder={renderOrder + 1}
          scale={[1.12, 1.12, 1]}
        >
          <lineBasicMaterial color="#f5fbfc" depthTest={false} />
        </lineSegments>
      )) : null}
      {children}
    </group>
  );
}
