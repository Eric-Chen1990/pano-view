import type { ThreeEvent } from "@react-three/fiber";
import { BackSide } from "three";
import { vector3ToPanoPosition } from "./hotspot/coordinates";
import type { PanoramaPointerEvent } from "./hotspot/types";

const EVENT_SURFACE_RADIUS = 49;

type PanoramaEventSurfaceProps = {
  onClick?: (event: PanoramaPointerEvent) => void;
  onDoubleClick?: (event: PanoramaPointerEvent) => void;
  onPointerMove?: (event: PanoramaPointerEvent) => void;
};

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

function emitPanoramaEvent(
  event: ThreeEvent<MouseEvent | PointerEvent>,
  callback: ((event: PanoramaPointerEvent) => void) | undefined,
) {
  if (!callback) {
    return;
  }
  event.stopPropagation();
  callback(makePanoramaPointerEvent(event));
}

export function PanoramaEventSurface({
  onClick,
  onDoubleClick,
  onPointerMove,
}: PanoramaEventSurfaceProps) {
  if (!onClick && !onDoubleClick && !onPointerMove) {
    return null;
  }

  return (
    <mesh
      renderOrder={-200}
      onClick={(event) => emitPanoramaEvent(event, onClick)}
      onDoubleClick={(event) => emitPanoramaEvent(event, onDoubleClick)}
      onPointerMove={(event) => emitPanoramaEvent(event, onPointerMove)}
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
