/**
 * Pointer tracking that does not depend on the hotspot mesh staying under the cursor.
 * A fast drag from the image edge leaves the raycast hit, and the gesture would
 * otherwise freeze with the cursor stuck in the dragging state.
 */

const CLICK_SUPPRESS_MS = 1000;

export type DragPointerLike = {
  pointerId: number;
  clientX: number;
  clientY: number;
  preventDefault?: () => void;
};

type DragListener = (event: DragPointerLike) => void;

export type DragEventSource = {
  addEventListener(
    type: "pointermove" | "pointerup" | "pointercancel",
    listener: DragListener,
    capture?: boolean,
  ): void;
  removeEventListener(
    type: "pointermove" | "pointerup" | "pointercancel",
    listener: DragListener,
    capture?: boolean,
  ): void;
};

export type DragCaptureElement = {
  setPointerCapture?: (pointerId: number) => void;
  releasePointerCapture?: (pointerId: number) => void;
  hasPointerCapture?: (pointerId: number) => boolean;
  addEventListener(type: "lostpointercapture", listener: DragListener): void;
  removeEventListener(type: "lostpointercapture", listener: DragListener): void;
};

export function trackPointerDrag(
  source: DragEventSource,
  element: DragCaptureElement,
  pointerId: number,
  onMove: (event: DragPointerLike) => void,
  onEnd: (event: DragPointerLike) => void,
): () => void {
  let stopped = false;
  const releaseCapture = () => {
    if (!element.hasPointerCapture?.(pointerId)) {
      return;
    }
    try {
      element.releasePointerCapture?.(pointerId);
    } catch {
      // Capture can already be gone when another handler released it first.
    }
  };
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    source.removeEventListener("pointermove", onPointerMove, true);
    source.removeEventListener("pointerup", onPointerUp, true);
    source.removeEventListener("pointercancel", onPointerCancel, true);
    element.removeEventListener("lostpointercapture", onLostCapture);
    releaseCapture();
  };
  const finish = (event: DragPointerLike) => {
    if (stopped || event.pointerId !== pointerId) {
      return;
    }
    stop();
    onEnd(event);
  };
  const onPointerMove = (event: DragPointerLike) => {
    if (stopped || event.pointerId !== pointerId) {
      return;
    }
    try {
      event.preventDefault?.();
    } catch {
      // Window pointermove listeners can be passive.
    }
    onMove(event);
  };
  const onPointerUp = (event: DragPointerLike) => {
    finish(event);
  };
  const onPointerCancel = (event: DragPointerLike) => {
    finish(event);
  };
  const onLostCapture = (event: DragPointerLike) => {
    finish(event);
  };

  try {
    element.setPointerCapture?.(pointerId);
  } catch {
    // Window listeners still follow the pointer while it stays in the page.
  }
  source.addEventListener("pointermove", onPointerMove, true);
  source.addEventListener("pointerup", onPointerUp, true);
  source.addEventListener("pointercancel", onPointerCancel, true);
  element.addEventListener("lostpointercapture", onLostCapture);
  return stop;
}

type ClickSuppressTarget = {
  addEventListener(
    type: "click" | "pointerdown",
    listener: (event: Event) => void,
    capture?: boolean,
  ): void;
  removeEventListener(
    type: "click" | "pointerdown",
    listener: (event: Event) => void,
    capture?: boolean,
  ): void;
};

/** Ignore the click that follows a drag, including when it lands outside the mesh. */
export function suppressFollowingClick(target: ClickSuppressTarget): void {
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    target.removeEventListener("click", swallowClick, true);
    target.removeEventListener("pointerdown", cancel, true);
  };
  const swallowClick = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    cleanup();
  };
  const cancel = () => {
    cleanup();
  };
  target.addEventListener("click", swallowClick, true);
  target.addEventListener("pointerdown", cancel, true);
  setTimeout(cleanup, CLICK_SUPPRESS_MS);
}
