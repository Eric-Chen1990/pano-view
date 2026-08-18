import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useRef } from "react";
import {
  getFullscreenElement,
  subscribeFullscreenChange,
} from "./fullscreen";
import type { PanoramaPointerEvent } from "./hotspot/types";
import {
  PanoEventBusContext,
  type PanoResizeEvent,
  type PanoWheelEvent,
  type ViewInteractionEvent,
} from "./pano-event-bus";
import { PanoramaViewContext } from "./panorama-view-runtime";
import type { PanoViewerState } from "./types";
import type { WebVRMode } from "./webvr/types";

const DEFAULT_IDLE_TIME_MS = 2000;

export type PanoEventsProps = {
  /**
   * Milliseconds without user interaction before `onIdle`. Defaults to 2000.
   * Each PanoEvents instance tracks idle independently.
   */
  idleTime?: number;
  onViewChange?: (view: PanoViewerState) => void;
  onViewSettled?: (view: PanoViewerState) => void;
  onViewInteractionStart?: (event: ViewInteractionEvent) => void;
  onViewInteractionEnd?: (event: ViewInteractionEvent) => void;
  onClick?: (event: PanoramaPointerEvent) => void;
  onDoubleClick?: (event: PanoramaPointerEvent) => void;
  onPointerDown?: (event: PanoramaPointerEvent) => void;
  onPointerUp?: (event: PanoramaPointerEvent) => void;
  onPointerMove?: (event: PanoramaPointerEvent) => void;
  onContextMenu?: (event: PanoramaPointerEvent) => void;
  onWheel?: (event: PanoWheelEvent) => void;
  onIdle?: () => void;
  onIdleEnd?: () => void;
  onEnterFullscreen?: () => void;
  onExitFullscreen?: () => void;
  onResize?: (event: PanoResizeEvent) => void;
  onAutoRotateStart?: () => void;
  onAutoRotateStop?: () => void;
  onAutoRotateOneRound?: () => void;
  onGyroAvailable?: () => void;
  onGyroUnavailable?: () => void;
  onGyroEnable?: () => void;
  onGyroDisable?: () => void;
  onGyroDenied?: () => void;
  onVRAvailable?: () => void;
  onVRUnavailable?: () => void;
  onVREnter?: (mode: WebVRMode) => void;
  onVRExit?: (mode: WebVRMode) => void;
  onVRDenied?: (error?: unknown) => void;
  onVRUnknownDevice?: () => void;
};

function resolveIdleTime(value: number | undefined): number {
  return Number.isFinite(value) && value! >= 0 ? value! : DEFAULT_IDLE_TIME_MS;
}

/**
 * Subscribes to viewer-level panorama events. Must run inside PanoViewer.
 * Prefer the {@link PanoEvents} component for declarative usage.
 */
export function usePanoEvents({
  idleTime = DEFAULT_IDLE_TIME_MS,
  onViewChange,
  onViewSettled,
  onViewInteractionStart,
  onViewInteractionEnd,
  onClick,
  onDoubleClick,
  onPointerDown,
  onPointerUp,
  onPointerMove,
  onContextMenu,
  onWheel,
  onIdle,
  onIdleEnd,
  onEnterFullscreen,
  onExitFullscreen,
  onResize,
  onAutoRotateStart,
  onAutoRotateStop,
  onAutoRotateOneRound,
  onGyroAvailable,
  onGyroUnavailable,
  onGyroEnable,
  onGyroDisable,
  onGyroDenied,
  onVRAvailable,
  onVRUnavailable,
  onVREnter,
  onVRExit,
  onVRDenied,
  onVRUnknownDevice,
}: PanoEventsProps): void {
  const eventBus = useContext(PanoEventBusContext);
  const controlsRef = useContext(PanoramaViewContext);
  const { gl } = useThree();

  if (!eventBus || !controlsRef) {
    throw new Error("usePanoEvents must be used inside <PanoViewer>.");
  }

  const callbacksRef = useRef({
    onViewChange,
    onViewSettled,
    onViewInteractionStart,
    onViewInteractionEnd,
    onClick,
    onDoubleClick,
    onPointerDown,
    onPointerUp,
    onPointerMove,
    onContextMenu,
    onWheel,
    onIdle,
    onIdleEnd,
    onEnterFullscreen,
    onExitFullscreen,
    onResize,
    onAutoRotateStart,
    onAutoRotateStop,
    onAutoRotateOneRound,
    onGyroAvailable,
    onGyroUnavailable,
    onGyroEnable,
    onGyroDisable,
    onGyroDenied,
    onVRAvailable,
    onVRUnavailable,
    onVREnter,
    onVRExit,
    onVRDenied,
    onVRUnknownDevice,
  });
  callbacksRef.current = {
    onViewChange,
    onViewSettled,
    onViewInteractionStart,
    onViewInteractionEnd,
    onClick,
    onDoubleClick,
    onPointerDown,
    onPointerUp,
    onPointerMove,
    onContextMenu,
    onWheel,
    onIdle,
    onIdleEnd,
    onEnterFullscreen,
    onExitFullscreen,
    onResize,
    onAutoRotateStart,
    onAutoRotateStop,
    onAutoRotateOneRound,
    onGyroAvailable,
    onGyroUnavailable,
    onGyroEnable,
    onGyroDisable,
    onGyroDenied,
    onVRAvailable,
    onVRUnavailable,
    onVREnter,
    onVRExit,
    onVRDenied,
    onVRUnknownDevice,
  };

  const idleElapsedRef = useRef(0);
  const isIdleRef = useRef(false);
  const idleTimeRef = useRef(resolveIdleTime(idleTime));
  idleTimeRef.current = resolveIdleTime(idleTime);

  useEffect(() => {
    idleElapsedRef.current = 0;
    isIdleRef.current = false;
  }, [idleTime]);

  useEffect(() => {
    const unsubscribers = [
      eventBus.subscribe("viewchange", (view) => {
        callbacksRef.current.onViewChange?.(view);
      }),
      eventBus.subscribe("viewsettled", (view) => {
        callbacksRef.current.onViewSettled?.(view);
      }),
      eventBus.subscribe("viewinteractionstart", (event) => {
        callbacksRef.current.onViewInteractionStart?.(event);
      }),
      eventBus.subscribe("viewinteractionend", (event) => {
        callbacksRef.current.onViewInteractionEnd?.(event);
      }),
      eventBus.subscribe("click", (event) => {
        callbacksRef.current.onClick?.(event);
      }),
      eventBus.subscribe("doubleclick", (event) => {
        callbacksRef.current.onDoubleClick?.(event);
      }),
      eventBus.subscribe("pointerdown", (event) => {
        callbacksRef.current.onPointerDown?.(event);
      }),
      eventBus.subscribe("pointerup", (event) => {
        callbacksRef.current.onPointerUp?.(event);
      }),
      eventBus.subscribe("pointermove", (event) => {
        callbacksRef.current.onPointerMove?.(event);
      }),
      eventBus.subscribe("contextmenu", (event) => {
        callbacksRef.current.onContextMenu?.(event);
      }),
      eventBus.subscribe("autorotatestart", () => {
        callbacksRef.current.onAutoRotateStart?.();
      }),
      eventBus.subscribe("autorotatestop", () => {
        callbacksRef.current.onAutoRotateStop?.();
      }),
      eventBus.subscribe("autorotateoneround", () => {
        callbacksRef.current.onAutoRotateOneRound?.();
      }),
      eventBus.subscribe("gyroavailable", () => {
        callbacksRef.current.onGyroAvailable?.();
      }),
      eventBus.subscribe("gyrounavailable", () => {
        callbacksRef.current.onGyroUnavailable?.();
      }),
      eventBus.subscribe("gyroenable", () => {
        callbacksRef.current.onGyroEnable?.();
      }),
      eventBus.subscribe("gyrodisable", () => {
        callbacksRef.current.onGyroDisable?.();
      }),
      eventBus.subscribe("gyrodenied", () => {
        callbacksRef.current.onGyroDenied?.();
      }),
      eventBus.subscribe("vravailable", () => {
        callbacksRef.current.onVRAvailable?.();
      }),
      eventBus.subscribe("vrunavailable", () => {
        callbacksRef.current.onVRUnavailable?.();
      }),
      eventBus.subscribe("vrenter", ({ mode }) => {
        callbacksRef.current.onVREnter?.(mode);
      }),
      eventBus.subscribe("vrexit", ({ mode }) => {
        callbacksRef.current.onVRExit?.(mode);
      }),
      eventBus.subscribe("vrdenied", ({ error }) => {
        callbacksRef.current.onVRDenied?.(error);
      }),
      eventBus.subscribe("vrunknowndevice", () => {
        callbacksRef.current.onVRUnknownDevice?.();
      }),
    ];
    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [eventBus]);

  useEffect(() => {
    const element = gl.domElement;

    const handleWheel = (nativeEvent: WheelEvent) => {
      callbacksRef.current.onWheel?.({
        delta: nativeEvent.deltaY,
        nativeEvent,
      });
    };

    element.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [gl]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const wasFullscreenRef = { current: false };

    const isViewerFullscreen = () => {
      const fullscreenElement = getFullscreenElement();
      if (!fullscreenElement) {
        return false;
      }
      const canvas = gl.domElement;
      return (
        fullscreenElement === canvas ||
        fullscreenElement.contains(canvas) ||
        canvas.contains(fullscreenElement)
      );
    };

    const handleFullscreenChange = () => {
      const isOurs = isViewerFullscreen();
      if (isOurs && !wasFullscreenRef.current) {
        wasFullscreenRef.current = true;
        callbacksRef.current.onEnterFullscreen?.();
      } else if (!isOurs && wasFullscreenRef.current) {
        wasFullscreenRef.current = false;
        callbacksRef.current.onExitFullscreen?.();
      }
    };

    wasFullscreenRef.current = isViewerFullscreen();
    return subscribeFullscreenChange(handleFullscreenChange);
  }, [gl]);

  useEffect(() => {
    const element = gl.domElement;
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const { width, height } = entry.contentRect;
      callbacksRef.current.onResize?.({ width, height });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [gl]);

  useFrame((_, deltaSeconds) => {
    const interacting = controlsRef.current?.isUserInteracting() ?? false;
    if (interacting) {
      idleElapsedRef.current = 0;
      if (isIdleRef.current) {
        isIdleRef.current = false;
        callbacksRef.current.onIdleEnd?.();
      }
      return;
    }

    idleElapsedRef.current += deltaSeconds * 1000;
    if (
      !isIdleRef.current &&
      idleElapsedRef.current >= idleTimeRef.current
    ) {
      isIdleRef.current = true;
      callbacksRef.current.onIdle?.();
    }
  });
}

/**
 * Declarative viewer-level event listeners for the nearest PanoViewer.
 * Multiple instances may coexist; each tracks its own idle timer.
 */
export function PanoEvents(props: PanoEventsProps) {
  usePanoEvents(props);
  return null;
}
