/** Visible viewport intersection, expressed in local container coordinates. */
export function getOverlayVisibleRect(
  rect: { left: number; top: number; width: number; height: number },
  viewport: { left: number; top: number; width: number; height: number },
) {
  const left = Math.min(rect.width, Math.max(0, viewport.left - rect.left));
  const top = Math.min(rect.height, Math.max(0, viewport.top - rect.top));
  const right = Math.min(rect.width, Math.max(0, viewport.left + viewport.width - rect.left));
  const bottom = Math.min(rect.height, Math.max(0, viewport.top + viewport.height - rect.top));
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
