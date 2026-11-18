const TAP_SLOP_PX = 5;

/** Match a surface click to one completed pointer gesture, including its full travel. */
export function createPanoramaTap() {
  let down: PointerEvent | undefined;
  let up: PointerEvent | undefined;

  const clear = () => {
    down = undefined;
    up = undefined;
  };

  const movedTooFar = (start: PointerEvent, event: MouseEvent) =>
    Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > TAP_SLOP_PX;

  return {
    clear,
    start(event: PointerEvent) {
      if (event.isPrimary && event.button === 0) down = event;
    },
    move(event: PointerEvent) {
      if (down && !up && down.pointerId === event.pointerId && movedTooFar(down, event)) clear();
    },
    end(event: PointerEvent) {
      if (!down || down.pointerId !== event.pointerId) return;
      if (event.button !== 0 || movedTooFar(down, event)) clear();
      else up = event;
    },
    take(event: MouseEvent) {
      const start = down;
      const end = up;
      clear();
      if (!start || !end || event.button !== 0 || event.detail === 0 || movedTooFar(start, event)) return;
      if ("pointerId" in event && event.pointerId !== start.pointerId) return;
      return { start, end };
    },
  };
}
