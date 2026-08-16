import type { ThreeEvent } from "@react-three/fiber";
import { useContext } from "react";
import { BackSide } from "three";
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
