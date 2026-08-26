import type { ThreeEvent } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  Box3,
  Camera,
  EdgesGeometry,
  MathUtils,
  Matrix4,
  Object3D,
  Plane,
  PlaneGeometry,
  PerspectiveCamera,
  Quaternion,
  Ray,
  Vector3,
} from "three";
import { PanoEventBusContext } from "../pano-event-bus";
import {
  hotspotCursorClaimId,
  usePanoCursor,
} from "../pano-cursor";
import { PanoramaViewContext } from "../panorama-view-runtime";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";
import { useHotspotAccessibility } from "./accessibility";
import {
  normalizePanoPosition,
  panoPositionToVector3,
  vector3ToPanoPosition,
} from "./coordinates";
import {
  HotspotTooltip,
  resolveHotspotTooltipContent,
  resolveHotspotTooltipOffset,
} from "./hotspot-tooltip";
import { HotspotTargetRegistryContext } from "./target-registry";
import {
  acceptsHotspotPointerEvents,
  type HotspotCommonProps,
  type HotspotInteractionEvent,
  type HotspotMode,
  type HotspotPosition,
  type HotspotScaleMode,
  type HotspotTooltipPlacement,
  type HotspotTooltipTrigger,
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
const TOOLTIP_WORLD_BOX = new Box3();
const TOOLTIP_LOCAL_BOX = new Box3();
const TOOLTIP_CORNER = new Vector3();
const TOOLTIP_INVERSE = new Matrix4();
const TOOLTIP_WORLD_CORNER = new Vector3();
const TOOLTIP_PROJECTED = new Vector3();
const TOOLTIP_RAY_ORIGIN = new Vector3();
const TOOLTIP_RAY_FAR = new Vector3();
const TOOLTIP_RAY_DIRECTION = new Vector3();
const TOOLTIP_RAY = new Ray();
const TOOLTIP_PLANE = new Plane();
const TOOLTIP_INTERSECTION = new Vector3();
const TOOLTIP_PLANE_NORMAL = new Vector3();
const TOOLTIP_PLANE_POINT = new Vector3();

type TooltipLocalBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type ViewportSize = {
  width: number;
  height: number;
};
const HOTSPOT_MODE_RENDERING: Record<
  HotspotMode,
  { orientation: "billboard" | "surface"; placement: "surface" | "floating" }
> = {
  surface: { orientation: "surface", placement: "surface" },
  billboard: { orientation: "billboard", placement: "floating" },
};

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
  /** Private support for world-space polygon and polyline primitives. */
  internalOrientation?: "billboard" | "surface";
  /** Private support for world-space polygon and polyline primitives. */
  internalPlacement?: "surface" | "floating";
};

function angularSizeToWorldSize(size: number, radius: number): number {
  const safeSize = Number.isFinite(size)
    ? MathUtils.clamp(Math.abs(size), MIN_ANGULAR_SIZE, MAX_ANGULAR_SIZE)
    : MIN_ANGULAR_SIZE;
  return 2 * radius * Math.tan(MathUtils.degToRad(safeSize) / 2);
}

function resolveScale(scale: number | undefined): number {
  return Number.isFinite(scale) && scale! > 0 ? scale! : 1;
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

function applyHotspotTransform(
  group: Object3D,
  camera: Camera,
  orientation: "billboard" | "surface",
  surfaceQuaternion: Quaternion,
  rotation: number,
  scaleMode: HotspotScaleMode,
  referenceFov: number,
  useAngularScale: boolean,
  worldWidth: number,
  worldHeight: number,
) {
  if (orientation === "billboard") {
    group.quaternion.copy(camera.quaternion);
  } else {
    group.quaternion.copy(surfaceQuaternion);
  }
  group.rotateOnAxis(LOCAL_FORWARD, MathUtils.degToRad(-rotation));
  const scaleFactor =
    scaleMode === "fixed" && camera instanceof PerspectiveCamera
      ? fixedScaleFactor(camera.fov, referenceFov)
      : 1;
  group.scale.set(
    (useAngularScale ? worldWidth : 1) * scaleFactor,
    (useAngularScale ? worldHeight : 1) * scaleFactor,
    1,
  );
  group.updateMatrixWorld();
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

function isTooltipOpen(
  trigger: HotspotTooltipTrigger,
  hovered: boolean,
  focused: boolean,
  pinned: boolean,
): boolean {
  switch (trigger) {
    case "always":
      return true;
    case "hover":
      return hovered || focused;
    case "click":
      return pinned;
    default: {
      const exhaustive: never = trigger;
      return exhaustive;
    }
  }
}

function setTooltipAnchorOnLocalBox(
  anchor: Object3D,
  placement: HotspotTooltipPlacement,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
) {
  switch (placement) {
    case "top":
      anchor.position.set((minX + maxX) / 2, maxY, 0);
      return;
    case "bottom":
      anchor.position.set((minX + maxX) / 2, minY, 0);
      return;
    case "left":
      anchor.position.set(minX, (minY + maxY) / 2, 0);
      return;
    case "right":
      anchor.position.set(maxX, (minY + maxY) / 2, 0);
      return;
    default: {
      const exhaustive: never = placement;
      return exhaustive;
    }
  }
}

function resolveTooltipLocalBounds(
  group: Object3D,
  anchor: Object3D,
  useAngularScale: boolean,
): TooltipLocalBounds | null {
  if (useAngularScale) {
    return { minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 };
  }
  group.updateMatrixWorld(true);
  TOOLTIP_WORLD_BOX.makeEmpty();
  for (const child of group.children) {
    if (child === anchor) {
      continue;
    }
    TOOLTIP_WORLD_BOX.expandByObject(child);
  }
  if (TOOLTIP_WORLD_BOX.isEmpty()) {
    return { minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 };
  }
  TOOLTIP_INVERSE.copy(group.matrixWorld).invert();
  TOOLTIP_LOCAL_BOX.makeEmpty();
  for (let x = 0; x <= 1; x += 1) {
    for (let y = 0; y <= 1; y += 1) {
      for (let z = 0; z <= 1; z += 1) {
        TOOLTIP_CORNER.set(
          x === 0 ? TOOLTIP_WORLD_BOX.min.x : TOOLTIP_WORLD_BOX.max.x,
          y === 0 ? TOOLTIP_WORLD_BOX.min.y : TOOLTIP_WORLD_BOX.max.y,
          z === 0 ? TOOLTIP_WORLD_BOX.min.z : TOOLTIP_WORLD_BOX.max.z,
        ).applyMatrix4(TOOLTIP_INVERSE);
        TOOLTIP_LOCAL_BOX.expandByPoint(TOOLTIP_CORNER);
      }
    }
  }
  return {
    minX: TOOLTIP_LOCAL_BOX.min.x,
    maxX: TOOLTIP_LOCAL_BOX.max.x,
    minY: TOOLTIP_LOCAL_BOX.min.y,
    maxY: TOOLTIP_LOCAL_BOX.max.y,
  };
}

function projectLocalPointToScreen(
  localPoint: Vector3,
  group: Object3D,
  camera: Camera,
  viewport: ViewportSize,
): { x: number; y: number } | null {
  TOOLTIP_WORLD_CORNER.copy(localPoint).applyMatrix4(group.matrixWorld);
  TOOLTIP_PROJECTED.copy(TOOLTIP_WORLD_CORNER).project(camera);
  if (TOOLTIP_PROJECTED.z > 1) {
    return null;
  }
  return {
    x: (TOOLTIP_PROJECTED.x * 0.5 + 0.5) * viewport.width,
    y: (-TOOLTIP_PROJECTED.y * 0.5 + 0.5) * viewport.height,
  };
}

function screenEdgeMidpoint(
  placement: HotspotTooltipPlacement,
  minScreenX: number,
  maxScreenX: number,
  minScreenY: number,
  maxScreenY: number,
): { x: number; y: number } {
  switch (placement) {
    case "top":
      return { x: (minScreenX + maxScreenX) / 2, y: minScreenY };
    case "bottom":
      return { x: (minScreenX + maxScreenX) / 2, y: maxScreenY };
    case "left":
      return { x: minScreenX, y: (minScreenY + maxScreenY) / 2 };
    case "right":
      return { x: maxScreenX, y: (minScreenY + maxScreenY) / 2 };
    default: {
      const exhaustive: never = placement;
      return exhaustive;
    }
  }
}

function unprojectScreenPointToLocalPlane(
  screenX: number,
  screenY: number,
  group: Object3D,
  camera: Camera,
  viewport: ViewportSize,
  target: Vector3,
): boolean {
  const ndcX = (screenX / viewport.width) * 2 - 1;
  const ndcY = -(screenY / viewport.height) * 2 + 1;
  TOOLTIP_RAY_ORIGIN.set(ndcX, ndcY, -1).unproject(camera);
  TOOLTIP_RAY_FAR.set(ndcX, ndcY, 1).unproject(camera);
  TOOLTIP_RAY_DIRECTION.copy(TOOLTIP_RAY_FAR).sub(TOOLTIP_RAY_ORIGIN).normalize();
  TOOLTIP_RAY.set(TOOLTIP_RAY_ORIGIN, TOOLTIP_RAY_DIRECTION);
  TOOLTIP_PLANE_POINT.set(0, 0, 0).applyMatrix4(group.matrixWorld);
  TOOLTIP_PLANE_NORMAL.set(0, 0, 1).transformDirection(group.matrixWorld);
  TOOLTIP_PLANE.setFromNormalAndCoplanarPoint(
    TOOLTIP_PLANE_NORMAL,
    TOOLTIP_PLANE_POINT,
  );
  const hit = TOOLTIP_RAY.intersectPlane(TOOLTIP_PLANE, TOOLTIP_INTERSECTION);
  if (!hit) {
    return false;
  }
  target.copy(hit).applyMatrix4(TOOLTIP_INVERSE.copy(group.matrixWorld).invert());
  return true;
}

function setTooltipAnchorFromScreenBounds(
  anchor: Object3D,
  group: Object3D,
  placement: HotspotTooltipPlacement,
  bounds: TooltipLocalBounds,
  camera: Camera,
  viewport: ViewportSize,
): boolean {
  const corners = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.maxY },
  ];
  let minScreenX = Number.POSITIVE_INFINITY;
  let maxScreenX = Number.NEGATIVE_INFINITY;
  let minScreenY = Number.POSITIVE_INFINITY;
  let maxScreenY = Number.NEGATIVE_INFINITY;
  let hasProjection = false;
  for (const corner of corners) {
    TOOLTIP_CORNER.set(corner.x, corner.y, 0);
    const projected = projectLocalPointToScreen(
      TOOLTIP_CORNER,
      group,
      camera,
      viewport,
    );
    if (!projected) {
      continue;
    }
    hasProjection = true;
    minScreenX = Math.min(minScreenX, projected.x);
    maxScreenX = Math.max(maxScreenX, projected.x);
    minScreenY = Math.min(minScreenY, projected.y);
    maxScreenY = Math.max(maxScreenY, projected.y);
  }
  if (!hasProjection) {
    return false;
  }
  const edge = screenEdgeMidpoint(
    placement,
    minScreenX,
    maxScreenX,
    minScreenY,
    maxScreenY,
  );
  if (
    !unprojectScreenPointToLocalPlane(
      edge.x,
      edge.y,
      group,
      camera,
      viewport,
      anchor.position,
    )
  ) {
    return false;
  }
  anchor.position.z = 0;
  return true;
}

function updateTooltipAnchor(
  anchor: Object3D,
  group: Object3D,
  placement: HotspotTooltipPlacement,
  useAngularScale: boolean,
  camera: Camera,
  viewport: ViewportSize,
) {
  group.updateMatrixWorld(true);
  const bounds = resolveTooltipLocalBounds(group, anchor, useAngularScale);
  if (
    bounds &&
    setTooltipAnchorFromScreenBounds(
      anchor,
      group,
      placement,
      bounds,
      camera,
      viewport,
    )
  ) {
    return;
  }
  if (bounds) {
    setTooltipAnchorOnLocalBox(
      anchor,
      placement,
      bounds.minX,
      bounds.maxX,
      bounds.minY,
      bounds.maxY,
    );
    return;
  }
  setTooltipAnchorOnLocalBox(anchor, placement, -0.5, 0.5, -0.5, 0.5);
}

/** Internal spatial and interaction primitive shared by concrete hotspots. */
export function HotspotAnchor({
  id,
  position,
  width,
  height,
  scale = 1,
  useAngularScale = true,
  focusContent,
  mode = "billboard",
  distance,
  internalOrientation,
  internalPlacement,
  scaleMode = "fov",
  referenceFov = DEFAULT_REFERENCE_FOV,
  rotation = 0,
  renderOrder = 0,
  visible = true,
  draggable = false,
  interactive = true,
  pointerEvents = "auto",
  cursor,
  ariaLabel,
  tooltip,
  tooltipTrigger = "always",
  tooltipPlacement = "top",
  tooltipOffset,
  tooltipAppearance,
  children,
  onClick,
  onHoverChange,
  onDragStart,
  onPositionChange,
  onDragEnd,
}: HotspotAnchorProps) {
  const controlsRef = useContext(PanoramaViewContext);
  const hotspotTargetRegistry = useContext(HotspotTargetRegistryContext);
  const eventBus = useContext(PanoEventBusContext);
  const cursorApi = usePanoCursor();
  const { camera, size } = useThree();
  const groupRef = useRef<Object3D>(null);
  const tooltipAnchorRef = useRef<Object3D>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressNextClickRef = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pinned, setPinned] = useState(false);
  const tooltipContent = useMemo(
    () => resolveHotspotTooltipContent(tooltip),
    [tooltip],
  );
  const normalizedPosition = normalizePanoPosition(position);

  useEffect(() => {
    if (!hotspotTargetRegistry) {
      return;
    }
    return hotspotTargetRegistry.register(id, normalizedPosition);
  }, [hotspotTargetRegistry, id, normalizedPosition.pitch, normalizedPosition.yaw]);
  const rendering =
    internalOrientation && internalPlacement
      ? { orientation: internalOrientation, placement: internalPlacement }
      : HOTSPOT_MODE_RENDERING[mode];
  const { orientation, placement } = rendering;
  const resolvedScale = resolveScale(scale);
  const scaledWidth = width * resolvedScale;
  const scaledHeight = height * resolvedScale;
  const resolvedDistance = resolveDistance(
    placement,
    distance,
    scaledWidth,
    scaledHeight,
  );
  const worldPosition = useMemo(
    () => panoPositionToVector3(normalizedPosition, resolvedDistance),
    [normalizedPosition.pitch, normalizedPosition.yaw, resolvedDistance],
  );
  const surfaceQuaternion = useMemo(
    () => createSurfaceQuaternion(normalizedPosition),
    [normalizedPosition.pitch, normalizedPosition.yaw],
  );
  const worldWidth = angularSizeToWorldSize(scaledWidth, resolvedDistance);
  const worldHeight = angularSizeToWorldSize(scaledHeight, resolvedDistance);
  const focusGeometry = useMemo(() => {
    const planeGeometry = new PlaneGeometry(1, 1);
    const geometry = new EdgesGeometry(planeGeometry);
    planeGeometry.dispose();
    return geometry;
  }, []);
  const acceptsPointer = acceptsHotspotPointerEvents(interactive, pointerEvents);
  const canActivateFromKeyboard = Boolean(
    visible && interactive && (onClick || tooltipTrigger === "click"),
  );
  const focused = useHotspotAccessibility({
    id,
    ariaLabel,
    onActivate: canActivateFromKeyboard
      ? (event) => {
          if (tooltipTrigger === "click") {
            setPinned((current) => !current);
          }
          onClick?.({
            id,
            position: normalizedPosition,
            source: "keyboard",
            nativeEvent: event,
          });
        }
      : undefined,
  });
  const tooltipOpen =
    visible &&
    tooltipContent !== null &&
    isTooltipOpen(tooltipTrigger, hovered, focused, pinned);
  const cursorClaimId = hotspotCursorClaimId(id);

  useEffect(
    () => () => {
      dragStateRef.current?.releaseInteractionLock();
      dragStateRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!cursorApi) {
      return;
    }
    if (acceptsPointer && visible && dragging) {
      cursorApi.claim(cursorClaimId, "hotspotDragging");
      return;
    }
    if (acceptsPointer && visible && hovered) {
      cursorApi.claim(cursorClaimId, "hotspot", cursor);
      return;
    }
    cursorApi.release(cursorClaimId);
  }, [
    acceptsPointer,
    cursor,
    cursorApi,
    cursorClaimId,
    dragging,
    hovered,
    visible,
  ]);

  useEffect(
    () => () => {
      cursorApi?.release(cursorClaimId);
    },
    [cursorApi, cursorClaimId],
  );

  useEffect(() => () => focusGeometry.dispose(), [focusGeometry]);

  useEffect(() => {
    if (tooltipTrigger !== "click") {
      setPinned(false);
      return;
    }
    return eventBus?.subscribe("click", () => {
      setPinned(false);
    });
  }, [eventBus, tooltipTrigger]);

  useEffect(() => {
    if (tooltipTrigger !== "hover") {
      setHovered(false);
    }
  }, [tooltipTrigger]);

  useEffect(() => {
    if (acceptsPointer) {
      return;
    }
    setHovered(false);
    const dragState = dragStateRef.current;
    if (!dragState) {
      return;
    }
    dragState.releaseInteractionLock();
    dragStateRef.current = null;
    setDragging(false);
  }, [acceptsPointer]);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) {
      return;
    }
    applyHotspotTransform(
      group,
      camera,
      orientation,
      surfaceQuaternion,
      rotation,
      scaleMode,
      referenceFov,
      useAngularScale,
      worldWidth,
      worldHeight,
    );
    if (tooltipOpen && tooltipAnchorRef.current) {
      updateTooltipAnchor(
        tooltipAnchorRef.current,
        group,
        tooltipPlacement,
        useAngularScale,
        camera,
        size,
      );
    }
  }, [
    camera,
    orientation,
    referenceFov,
    rotation,
    scaleMode,
    size,
    surfaceQuaternion,
    tooltipOpen,
    tooltipPlacement,
    useAngularScale,
    worldHeight,
    worldWidth,
  ]);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) {
      return;
    }
    applyHotspotTransform(
      group,
      state.camera,
      orientation,
      surfaceQuaternion,
      rotation,
      scaleMode,
      referenceFov,
      useAngularScale,
      worldWidth,
      worldHeight,
    );
    if (tooltipOpen && tooltipAnchorRef.current) {
      updateTooltipAnchor(
        tooltipAnchorRef.current,
        group,
        tooltipPlacement,
        useAngularScale,
        state.camera,
        state.size,
      );
    }
  }, -1);

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
    setDragging(false);
    if (emitDragEnd) {
      setHovered(true);
    }
  };

  return (
    <group
      ref={groupRef}
      position={worldPosition}
      renderOrder={renderOrder}
      scale={[worldWidth, worldHeight, 1]}
      visible={visible}
      onClick={acceptsPointer ? (event) => {
        stopPointerEvent(event);
        if (!suppressNextClickRef.current) {
          if (tooltipTrigger === "click") {
            setPinned((current) => !current);
          }
          onClick?.(makeInteractionEvent(id, normalizedPosition, event));
        }
        suppressNextClickRef.current = false;
      } : undefined}
      onLostPointerCapture={acceptsPointer ? (event) => releasePointer(event, false) : undefined}
      onPointerCancel={acceptsPointer ? (event) => releasePointer(event, false) : undefined}
      onPointerDown={acceptsPointer ? (event) => {
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
        setHovered(false);
        setDragging(true);
        onDragStart?.({
          ...makeInteractionEvent(id, startPosition, event),
          source: "pointer",
          startPosition,
        });
      } : undefined}
      onPointerMove={acceptsPointer ? (event) => {
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
      } : undefined}
      onPointerOut={acceptsPointer ? (event) => {
        if (!dragStateRef.current) {
          setHovered(false);
          onHoverChange?.(
            false,
            makeInteractionEvent(id, normalizedPosition, event),
          );
        }
      } : undefined}
      onPointerOver={acceptsPointer ? (event) => {
        if (!dragStateRef.current) {
          setHovered(true);
          onHoverChange?.(
            true,
            makeInteractionEvent(id, normalizedPosition, event),
          );
        }
      } : undefined}
      onPointerUp={acceptsPointer ? (event) => releasePointer(event, true) : undefined}
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
      {tooltipOpen && tooltipContent ? (
        <group ref={tooltipAnchorRef}>
          <HotspotTooltip
            appearance={tooltipAppearance}
            content={tooltipContent}
            offset={resolveHotspotTooltipOffset(tooltipOffset)}
            placement={tooltipPlacement}
          />
        </group>
      ) : null}
    </group>
  );
}
