import type { ThreeEvent } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import {
  DoubleSide,
  Group,
  Intersection,
  Mesh,
  Object3D,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

const CENTER_NDC = new Vector2(0, 0);
const HUD_DISTANCE = 2;
const RETICLE_SCALE = 1;
const RETICLE_RENDER_ORDER = 100_000;
const CROSSHAIR_LENGTH = 0.044;
const CROSSHAIR_THICKNESS = 0.008;
const RING_INNER_RADIUS = 0.05;
const RING_OUTER_RADIUS = 0.058;
const RING_SEGMENTS = 96;
const RING_INDICES_PER_SEGMENT = 6;
const GAZE_POINTER_ID = 1_000_001;
export const DEFAULT_WEBVR_CURSOR_DWELL_MS = 1_500;
const MAX_DWELL_DELTA_MS = 48;

type R3FObject = Object3D & {
  __r3f?: {
    handlers?: {
      onClick?: (event: ThreeEvent<PointerEvent>) => void;
      onPointerOver?: (event: ThreeEvent<PointerEvent>) => void;
      onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
    };
  };
};

type GazeTarget = {
  eventObject: Object3D;
  intersection: Intersection;
};

function noopRaycast() {}

function findGazeTarget(hits: Intersection[]): GazeTarget | null {
  for (const intersection of hits) {
    let current: Object3D | null = intersection.object;
    while (current) {
      const handlers = (current as R3FObject).__r3f?.handlers;
      if (handlers?.onClick && handlers.onPointerOver) {
        return { eventObject: current, intersection };
      }
      current = current.parent;
    }
  }
  return null;
}

function createNativePointerEvent(type: string): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: GAZE_POINTER_ID,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons: type === "pointerdown" ? 1 : 0,
  });
}

function createThreePointerEvent(
  intersection: Intersection,
  eventObject: Object3D,
  camera: ThreeEvent<PointerEvent>["camera"],
  nativeEvent: PointerEvent,
  ray: Raycaster["ray"],
): ThreeEvent<PointerEvent> {
  let stopped = false;
  return {
    camera,
    delta: 0,
    distance: intersection.distance,
    eventObject,
    face: intersection.face ?? null,
    faceIndex: intersection.faceIndex,
    nativeEvent,
    object: intersection.object,
    pointer: CENTER_NDC.clone(),
    point: intersection.point.clone(),
    ray,
    stopPropagation: () => {
      stopped = true;
    },
    uv: intersection.uv,
    intersections: [intersection],
    stopped,
  } as ThreeEvent<PointerEvent>;
}

function emitHandler(
  target: GazeTarget,
  camera: ThreeEvent<PointerEvent>["camera"],
  ray: Raycaster["ray"],
  type: "onPointerOver" | "onPointerOut" | "onClick",
  nativeType: string,
): void {
  const handler = (target.eventObject as R3FObject).__r3f?.handlers?.[type];
  if (!handler) {
    return;
  }
  handler(
    createThreePointerEvent(
      target.intersection,
      target.eventObject,
      camera,
      createNativePointerEvent(nativeType),
      ray,
    ),
  );
}

function resolveDwellMs(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(value!, 0) : DEFAULT_WEBVR_CURSOR_DWELL_MS;
}

export function WebVRReticle({
  dwellMs,
  visible,
}: {
  dwellMs?: number;
  visible: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const ringMeshRef = useRef<Mesh>(null);
  const directionRef = useRef(new Vector3());
  const raycasterRef = useRef(new Raycaster());
  const hoveredRef = useRef<GazeTarget | null>(null);
  const dwellRef = useRef(0);
  const clickedRef = useRef(false);
  const { camera, gl, scene } = useThree();

  useFrame((_, deltaSeconds) => {
    const group = groupRef.current;
    const ringMesh = ringMeshRef.current;
    if (!visible || !group) {
      if (hoveredRef.current) {
        emitHandler(
          hoveredRef.current,
          camera,
          raycasterRef.current.ray,
          "onPointerOut",
          "pointerout",
        );
        hoveredRef.current = null;
      }
      dwellRef.current = 0;
      clickedRef.current = false;
      if (ringMesh) {
        ringMesh.visible = false;
        ringMesh.geometry.setDrawRange(0, 0);
      }
      return;
    }

    const activeCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    activeCamera.getWorldDirection(directionRef.current);
    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(CENTER_NDC, camera);
    scene.updateMatrixWorld();
    const hits = raycaster.intersectObjects(scene.children, true);
    const target = findGazeTarget(hits);
    const previous = hoveredRef.current;
    const acquiredNewTarget = Boolean(
      target && previous?.eventObject !== target.eventObject,
    );

    if (previous && previous.eventObject !== target?.eventObject) {
      emitHandler(previous, camera, raycaster.ray, "onPointerOut", "pointerout");
      dwellRef.current = 0;
      clickedRef.current = false;
    }
    if (acquiredNewTarget && target) {
      emitHandler(target, camera, raycaster.ray, "onPointerOver", "pointerover");
      dwellRef.current = 0;
      clickedRef.current = false;
    }
    hoveredRef.current = target;

    const resolvedDwellMs = resolveDwellMs(dwellMs);
    if (target && resolvedDwellMs > 0 && !clickedRef.current && !acquiredNewTarget) {
      dwellRef.current = Math.min(
        dwellRef.current + Math.min(deltaSeconds * 1_000, MAX_DWELL_DELTA_MS),
        resolvedDwellMs,
      );
      if (dwellRef.current >= resolvedDwellMs) {
        clickedRef.current = true;
        dwellRef.current = 0;
        emitHandler(target, camera, raycaster.ray, "onClick", "click");
      }
    } else if (!target) {
      dwellRef.current = 0;
    }

    const progress =
      target && !clickedRef.current
        ? resolvedDwellMs > 0
          ? Math.min(dwellRef.current / resolvedDwellMs, 1)
          : 1
        : 0;
    if (ringMesh) {
      const segments = Math.max(0, Math.ceil(progress * RING_SEGMENTS));
      ringMesh.visible = progress > 0.001;
      ringMesh.geometry.setDrawRange(0, segments * RING_INDICES_PER_SEGMENT);
    }

    group.position
      .copy(activeCamera.position)
      .addScaledVector(directionRef.current, HUD_DISTANCE);
    group.quaternion.copy(activeCamera.quaternion);
    group.scale.setScalar(RETICLE_SCALE);
  });

  return (
    <group
      frustumCulled={false}
      ref={groupRef}
      renderOrder={RETICLE_RENDER_ORDER}
      visible={visible}
    >
      <mesh
        frustumCulled={false}
        raycast={noopRaycast}
        renderOrder={RETICLE_RENDER_ORDER + 1}
      >
        <boxGeometry args={[CROSSHAIR_LENGTH, CROSSHAIR_THICKNESS, 0.001]} />
        <meshBasicMaterial
          color="#ffffff"
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          transparent
        />
      </mesh>
      <mesh
        frustumCulled={false}
        raycast={noopRaycast}
        renderOrder={RETICLE_RENDER_ORDER + 1}
      >
        <boxGeometry args={[CROSSHAIR_THICKNESS, CROSSHAIR_LENGTH, 0.001]} />
        <meshBasicMaterial
          color="#ffffff"
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          transparent
        />
      </mesh>
      <mesh
        frustumCulled={false}
        raycast={noopRaycast}
        ref={ringMeshRef}
        renderOrder={RETICLE_RENDER_ORDER + 2}
        visible={false}
      >
        <ringGeometry
          args={[
            RING_INNER_RADIUS,
            RING_OUTER_RADIUS,
            RING_SEGMENTS,
            1,
            Math.PI / 2,
            Math.PI * -2,
          ]}
        />
        <meshBasicMaterial
          color="#ffffff"
          depthTest={false}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  );
}
