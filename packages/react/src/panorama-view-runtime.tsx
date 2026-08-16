import { useFrame, useThree } from "@react-three/fiber";
import {
  createContext,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { RefObject } from "react";
import { Euler, MathUtils, PerspectiveCamera } from "three";
import type { PanoEventBus } from "./pano-event-bus";
import type {
  PanoramaControlsOptions,
  PanoViewState,
  SetPanoViewOptions,
} from "./types";

const MAX_PITCH = 90;
const BOUNCE_OVERSHOOT_PITCH = 12;
const BOUNCE_OVERSHOOT_FOV_RATIO = 0.15;
const INERTIA_ROTATION_DAMPING = 8;
const INERTIA_ZOOM_DAMPING = 12;
const DEFAULT_ROTATE_DAMPING = 14;
const DEFAULT_ZOOM_DAMPING = 16;
const DEFAULT_FRICTION_STOP = 0.01;
const VIEW_SETTLE_EPSILON = 0.001;

export type ApplyViewDeltaOptions = {
  /** When true, records yaw/pitch/fov velocity for post-drag inertia. */
  recordVelocity?: boolean;
};

export type PanoramaViewRuntimeHandle = {
  getView: () => PanoViewState;
  /** Target view used by drag/zoom input before camera smoothing. */
  getTargetView: () => PanoViewState;
  setView: (
    view: Partial<PanoViewState>,
    options?: SetPanoViewOptions,
  ) => void;
  reset: () => void;
  /**
   * Adjusts the target view by relative deltas without snapping the current
   * view. Returns false while an interaction lock is held.
   */
  applyViewDelta: (
    delta: Partial<PanoViewState>,
    options?: ApplyViewDeltaOptions,
  ) => boolean;
  /** Marks whether keyboard navigation is currently driving the view. */
  setKeyboardActive: (active: boolean) => void;
  /** Marks whether mouse or touch input is currently driving the view. */
  setPointerActive: (source: "mouse" | "touch", active: boolean) => void;
  /** Whether hotspot / transition locks currently block user input. */
  isInteractionLocked: () => boolean;
  /**
   * True while pointer/keyboard input, post-drag inertia, or an interaction
   * lock is active. Used by idle timers and AutoRotate pause logic.
   */
  isUserInteracting: () => boolean;
  applyAutoRotation: (yawDelta: number) => boolean;
  acquireInteractionLock: () => () => void;
};

export const PanoramaViewContext = createContext<
  RefObject<PanoramaViewRuntimeHandle | null> | null
>(null);

type PanoramaViewRuntimeProps = {
  initialView: PanoViewState;
  minFov: number;
  maxFov: number;
  options: PanoramaControlsOptions;
  eventBus: PanoEventBus;
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

function resolveFrictionStop(value: number | undefined): number {
  return Number.isFinite(value) && value! >= 0 ? value! : DEFAULT_FRICTION_STOP;
}

function viewsEqual(a: PanoViewState, b: PanoViewState): boolean {
  return a.yaw === b.yaw && a.pitch === b.pitch && a.fov === b.fov;
}

/**
 * Internal canvas host for view following, inertia, and interaction locks.
 * Not part of the public API — input is provided by Mouse/Touch/Keyboard.
 */
export const PanoramaViewRuntime = forwardRef<
  PanoramaViewRuntimeHandle,
  PanoramaViewRuntimeProps
>(function PanoramaViewRuntime(
  { initialView, minFov, maxFov, options, eventBus },
  ref,
) {
  const { camera } = useThree();
  const viewRef = useRef<PanoViewState>({ ...initialView });
  const targetViewRef = useRef<PanoViewState>({ ...initialView });
  const initialViewRef = useRef<PanoViewState>({ ...initialView });
  const yawVelocityRef = useRef(0);
  const pitchVelocityRef = useRef(0);
  const zoomVelocityRef = useRef(0);
  const dirtyRef = useRef(true);
  const settledRef = useRef(false);
  const interactingRef = useRef(false);
  const mouseActiveRef = useRef(false);
  const touchActiveRef = useRef(false);
  const interactionLockCountRef = useRef(0);
  const keyboardActiveRef = useRef(false);
  const lastVelocitySampleAtRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  const eventBusRef = useRef(eventBus);
  const lastEmittedViewRef = useRef<PanoViewState | null>(null);
  const eulerRef = useRef(new Euler(0, 0, 0, "YXZ"));
  const minFovRef = useRef(minFov);
  const maxFovRef = useRef(maxFov);

  optionsRef.current = options;
  eventBusRef.current = eventBus;
  minFovRef.current = minFov;
  maxFovRef.current = maxFov;

  const hasInertia = () =>
    yawVelocityRef.current !== 0 ||
    pitchVelocityRef.current !== 0 ||
    zoomVelocityRef.current !== 0;

  const isUserInteracting = () =>
    mouseActiveRef.current ||
    touchActiveRef.current ||
    keyboardActiveRef.current ||
    interactionLockCountRef.current > 0 ||
    hasInertia();

  const syncInteracting = () => {
    interactingRef.current = mouseActiveRef.current || touchActiveRef.current;
  };

  const hardConstrainView = (
    view: Partial<PanoViewState>,
    current: PanoViewState = targetViewRef.current,
  ): PanoViewState => {
    return {
      yaw: normalizeYaw(view.yaw ?? current.yaw),
      pitch: clamp(view.pitch ?? current.pitch, -MAX_PITCH, MAX_PITCH),
      fov: clamp(
        view.fov ?? current.fov,
        minFovRef.current,
        maxFovRef.current,
      ),
    };
  };

  const softConstrainView = (
    view: Partial<PanoViewState>,
    current: PanoViewState = targetViewRef.current,
  ): PanoViewState => {
    const bouncing = optionsRef.current.bouncingLimits === true;
    if (!bouncing || !interactingRef.current) {
      return hardConstrainView(view, current);
    }

    const fovRange = Math.max(maxFovRef.current - minFovRef.current, 1);
    const fovOvershoot = fovRange * BOUNCE_OVERSHOOT_FOV_RATIO;
    return {
      yaw: normalizeYaw(view.yaw ?? current.yaw),
      pitch: clamp(
        view.pitch ?? current.pitch,
        -MAX_PITCH - BOUNCE_OVERSHOOT_PITCH,
        MAX_PITCH + BOUNCE_OVERSHOOT_PITCH,
      ),
      fov: clamp(
        view.fov ?? current.fov,
        minFovRef.current - fovOvershoot,
        maxFovRef.current + fovOvershoot,
      ),
    };
  };

  const stopVelocity = () => {
    yawVelocityRef.current = 0;
    pitchVelocityRef.current = 0;
    zoomVelocityRef.current = 0;
    lastVelocitySampleAtRef.current = null;
  };

  const markDirty = () => {
    dirtyRef.current = true;
    settledRef.current = false;
  };

  const snapTargetToHardLimits = () => {
    const next = hardConstrainView(targetViewRef.current);
    if (
      next.yaw !== targetViewRef.current.yaw ||
      next.pitch !== targetViewRef.current.pitch ||
      next.fov !== targetViewRef.current.fov
    ) {
      targetViewRef.current = next;
      markDirty();
    }
  };

  const acquireInteractionLock = () => {
    interactionLockCountRef.current += 1;
    stopVelocity();
    if (mouseActiveRef.current) {
      mouseActiveRef.current = false;
      eventBusRef.current.emit("viewinteractionend", { source: "mouse" });
    }
    if (touchActiveRef.current) {
      touchActiveRef.current = false;
      eventBusRef.current.emit("viewinteractionend", { source: "touch" });
    }
    syncInteracting();

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
    const nextView = hardConstrainView(view);
    targetViewRef.current = nextView;
    viewRef.current = nextView;
    if (setOptions?.immediate !== false) {
      stopVelocity();
    }
    markDirty();
  };

  const applyViewDelta = (
    delta: Partial<PanoViewState>,
    applyOptions?: ApplyViewDeltaOptions,
  ): boolean => {
    if (interactionLockCountRef.current > 0) {
      return false;
    }

    const current = targetViewRef.current;
    const nextYaw =
      delta.yaw !== undefined && Number.isFinite(delta.yaw)
        ? current.yaw + delta.yaw
        : current.yaw;
    const nextPitch =
      delta.pitch !== undefined && Number.isFinite(delta.pitch)
        ? current.pitch + delta.pitch
        : current.pitch;
    const nextFov =
      delta.fov !== undefined && Number.isFinite(delta.fov)
        ? current.fov + delta.fov
        : current.fov;

    targetViewRef.current = softConstrainView({
      yaw: nextYaw,
      pitch: nextPitch,
      fov: nextFov,
    });
    markDirty();

    if (applyOptions?.recordVelocity) {
      const now = performance.now();
      const previousAt = lastVelocitySampleAtRef.current;
      const elapsed =
        previousAt === null
          ? 1 / 60
          : Math.max((now - previousAt) / 1000, 1 / 120);
      lastVelocitySampleAtRef.current = now;

      if (delta.yaw !== undefined && Number.isFinite(delta.yaw)) {
        yawVelocityRef.current = delta.yaw / elapsed;
      }
      if (delta.pitch !== undefined && Number.isFinite(delta.pitch)) {
        pitchVelocityRef.current = delta.pitch / elapsed;
      }
      if (delta.fov !== undefined && Number.isFinite(delta.fov)) {
        zoomVelocityRef.current = clamp(delta.fov / elapsed, -180, 180);
      }
    }

    return true;
  };

  useImperativeHandle(
    ref,
    () => ({
      getView: () => ({ ...viewRef.current }),
      getTargetView: () => ({ ...targetViewRef.current }),
      setView,
      reset: () => setView(initialViewRef.current),
      applyViewDelta,
      setKeyboardActive: (active: boolean) => {
        const wasActive = keyboardActiveRef.current;
        keyboardActiveRef.current = active;
        if (active && !wasActive) {
          eventBusRef.current.emit("viewinteractionstart", {
            source: "keyboard",
          });
        } else if (!active && wasActive) {
          eventBusRef.current.emit("viewinteractionend", {
            source: "keyboard",
          });
        }
      },
      setPointerActive: (source, active) => {
        const wasActive =
          source === "mouse"
            ? mouseActiveRef.current
            : touchActiveRef.current;
        if (source === "mouse") {
          mouseActiveRef.current = active;
        } else {
          touchActiveRef.current = active;
        }
        syncInteracting();
        if (active && !wasActive) {
          eventBusRef.current.emit("viewinteractionstart", { source });
        } else if (!active && wasActive) {
          eventBusRef.current.emit("viewinteractionend", { source });
        }
        if (active) {
          stopVelocity();
        } else if (!mouseActiveRef.current && !touchActiveRef.current) {
          lastVelocitySampleAtRef.current = null;
          snapTargetToHardLimits();
        }
      },
      isInteractionLocked: () => interactionLockCountRef.current > 0,
      isUserInteracting,
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
        markDirty();
        return true;
      },
    }),
    [],
  );

  useEffect(() => {
    initialViewRef.current = { ...initialView };
    setView(initialView);
  }, [initialView.fov, initialView.pitch, initialView.yaw]);

  useFrame((_, deltaSeconds) => {
    if (!(camera instanceof PerspectiveCamera)) {
      return;
    }

    const frictionStop = resolveFrictionStop(optionsRef.current.frictionStop);
    const inertiaEnabled = optionsRef.current.inertia !== false;
    if (!interactingRef.current && inertiaEnabled) {
      const rotationDamping = Math.exp(
        -INERTIA_ROTATION_DAMPING * deltaSeconds,
      );
      const zoomDamping = Math.exp(-INERTIA_ZOOM_DAMPING * deltaSeconds);

      if (Math.abs(yawVelocityRef.current) >= frictionStop) {
        targetViewRef.current.yaw += yawVelocityRef.current * deltaSeconds;
        yawVelocityRef.current *= rotationDamping;
        markDirty();
      } else {
        yawVelocityRef.current = 0;
      }

      if (Math.abs(pitchVelocityRef.current) >= frictionStop) {
        targetViewRef.current.pitch += pitchVelocityRef.current * deltaSeconds;
        pitchVelocityRef.current *= rotationDamping;
        markDirty();
      } else {
        pitchVelocityRef.current = 0;
      }

      if (Math.abs(zoomVelocityRef.current) >= frictionStop) {
        targetViewRef.current.fov += zoomVelocityRef.current * deltaSeconds;
        zoomVelocityRef.current *= zoomDamping;
        markDirty();
      } else {
        zoomVelocityRef.current = 0;
      }
    } else if (!inertiaEnabled) {
      stopVelocity();
    }

    if (!interactingRef.current) {
      targetViewRef.current = hardConstrainView(targetViewRef.current);
    } else {
      targetViewRef.current = softConstrainView(targetViewRef.current);
    }

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
      eventBusRef.current.emit("viewchange", nextView);
    }

    const wasSettled = settledRef.current;
    settledRef.current = hasSettled;
    if (hasSettled && !wasSettled) {
      eventBusRef.current.emit("viewsettled", nextView);
    }

    dirtyRef.current = !hasSettled;
  });

  return null;
});
