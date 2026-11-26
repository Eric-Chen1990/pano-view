import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useRef } from "react";
import {
  AUTO_ROTATE_MAX_FRAME_DELTA_SECONDS,
  autoRotateRestoreDuration,
  fovScaledYawSpeed,
  sampleRestoreFov,
  stepAutoRotateSpeed,
} from "./auto-rotate-motion";
import { PanoEventBusContext } from "./pano-event-bus";
import { PanoramaViewContext } from "./panorama-view-runtime";

const DEFAULT_AUTO_ROTATE_SPEED = 18;
const DEFAULT_AUTO_ROTATE_ACCELERATION = 18;
const DEFAULT_AUTO_ROTATE_START_DELAY = 2;
const FOV_ABORT_EPSILON = 0.01;

/** Options for automatic horizontal panorama rotation. */
export type AutoRotateProps = {
  /** Whether automatic rotation is active. Defaults to true. */
  enabled?: boolean;
  /**
   * Rotation speed in degrees per second at the reference FOV (the restore
   * target, or the viewer's initial FOV when restore is disabled). Negative
   * values rotate left. Actual yaw speed scales with the current FOV.
   */
  speed?: number;
  /**
   * Rate at which signed rotation speed approaches its target, in degrees per
   * second squared. Also used for deceleration and direction changes. Use 0
   * to snap immediately to the target speed. Defaults to 18.
   */
  acceleration?: number;
  /** Milliseconds to wait after enabling before rotation begins. */
  startDelay?: number;
  /**
   * FOV restored when rotation starts or resumes after interaction. Defaults
   * to the viewer's initial view FOV. Pass `false` to keep the current zoom
   * while still using the initial FOV as the speed-scaling reference.
   */
  fov?: number | false;
};

function resolveStartDelay(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(value!, 0) : 0;
}

function resolveAcceleration(value: number | undefined): number {
  return Number.isFinite(value) && value! >= 0
    ? value!
    : DEFAULT_AUTO_ROTATE_ACCELERATION;
}

type FovRestoreState = {
  fromFov: number;
  toFov: number;
  elapsed: number;
  duration: number;
  lastWrittenFov: number;
};

/**
 * Adds automatic rotation to the nearest PanoViewer. Render one instance as a
 * child of PanoViewer, alongside its panorama source.
 */
export function AutoRotate({
  enabled = true,
  speed = DEFAULT_AUTO_ROTATE_SPEED,
  acceleration = DEFAULT_AUTO_ROTATE_ACCELERATION,
  startDelay = DEFAULT_AUTO_ROTATE_START_DELAY,
  fov,
}: AutoRotateProps) {
  const controlsRef = useContext(PanoramaViewContext);
  const eventBus = useContext(PanoEventBusContext);
  const invalidate = useThree((state) => state.invalidate);
  const elapsedRef = useRef(0);
  const rotationSpeedRef = useRef(0);
  const rotatingRef = useRef(false);
  const yawAccumulatedRef = useRef(0);
  const fovRestoreRef = useRef<FovRestoreState | null>(null);

  if (!controlsRef) {
    throw new Error("<AutoRotate> must be rendered inside <PanoViewer>.");
  }

  useEffect(() => {
    elapsedRef.current = 0;
    rotationSpeedRef.current = 0;
    yawAccumulatedRef.current = 0;
    fovRestoreRef.current = null;
    if (rotatingRef.current) {
      rotatingRef.current = false;
      eventBus?.emit("autorotatestop", undefined);
    }
  }, [enabled, eventBus, startDelay]);

  // Demand mode stops after settle; wake once startDelay elapses or the view settles.
  useEffect(() => {
    if (!enabled || !Number.isFinite(speed) || speed === 0) return;
    const delay = resolveStartDelay(startDelay);
    const timer = window.setTimeout(() => invalidate(), delay);
    const unsubscribe = eventBus?.subscribe("viewsettled", () => {
      window.setTimeout(() => invalidate(), resolveStartDelay(startDelay));
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, [enabled, eventBus, invalidate, speed, startDelay]);

  useFrame((state, deltaSeconds) => {
    if (!enabled || !Number.isFinite(speed) || speed === 0) {
      rotationSpeedRef.current = 0;
      fovRestoreRef.current = null;
      if (rotatingRef.current) {
        rotatingRef.current = false;
        eventBus?.emit("autorotatestop", undefined);
      }
      return;
    }

    const delta = Math.min(deltaSeconds, AUTO_ROTATE_MAX_FRAME_DELTA_SECONDS);
    const delaySeconds = resolveStartDelay(startDelay) / 1000;
    elapsedRef.current += delta;
    if (elapsedRef.current < delaySeconds) {
      state.invalidate();
      return;
    }

    const runtime = controlsRef.current;
    if (!runtime) {
      return;
    }

    const accelerationPerSecond = resolveAcceleration(acceleration);
    const currentSpeed = rotationSpeedRef.current;
    const nextSpeed = stepAutoRotateSpeed(
      currentSpeed,
      speed,
      accelerationPerSecond,
      delta,
    );
    const averageSpeed = (currentSpeed + nextSpeed) / 2;

    const initialView = runtime.getInitialView();
    const referenceFov = initialView.fov;
    const renderedView = runtime.getView();
    const targetView = runtime.getTargetView();
    const starting = !rotatingRef.current;

    if (starting && fov !== false) {
      const toFov =
        fov !== undefined && Number.isFinite(fov) ? fov : initialView.fov;
      const constrainedTo = runtime.constrainSceneView({
        yaw: renderedView.yaw,
        pitch: renderedView.pitch,
        fov: toFov,
      }).fov;
      const fromFov = renderedView.fov;
      if (Math.abs(fromFov - constrainedTo) > FOV_ABORT_EPSILON) {
        fovRestoreRef.current = {
          fromFov,
          toFov: constrainedTo,
          elapsed: 0,
          duration: autoRotateRestoreDuration(speed, accelerationPerSecond),
          lastWrittenFov: targetView.fov,
        };
      } else {
        fovRestoreRef.current = null;
      }
    }

    let restoreFov: number | undefined;
    const restore = fovRestoreRef.current;
    if (restore) {
      const targetMoved =
        Math.abs(targetView.fov - restore.lastWrittenFov) > FOV_ABORT_EPSILON;
      if (targetMoved && !starting) {
        fovRestoreRef.current = null;
      } else {
        restore.elapsed += delta;
        restoreFov = sampleRestoreFov(
          restore.fromFov,
          restore.toFov,
          restore.elapsed,
          restore.duration,
        );
        restore.lastWrittenFov = restoreFov;
        if (restore.elapsed >= restore.duration) {
          fovRestoreRef.current = null;
        }
      }
    }

    const speedScaleFov =
      restoreFov !== undefined ? restoreFov : renderedView.fov;
    const yawSpeed = fovScaledYawSpeed(
      averageSpeed,
      speedScaleFov,
      referenceFov,
    );
    const yawDelta = yawSpeed * delta;

    if (
      !runtime.applyAutoRotation({
        yaw: yawDelta,
        ...(restoreFov !== undefined ? { fov: restoreFov } : {}),
      })
    ) {
      rotationSpeedRef.current = 0;
      fovRestoreRef.current = null;
      if (rotatingRef.current) {
        rotatingRef.current = false;
        eventBus?.emit("autorotatestop", undefined);
      }
      return;
    }

    if (starting) {
      rotatingRef.current = true;
      eventBus?.emit("autorotatestart", undefined);
    }

    yawAccumulatedRef.current += Math.abs(yawDelta);
    while (yawAccumulatedRef.current >= 360) {
      yawAccumulatedRef.current -= 360;
      eventBus?.emit("autorotateoneround", undefined);
    }

    rotationSpeedRef.current = nextSpeed;
    state.invalidate();
  });

  return null;
}
