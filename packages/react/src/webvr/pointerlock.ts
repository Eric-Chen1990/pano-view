import { useEffect, useRef, useState } from "react";
import { usePanoCursor } from "../pano-cursor";
import { bindWebVRPointerLock } from "./pointerlock-runtime";

export { exitWebVRPointerLock, requestWebVRPointerLock } from "./pointerlock-runtime";

const POINTER_LOCK_CURSOR_ID = "webvr:pointerlock";

/** Tracks actual ownership; unlocking never automatically requests another lock. */
export function useWebVRPointerLock(
  enabled: boolean,
  element: HTMLElement | null,
): boolean {
  const cursor = usePanoCursor();
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!enabled || !element) {
      setLocked(false);
      return;
    }
    return bindWebVRPointerLock(element, (ownsLock) => {
      setLocked(ownsLock);
      if (ownsLock) cursorRef.current?.claim(POINTER_LOCK_CURSOR_ID, "hidden");
      else cursorRef.current?.release(POINTER_LOCK_CURSOR_ID);
    });
  }, [element, enabled]);

  return enabled && locked;
}
