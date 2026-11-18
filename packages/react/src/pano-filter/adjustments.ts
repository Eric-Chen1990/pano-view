export type PanoColorAdjustments = Readonly<{
  /** Linear exposure in stops, from -2 to 2. */
  exposure?: number;
  /** Color saturation from -1 (grayscale) to 1 (boosted). */
  saturation?: number;
  /** Contrast around display-space middle gray, from -1 to 1. */
  contrast?: number;
  /** Local midtone contrast, from -1 (softer) to 1 (stronger). */
  clarity?: number;
}>;

function normalize(value: number | undefined, limit: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(-limit, Math.min(limit, value))
    : 0;
}

export function resolvePanoColorAdjustments(
  adjustments?: PanoColorAdjustments,
): Required<PanoColorAdjustments> {
  return {
    exposure: normalize(adjustments?.exposure, 2),
    saturation: normalize(adjustments?.saturation, 1),
    contrast: normalize(adjustments?.contrast, 1),
    clarity: normalize(adjustments?.clarity, 1),
  };
}
