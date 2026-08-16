import { useFrame, useThree } from "@react-three/fiber";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Euler, MathUtils, PerspectiveCamera } from "three";
import type {
  PanoramaControlsOptions,
  PanoViewState,
  SetPanoViewOptions,
} from "./types";

const MAX_PITCH = 90;
const INERTIA_ROTATION_DAMPING = 8;
const INERTIA_ZOOM_DAMPING = 12;
const DEFAULT_ROTATE_DAMPING = 14;
const DEFAULT_ZOOM_DAMPING = 16;
const MIN_ROTATION_VELOCITY = 0.01;
const MIN_ZOOM_VELOCITY = 0.01;
const VIEW_SETTLE_EPSILON = 0.001;

type PointerPosition = {
  x: number;
  y: number;
  at: number;
};

export type PanoramaControlsHandle = {
  getView: () => PanoViewState;
  setView: (
    view: Partial<PanoViewState>,
    options?: SetPanoViewOptions,
  ) => void;
  reset: () => void;
  /**
   * Adjusts the target view by relative deltas without snapping the current
   * view. Returns false while an interaction lock is held.
   */
  applyViewDelta: (delta: Partial<PanoViewState>) => boolean;
  /** Marks whether keyboard navigation is currently driving the view. */
  setKeyboardActive: (active: boolean) => void;
  applyAutoRotation: (yawDelta: number) => boolean;
  acquireInteractionLock: () => () => void;
};

type PanoramaControlsProps = {
  enabled: boolean;
  initialView: PanoViewState;
  minFov: number;
  maxFov: number;
  options: PanoramaControlsOptions;
  onViewChange?: (view: PanoViewState) => void;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeYaw(yaw: number): number {
  return MathUtils.euclideanModulo(yaw + 180, 360) - 180;
}

function shortestYawDelta(from: number, to: number): number {
  return normalizeYaw(to - from);
}

function dampingFactor(damping: number, deltaSeconds: number): number {
  return damping === 0 ? 1 : 1 - Math.exp(-damping * deltaSeconds);
}

function resolveDamping(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! >= 0 ? value! : fallback;
}

function pointerDistance(a: PointerPosition, b: PointerPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function viewsEqual(a: PanoViewState, b: PanoViewState): boolean {
  return a.yaw === b.yaw && a.pitch === b.pitch && a.fov === b.fov;
}

export const PanoramaControls = forwardRef<
  PanoramaControlsHandle,
  PanoramaControlsProps
>(function PanoramaControls(
  { enabled, initialView, minFov, maxFov, options, onViewChange },
  ref,
) {
  const { camera, gl } = useThree();
  const viewRef = useRef<PanoViewState>({ ...initialView });
  const targetViewRef = useRef<PanoViewState>({ ...initialView });
  const initialViewRef = useRef<PanoViewState>({ ...initialView });
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const pinchDistanceRef = useRef<number | null>(null);
  const yawVelocityRef = useRef(0);
  const pitchVelocityRef = useRef(0);
  const zoomVelocityRef = useRef(0);
  const dirtyRef = useRef(true);
  const interactingRef = useRef(false);
  const interactionLockCountRef = useRef(0);
  const keyboardActiveRef = useRef(false);
  const optionsRef = useRef(options);
  const onViewChangeRef = useRef(onViewChange);
  const lastEmittedViewRef = useRef<PanoViewState | null>(null);
  const eulerRef = useRef(new Euler(0, 0, 0, "YXZ"));

  optionsRef.current = options;
  onViewChangeRef.current = onViewChange;

  const constrainView = (
    view: Partial<PanoViewState>,
    current: PanoViewState = targetViewRef.current,
  ): PanoViewState => {
    return {
      yaw: normalizeYaw(view.yaw ?? current.yaw),
      pitch: clamp(view.pitch ?? current.pitch, -MAX_PITCH, MAX_PITCH),
      fov: clamp(view.fov ?? current.fov, minFov, maxFov),
    };
  };

  const stopVelocity = () => {
    yawVelocityRef.current = 0;
    pitchVelocityRef.current = 0;
    zoomVelocityRef.current = 0;
  };

  const acquireInteractionLock = () => {
    interactionLockCountRef.current += 1;
    stopVelocity();
    interactingRef.current = false;
    pinchDistanceRef.current = null;
    for (const pointerId of pointersRef.current.keys()) {
      if (gl.domElement.hasPointerCapture?.(pointerId)) {
        gl.domElement.releasePointerCapture?.(pointerId);
      }
    }
    pointersRef.current.clear();

    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      interactionLockCountRef.current = Math.max(
        0,
        interactionLockCountRef.current - 1,
      );
    };
  };

  const setView = (
    view: Partial<PanoViewState>,
    setOptions?: SetPanoViewOptions,
  ) => {
    const nextView = constrainView(view);
    targetViewRef.current = nextView;
    viewRef.current = nextView;
    if (setOptions?.immediate !== false) {
      stopVelocity();
    }
    dirtyRef.current = true;
  };

  const applyViewDelta = (delta: Partial<PanoViewState>): boolean => {
    if (interactionLockCountRef.current > 0) {
      return false;
    }

    const current = targetViewRef.current;
    targetViewRef.current = constrainView({
      yaw:
        delta.yaw !== undefined && Number.isFinite(delta.yaw)
          ? current.yaw + delta.yaw
          : current.yaw,
      pitch:
        delta.pitch !== undefined && Number.isFinite(delta.pitch)
          ? current.pitch + delta.pitch
          : current.pitch,
      fov:
        delta.fov !== undefined && Number.isFinite(delta.fov)
          ? current.fov + delta.fov
          : current.fov,
    });
    dirtyRef.current = true;
    return true;
  };

  useImperativeHandle(
    ref,
    () => ({
      getView: () => ({ ...viewRef.current }),
      setView,
      reset: () => setView(initialViewRef.current),
      applyViewDelta,
      setKeyboardActive: (active: boolean) => {
        keyboardActiveRef.current = active;
      },
      acquireInteractionLock,
      applyAutoRotation: (yawDelta: number) => {
        const inertiaFinished =
          yawVelocityRef.current === 0 &&
          pitchVelocityRef.current === 0 &&
          zoomVelocityRef.current === 0;
        if (
          !Number.isFinite(yawDelta) ||
          interactionLockCountRef.current > 0 ||
          interactingRef.current ||
          keyboardActiveRef.current ||
          !inertiaFinished
        ) {
          return false;
        }

        targetViewRef.current.yaw += yawDelta;
        dirtyRef.current = true;
        return true;
      },
    }),
    [gl, maxFov, minFov],
  );

  useEffect(() => {
    initialViewRef.current = { ...initialView };
    setView(initialView);
  }, [initialView.fov, initialView.pitch, initialView.yaw]);

  useEffect(() => {
    const element = gl.domElement;
    if (!enabled) {
      pointersRef.current.clear();
      interactingRef.current = false;
      return;
    }

    const updatePointer = (event: PointerEvent) => {
      const previous = pointersRef.current.get(event.pointerId);
      const now = performance.now();
      const next = { x: event.clientX, y: event.clientY, at: now };
      pointersRef.current.set(event.pointerId, next);
      return { previous, next };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (interactionLockCountRef.current > 0) {
        return;
      }
      event.preventDefault();
      interactingRef.current = true;
      stopVelocity();
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        at: performance.now(),
      });
      element.setPointerCapture?.(event.pointerId);

      if (pointersRef.current.size === 2) {
        const [first, second] = Array.from(pointersRef.current.values());
        pinchDistanceRef.current = pointerDistance(first!, second!);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (interactionLockCountRef.current > 0) {
        return;
      }
      if (!pointersRef.current.has(event.pointerId)) {
        return;
      }

      event.preventDefault();
      const { previous, next } = updatePointer(event);
      if (!previous) {
        return;
      }

      const pointers = Array.from(pointersRef.current.values());
      if (pointers.length >= 2) {
        const distance = pointerDistance(pointers[0]!, pointers[1]!);
        const previousDistance = pinchDistanceRef.current;
        pinchDistanceRef.current = distance;
        if (previousDistance && distance > 0) {
          const currentFov = targetViewRef.current.fov;
          const nextFov = clamp(
            currentFov * (previousDistance / distance),
            minFov,
            maxFov,
          );
          const elapsed = Math.max((next.at - previous.at) / 1000, 1 / 120);
          zoomVelocityRef.current = (nextFov - currentFov) / elapsed;
          targetViewRef.current = {
            ...targetViewRef.current,
            fov: nextFov,
          };
          dirtyRef.current = true;
        }
        return;
      }

      const rect = element.getBoundingClientRect();
      const rotateSpeed = optionsRef.current.rotateSpeed ?? 0.35;
      const deltaYaw =
        (-(next.x - previous.x) * 360 * rotateSpeed) /
        Math.max(rect.width, 1);
      const deltaPitch =
        ((next.y - previous.y) * 180 * rotateSpeed) /
        Math.max(rect.height, 1);
      const elapsed = Math.max((next.at - previous.at) / 1000, 1 / 120);

      targetViewRef.current = constrainView({
        yaw: targetViewRef.current.yaw + deltaYaw,
        pitch: targetViewRef.current.pitch + deltaPitch,
      });
      yawVelocityRef.current = deltaYaw / elapsed;
      pitchVelocityRef.current = deltaPitch / elapsed;
      dirtyRef.current = true;
    };

    const releasePointer = (event: PointerEvent) => {
      pointersRef.current.delete(event.pointerId);
      if (element.hasPointerCapture?.(event.pointerId)) {
        element.releasePointerCapture?.(event.pointerId);
      }
      if (pointersRef.current.size < 2) {
        pinchDistanceRef.current = null;
      }
      interactingRef.current = pointersRef.current.size > 0;
    };

    const onWheel = (event: WheelEvent) => {
      if (interactionLockCountRef.current > 0) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      const zoomSpeed = optionsRef.current.zoomSpeed ?? 0.08;
      const delta = event.deltaY * zoomSpeed;
      const nextFov = clamp(
        targetViewRef.current.fov + delta,
        minFov,
        maxFov,
      );
      zoomVelocityRef.current = clamp(
        zoomVelocityRef.current + delta * 12,
        -180,
        180,
      );
      targetViewRef.current = {
        ...targetViewRef.current,
        fov: nextFov,
      };
      dirtyRef.current = true;
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
      pointersRef.current.clear();
    };
  }, [enabled, gl, maxFov, minFov]);

  useFrame((_, deltaSeconds) => {
    if (!(camera instanceof PerspectiveCamera)) {
      return;
    }

    const inertiaEnabled = optionsRef.current.inertia !== false;
    if (!interactingRef.current && inertiaEnabled) {
      const rotationDamping = Math.exp(
        -INERTIA_ROTATION_DAMPING * deltaSeconds,
      );
      const zoomDamping = Math.exp(-INERTIA_ZOOM_DAMPING * deltaSeconds);

      if (Math.abs(yawVelocityRef.current) >= MIN_ROTATION_VELOCITY) {
        targetViewRef.current.yaw += yawVelocityRef.current * deltaSeconds;
        yawVelocityRef.current *= rotationDamping;
        dirtyRef.current = true;
      } else {
        yawVelocityRef.current = 0;
      }

      if (Math.abs(pitchVelocityRef.current) >= MIN_ROTATION_VELOCITY) {
        targetViewRef.current.pitch += pitchVelocityRef.current * deltaSeconds;
        pitchVelocityRef.current *= rotationDamping;
        dirtyRef.current = true;
      } else {
        pitchVelocityRef.current = 0;
      }

      if (Math.abs(zoomVelocityRef.current) >= MIN_ZOOM_VELOCITY) {
        targetViewRef.current.fov += zoomVelocityRef.current * deltaSeconds;
        zoomVelocityRef.current *= zoomDamping;
        dirtyRef.current = true;
      } else {
        zoomVelocityRef.current = 0;
      }
    } else if (!inertiaEnabled) {
      stopVelocity();
    }

    targetViewRef.current = constrainView(targetViewRef.current);

    if (!dirtyRef.current) {
      return;
    }

    const targetView = targetViewRef.current;
    const rotateDamping = resolveDamping(
      optionsRef.current.rotateDamping,
      DEFAULT_ROTATE_DAMPING,
    );
    const zoomDamping = resolveDamping(
      optionsRef.current.zoomDamping,
      DEFAULT_ZOOM_DAMPING,
    );
    const rotationFactor = dampingFactor(rotateDamping, deltaSeconds);
    const zoomFactor = dampingFactor(zoomDamping, deltaSeconds);
    const yawDelta = shortestYawDelta(viewRef.current.yaw, targetView.yaw);
    const smoothedView = {
      yaw: normalizeYaw(viewRef.current.yaw + yawDelta * rotationFactor),
      pitch:
        viewRef.current.pitch +
        (targetView.pitch - viewRef.current.pitch) * rotationFactor,
      fov:
        viewRef.current.fov +
        (targetView.fov - viewRef.current.fov) * zoomFactor,
    };
    const hasSettled =
      Math.abs(shortestYawDelta(smoothedView.yaw, targetView.yaw)) <
        VIEW_SETTLE_EPSILON &&
      Math.abs(smoothedView.pitch - targetView.pitch) < VIEW_SETTLE_EPSILON &&
      Math.abs(smoothedView.fov - targetView.fov) < VIEW_SETTLE_EPSILON;
    viewRef.current = hasSettled ? { ...targetView } : smoothedView;
    eulerRef.current.set(
      MathUtils.degToRad(viewRef.current.pitch),
      MathUtils.degToRad(-viewRef.current.yaw),
      0,
      "YXZ",
    );
    camera.quaternion.setFromEuler(eulerRef.current);
    camera.fov = viewRef.current.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const nextView = { ...viewRef.current };
    const lastEmitted = lastEmittedViewRef.current;
    if (!lastEmitted || !viewsEqual(lastEmitted, nextView)) {
      lastEmittedViewRef.current = nextView;
      onViewChangeRef.current?.(nextView);
    }
    dirtyRef.current = !hasSettled;
  });

  return null;
});
