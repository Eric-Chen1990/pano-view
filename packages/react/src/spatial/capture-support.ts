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
