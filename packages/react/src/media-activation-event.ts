/**
 * Whether this event can unlock autoplay / AudioContext.
 * HTML grants user activation on `pointerdown` for mouse, `pointerup` for
 * touch/pen, and `keydown` except Escape.
 */
export function isMediaActivationEvent(event: Event): boolean {
  switch (event.type) {
    case "keydown":
      return event instanceof KeyboardEvent && event.key !== "Escape";
    case "pointerdown":
      return event instanceof PointerEvent && event.pointerType === "mouse";
    case "pointerup":
      return event instanceof PointerEvent && event.pointerType !== "mouse";
    default:
      return false;
  }
}
