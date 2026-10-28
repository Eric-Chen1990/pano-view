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
  /** Still-pressed buttons. A capture loss with a button held is not a drag end. */
  buttons?: number;
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
    // View controls can release the canvas capture on the next frame after a
    // hotspot locks the gesture. The button is still down, and window
    // listeners keep receiving the pointer, so this is not the end of the drag.
    if ((event.buttons ?? 0) > 0) {
      return;
    }
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

type ListenerOptions = boolean | { capture?: boolean };

type ClickSuppressTarget = {
  addEventListener(
    type: "click" | "pointerdown",
    listener: (event: Event) => void,
    options?: ListenerOptions,
  ): void;
  removeEventListener(
    type: "click" | "pointerdown",
    listener: (event: Event) => void,
    options?: ListenerOptions,
  ): void;
};

// Node reads removeEventListener(type, listener, true) as capture: false.
const CAPTURE: { capture: true } = { capture: true };

/** Ignore the click that follows a drag, including when it lands outside the mesh. */
export function suppressFollowingClick(target: ClickSuppressTarget): void {
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    target.removeEventListener("click", swallowClick, CAPTURE);
    target.removeEventListener("pointerdown", cancel, CAPTURE);
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
  target.addEventListener("click", swallowClick, CAPTURE);
  target.addEventListener("pointerdown", cancel, CAPTURE);
  setTimeout(cleanup, CLICK_SUPPRESS_MS);
}
