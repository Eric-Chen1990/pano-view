/**
 * Vergence distance for a monoscopic panorama, in meters.
 * A 360 photo has no real depth. Toe-in by the angle subtended by the
 * headset IPD at this distance gives each eye a distinct view that still
 * fuses comfortably (about 2° of disparity at 60 mm IPD).
 */
export const WEBVR_PANORAMA_VIRTUAL_DISTANCE_M = 2;

/**
 * Inward yaw for one eye, in radians.
 * The panorama shell is huge compared with a literal 60 mm eye offset, so
 * translating the cameras by IPD moves the image by a fraction of a pixel.
 */
export function panoramaStereoHalfAngle(
  ipdMm: number,
  virtualDistanceM = WEBVR_PANORAMA_VIRTUAL_DISTANCE_M,
): number {
  const ipdM = Math.max(0, ipdMm) / 1000;
  const distance = Math.max(
    Number.isFinite(virtualDistanceM) ? virtualDistanceM : WEBVR_PANORAMA_VIRTUAL_DISTANCE_M,
    0.05,
  );
  return Math.atan(ipdM / 2 / distance);
}

/** Local yaw applied after the shared view pose. Left looks right, right looks left. */
export function panoramaStereoToeInYaw(
  eye: "left" | "right",
  halfAngleRad: number,
): number {
  return eye === "left" ? -halfAngleRad : halfAngleRad;
}
