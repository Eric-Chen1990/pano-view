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

const MAX_PITCH = 89.9;
const ROTATION_DAMPING = 8;
const ZOOM_DAMPING = 12;
const MIN_ROTATION_VELOCITY = 0.01;
const MIN_ZOOM_VELOCITY = 0.01;

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
  startAutoRotate: () => void;
  stopAutoRotate: () => void;
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
  const initialViewRef = useRef<PanoViewState>({ ...initialView });
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const pinchDistanceRef = useRef<number | null>(null);
  const yawVelocityRef = useRef(0);
  const pitchVelocityRef = useRef(0);
  const zoomVelocityRef = useRef(0);
  const dirtyRef = useRef(true);
  const interactingRef = useRef(false);
  const autoRotateRef = useRef(options.autoRotate ?? false);
  const optionsRef = useRef(options);
  const onViewChangeRef = useRef(onViewChange);
  const lastEmittedViewRef = useRef<PanoViewState | null>(null);
  const eulerRef = useRef(new Euler(0, 0, 0, "YXZ"));

  optionsRef.current = options;
  onViewChangeRef.current = onViewChange;

  const constrainView = (view: Partial<PanoViewState>): PanoViewState => {
    const current = viewRef.current;
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

  const setView = (
    view: Partial<PanoViewState>,
    setOptions?: SetPanoViewOptions,
  ) => {
    viewRef.current = constrainView(view);
    if (setOptions?.immediate !== false) {
      stopVelocity();
    }
    dirtyRef.current = true;
  };

  useImperativeHandle(
    ref,
    () => ({
      getView: () => ({ ...viewRef.current }),
      setView,
      reset: () => setView(initialViewRef.current),
      startAutoRotate: () => {
        autoRotateRef.current = true;
      },
      stopAutoRotate: () => {
        autoRotateRef.current = false;
      },
    }),
    [maxFov, minFov],
  );

  useEffect(() => {
    autoRotateRef.current = options.autoRotate ?? false;
  }, [options.autoRotate]);

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
          const currentFov = viewRef.current.fov;
          const nextFov = clamp(
            currentFov * (previousDistance / distance),
            minFov,
            maxFov,
          );
          const elapsed = Math.max((next.at - previous.at) / 1000, 1 / 120);
          zoomVelocityRef.current = (nextFov - currentFov) / elapsed;
          viewRef.current = { ...viewRef.current, fov: nextFov };
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

      viewRef.current = constrainView({
        yaw: viewRef.current.yaw + deltaYaw,
        pitch: viewRef.current.pitch + deltaPitch,
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
      event.preventDefault();
      const zoomSpeed = optionsRef.current.zoomSpeed ?? 0.08;
      const delta = event.deltaY * zoomSpeed;
      const nextFov = clamp(viewRef.current.fov + delta, minFov, maxFov);
      zoomVelocityRef.current = clamp(
        zoomVelocityRef.current + delta * 12,
        -180,
        180,
      );
      viewRef.current = { ...viewRef.current, fov: nextFov };
      dirtyRef.current = true;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (optionsRef.current.keyboard === false) {
        return;
      }

      const step = event.shiftKey ? 10 : 3;
      let next: Partial<PanoViewState> | null = null;
      if (event.key === "ArrowLeft") {
        next = { yaw: viewRef.current.yaw - step };
      } else if (event.key === "ArrowRight") {
        next = { yaw: viewRef.current.yaw + step };
      } else if (event.key === "ArrowUp") {
        next = { pitch: viewRef.current.pitch + step };
      } else if (event.key === "ArrowDown") {
        next = { pitch: viewRef.current.pitch - step };
      } else if (event.key === "+" || event.key === "=") {
        next = { fov: viewRef.current.fov - step };
      } else if (event.key === "-" || event.key === "_") {
        next = { fov: viewRef.current.fov + step };
      } else if (event.key === "0") {
        setView(initialViewRef.current);
        event.preventDefault();
        return;
      }

      if (next) {
        event.preventDefault();
        setView(next);
      }
    };

    element.addEventListener("pointerdown", onPointerDown);
    element.addEventListener("pointermove", onPointerMove);
    element.addEventListener("pointerup", releasePointer);
    element.addEventListener("pointercancel", releasePointer);
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("keydown", onKeyDown);

    return () => {
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerup", releasePointer);
      element.removeEventListener("pointercancel", releasePointer);
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("keydown", onKeyDown);
      pointersRef.current.clear();
    };
  }, [enabled, gl, maxFov, minFov]);

  useFrame((_, deltaSeconds) => {
    if (!(camera instanceof PerspectiveCamera)) {
      return;
    }

    const inertiaEnabled = optionsRef.current.inertia !== false;
    if (!interactingRef.current && inertiaEnabled) {
      const rotationDamping = Math.exp(-ROTATION_DAMPING * deltaSeconds);
      const zoomDamping = Math.exp(-ZOOM_DAMPING * deltaSeconds);

      if (Math.abs(yawVelocityRef.current) >= MIN_ROTATION_VELOCITY) {
        viewRef.current.yaw += yawVelocityRef.current * deltaSeconds;
        yawVelocityRef.current *= rotationDamping;
        dirtyRef.current = true;
      } else {
        yawVelocityRef.current = 0;
      }

      if (Math.abs(pitchVelocityRef.current) >= MIN_ROTATION_VELOCITY) {
        viewRef.current.pitch += pitchVelocityRef.current * deltaSeconds;
        pitchVelocityRef.current *= rotationDamping;
        dirtyRef.current = true;
      } else {
        pitchVelocityRef.current = 0;
      }

      if (Math.abs(zoomVelocityRef.current) >= MIN_ZOOM_VELOCITY) {
        viewRef.current.fov += zoomVelocityRef.current * deltaSeconds;
        zoomVelocityRef.current *= zoomDamping;
        dirtyRef.current = true;
      } else {
        zoomVelocityRef.current = 0;
      }
    } else if (!inertiaEnabled) {
      stopVelocity();
    }

    const inertiaFinished =
      yawVelocityRef.current === 0 &&
      pitchVelocityRef.current === 0 &&
      zoomVelocityRef.current === 0;
    if (
      autoRotateRef.current &&
      !interactingRef.current &&
      inertiaFinished
    ) {
      viewRef.current.yaw +=
        (optionsRef.current.autoRotateSpeed ?? 18) * deltaSeconds;
      dirtyRef.current = true;
    }

    if (!dirtyRef.current) {
      return;
    }

    viewRef.current = constrainView(viewRef.current);
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
    dirtyRef.current = false;
  });

  return null;
});
