/** Old experimental APIs expose drawElementImage but ignore content=drawable. */
export function supportsNativeHtmlCapture(
  canvas: { content?: string; requestPaint?: unknown },
  context: { drawElementImage?: unknown } | null
) {
  return (
    canvas.content === "drawable" &&
    typeof canvas.requestPaint === "function" &&
    typeof context?.drawElementImage === "function"
  );
}

/** Snapshot serializers may reapply logical radii or the original shorthand. */
export function squareCaptureFooter(style: Pick<CSSStyleDeclaration, "setProperty" | "borderTopLeftRadius" | "borderTopRightRadius">) {
  const left = style.borderTopLeftRadius || "0px";
  const right = style.borderTopRightRadius || "0px";
  style.setProperty("border-radius", `${left} ${right} 0px 0px`, "important");
  for (const property of ["border-bottom-left-radius", "border-bottom-right-radius", "border-end-start-radius", "border-end-end-radius"]) {
    style.setProperty(property, "0px", "important");
  }
}

/** The snapshot can retain a rounded border/shadow. Flatten both seam corners in the final raster. */
export function fillCaptureFooter(
  context: Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect">,
  width: number, bodyHeight: number, footerHeight: number, radius: number, background: string,
) {
  const corner = Math.min(Math.max(0, radius + 1), bodyHeight, width / 2);
  context.fillStyle = background;
  context.fillRect(0, bodyHeight - corner, corner, corner);
  context.fillRect(width - corner, bodyHeight - corner, corner, corner);
  context.fillRect(0, bodyHeight, width, footerHeight);
}
