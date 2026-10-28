/** Camera-center limits in degrees. A yaw min greater than max crosses ±180°. */
export type PanoViewLimits = {
  yaw?: { min: number; max: number };
  pitch?: { min: number; max: number };
  fov?: { min: number; max: number };
};

type Range = { min: number; max: number };
export type ResolvedViewLimits = {
  yaw?: Range;
  pitch: Range;
  fov: Range;
  hardPitch: boolean;
  hardFov: boolean;
};

export function parseViewLimits(value: unknown): PanoViewLimits | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("viewLimits: expected an object");
  const result: PanoViewLimits = {};
  for (const axis of ["yaw", "pitch", "fov"] as const) {
    const input = (value as Record<string, unknown>)[axis];
    if (input === undefined) continue;
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new Error(`viewLimits.${axis}: expected min and max`);
    const { min, max } = input as Record<string, unknown>;
    const lower = axis === "yaw" ? -180 : axis === "pitch" ? -90 : 1;
    const upper = axis === "yaw" ? 180 : axis === "pitch" ? 90 : 179;
    if (typeof min !== "number" || typeof max !== "number" ||
        !Number.isFinite(min) || !Number.isFinite(max) ||
        min < lower || min > upper || max < lower || max > upper)
      throw new Error(`viewLimits.${axis}: expected finite min and max from ${lower} to ${upper}`);
    if (axis !== "yaw" && min > max)
      throw new Error(`viewLimits.${axis}: min must not exceed max`);
    result[axis] = { min, max };
  }
  return result;
}

export function resolveViewLimits(
  base: PanoViewLimits | undefined,
  scene: PanoViewLimits | undefined,
  minFov = 30,
  maxFov = 100,
): ResolvedViewLimits {
  const pitch = scene?.pitch ?? base?.pitch;
  const fov = scene?.fov ?? base?.fov;
  return {
    yaw: scene?.yaw ?? base?.yaw,
    pitch: pitch ?? { min: -90, max: 90 },
    fov: fov ?? { min: minFov, max: maxFov },
    hardPitch: pitch !== undefined,
    hardFov: fov !== undefined,
  };
}

export function clampViewAxis(value: number, range: Range): number {
  return Math.max(range.min, Math.min(range.max, value));
}

export function normalizeViewYaw(yaw: number): number {
  return ((yaw + 180) % 360 + 360) % 360 - 180;
}

function yawWidth(range: Range | undefined): number {
  if (!range || (range.min === -180 && range.max === 180)) return 360;
  return ((range.max - range.min) % 360 + 360) % 360;
}

/** Offset in the allowed arc; outside points use the nearest boundary (ties use min). */
function yawOffset(yaw: number, range: Range): number {
  const width = yawWidth(range);
  const offset = ((yaw - range.min) % 360 + 360) % 360;
  if (offset <= width) return offset;
  return offset - width < 360 - offset ? width : 0;
}

export function constrainViewYaw(yaw: number, range?: Range): number {
  if (yawWidth(range) === 360) return normalizeViewYaw(yaw);
  return normalizeViewYaw(range!.min + yawOffset(yaw, range!));
}

/** Clamp relative input before wrapping so a large drag cannot jump across a forbidden arc. */
export function applyLimitedYawDelta(yaw: number, delta: number, range?: Range): number {
  const width = yawWidth(range);
  if (width === 360) return normalizeViewYaw(yaw + delta);
  const offset = clampViewAxis(yawOffset(yaw, range!) + delta, { min: 0, max: width });
  return normalizeViewYaw(range!.min + offset);
}

/** Interpolate inside the allowed arc even when the shorter path leaves it. */
export function limitedYawDelta(from: number, to: number, range?: Range, shortestPath = true): number {
  if (yawWidth(range) === 360)
    return shortestPath ? normalizeViewYaw(to - from) : to - from;
  return yawOffset(to, range!) - yawOffset(from, range!);
}
