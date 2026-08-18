import { useThree } from "@react-three/fiber";
import { useContext, useEffect, useRef } from "react";
import { PanoramaViewContext } from "./panorama-view-runtime";
import type { TouchControlsOptions } from "./types";

const DEFAULT_ROTATE_SPEED = 0.35;

export type TouchControlsProps = TouchControlsOptions;

type PointerSample = {
  x: number;
  y: number;
  at: number;
};

function resolveSpeed(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! >= 0 ? value! : fallback;
}

function pointerDistance(a: PointerSample, b: PointerSample): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Adds touch drag and pinch-zoom navigation to the nearest PanoViewer.
 * PanoViewer mounts a default instance; render your own only to override.
 */
export function TouchControls({
  enabled = true,
  rotateSpeed = DEFAULT_ROTATE_SPEED,
  invert = false,
  pinchZoom = true,
}: TouchControlsProps) {
  const controlsRef = useContext(PanoramaViewContext);
  const { gl } = useThree();
  const pointersRef = useRef(new Map<number, PointerSample>());
  const pinchDistanceRef = useRef<number | null>(null);
  const optionsRef = useRef({ rotateSpeed, invert, pinchZoom });

  if (!controlsRef) {
    throw new Error("<TouchControls> must be rendered inside <PanoViewer>.");
  }

  optionsRef.current = { rotateSpeed, invert, pinchZoom };

  useEffect(() => {
    const element = gl.domElement;

    const clearPointers = () => {
      for (const pointerId of pointersRef.current.keys()) {
        if (element.hasPointerCapture?.(pointerId)) {
          element.releasePointerCapture?.(pointerId);
        }
      }
      pointersRef.current.clear();
      pinchDistanceRef.current = null;
      controlsRef.current?.setPointerActive("touch", false);
    };

    if (!enabled) {
      clearPointers();
      return;
    }

    const syncActive = () => {
      controlsRef.current?.setPointerActive(
        "touch",
        pointersRef.current.size > 0,
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

      if (pointersRef.current.size === 2) {
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
              { recordVelocity: true },
            );
          }
        }
        return;
      }

      const rect = element.getBoundingClientRect();
      const speed = resolveSpeed(
        optionsRef.current.rotateSpeed,
        DEFAULT_ROTATE_SPEED,
      );
      const sign = optionsRef.current.invert ? -1 : 1;
      const deltaYaw =
        (sign * -(next.x - previous.x) * 360 * speed) /
        Math.max(rect.width, 1);
      const deltaPitch =
        (sign * (next.y - previous.y) * 180 * speed) /
        Math.max(rect.height, 1);

      controlsRef.current?.applyViewDelta(
        { yaw: deltaYaw, pitch: deltaPitch },
        { recordVelocity: true },
      );
    };

    const releasePointer = (event: PointerEvent) => {
      if (!pointersRef.current.has(event.pointerId)) {
        return;
      }
      pointersRef.current.delete(event.pointerId);
      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture?.(event.pointerId);
      }
      if (pointersRef.current.size < 2) {
        pinchDistanceRef.current = null;
      }
      syncActive();
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", releasePointer);
    element.addEventListener("pointercancel", releasePointer);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", releasePointer);
      element.removeEventListener("pointercancel", releasePointer);
      clearPointers();
    };
  }, [controlsRef, enabled, gl]);

  return null;
}
