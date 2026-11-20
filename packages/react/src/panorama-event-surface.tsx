import { aimComparePointer, CompareHostContext } from "./compare/view";
import { SpatialHostContext } from "./spatial/host";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { BackSide, Mesh, Raycaster, Sphere, Vector2, Vector3, type Intersection } from "three";
import { vector3ToPanoPosition } from "./hotspot/coordinates";
import type { PanoramaPointerEvent } from "./hotspot/types";
import { PanoEventBusContext } from "./pano-event-bus";
import { DEFAULT_PANORAMA_RADIUS } from "./panorama-radius";
import { PanoVideoHostContext, subscribePanoVideoHost } from "./video/host";
import { createPanoramaTap } from "./video/panorama-tap";

const EVENT_SURFACE_RADIUS = DEFAULT_PANORAMA_RADIUS - 1;
const EVENT_SPHERE = new Sphere(new Vector3(), EVENT_SURFACE_RADIUS);
const eventSurfaceHit = new Vector3();

export function raycastPanoramaEventSurface(this: Mesh, raycaster: Raycaster, hits: Intersection[]) {
  const { ray, near, far } = raycaster;
  if (!EVENT_SPHERE.containsPoint(ray.origin)) {
    Mesh.prototype.raycast.call(this, raycaster, hits);
    return;
  }

  // The event surface is centered at the viewer origin. Intersect the sphere
  // directly so rays along triangle edges still register panorama clicks.
  const point = ray.intersectSphere(EVENT_SPHERE, eventSurfaceHit);
  if (!point) return;
  const distance = ray.origin.distanceTo(point);
  if (distance < near || distance > far) return;
  hits.push({ distance, object: this, point: point.clone() });
}

function makePanoramaPointerEvent(
  event: ThreeEvent<MouseEvent | PointerEvent>,
): PanoramaPointerEvent {
  const nativeEvent = event.nativeEvent;
  return {
    position: vector3ToPanoPosition(event.ray.direction),
    nativeEvent,
    pointerId:
      "pointerId" in nativeEvent ? nativeEvent.pointerId : undefined,
    button: nativeEvent.button,
    buttons: nativeEvent.buttons,
    clientX: nativeEvent.clientX,
    clientY: nativeEvent.clientY,
  };
}

/**
 * Invisible inward sphere that maps pointer hits to panorama yaw/pitch and
 * publishes them on the viewer event bus.
 */
export function PanoramaEventSurface({
  videoInteractionsDisabled,
}: {
  videoInteractionsDisabled: boolean;
}) {
  const spatialHost = useContext(SpatialHostContext);
  const eventBus = useContext(PanoEventBusContext);
  const videoHost = useContext(PanoVideoHostContext);
  const { camera, gl, size } = useThree();
  const compareHost = useContext(CompareHostContext);
  const [tap] = useState(createPanoramaTap);
  const clickToTogglePlayback = useSyncExternalStore(
    useCallback(
      (listener: () => void) => videoHost ? subscribePanoVideoHost(videoHost, listener) : () => {},
      [videoHost],
    ),
    () => !videoInteractionsDisabled && videoHost?.clickToTogglePlayback === true,
    () => false,
  );

  useEffect(() => {
    if (!clickToTogglePlayback) return;
    // Track outside the raycast so crossing a hotspot or adding another finger cancels the tap.
    window.addEventListener("pointerdown", tap.clear, true);
    window.addEventListener("pointermove", tap.move, true);
    window.addEventListener("pointerup", tap.end, true);
    window.addEventListener("pointercancel", tap.clear, true);
    window.addEventListener("blur", tap.clear);
    return () => {
      window.removeEventListener("pointerdown", tap.clear, true);
      window.removeEventListener("pointermove", tap.move, true);
      window.removeEventListener("pointerup", tap.end, true);
      window.removeEventListener("pointercancel", tap.clear, true);
      window.removeEventListener("blur", tap.clear);
      tap.clear();
    };
  }, [clickToTogglePlayback, tap]);

  useEffect(() => {
    if (!eventBus) {
      return;
    }

    const element = gl.domElement;
    const ndc = new Vector2();
    const raycaster = new Raycaster();
    const direction = new Vector3();

    const handleContextMenu = (nativeEvent: MouseEvent) => {
      tap.clear();
      if (spatialHost?.mode && spatialHost.surfaces.size) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      const pane = aimComparePointer(compareHost, nativeEvent, element, camera, size, gl.getPixelRatio(), ndc);
      if (!pane) ndc.set(
        ((nativeEvent.clientX - rect.left) / rect.width) * 2 - 1,
        -((nativeEvent.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, pane?.camera ?? camera);
      direction.copy(raycaster.ray.direction);

      eventBus.emit("contextmenu", {
        position: vector3ToPanoPosition(direction),
        nativeEvent,
        pointerId:
          "pointerId" in nativeEvent
            ? (nativeEvent as PointerEvent).pointerId
            : undefined,
        button: nativeEvent.button,
        buttons: nativeEvent.buttons,
        clientX: nativeEvent.clientX,
        clientY: nativeEvent.clientY,
      });
    };

    element.addEventListener("contextmenu", handleContextMenu);
    return () => {
      element.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [camera, compareHost, eventBus, gl, size, spatialHost, tap]);

  if (!eventBus) {
    return null;
  }

  const emit = (
    type: "click" | "doubleclick" | "pointerdown" | "pointerup" | "pointermove",
    event: ThreeEvent<MouseEvent | PointerEvent>,
  ) => {
    event.stopPropagation();
    if (spatialHost?.mode && spatialHost.surfaces.size) return;
    eventBus.emit(type, makePanoramaPointerEvent(event));
  };

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    const nativeEvent = event.nativeEvent;
    const gesture = tap.take(nativeEvent);
    const controller = videoHost?.controller;
    emit("click", event);
    if (
      !gesture || !controller || !clickToTogglePlayback ||
      !videoHost?.clickToTogglePlayback || videoHost.controller !== controller ||
      spatialHost?.mode || gl.xr.isPresenting || nativeEvent.defaultPrevented ||
      nativeEvent.target !== gl.domElement ||
      videoHost.activationPlayEvents.get(gesture.start) === controller ||
      videoHost.activationPlayEvents.get(gesture.end) === controller
    ) return;
    const rect = gl.domElement.getBoundingClientRect();
    if (
      nativeEvent.clientX >= rect.left && nativeEvent.clientX < rect.right &&
      nativeEvent.clientY >= rect.top && nativeEvent.clientY < rect.bottom
    ) controller.togglePlay();
  };

  return (
    <mesh
      renderOrder={-200}
      raycast={raycastPanoramaEventSurface}
      onClick={handleClick}
      onDoubleClick={(event) => emit("doubleclick", event)}
      onPointerDown={(event) => {
        const nativeEvent = event.nativeEvent;
        if (clickToTogglePlayback && !spatialHost?.mode && !gl.xr.isPresenting && nativeEvent.target === gl.domElement) {
          tap.start(nativeEvent);
        }
        emit("pointerdown", event);
      }}
      onPointerUp={(event) => emit("pointerup", event)}
      onPointerMove={(event) => emit("pointermove", event)}
    >
      <sphereGeometry args={[EVENT_SURFACE_RADIUS, 64, 32]} />
      <meshBasicMaterial
        colorWrite={false}
        depthTest={false}
        depthWrite={false}
        opacity={0}
        side={BackSide}
        transparent
      />
    </mesh>
  );
}
