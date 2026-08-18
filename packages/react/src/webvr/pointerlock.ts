import { useEffect, useRef } from "react";
import { subscribeFullscreenChange } from "../fullscreen";
import { usePanoCursor } from "../pano-cursor";

const POINTER_LOCK_CURSOR_ID = "webvr:pointerlock";

type PointerLockTarget = HTMLElement & {
  requestPointerLock: (options?: {
    unadjustedMovement?: boolean;
  }) => Promise<void> | void;
};

export async function requestWebVRPointerLock(
  element: HTMLElement,
): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }
  if (document.pointerLockElement === element) {
    return;
  }
  const target = element as PointerLockTarget;
  if (typeof target.requestPointerLock !== "function") {
    return;
  }

  try {
    await target.requestPointerLock({ unadjustedMovement: true });
  } catch {
    try {
      await target.requestPointerLock();
    } catch {
      // Pointer lock is best-effort; a later click can retry.
    }
  }
}

export function exitWebVRPointerLock(element?: Element | null): void {
  if (typeof document === "undefined" || !document.pointerLockElement) {
    return;
  }
  if (element && document.pointerLockElement !== element) {
    return;
  }
  document.exitPointerLock();
}

/**
 * Locks the mouse to the canvas in simulated desktop VR so movement looks
 * around with no visible cursor. Retries after fullscreen and on click.
 */
export function useWebVRPointerLock(
  enabled: boolean,
  element: HTMLElement | null,
): void {
  const cursor = usePanoCursor();
  const cursorRef = useRef(cursor);
  const enabledRef = useRef(enabled);
  cursorRef.current = cursor;
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled || !element) {
      return;
    }

    cursorRef.current?.claim(POINTER_LOCK_CURSOR_ID, "hidden");

    const tryLock = () => {
      if (!enabledRef.current || document.pointerLockElement === element) {
        return;
      }
      void requestWebVRPointerLock(element);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      tryLock();
    };

    tryLock();
    element.addEventListener("pointerdown", onPointerDown);
    const unsubscribeFullscreen = subscribeFullscreenChange(tryLock);

    return () => {
      cursorRef.current?.release(POINTER_LOCK_CURSOR_ID);
      element.removeEventListener("pointerdown", onPointerDown);
      unsubscribeFullscreen();
      exitWebVRPointerLock(element);
    };
  }, [element, enabled]);
}
