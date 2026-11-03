export type StereoEyeViewport = {
  /** Logical-pixel width of the left (or current) eye viewport. */
  width: number;
  /** Logical-pixel height of the eye viewport. */
  height: number;
  /** Logical-pixel x offset for this eye. */
  offsetX: number;
};

export type StereoLayout = {
  fullWidth: number;
  fullHeight: number;
  left: StereoEyeViewport;
  right: StereoEyeViewport;
  /** Physical-pixel size for the per-eye distortion render target. */
  renderTargetWidth: number;
  renderTargetHeight: number;
  /** Value for Three.js `StereoCamera.aspect` (`left.width / fullWidth`). */
  stereoAspect: number;
};

export const DEFAULT_WEBVR_OVERSAMPLING = 1;
export const MIN_WEBVR_OVERSAMPLING = 0.5;
export const MAX_WEBVR_OVERSAMPLING = 2;

export function clampWebVROversampling(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_WEBVR_OVERSAMPLING;
  }
  return Math.max(
    MIN_WEBVR_OVERSAMPLING,
    Math.min(MAX_WEBVR_OVERSAMPLING, value),
  );
}

/**
 * Computes left/right eye layout in logical CSS pixels.
 *
 * Three.js `setViewport` / `setScissor` multiply by `pixelRatio`, so callers
 * must pass logical sizes from `gl.getSize()`, never drawing-buffer sizes.
 * Distortion render targets still use physical pixels
 * (`logical * pixelRatio * oversampling`). Viewports are unaffected by
 * oversampling.
 */
export function computeStereoLayout(
  logicalWidth: number,
  logicalHeight: number,
  pixelRatio: number,
  oversampling: number = DEFAULT_WEBVR_OVERSAMPLING,
): StereoLayout {
  const fullWidth = Math.max(2, Math.floor(logicalWidth));
  const fullHeight = Math.max(1, Math.floor(logicalHeight));
  const leftWidth = Math.max(1, Math.floor(fullWidth / 2));
  const rightWidth = Math.max(1, fullWidth - leftWidth);
  const ratio =
    Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const scale = clampWebVROversampling(oversampling);

  return {
    fullWidth,
    fullHeight,
    left: { width: leftWidth, height: fullHeight, offsetX: 0 },
    right: { width: rightWidth, height: fullHeight, offsetX: leftWidth },
    renderTargetWidth: Math.max(1, Math.floor(leftWidth * ratio * scale)),
    renderTargetHeight: Math.max(1, Math.floor(fullHeight * ratio * scale)),
    stereoAspect: leftWidth / fullWidth,
  };
}
