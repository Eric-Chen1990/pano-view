/** Snapshot serializers may reapply logical radii or the original shorthand. */
export function squareCaptureFooter(
  style: Pick<
    CSSStyleDeclaration,
    "setProperty" | "borderTopLeftRadius" | "borderTopRightRadius"
  >,
) {
  const left = style.borderTopLeftRadius || "0px";
  const right = style.borderTopRightRadius || "0px";
  style.setProperty("border-radius", `${left} ${right} 0px 0px`, "important");
  for (const property of [
    "border-bottom-left-radius",
    "border-bottom-right-radius",
    "border-end-start-radius",
    "border-end-end-radius",
  ]) {
    style.setProperty(property, "0px", "important");
  }
}

/** The snapshot can retain a rounded border/shadow. Flatten both seam corners in the final raster. */
export function fillCaptureFooter(
  context: Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">,
  width: number,
  bodyHeight: number,
  footerHeight: number,
  radius: number,
  background: string,
) {
  const corner = Math.min(Math.max(0, radius + 1), bodyHeight, width / 2);
  context.fillStyle = background;
  context.fillRect(0, bodyHeight - corner, corner, corner);
  context.fillRect(width - corner, bodyHeight - corner, corner, corner);
  context.fillRect(0, bodyHeight, width, footerHeight);
}

type SpatialCaptureState<Image> = {
  disposed: boolean;
  generation: number;
  revision: number;
  dirty: boolean;
  failed: boolean;
  image: Image | null;
};

/** Publish completed frames even while DOM animation keeps invalidating the source. */
export function commitSpatialCapture<Image>(
  state: SpatialCaptureState<Image>,
  generation: number,
  revision: number,
  image: Image,
): boolean {
  if (state.disposed || generation !== state.generation) return false;
  state.image = image;
  state.failed = false;
  state.dirty ||= revision !== state.revision;
  return true;
}

export function failSpatialCapture(
  state: Pick<
    SpatialCaptureState<unknown>,
    "disposed" | "generation" | "failed"
  >,
  generation: number,
): boolean {
  if (state.disposed || generation !== state.generation) return false;
  state.failed = true;
  return true;
}

/** Bound each cloning slice so panorama rendering and input can run between slices. */
export function createCaptureCheckpoint(
  now: () => number = () => performance.now(),
  pause: () => Promise<void> = () =>
    new Promise((resolve) => {
      // Align cloning slices with display frames; the timeout also serves hidden XR companions.
      let frame = 0;
      const timer = setTimeout(() => {
        cancelAnimationFrame(frame);
        resolve();
      }, 20);
      frame = requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      });
    }),
) {
  let started = now();
  return async () => {
    if (now() - started < 4) return;
    await pause();
    started = now();
  };
}

type CaptureRect = Pick<DOMRect, "left" | "top" | "width" | "height">;

/** Include visible overflow such as marker titles, arrows and shadows. */
export function captureOverlayBounds(
  rectangles: readonly CaptureRect[],
): CaptureRect | null {
  const visible = rectangles.filter(
    (rect) => rect.width > 0 && rect.height > 0,
  );
  if (!visible.length) return null;
  const left = Math.floor(Math.min(...visible.map((rect) => rect.left))) - 8;
  const top = Math.floor(Math.min(...visible.map((rect) => rect.top))) - 8;
  const right =
    Math.ceil(Math.max(...visible.map((rect) => rect.left + rect.width))) + 8;
  const bottom =
    Math.ceil(Math.max(...visible.map((rect) => rect.top + rect.height))) + 8;
  return { left, top, width: right - left, height: bottom - top };
}
