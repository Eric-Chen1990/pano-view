/** Comfortable angular bounds independent of raster resolution and content aspect. */
export function spatialPanelScale(
  height: number,
  distance = 2,
  width = 640
): number {
  const horizontal = (2 * distance * Math.tan((16 * Math.PI) / 180)) / width;
  const vertical =
    (2 * distance * Math.tan((20 * Math.PI) / 180)) / Math.max(1, height);
  return Math.min(horizontal, vertical);
}

export function spatialUvToPoint(
  uv: { x: number; y: number },
  height: number,
  width = 640
) {
  return { x: uv.x * width, y: (1 - uv.y) * height };
}
