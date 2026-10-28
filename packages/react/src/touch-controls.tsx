import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useRef } from "react";
import { createPointerDrag } from "./pointer-drag";
import { useClaimControlChannel } from "./control-claims";
import { PanoramaViewContext } from "./panorama-view-runtime";
import type { TouchControlsOptions } from "./types";

const DEFAULT_ROTATE_SPEED = 0.35;

export type TouchControlsProps = TouchControlsOptions;

type PointerSample = {
  x: number;
  y: number;
  at: number;
};

function pointerAt(event: PointerEvent): number {
  return event.timeStamp > 0 ? event.timeStamp : performance.now();
}

function resolveSpeed(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! >= 0 ? value! : fallback;
}

function pointerDistance(a: PointerSample, b: PointerSample): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Adds touch drag and pinch-zoom navigation to the nearest PanoViewer.
 * Enabled by default; render this component only to override properties.
 */
export function TouchControls({
  enabled = true,
  rotateSpeed = DEFAULT_ROTATE_SPEED,
  invert = false,
  pinchZoom = true,
}: TouchControlsProps) {
  useClaimControlChannel("touch");
  const controlsRef = useContext(PanoramaViewContext);
  const { gl, camera } = useThree();
  const validateDragRef = useRef<((delta: number) => void) | undefined>(undefined);
  useFrame((_, delta) => validateDragRef.current?.(delta), -1);
  const pointersRef = useRef(new Map<number, PointerSample>());
  const pinchDistanceRef = useRef<number | null>(null);
  const optionsRef = useRef({ rotateSpeed, invert, pinchZoom });

  if (!controlsRef) {
    throw new Error("<TouchControls> must be rendered inside <PanoViewer>.");
  }

  optionsRef.current = { rotateSpeed, invert, pinchZoom };

  useEffect(() => {
    const element = gl.domElement;
    const drag = createPointerDrag(camera, element, () => controlsRef.current, "touch");

    const clearPointers = () => {
      for (const pointerId of pointersRef.current.keys()) {
        if (element.hasPointerCapture?.(pointerId)) {
          element.releasePointerCapture?.(pointerId);
        }
      }
      pointersRef.current.clear();
      drag.clear();
      pinchDistanceRef.current = null;
      controlsRef.current?.setPointerActive("touch", false, { cancelled: true });
    };

    validateDragRef.current = (delta) => {
      if (pointersRef.current.size && !drag.valid()) clearPointers();
      else drag.flush(delta);
    };

    if (!enabled) {
      clearPointers();
      return;
    }

    const syncActive = (cancelled = false) => {
      controlsRef.current?.setPointerActive(
        "touch",
        pointersRef.current.size > 0,
        { cancelled },
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        return;
      }
      if (controlsRef.current?.isInteractionLocked()) {
        return;
      }

      event.preventDefault();
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        at: performance.now(),
      });
      element.setPointerCapture?.(event.pointerId);
      syncActive();
      drag.start({ x: event.clientX, y: event.clientY }, pointerAt(event));

      if (pointersRef.current.size >= 2) {
        drag.suspend();
        const [first, second] = Array.from(pointersRef.current.values());
        pinchDistanceRef.current = pointerDistance(first!, second!);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        return;
      }
      if (controlsRef.current?.isInteractionLocked()) {
        return;
      }
      const previous = pointersRef.current.get(event.pointerId);
      if (!previous) {
        return;
      }

      event.preventDefault();
      const next: PointerSample = {
        x: event.clientX,
        y: event.clientY,
        at: performance.now(),
      };
      pointersRef.current.set(event.pointerId, next);

      const pointers = Array.from(pointersRef.current.values());
      if (pointers.length >= 2) {
        drag.suspend();
        if (!optionsRef.current.pinchZoom) {
          return;
        }
        const distance = pointerDistance(pointers[0]!, pointers[1]!);
        const previousDistance = pinchDistanceRef.current;
        pinchDistanceRef.current = distance;
        if (previousDistance && distance > 0) {
          const view = controlsRef.current?.getTargetView();
          if (view) {
            const nextFov = view.fov * (previousDistance / distance);
            controlsRef.current?.applyViewDelta(
              { fov: nextFov - view.fov },
              { recordVelocity: true, source: "touch" },
            );
          }
        }
        return;
      }

      const speed = resolveSpeed(optionsRef.current.rotateSpeed, DEFAULT_ROTATE_SPEED);
      drag.move(next, previous, speed, optionsRef.current.invert, pointerAt(event));
    };

    const releasePointer = (event: PointerEvent) => {
      if (!pointersRef.current.has(event.pointerId)) {
        return;
      }
      const pinch = pointersRef.current.size >= 2;
      if (event.type === "pointerup" && !pinch) drag.release();
      else drag.clear();
      pointersRef.current.delete(event.pointerId);
      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture?.(event.pointerId);
      }
      if (pointersRef.current.size < 2) {
        pinchDistanceRef.current = null;
      }
      syncActive(event.type !== "pointerup");
      const remaining = pointersRef.current.values().next().value;
      if (remaining) drag.start(remaining, pointerAt(event));
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", releasePointer);
    element.addEventListener("pointercancel", releasePointer);
    element.addEventListener("lostpointercapture", releasePointer);

    return () => {
      validateDragRef.current = undefined;
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", releasePointer);
      element.removeEventListener("pointercancel", releasePointer);
      element.removeEventListener("lostpointercapture", releasePointer);
      clearPointers();
    };
  }, [controlsRef, enabled, gl, camera]);

  return null;
}
