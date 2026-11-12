import { createReticleRing } from "./reticle-geometry";
import { dispatchGazeHotspotClick, resolveGazeTarget, type GazeTarget, type R3FObject } from "./gaze-target";
import { SPATIAL_UI_LAYER } from "../spatial/render-layer";
import { controlBindings } from "../controls/components";
import { SpatialHostContext, type SpatialSurface } from "../spatial/host";
import { canRunSpatialGaze, createGazeActionState } from "../spatial/gaze-action";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useMemo, useRef } from "react";
import {
  DoubleSide,
  Group,
  Intersection,
  Mesh,
  type Object3D,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

const CENTER_NDC = new Vector2(0, 0);
const HUD_DISTANCE = 2;
const RETICLE_SCALE = 1;
/** MobileVR's wide field of view shrinks a world-size crosshair to a few pixels. */
export const MOBILE_VR_RETICLE_SCALE = 3;
const RETICLE_RENDER_ORDER = 100_000;
const CROSSHAIR_LENGTH = 0.044;
const CROSSHAIR_THICKNESS = 0.006;
const RING_INNER_RADIUS = 0.05;
const RING_OUTER_RADIUS = 0.058;
const RING_INDICES_PER_SEGMENT = 6;
const GAZE_POINTER_ID = 1_000_001;
export const DEFAULT_WEBVR_CURSOR_DWELL_MS = 1_500;
const MAX_DWELL_DELTA_MS = 48;

function noopRaycast() {}

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
    // Pointer-out must describe an empty hover set, including unlock cancellation.
    intersections: nativeEvent.type === "pointerout" ? [] : [intersection],
    stopped,
  } as ThreeEvent<PointerEvent>;
}

function emitHandler(
  target: GazeTarget,
  camera: ThreeEvent<PointerEvent>["camera"],
  ray: Raycaster["ray"],
  type: "onPointerOver" | "onPointerOut" | "onClick",
  nativeType: string,
  surfaces: Iterable<SpatialSurface> = [],
): void {
  const handler = (target.eventObject as R3FObject).__r3f?.handlers?.[type];
  if (!handler) {
    return;
  }
  const nativeEvent = createNativePointerEvent(nativeType);
  const event = createThreePointerEvent(
    target.intersection,
    target.eventObject,
    camera,
    nativeEvent,
    ray,
  );
  if (type === "onClick") {
    dispatchGazeHotspotClick(surfaces, nativeEvent, () => handler(event));
  } else {
    handler(event);
  }
}

function resolveDwellMs(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(value!, 0) : DEFAULT_WEBVR_CURSOR_DWELL_MS;
}

export function WebVRReticle({
  dwellMs,
  scale = RETICLE_SCALE,
  visible,
}: {
  dwellMs?: number;
  scale?: number;
  visible: boolean;
}) {
  const spatial = useContext(SpatialHostContext);
  const spatialGaze = useRef(createGazeActionState());
  useEffect(() => {
    const stop = () => spatialGaze.current.stop();
    window.addEventListener("blur", stop); document.addEventListener("visibilitychange", stop);
    return () => { stop(); window.removeEventListener("blur", stop); document.removeEventListener("visibilitychange", stop); };
  }, []);
  const groupRef = useRef<Group>(null);
  const ringMeshRef = useRef<Mesh>(null);
  const ringBackdropRef = useRef<Group>(null);
  const rings = useMemo(() => ({
    outline: createReticleRing(RING_INNER_RADIUS - .003, RING_OUTER_RADIUS + .003),
    track: createReticleRing(RING_INNER_RADIUS, RING_OUTER_RADIUS),
    progress: createReticleRing(RING_INNER_RADIUS, RING_OUTER_RADIUS),
  }), []);
  useEffect(() => () => { Object.values(rings).forEach(geometry => geometry.dispose()); }, [rings]);
  const directionRef = useRef(new Vector3());
  const raycasterRef = useRef(new Raycaster());
  const hoveredRef = useRef<GazeTarget | null>(null);
  const dwellRef = useRef(0);
  const clickedRef = useRef(false);
  const { camera, gl, scene } = useThree();

  useFrame((_, deltaSeconds) => {
    const group = groupRef.current;
    const ringMesh = ringMeshRef.current;
    if (!visible || !group || spatial?.input.getSnapshot().mode !== "gaze" || !canRunSpatialGaze(document.hidden, gl.xr.getSession()?.visibilityState, 0, performance.now())) {
      if (spatial?.action?.id instanceof HTMLElement) delete spatial.action.id.dataset.panoGazeActive;
      if (spatial && spatial.input.getSnapshot().mode !== "pointer") spatial.action = null;
      spatialGaze.current.stop();
      if (group) group.visible = false;
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
      if (ringBackdropRef.current) ringBackdropRef.current.visible = false;
      if (ringMesh) {
        ringMesh.visible = false;
        ringMesh.geometry.setDrawRange(0, 0);
      }
      return;
    }

    group.visible = true;
    group.traverse(node => node.layers.set(SPATIAL_UI_LAYER));
    const activeCamera = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    activeCamera.getWorldDirection(directionRef.current);
    const raycaster = raycasterRef.current;
    raycaster.layers.enable(SPATIAL_UI_LAYER);
    activeCamera.getWorldPosition(raycaster.ray.origin);
    raycaster.ray.direction.copy(directionRef.current);
    scene.updateMatrixWorld();
    const hits = raycaster.intersectObjects(scene.children, true);
    const route = resolveGazeTarget(hits, {
      modalOpen: Boolean(spatial?.mode && spatial.surfaces.size),
      panelsOpen: Boolean(spatial?.mode && spatial.panels.size),
    });
    const spatialOpen = route.channel === "spatial";
    const spatialTarget = route.channel === "spatial" ? route.action : null;
    if (spatial) {
      const previous = spatial.action?.id;
      if (previous !== spatialTarget?.id) {
        if (previous instanceof HTMLElement) delete previous.dataset.panoGazeActive;
        // Only bound controls style this attribute. Plain host buttons use the reticle
        // for dwell feedback and must not invalidate the entire DOM capture on hover.
        if (spatialTarget?.id instanceof HTMLElement && controlBindings.has(spatialTarget.id)) spatialTarget.id.dataset.panoGazeActive = "";
      }
      spatial.action = spatialTarget;
    }
    const spatialProgress = spatialGaze.current.tick(canRunSpatialGaze(document.hidden, gl.xr.getSession()?.visibilityState, spatial?.suppressGazeUntil ?? 0, performance.now()) ? spatialTarget : null, deltaSeconds, resolveDwellMs(dwellMs));
    const target = route.channel === "hotspot" ? route.target : null;
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
        emitHandler(target, camera, raycaster.ray, "onClick", "click", spatial?.mode ? spatial.surfaces : []);
      }
    } else if (!target) {
      dwellRef.current = 0;
    }

    const progress = spatialOpen ? spatialProgress :
      target && !clickedRef.current
        ? resolvedDwellMs > 0
          ? Math.min(dwellRef.current / resolvedDwellMs, 1)
          : 1
        : 0;
    if (ringBackdropRef.current) ringBackdropRef.current.visible = progress > 0.001;
    if (ringMesh) {
      const segments = Math.max(0, Math.ceil(progress * rings.progress.index!.count / RING_INDICES_PER_SEGMENT));
      ringMesh.visible = progress > 0.001;
      ringMesh.geometry.setDrawRange(0, segments * RING_INDICES_PER_SEGMENT);
    }

    group.position
      .copy(activeCamera.position)
      .addScaledVector(directionRef.current, HUD_DISTANCE);
    group.quaternion.copy(activeCamera.quaternion);
    group.scale.setScalar(scale);
  });

  return (
    <group
      frustumCulled={false}
      ref={groupRef}
      renderOrder={RETICLE_RENDER_ORDER}
      visible={visible}
    >
      {[false, true].map(vertical => <mesh key={String(vertical)} frustumCulled={false} raycast={noopRaycast} renderOrder={RETICLE_RENDER_ORDER}>
        <boxGeometry args={vertical ? [CROSSHAIR_THICKNESS + .006, CROSSHAIR_LENGTH + .006, .001] : [CROSSHAIR_LENGTH + .006, CROSSHAIR_THICKNESS + .006, .001]} />
        <meshBasicMaterial color="#101419" transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>)}
      <group ref={ringBackdropRef} renderOrder={RETICLE_RENDER_ORDER} visible={false}>
        <mesh geometry={rings.outline} frustumCulled={false} raycast={noopRaycast} renderOrder={RETICLE_RENDER_ORDER}>
          <meshBasicMaterial color="#101419" transparent side={DoubleSide} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh geometry={rings.track} frustumCulled={false} raycast={noopRaycast} renderOrder={RETICLE_RENDER_ORDER + 1}>
          <meshBasicMaterial color="#ffffff" transparent opacity={.45} side={DoubleSide} depthTest={false} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
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
        geometry={rings.progress}
        renderOrder={RETICLE_RENDER_ORDER + 2}
        visible={false}
      >
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
