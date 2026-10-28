import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useRef } from "react";
import { createPointerDrag } from "./pointer-drag";
import { useClaimControlChannel } from "./control-claims";
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
   * omitted, no extra rate cap is applied. Usually supplied by PanoViewer from
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
 * Adds mouse (and pen) drag / wheel navigation to the nearest PanoViewer.
 * Enabled by default; render this component only to override properties.
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
  useClaimControlChannel("mouse");
  const controlsRef = useContext(PanoramaViewContext);
  const { gl, camera } = useThree();
  const validateDragRef = useRef<((delta: number) => void) | undefined>(undefined);
  useFrame((_, delta) => validateDragRef.current?.(delta), -1);
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
    throw new Error("<MouseControls> must be rendered inside <PanoViewer>.");
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
    const drag = createPointerDrag(camera, element, () => controlsRef.current, "mouse");
    const allowedButtons = resolveButtons(buttons);

    const clearPointers = () => {
      for (const pointerId of pointersRef.current.keys()) {
        if (element.hasPointerCapture?.(pointerId)) {
          element.releasePointerCapture?.(pointerId);
        }
      }
      pointersRef.current.clear();
      drag.clear();
      controlsRef.current?.setPointerActive("mouse", false, { cancelled: true });
    };

    validateDragRef.current = (delta) => {
      if (pointersRef.current.size && !drag.valid()) clearPointers();
      else drag.flush(delta);
    };

    if (!enabled) {
      clearPointers();
      return;
    }

    const isMouseLike = (event: PointerEvent) =>
      event.pointerType === "mouse" || event.pointerType === "pen";

    const syncActive = (cancelled = false) => {
      controlsRef.current?.setPointerActive(
        "mouse",
        pointersRef.current.size > 0,
        { cancelled },
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
      drag.start({ x: event.clientX, y: event.clientY });
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

      const speed = resolveSpeed(optionsRef.current.rotateSpeed, DEFAULT_ROTATE_SPEED);
      drag.move(next, previous, speed, optionsRef.current.invert);
    };

    const releasePointer = (event: PointerEvent) => {
      if (!pointersRef.current.has(event.pointerId)) {
        return;
      }
      if (event.type === "pointerup") drag.flush();
      pointersRef.current.delete(event.pointerId);
      drag.clear();
      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture?.(event.pointerId);
      }
      syncActive(event.type !== "pointerup");
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
        { source: "mouse" },
      );
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", releasePointer);
    element.addEventListener("pointercancel", releasePointer);
    element.addEventListener("lostpointercapture", releasePointer);
    element.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      validateDragRef.current = undefined;
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", releasePointer);
      element.removeEventListener("pointercancel", releasePointer);
      element.removeEventListener("lostpointercapture", releasePointer);
      element.removeEventListener("wheel", onWheel);
      clearPointers();
    };
  }, [buttons, controlsRef, enabled, gl, camera]);

  return null;
}
