/**
 * Shared world-space radius for the built-in sphere and cube-tile panoramas.
 * Hotspots and the invisible event surface use the same scale.
 */
export const DEFAULT_PANORAMA_RADIUS = 1_000;
/** Keeps depth-buffer precision stable for hotspots near the panorama shell. */
export const DEFAULT_PANORAMA_CAMERA_NEAR = 0.1;
export const DEFAULT_PANORAMA_CAMERA_FAR = DEFAULT_PANORAMA_RADIUS * 2;
