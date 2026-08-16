import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { useContext, useEffect } from "react";
import { BackSide, Raycaster, Vector2, Vector3 } from "three";
import { vector3ToPanoPosition } from "./hotspot/coordinates";
import type { PanoramaPointerEvent } from "./hotspot/types";
import { PanoEventBusContext } from "./pano-event-bus";
import { DEFAULT_PANORAMA_RADIUS } from "./panorama-radius";

const EVENT_SURFACE_RADIUS = DEFAULT_PANORAMA_RADIUS - 1;

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
export function PanoramaEventSurface() {
  const eventBus = useContext(PanoEventBusContext);
  const { camera, gl } = useThree();

  useEffect(() => {
    if (!eventBus) {
      return;
    }

    const element = gl.domElement;
    const ndc = new Vector2();
    const raycaster = new Raycaster();
    const direction = new Vector3();

    const handleContextMenu = (nativeEvent: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }

      ndc.set(
        ((nativeEvent.clientX - rect.left) / rect.width) * 2 - 1,
        -((nativeEvent.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
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
  }, [camera, eventBus, gl]);

  if (!eventBus) {
    return null;
  }

  const emit = (
    type: "click" | "doubleclick" | "pointerdown" | "pointerup" | "pointermove",
    event: ThreeEvent<MouseEvent | PointerEvent>,
  ) => {
    event.stopPropagation();
    eventBus.emit(type, makePanoramaPointerEvent(event));
  };

  return (
    <mesh
      renderOrder={-200}
      onClick={(event) => emit("click", event)}
      onDoubleClick={(event) => emit("doubleclick", event)}
      onPointerDown={(event) => emit("pointerdown", event)}
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
