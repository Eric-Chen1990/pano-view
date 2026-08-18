import { useFrame, useThree } from "@react-three/fiber";
import {
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Quaternion } from "three";
import {
  applyGyroCalibration,
  createRelativeCalibration,
  deviceOrientationToQuaternion,
  getScreenOrientationAngle,
  quaternionToGyroPose,
} from "./gyro-orientation";
import type { DeviceOrientationSample } from "./gyro-orientation";
import type { GyroPose, GyroTouchMode } from "./gyro-types";
import { PanoEventBusContext } from "./pano-event-bus";
import { PanoramaViewContext } from "./panorama-view-runtime";

export type { GyroTouchMode } from "./gyro-types";

type DeviceOrientationEventWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type DeviceOrientationEventConstructorWithPermission =
  typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<"granted" | "denied">;
  };

let deviceOrientationPermissionState: "unknown" | "granted" | "denied" =
  "unknown";

export type GyroHandle = {
  resetSensor: (yaw?: number, pitch?: number) => void;
  isAvailable: () => boolean;
  isEnabled: () => boolean;
  /**
   * Requests iOS sensor permission. Call this directly from a user gesture
   * before setting `enabled` to true.
   */
  requestPermission: () => Promise<boolean>;
};

export type GyroProps = {
  /** Whether device-orientation control is requested. Defaults to false. */
  enabled?: boolean;
  /** Whether device roll levels the camera. Defaults to true. */
  camroll?: boolean;
  /** Whether to follow compass-oriented headings. Defaults to false. */
  absolute?: boolean;
  /** Panorama yaw that represents North, in degrees. Defaults to 0. */
  north?: number;
  /** Sensor smoothing from 0 (none) to 0.99 (strong). Defaults to 0. */
  friction?: number;
  /** How touch dragging combines with gyro movement. Defaults to "full". */
  touchMode?: GyroTouchMode;
  /** Seconds used to blend from the current view when enabling. Defaults to 0.5. */
  softstart?: number;
  /** Allow capability detection on desktop-class devices. Defaults to false. */
  desktopSupport?: boolean;
  onAvailable?: () => void;
  onUnavailable?: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  onDenied?: () => void;
};

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  return (
    /Android|iPad|iPhone|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function normalizeYaw(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function shortestYawDelta(from: number, to: number): number {
  return normalizeYaw(to - from);
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value! : fallback;
}

function resolveFriction(value: number | undefined): number {
  return Math.min(Math.max(finiteOr(value, 0), 0), 0.99);
}

function resolveSoftstart(value: number | undefined): number {
  return Math.max(finiteOr(value, 0.5), 0);
}

function posesNearlyEqual(a: GyroPose, b: GyroPose): boolean {
  return (
    Math.abs(shortestYawDelta(a.yaw, b.yaw)) < 0.0001 &&
    Math.abs(a.pitch - b.pitch) < 0.0001 &&
    Math.abs(a.roll - b.roll) < 0.0001
  );
}

/**
 * Adds device-orientation navigation to the nearest PanoViewer.
 * Sensor access is opt-in and disabled by default.
 */
export const Gyro = forwardRef<GyroHandle, GyroProps>(function Gyro(
  {
    enabled = false,
    camroll = true,
    absolute = false,
    north = 0,
    friction = 0,
    touchMode = "full",
    softstart = 0.5,
    desktopSupport = false,
    onAvailable,
    onUnavailable,
    onEnable,
    onDisable,
    onDenied,
  },
  ref,
) {
  const controlsRef = useContext(PanoramaViewContext);
  const eventBus = useContext(PanoEventBusContext);
  const { gl } = useThree();
  const [internallyDisabled, setInternallyDisabled] = useState(false);
  const availableRef = useRef(false);
  const availabilityReportedRef = useRef<boolean | null>(null);
  const activeRef = useRef(false);
  const permissionRef = useRef(deviceOrientationPermissionState);
  const absoluteEventSourceRef = useRef<"standard" | "absolute" | null>(null);
  const rawQuaternionRef = useRef<Quaternion | null>(null);
  const calibrationRef = useRef<Quaternion | null>(null);
  const absoluteOffsetRef = useRef({ yaw: 0, pitch: 0 });
  const screenAngleRef = useRef(getScreenOrientationAngle());
  const startPoseRef = useRef<GyroPose | null>(null);
  const enabledAtRef = useRef(0);
  const filteredPoseRef = useRef<GyroPose | null>(null);
  const lastAppliedPoseRef = useRef<GyroPose | null>(null);
  const callbacksRef = useRef({
    onAvailable,
    onUnavailable,
    onEnable,
    onDisable,
    onDenied,
  });
  callbacksRef.current = {
    onAvailable,
    onUnavailable,
    onEnable,
    onDisable,
    onDenied,
  };

  if (!controlsRef) {
    throw new Error("<Gyro> must be rendered inside <PanoViewer>.");
  }

  const emit = useCallback(
    (
      type:
        | "gyroavailable"
        | "gyrounavailable"
        | "gyroenable"
        | "gyrodisable"
        | "gyrodenied",
    ) => {
      eventBus?.emit(type, undefined);
      switch (type) {
        case "gyroavailable":
          callbacksRef.current.onAvailable?.();
          break;
        case "gyrounavailable":
          callbacksRef.current.onUnavailable?.();
          break;
        case "gyroenable":
          callbacksRef.current.onEnable?.();
          break;
        case "gyrodisable":
          callbacksRef.current.onDisable?.();
          break;
        case "gyrodenied":
          callbacksRef.current.onDenied?.();
          break;
        default: {
          const exhaustive: never = type;
          return exhaustive;
        }
      }
    },
    [eventBus],
  );

  const setAvailable = useCallback(
    (available: boolean) => {
      availableRef.current = available;
      if (availabilityReportedRef.current === available) {
        return;
      }
      availabilityReportedRef.current = available;
      emit(available ? "gyroavailable" : "gyrounavailable");
    },
    [emit],
  );

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!availableRef.current) {
      return false;
    }
    if (typeof DeviceOrientationEvent === "undefined") {
      setAvailable(false);
      return false;
    }
    const constructor =
      DeviceOrientationEvent as DeviceOrientationEventConstructorWithPermission;
    if (typeof constructor.requestPermission !== "function") {
      permissionRef.current = "granted";
      deviceOrientationPermissionState = "granted";
      return true;
    }
    if (
      permissionRef.current === "granted" ||
      deviceOrientationPermissionState === "granted"
    ) {
      permissionRef.current = "granted";
      return true;
    }
    try {
      const result = await constructor.requestPermission();
      permissionRef.current = result;
      deviceOrientationPermissionState = result;
      if (result === "granted") {
        setAvailable(true);
        return true;
      }
    } catch {
      permissionRef.current = "denied";
      deviceOrientationPermissionState = "denied";
    }
    emit("gyrodenied");
    return false;
  }, [emit, setAvailable]);

  const deactivate = useCallback(() => {
    if (activeRef.current) {
      activeRef.current = false;
      controlsRef.current?.setGyroActive(false);
      emit("gyrodisable");
    }
    rawQuaternionRef.current = null;
    absoluteEventSourceRef.current = null;
    calibrationRef.current = null;
    filteredPoseRef.current = null;
    lastAppliedPoseRef.current = null;
  }, [controlsRef, emit]);

  const resetSensor = useCallback(
    (yaw?: number, pitch?: number) => {
      const rawQuaternion = rawQuaternionRef.current;
      if (!rawQuaternion) {
        return;
      }
      const view = controlsRef.current?.getTargetView();
      const targetYaw = finiteOr(yaw, view?.yaw ?? 0);
      const targetPitch = finiteOr(pitch, view?.pitch ?? 0);
      if (absolute) {
        const rawPose = quaternionToGyroPose(rawQuaternion);
        absoluteOffsetRef.current = {
          yaw: shortestYawDelta(
            rawPose.yaw + finiteOr(north, 0),
            targetYaw,
          ),
          pitch: targetPitch - rawPose.pitch,
        };
      } else {
        calibrationRef.current = createRelativeCalibration(
          rawQuaternion,
          targetYaw,
          targetPitch,
        );
      }
      startPoseRef.current = {
        yaw: targetYaw,
        pitch: targetPitch,
        roll: 0,
      };
      enabledAtRef.current = performance.now();
      filteredPoseRef.current = null;
    },
    [absolute, controlsRef, north],
  );

  useImperativeHandle(
    ref,
    () => ({
      resetSensor,
      isAvailable: () => availableRef.current,
      isEnabled: () => activeRef.current,
      requestPermission,
    }),
    [requestPermission, resetSensor],
  );

  useEffect(() => {
    if (!enabled) {
      setInternallyDisabled(false);
    }
  }, [enabled]);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      window.isSecureContext &&
      typeof DeviceOrientationEvent !== "undefined" &&
      (desktopSupport || isMobileDevice());
    setAvailable(supported);
    return () => {
      availableRef.current = false;
    };
  }, [desktopSupport, setAvailable]);

  useEffect(() => {
    controlsRef.current?.setGyroTouchMode(touchMode);
  }, [controlsRef, touchMode]);

  useEffect(() => {
    if (!enabled || internallyDisabled || touchMode !== "disablegyro") {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        setInternallyDisabled(true);
      }
    };
    gl.domElement.addEventListener("pointerdown", onPointerDown);
    return () => {
      gl.domElement.removeEventListener("pointerdown", onPointerDown);
    };
  }, [enabled, gl, internallyDisabled, touchMode]);

  useEffect(() => {
    if (!enabled || internallyDisabled || !availableRef.current) {
      deactivate();
      return;
    }

    let disposed = false;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (
        disposed ||
        event.alpha === null ||
        event.beta === null ||
        event.gamma === null
      ) {
        return;
      }
      const compassEvent = event as DeviceOrientationEventWithCompass;
      const hasCompassHeading = Number.isFinite(
        compassEvent.webkitCompassHeading,
      );
      if (absolute) {
        const eventSource =
          event.type === "deviceorientationabsolute" ? "absolute" : "standard";
        if (
          eventSource === "standard" &&
          event.absolute !== true &&
          !hasCompassHeading
        ) {
          return;
        }
        if (
          absoluteEventSourceRef.current !== null &&
          absoluteEventSourceRef.current !== eventSource
        ) {
          return;
        }
        absoluteEventSourceRef.current = eventSource;
      }
      const sample: DeviceOrientationSample = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        compassHeading:
          absolute && hasCompassHeading
            ? compassEvent.webkitCompassHeading
            : undefined,
      };
      rawQuaternionRef.current = deviceOrientationToQuaternion(
        sample,
        screenAngleRef.current,
      );
      if (!activeRef.current) {
        const view = controlsRef.current?.getTargetView() ?? {
          yaw: 0,
          pitch: 0,
          fov: 75,
        };
        if (!absolute) {
          calibrationRef.current = createRelativeCalibration(
            rawQuaternionRef.current,
            view.yaw,
            view.pitch,
          );
        }
        absoluteOffsetRef.current = { yaw: 0, pitch: 0 };
        startPoseRef.current = { ...view, roll: 0 };
        enabledAtRef.current = performance.now();
        activeRef.current = true;
        controlsRef.current?.setGyroActive(true);
        emit("gyroenable");
      }
    };
    const onScreenOrientation = () => {
      screenAngleRef.current = getScreenOrientationAngle();
    };

    void requestPermission().then((granted) => {
      if (!granted || disposed) {
        return;
      }
      window.addEventListener("deviceorientation", onOrientation);
      if (absolute) {
        window.addEventListener(
          "deviceorientationabsolute",
          onOrientation as EventListener,
        );
      }
      window.screen.orientation?.addEventListener(
        "change",
        onScreenOrientation,
      );
      window.addEventListener("orientationchange", onScreenOrientation);
    });

    return () => {
      disposed = true;
      window.removeEventListener("deviceorientation", onOrientation);
      if (absolute) {
        window.removeEventListener(
          "deviceorientationabsolute",
          onOrientation as EventListener,
        );
      }
      window.screen.orientation?.removeEventListener(
        "change",
        onScreenOrientation,
      );
      window.removeEventListener("orientationchange", onScreenOrientation);
      deactivate();
    };
  }, [
    absolute,
    controlsRef,
    deactivate,
    emit,
    enabled,
    internallyDisabled,
    requestPermission,
  ]);

  useFrame((_, deltaSeconds) => {
    const rawQuaternion = rawQuaternionRef.current;
    if (!activeRef.current || !rawQuaternion) {
      return;
    }

    let targetPose: GyroPose;
    if (absolute) {
      const rawPose = quaternionToGyroPose(rawQuaternion);
      targetPose = {
        yaw:
          rawPose.yaw +
          finiteOr(north, 0) +
          absoluteOffsetRef.current.yaw,
        pitch: rawPose.pitch + absoluteOffsetRef.current.pitch,
        roll: rawPose.roll,
      };
    } else {
      const calibration = calibrationRef.current;
      if (!calibration) {
        return;
      }
      targetPose = applyGyroCalibration(rawQuaternion, calibration);
    }
    if (!camroll) {
      targetPose.roll = 0;
    }

    const softstartMs = resolveSoftstart(softstart) * 1000;
    const startPose = startPoseRef.current;
    if (startPose && softstartMs > 0) {
      const progress = Math.min(
        Math.max((performance.now() - enabledAtRef.current) / softstartMs, 0),
        1,
      );
      targetPose = {
        yaw:
          startPose.yaw +
          shortestYawDelta(startPose.yaw, targetPose.yaw) * progress,
        pitch: startPose.pitch + (targetPose.pitch - startPose.pitch) * progress,
        roll:
          startPose.roll +
          shortestYawDelta(startPose.roll, targetPose.roll) * progress,
      };
      if (progress === 1) {
        startPoseRef.current = null;
      }
    }

    const previous = filteredPoseRef.current;
    const retention = resolveFriction(friction);
    const follow = retention === 0 ? 1 : 1 - Math.pow(retention, deltaSeconds * 60);
    const filteredPose = previous
      ? {
          yaw:
            previous.yaw +
            shortestYawDelta(previous.yaw, targetPose.yaw) * follow,
          pitch: previous.pitch + (targetPose.pitch - previous.pitch) * follow,
          roll:
            previous.roll +
            shortestYawDelta(previous.roll, targetPose.roll) * follow,
        }
      : targetPose;
    filteredPoseRef.current = filteredPose;

    if (controlsRef.current?.isInteractionLocked()) {
      return;
    }
    const lastApplied = lastAppliedPoseRef.current;
    if (!lastApplied || !posesNearlyEqual(lastApplied, filteredPose)) {
      lastAppliedPoseRef.current = { ...filteredPose };
      controlsRef.current?.setGyroPose(filteredPose);
    }
  });

  return null;
});
