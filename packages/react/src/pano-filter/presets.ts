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

export type PanoFilterSnapshot = {
  preset: PanoFilterPreset;
  intensity: number;
  enabled: boolean;
};

export const DEFAULT_PANO_FILTER_INTENSITY = 1;

export const DEFAULT_PANO_FILTER_SNAPSHOT: PanoFilterSnapshot = {
  preset: "none",
  intensity: DEFAULT_PANO_FILTER_INTENSITY,
  enabled: true,
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
}): PanoFilterSnapshot {
  return {
    preset: input.preset ?? "none",
    intensity: clampPanoFilterIntensity(input.intensity),
    enabled: input.enabled !== false,
  };
}

export function isPanoFilterActive(snapshot: PanoFilterSnapshot): boolean {
  return snapshot.enabled && snapshot.preset !== "none";
}
