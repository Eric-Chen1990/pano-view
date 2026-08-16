import { useThree } from "@react-three/fiber";
import { useContext, useEffect, useRef } from "react";
import { PanoramaViewContext } from "./panorama-view-runtime";
import type { MouseControlButton, MouseControlsOptions } from "./types";

const DEFAULT_ROTATE_SPEED = 0.35;
const DEFAULT_ZOOM_SPEED = 0.08;

const BUTTON_FLAG: Record<MouseControlButton, number> = {
  left: 0,
  middle: 1,
  right: 2,
};

export type MouseControlsProps = MouseControlsOptions & {
  /**
   * Maximum FOV change rate in degrees per second for wheel zoom. When
   * omitted, no extra rate cap is applied. Usually supplied by PanoView from
   * `controls.fovSpeed`.
   */
  fovSpeed?: number;
};

function resolveSpeed(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! >= 0 ? value! : fallback;
}

function resolveButtons(
  buttons: readonly MouseControlButton[] | undefined,
): Set<number> {
  const list = buttons && buttons.length > 0 ? buttons : (["left"] as const);
  return new Set(list.map((button) => BUTTON_FLAG[button]));
}

/**
 * Adds mouse (and pen) drag / wheel navigation to the nearest PanoView.
 * PanoView mounts a default instance; render your own only to override.
 */
export function MouseControls({
  enabled = true,
  rotateSpeed = DEFAULT_ROTATE_SPEED,
  zoomSpeed = DEFAULT_ZOOM_SPEED,
  wheel = true,
  invert = false,
  buttons,
  fovSpeed,
}: MouseControlsProps) {
  const controlsRef = useContext(PanoramaViewContext);
  const { gl } = useThree();
  const pointersRef = useRef(
    new Map<number, { x: number; y: number; at: number }>(),
  );
  const optionsRef = useRef({
    rotateSpeed,
    zoomSpeed,
    wheel,
    invert,
    fovSpeed,
  });

  if (!controlsRef) {
    throw new Error("<MouseControls> must be rendered inside <PanoView>.");
  }

  optionsRef.current = {
    rotateSpeed,
    zoomSpeed,
    wheel,
    invert,
    fovSpeed,
  };

  useEffect(() => {
    const element = gl.domElement;
    const allowedButtons = resolveButtons(buttons);

    const clearPointers = () => {
      for (const pointerId of pointersRef.current.keys()) {
        if (element.hasPointerCapture?.(pointerId)) {
          element.releasePointerCapture?.(pointerId);
        }
      }
      pointersRef.current.clear();
      controlsRef.current?.setPointerActive("mouse", false);
    };

    if (!enabled) {
      clearPointers();
      return;
    }

    const isMouseLike = (event: PointerEvent) =>
      event.pointerType === "mouse" || event.pointerType === "pen";

    const syncActive = () => {
      controlsRef.current?.setPointerActive(
        "mouse",
        pointersRef.current.size > 0,
      );
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!isMouseLike(event)) {
        return;
      }
      if (controlsRef.current?.isInteractionLocked()) {
        return;
      }
      if (!allowedButtons.has(event.button)) {
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
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isMouseLike(event)) {
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
      const next = {
        x: event.clientX,
        y: event.clientY,
        at: performance.now(),
      };
      pointersRef.current.set(event.pointerId, next);

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
      syncActive();
    };

    const onWheel = (event: WheelEvent) => {
      if (!optionsRef.current.wheel) {
        return;
      }
      if (controlsRef.current?.isInteractionLocked()) {
        event.preventDefault();
        return;
      }
      event.preventDefault();

      const speed = resolveSpeed(
        optionsRef.current.zoomSpeed,
        DEFAULT_ZOOM_SPEED,
      );
      let delta = event.deltaY * speed;
      const cap = optionsRef.current.fovSpeed;
      if (Number.isFinite(cap) && cap! > 0) {
        delta = Math.max(-cap!, Math.min(cap!, delta));
      }

      controlsRef.current?.applyViewDelta(
        { fov: delta },
        { recordVelocity: true },
      );
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", releasePointer);
    element.addEventListener("pointercancel", releasePointer);
    element.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", releasePointer);
      element.removeEventListener("pointercancel", releasePointer);
      element.removeEventListener("wheel", onWheel);
      clearPointers();
    };
  }, [buttons, controlsRef, enabled, gl]);

  return null;
}
