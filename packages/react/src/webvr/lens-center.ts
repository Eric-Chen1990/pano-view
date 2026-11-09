import type { WebVRProfile } from "./types";

export type StereoLensCenter = {
  /** Normalized offset from the eye viewport center toward the right (+1 = right edge). */
  x: number;
  /** Normalized offset from the eye viewport center toward the top (+1 = top edge). */
  y: number;
};

export type StereoPhysicalScreen = {
  widthMm: number;
  heightMm: number;
};

/**
 * Physical screen dimensions from a diagonal size in inches and the display
 * aspect (`fullWidth / fullHeight` in landscape).
 */
export function physicalScreenFromDiagonal(
  screensizeInches: number,
  displayAspect: number,
): StereoPhysicalScreen | null {
  if (
    !(
      Number.isFinite(screensizeInches) &&
      screensizeInches > 0 &&
      Number.isFinite(displayAspect) &&
      displayAspect > 0
    )
  ) {
    return null;
  }
  const diagonalMm = screensizeInches * 25.4;
  const heightMm = diagonalMm / Math.sqrt(displayAspect * displayAspect + 1);
  const widthMm = heightMm * displayAspect;
  if (!(heightMm > 0 && widthMm > 0)) {
    return null;
  }
  return { widthMm, heightMm };
}

/**
 * Lens optical center relative to each eye's viewport center, in normalized
 * eye coordinates (-1…1). Zero offsets keep the current half-screen center.
 *
 * Horizontal: half IPD from the phone midline toward each eye.
 * Vertical: tray-to-lens distance from the bottom edge when `trayDistanceMm`
 * is positive; `0` / omitted keeps the vertical center.
 */
export function computeStereoLensCenters(
  profile: Pick<WebVRProfile, "ipdMm" | "trayDistanceMm">,
  screensize: number | "auto",
  displayAspect: number,
): { left: StereoLensCenter; right: StereoLensCenter } {
  const zero = { left: { x: 0, y: 0 }, right: { x: 0, y: 0 } };
  if (screensize === "auto") {
    return zero;
  }
  const screen = physicalScreenFromDiagonal(screensize, displayAspect);
  if (!screen) {
    return zero;
  }

  const halfEyeWidthMm = screen.widthMm / 4;
  const ipdMm = Number.isFinite(profile.ipdMm) ? profile.ipdMm : 60;
  // Midline → left lens is -ipd/2; left eye center is at -halfEyeWidth from
  // the midline, so the offset inside the left eye is halfEyeWidth - ipd/2.
  const x =
    halfEyeWidthMm > 0 ? (halfEyeWidthMm - ipdMm / 2) / halfEyeWidthMm : 0;

  const trayDistanceMm =
    typeof profile.trayDistanceMm === "number" &&
    Number.isFinite(profile.trayDistanceMm) &&
    profile.trayDistanceMm > 0
      ? profile.trayDistanceMm
      : 0;
  const y =
    trayDistanceMm > 0 && screen.heightMm > 0
      ? (2 * trayDistanceMm) / screen.heightMm - 1
      : 0;

  const clampUnit = (value: number) =>
    Math.max(-1, Math.min(1, Number.isFinite(value) ? value : 0));

  return {
    left: { x: clampUnit(x), y: clampUnit(y) },
    right: { x: clampUnit(-x), y: clampUnit(y) },
  };
}

/** Neutral preview optics deliberately ignore physical screen measurements. */
export function computeStereoCalibration(profile: WebVRProfile, screensize: number | "auto", displayAspect: number) {
  const calibratedSize = profile.id === "none" ? "auto" : screensize;
  const screen = calibratedSize === "auto" ? null : physicalScreenFromDiagonal(calibratedSize, displayAspect);
  const fov = screen === null ? profile.fov : 2 * Math.atan(screen.heightMm / (2 * (profile.screenToLensMm ?? 42))) * 180 / Math.PI;
  return {
    fov: Math.max(30, Math.min(140, fov)),
    centers: computeStereoLensCenters(profile, calibratedSize, displayAspect),
  };
}
