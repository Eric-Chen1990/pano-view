import { useFrame } from "@react-three/fiber";
import { useContext, useEffect, useRef } from "react";
import { PanoEventBusContext } from "./pano-event-bus";
import { PanoramaViewContext } from "./panorama-view-runtime";

const DEFAULT_AUTO_ROTATE_SPEED = 18;
const DEFAULT_AUTO_ROTATE_ACCELERATION = 18;
const DEFAULT_AUTO_ROTATE_START_DELAY = 2;

/** Options for automatic horizontal panorama rotation. */
export type AutoRotateProps = {
  /** Whether automatic rotation is active. Defaults to true. */
  enabled?: boolean;
  /** Rotation speed in degrees per second. Negative values rotate left. */
  speed?: number;
  /**
   * Rate at which rotation reaches its target speed, in degrees per second
   * squared. Use 0 to disable the speed ramp. Defaults to 18.
   */
  acceleration?: number;
  /** Milliseconds to wait after enabling before rotation begins. */
  startDelay?: number;
};

function resolveStartDelay(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(value!, 0) : 0;
}

function resolveAcceleration(value: number | undefined): number {
  return Number.isFinite(value) && value! >= 0
    ? value!
    : DEFAULT_AUTO_ROTATE_ACCELERATION;
}

/**
 * Adds automatic rotation to the nearest PanoView. Render one instance as a
 * child of PanoView, alongside its panorama source.
 */
export function AutoRotate({
  enabled = true,
  speed = DEFAULT_AUTO_ROTATE_SPEED,
  acceleration = DEFAULT_AUTO_ROTATE_ACCELERATION,
  startDelay = DEFAULT_AUTO_ROTATE_START_DELAY,
}: AutoRotateProps) {
  const controlsRef = useContext(PanoramaViewContext);
  const eventBus = useContext(PanoEventBusContext);
  const elapsedRef = useRef(0);
  const rotationSpeedRef = useRef(0);
  const rotatingRef = useRef(false);
  const yawAccumulatedRef = useRef(0);

  if (!controlsRef) {
    throw new Error("<AutoRotate> must be rendered inside <PanoView>.");
  }

  useEffect(() => {
    elapsedRef.current = 0;
    rotationSpeedRef.current = 0;
    yawAccumulatedRef.current = 0;
    if (rotatingRef.current) {
      rotatingRef.current = false;
      eventBus?.emit("autorotatestop", undefined);
    }
  }, [enabled, eventBus, startDelay]);

  useFrame((_, deltaSeconds) => {
    if (!enabled || !Number.isFinite(speed) || speed === 0) {
      rotationSpeedRef.current = 0;
      if (rotatingRef.current) {
        rotatingRef.current = false;
        eventBus?.emit("autorotatestop", undefined);
      }
      return;
    }

    const delaySeconds = resolveStartDelay(startDelay) / 1000;
    elapsedRef.current += deltaSeconds;
    if (elapsedRef.current < delaySeconds) {
      return;
    }

    const targetSpeed = Math.abs(speed);
    const currentSpeed = rotationSpeedRef.current;
    const accelerationPerSecond = resolveAcceleration(acceleration);
    const nextSpeed =
      accelerationPerSecond === 0
        ? targetSpeed
        : Math.min(
            targetSpeed,
            currentSpeed + accelerationPerSecond * deltaSeconds,
          );
    const averageSpeed = (currentSpeed + nextSpeed) / 2;
    const yawDelta = Math.sign(speed) * averageSpeed * deltaSeconds;

    if (!controlsRef.current?.applyAutoRotation(yawDelta)) {
      rotationSpeedRef.current = 0;
      if (rotatingRef.current) {
        rotatingRef.current = false;
        eventBus?.emit("autorotatestop", undefined);
      }
      return;
    }

    if (!rotatingRef.current) {
      rotatingRef.current = true;
      eventBus?.emit("autorotatestart", undefined);
    }

    yawAccumulatedRef.current += Math.abs(yawDelta);
    while (yawAccumulatedRef.current >= 360) {
      yawAccumulatedRef.current -= 360;
      eventBus?.emit("autorotateoneround", undefined);
    }

    rotationSpeedRef.current = nextSpeed;
  });

  return null;
}
