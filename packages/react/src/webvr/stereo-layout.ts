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

/**
 * Computes left/right eye layout in logical CSS pixels.
 *
 * Three.js `setViewport` / `setScissor` multiply by `pixelRatio`, so callers
 * must pass logical sizes from `gl.getSize()`, never drawing-buffer sizes.
 * Distortion render targets still use physical pixels (`logical * pixelRatio`).
 */
export function computeStereoLayout(
  logicalWidth: number,
  logicalHeight: number,
  pixelRatio: number,
): StereoLayout {
  const fullWidth = Math.max(2, Math.floor(logicalWidth));
  const fullHeight = Math.max(1, Math.floor(logicalHeight));
  const leftWidth = Math.max(1, Math.floor(fullWidth / 2));
  const rightWidth = Math.max(1, fullWidth - leftWidth);
  const ratio =
    Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;

  return {
    fullWidth,
    fullHeight,
    left: { width: leftWidth, height: fullHeight, offsetX: 0 },
    right: { width: rightWidth, height: fullHeight, offsetX: leftWidth },
    renderTargetWidth: Math.max(1, Math.floor(leftWidth * ratio)),
    renderTargetHeight: Math.max(1, Math.floor(fullHeight * ratio)),
    stereoAspect: leftWidth / fullWidth,
  };
}
