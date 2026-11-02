export type MapRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type MapPoint = {
  x: number;
  y: number;
};

export type MapViewport = {
  /** Image pixel size after contain fitting, before user zoom. */
  fit: MapRect;
  /** User zoom relative to fit (1 = fitted). */
  scale: number;
  /** Pan in container pixels applied after scale around the fit origin. */
  panX: number;
  panY: number;
};

/** Clockwise degrees from image up for a sector when viewer yaw is `yaw`. */
export function sectorRotation(heading: number, yaw: number): number {
  return heading + yaw;
}

/** Approximate horizontal FOV from vertical FOV and container aspect ratio. */
export function horizontalFov(verticalFov: number, aspect: number): number {
  if (!(aspect > 0) || !(verticalFov > 0) || verticalFov >= 180) return verticalFov;
  const verticalRad = (verticalFov * Math.PI) / 180;
  const horizontalRad = 2 * Math.atan(Math.tan(verticalRad / 2) * aspect);
  return (horizontalRad * 180) / Math.PI;
}

/** Fit an image into a container with object-fit: contain semantics. */
export function containRect(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): MapRect {
  if (
    !(containerWidth > 0) ||
    !(containerHeight > 0) ||
    !(imageWidth > 0) ||
    !(imageHeight > 0)
  ) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const scale = Math.min(
    containerWidth / imageWidth,
    containerHeight / imageHeight,
  );
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
    width,
    height,
  };
}

/** Project a normalized image point into container CSS pixels. */
export function imagePointToContainer(
  point: MapPoint,
  viewport: MapViewport,
): MapPoint {
  const { fit, scale, panX, panY } = viewport;
  return {
    x: fit.left + panX + point.x * fit.width * scale,
    y: fit.top + panY + point.y * fit.height * scale,
  };
}

/** Convert a container pointer into a normalized image point. */
export function containerPointToImage(
  point: MapPoint,
  viewport: MapViewport,
): MapPoint | null {
  const { fit, scale, panX, panY } = viewport;
  const width = fit.width * scale;
  const height = fit.height * scale;
  if (!(width > 0) || !(height > 0)) return null;
  return {
    x: (point.x - fit.left - panX) / width,
    y: (point.y - fit.top - panY) / height,
  };
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Clockwise degrees from image up for a vector in container space. */
export function headingFromVector(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  const radians = Math.atan2(dx, -dy);
  return (radians * 180) / Math.PI;
}

export function normalizeDegrees(value: number): number {
  const wrapped = ((value % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}
