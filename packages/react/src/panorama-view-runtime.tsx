import { useFrame, useThree } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import {
  createContext,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { RefObject } from "react";
import { Euler, MathUtils, PerspectiveCamera } from "three";
import type { GyroPose, GyroTouchMode } from "./gyro-types";
import type { PanoEventBus } from "./pano-event-bus";
import type {
  PanoramaControlsOptions,
  PanoViewerState,
  SetPanoViewerOptions,
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
  /** Input channel applying the delta. */
  source?: "mouse" | "touch" | "keyboard";
};

export type PanoramaViewRuntimeHandle = {
  getView: () => PanoViewerState;
  /** Target view used by drag/zoom input before camera smoothing. */
  getTargetView: () => PanoViewerState;
  setView: (
    view: Partial<PanoViewerState>,
    options?: SetPanoViewerOptions,
  ) => void;
  reset: () => void;
  /**
   * Adjusts the target view by relative deltas without snapping the current
   * view. Returns false while an interaction lock is held.
   */
  applyViewDelta: (
    delta: Partial<PanoViewerState>,
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
  /** Enables or disables device-orientation control. */
  setGyroActive: (active: boolean) => void;
  /** Updates the latest device-orientation pose. */
  setGyroPose: (pose: GyroPose) => void;
  /** Configures how pointer deltas combine with the gyro pose. */
  setGyroTouchMode: (mode: GyroTouchMode) => void;
  applyAutoRotation: (yawDelta: number) => boolean;
  acquireInteractionLock: () => () => void;
};

export const PanoramaViewContext = createContext<
  RefObject<PanoramaViewRuntimeHandle | null> | null
>(null);

type PanoramaViewRuntimeProps = {
  initialView: PanoViewerState;
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

function viewsEqual(a: PanoViewerState, b: PanoViewerState): boolean {
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
  const { camera, gl } = useThree();
  const xrSession = useXR((state) => state.session);
  const xrSessionRef = useRef(xrSession);
  const viewRef = useRef<PanoViewerState>({ ...initialView });
  const targetViewRef = useRef<PanoViewerState>({ ...initialView });
  const initialViewRef = useRef<PanoViewerState>({ ...initialView });
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
  const gyroActiveRef = useRef(false);
  const gyroPoseRef = useRef<GyroPose>({ yaw: 0, pitch: 0, roll: 0 });
  const gyroOffsetRef = useRef({ yaw: 0, pitch: 0 });
  const gyroTouchModeRef = useRef<GyroTouchMode>("full");
  const cameraRollRef = useRef(0);
  const lastVelocitySampleAtRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  const eventBusRef = useRef(eventBus);
  const lastEmittedViewRef = useRef<PanoViewerState | null>(null);
  const eulerRef = useRef(new Euler(0, 0, 0, "YXZ"));
  const xrEulerRef = useRef(new Euler(0, 0, 0, "YXZ"));
  const minFovRef = useRef(minFov);
  const maxFovRef = useRef(maxFov);

  optionsRef.current = options;
  eventBusRef.current = eventBus;
  xrSessionRef.current = xrSession;
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
    gyroActiveRef.current ||
    interactionLockCountRef.current > 0 ||
    xrSessionRef.current != null ||
    hasInertia();

  const syncInteracting = () => {
    interactingRef.current = mouseActiveRef.current || touchActiveRef.current;
  };

  const hardConstrainView = (
    view: Partial<PanoViewerState>,
    current: PanoViewerState = targetViewRef.current,
  ): PanoViewerState => {
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
    view: Partial<PanoViewerState>,
    current: PanoViewerState = targetViewRef.current,
  ): PanoViewerState => {
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
    view: Partial<PanoViewerState>,
    setOptions?: SetPanoViewerOptions,
  ) => {
    const nextView = hardConstrainView(view);
    if (gyroActiveRef.current) {
      gyroOffsetRef.current = {
        yaw: shortestYawDelta(gyroPoseRef.current.yaw, nextView.yaw),
        pitch: nextView.pitch - gyroPoseRef.current.pitch,
      };
    }
    targetViewRef.current = nextView;
    viewRef.current = nextView;
    if (setOptions?.immediate !== false) {
      stopVelocity();
    }
    markDirty();
  };

  const applyViewDelta = (
    delta: Partial<PanoViewerState>,
    applyOptions?: ApplyViewDeltaOptions,
  ): boolean => {
    if (
      interactionLockCountRef.current > 0 ||
      xrSessionRef.current != null
    ) {
      return false;
    }

    const current = targetViewRef.current;
    const gyroMode = gyroTouchModeRef.current;
    const gyroControlsView = gyroActiveRef.current;
    const appliesTouchMode =
      gyroControlsView && applyOptions?.source === "touch";
    const acceptsYaw =
      !appliesTouchMode ||
      gyroMode === "horizontaloffset" ||
      gyroMode === "full";
    const acceptsPitch = !appliesTouchMode || gyroMode === "full";
    const nextYaw =
      acceptsYaw && delta.yaw !== undefined && Number.isFinite(delta.yaw)
        ? current.yaw + delta.yaw
        : current.yaw;
    const nextPitch =
      acceptsPitch && delta.pitch !== undefined && Number.isFinite(delta.pitch)
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
    if (gyroControlsView) {
      if (acceptsYaw && delta.yaw !== undefined && Number.isFinite(delta.yaw)) {
        gyroOffsetRef.current.yaw += delta.yaw;
      }
      if (
        acceptsPitch &&
        delta.pitch !== undefined &&
        Number.isFinite(delta.pitch)
      ) {
        gyroOffsetRef.current.pitch += delta.pitch;
      }
    }
    markDirty();

    if (applyOptions?.recordVelocity && !gyroControlsView) {
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
      setGyroActive: (active: boolean) => {
        gyroActiveRef.current = active;
        gyroOffsetRef.current = { yaw: 0, pitch: 0 };
        stopVelocity();
        if (!active) {
          cameraRollRef.current = 0;
          dirtyRef.current = true;
        }
      },
      setGyroPose: (pose: GyroPose) => {
        if (
          !gyroActiveRef.current ||
          interactionLockCountRef.current > 0 ||
          !Number.isFinite(pose.yaw) ||
          !Number.isFinite(pose.pitch) ||
          !Number.isFinite(pose.roll)
        ) {
          return;
        }

        const previous = gyroPoseRef.current;
        const viewMovement =
          Math.abs(shortestYawDelta(previous.yaw, pose.yaw)) +
          Math.abs(previous.pitch - pose.pitch);
        const movement =
          viewMovement + Math.abs(previous.roll - pose.roll);
        if (movement < 0.0001) {
          return;
        }
        gyroPoseRef.current = { ...pose };
        targetViewRef.current = hardConstrainView({
          yaw: pose.yaw + gyroOffsetRef.current.yaw,
          pitch: pose.pitch + gyroOffsetRef.current.pitch,
        });
        cameraRollRef.current = pose.roll;
        if (viewMovement >= 0.0001) {
          markDirty();
        } else {
          dirtyRef.current = true;
        }
      },
      setGyroTouchMode: (mode: GyroTouchMode) => {
        gyroTouchModeRef.current = mode;
      },
      acquireInteractionLock,
      applyAutoRotation: (yawDelta: number) => {
        const inertiaFinished =
          yawVelocityRef.current === 0 &&
          pitchVelocityRef.current === 0 &&
          zoomVelocityRef.current === 0;
        if (
          !Number.isFinite(yawDelta) ||
          xrSessionRef.current != null ||
          gyroActiveRef.current ||
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
    if (xrSessionRef.current && gl.xr.isPresenting) {
      const xrCamera = gl.xr.getCamera();
      xrEulerRef.current.setFromQuaternion(xrCamera.quaternion, "YXZ");
      const nextView = {
        yaw: normalizeYaw(-MathUtils.radToDeg(xrEulerRef.current.y)),
        pitch: clamp(
          MathUtils.radToDeg(xrEulerRef.current.x),
          -MAX_PITCH,
          MAX_PITCH,
        ),
        fov: viewRef.current.fov,
      };
      viewRef.current = nextView;
      targetViewRef.current = nextView;
      const lastEmitted = lastEmittedViewRef.current;
      if (!lastEmitted || !viewsEqual(lastEmitted, nextView)) {
        lastEmittedViewRef.current = { ...nextView };
        eventBusRef.current.emit("viewchange", { ...nextView });
      }
      return;
    }

    const frictionStop = resolveFrictionStop(optionsRef.current.frictionStop);
    const inertiaEnabled = optionsRef.current.inertia !== false;
    if (!interactingRef.current && !gyroActiveRef.current && inertiaEnabled) {
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
      MathUtils.degToRad(cameraRollRef.current),
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
