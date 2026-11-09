/** Viewer-local spatial UI is composited after fallback panorama lens distortion. */
export const SPATIAL_UI_LAYER = 31;
export const SPATIAL_UI_MASK = 1 << SPATIAL_UI_LAYER;

/** Preserve camera/renderer state even if a host's custom render callback throws. */
export function renderSpatialEye(
  renderer: { autoClear: boolean; clearDepth: () => void },
  camera: { layers: { mask: number } },
  background: () => void,
  overlay: () => void,
  aperture: () => void = () => {}
) {
  const mask = camera.layers.mask;
  const autoClear = renderer.autoClear;
  try {
    camera.layers.mask = mask & ~SPATIAL_UI_MASK;
    background();
    renderer.autoClear = false;
    renderer.clearDepth();
    camera.layers.mask = SPATIAL_UI_MASK;
    overlay();
    aperture();
  } finally {
    camera.layers.mask = mask;
    renderer.autoClear = autoClear;
  }
}
