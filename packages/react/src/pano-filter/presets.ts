import { resolvePanoColorAdjustments, type PanoColorAdjustments } from "./adjustments";

export const PANO_FILTER_PRESETS = [
  "none",
  "grayscale",
  "sepia",
  "vintage",
  "cool",
  "warm",
  "pencil",
  "coloredPencil",
  "crayon",
  "watercolor",
  "cartoon",
  "crosshatch",
] as const;

export type PanoFilterPreset = (typeof PANO_FILTER_PRESETS)[number];

export type AppliedPanoFilterPreset = Exclude<PanoFilterPreset, "none">;

/** Row-major 4×5 RGBA matrix, applied in display (sRGB) space like an SVG color matrix. */
export type PanoColorMatrix = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type PanoFilterSnapshot = {
  preset: PanoFilterPreset;
  intensity: number;
  enabled: boolean;
  colorMatrix: PanoColorMatrix | null;
  colorMatrixScope: "panorama" | "all";
  adjustments: Required<PanoColorAdjustments> | null;
};

export const DEFAULT_PANO_FILTER_INTENSITY = 1;

export const DEFAULT_PANO_FILTER_SNAPSHOT: PanoFilterSnapshot = {
  preset: "none",
  intensity: DEFAULT_PANO_FILTER_INTENSITY,
  enabled: true,
  colorMatrix: null,
  colorMatrixScope: "panorama",
  adjustments: null,
};

export function clampPanoFilterIntensity(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PANO_FILTER_INTENSITY;
  }
  return Math.max(0, Math.min(value!, 1));
}

export function resolvePanoFilterSnapshot(input: {
  preset?: PanoFilterPreset;
  intensity?: number;
  enabled?: boolean;
  colorMatrix?: PanoColorMatrix | null;
  colorMatrixScope?: "panorama" | "all";
  adjustments?: PanoColorAdjustments;
}): PanoFilterSnapshot {
  if (
    input.colorMatrix &&
    (input.colorMatrix.length !== 20 ||
      input.colorMatrix.some((value) => !Number.isFinite(value)))
  ) {
    throw new Error("colorMatrix must contain 20 finite numbers");
  }
  return {
    adjustments: input.adjustments ? resolvePanoColorAdjustments(input.adjustments) : null,
    colorMatrix: input.colorMatrix ? [...input.colorMatrix] : null,
    colorMatrixScope: input.colorMatrixScope ?? "panorama",
    preset: input.preset ?? "none",
    intensity: clampPanoFilterIntensity(input.intensity),
    enabled: input.enabled !== false,
  };
}

export function isPanoFilterActive(snapshot: PanoFilterSnapshot): boolean {
  return (
    snapshot.enabled &&
    ((snapshot.intensity > 0 && (snapshot.preset !== "none" || snapshot.colorMatrix !== null)) ||
      (snapshot.adjustments !== null &&
        Object.values(snapshot.adjustments).some((value) => value !== 0)))
  );
}
