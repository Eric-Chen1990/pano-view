/**
 * Shared drag inertia and edge bounce for map pan and scene-menu scrolling.
 * Axis motion is pure; hosts own pointer capture and rAF loops.
 */

export type PanoDragMotion = {
  /** Continue sliding after release from pointer velocity. Defaults to true. */
  inertia?: boolean;
  /** Rubber-band past edges while dragging; spring back on release. Defaults to true. */
  bounce?: boolean;
};

export type ResolvedDragMotion = {
  inertia: boolean;
  bounce: boolean;
};

/** Matches panorama rotation inertia damping (1/s). */
export const DRAG_INERTIA_DAMPING = 8;
/** Absolute velocity (px/s) below which coasting stops. */
export const DRAG_FRICTION_STOP = 24;
/** Spring rate toward the nearest edge while overscrolled (1/s² scale via exp). */
export const DRAG_SPRING_STRENGTH = 28;
/** Overscroll rubber-band constant (iOS-like). */
export const DRAG_RUBBER_CONSTANT = 0.55;
/** Snap distance (px) and residual speed that finish a spring. */
export const DRAG_SPRING_SETTLE_DISTANCE = 0.5;
export const DRAG_SPRING_SETTLE_VELOCITY = 12;

export function resolveDragMotion(
  motion: PanoDragMotion | false | undefined,
): ResolvedDragMotion {
  if (motion === false) {
    return { inertia: false, bounce: false };
  }
  return {
    inertia: motion?.inertia !== false,
    bounce: motion?.bounce !== false,
  };
}

export function clampAxis(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Map a free (unconstrained) drag offset into a display position.
 * Inside [min, max] the mapping is identity. Past an edge, bounce applies
 * rubber-banding against `dimension`; otherwise the value is hard-clamped.
 */
export function constrainDragPosition(
  raw: number,
  min: number,
  max: number,
  dimension: number,
  bounce: boolean,
): number {
  if (!(Number.isFinite(raw) && Number.isFinite(min) && Number.isFinite(max))) {
    return 0;
  }
  if (raw >= min && raw <= max) {
    return raw;
  }
  if (!bounce) {
    return clampAxis(raw, min, max);
  }
  const size = Math.max(1, Math.abs(dimension) || 1);
  if (raw < min) {
    const overshoot = min - raw;
    return min - rubberBandDistance(overshoot, size);
  }
  const overshoot = raw - max;
  return max + rubberBandDistance(overshoot, size);
}

export function rubberBandDistance(
  overshoot: number,
  dimension: number,
  constant: number = DRAG_RUBBER_CONSTANT,
): number {
  if (!(overshoot > 0)) return 0;
  const size = Math.max(1, Math.abs(dimension) || 1);
  return (size * overshoot) / (size + overshoot * constant);
}

export type PointerSample = {
  t: number;
  position: number;
};

/**
 * Estimate release velocity (units/s) from recent samples.
 * Uses the oldest-to-newest span within the last ~100 ms when possible.
 */
export function velocityFromSamples(
  samples: readonly PointerSample[],
  now?: number,
): number {
  if (samples.length < 2) return 0;
  const windowMs = 100;
  let oldest = samples[0]!;
  const newest = samples[samples.length - 1]!;
  const referenceTime = now ?? newest.t;
  for (let i = samples.length - 2; i >= 0; i -= 1) {
    const sample = samples[i]!;
    if (referenceTime - sample.t > windowMs) break;
    oldest = sample;
  }
  const dt = (newest.t - oldest.t) / 1000;
  // Ignore sub-millisecond spans; synthetic or bursty samples would explode.
  if (!(dt >= 0.001)) return 0;
  return (newest.position - oldest.position) / dt;
}

export type AxisMotionState = {
  position: number;
  velocity: number;
};

export type AxisMotionOptions = {
  min: number;
  max: number;
  inertia: boolean;
  bounce: boolean;
  damping?: number;
  frictionStop?: number;
  spring?: number;
};

/**
 * Advance one axis by `deltaSeconds`. Returns settled when motion should stop.
 */
export function integrateAxis(
  state: AxisMotionState,
  deltaSeconds: number,
  options: AxisMotionOptions,
): AxisMotionState & { settled: boolean } {
  const dt = Math.max(0, deltaSeconds);
  if (!(dt > 0)) {
    return { ...state, settled: isAxisSettled(state, options) };
  }

  const damping = options.damping ?? DRAG_INERTIA_DAMPING;
  const frictionStop = options.frictionStop ?? DRAG_FRICTION_STOP;
  const spring = options.spring ?? DRAG_SPRING_STRENGTH;
  const { min, max } = options;
  let { position, velocity } = state;

  const pastMin = position < min;
  const pastMax = position > max;

  if (pastMin || pastMax) {
    if (!options.bounce) {
      position = clampAxis(position, min, max);
      return { position, velocity: 0, settled: true };
    }
    const edge = pastMin ? min : max;
    // Kill velocity that pushes further outward.
    if (pastMin && velocity < 0) velocity = 0;
    if (pastMax && velocity > 0) velocity = 0;
    const displacement = edge - position;
    velocity += displacement * spring * dt;
    const decay = Math.exp(-damping * dt);
    velocity *= decay;
    position += velocity * dt;
    // Do not cross through the edge while springing back.
    if (pastMin && position > min) {
      position = min;
      velocity = 0;
    }
    if (pastMax && position < max) {
      position = max;
      velocity = 0;
    }
    const settled = isAxisSettled({ position, velocity }, options);
    if (settled) {
      return { position: clampAxis(position, min, max), velocity: 0, settled: true };
    }
    return { position, velocity, settled: false };
  }

  if (!options.inertia || Math.abs(velocity) < frictionStop) {
    return { position, velocity: 0, settled: true };
  }

  position += velocity * dt;
  velocity *= Math.exp(-damping * dt);

  if (position < min || position > max) {
    if (!options.bounce) {
      position = clampAxis(position, min, max);
      return { position, velocity: 0, settled: true };
    }
    // Leave overscrolled; next frame springs back.
    if (Math.abs(velocity) < frictionStop) {
      velocity = 0;
    }
    return { position, velocity, settled: false };
  }

  if (Math.abs(velocity) < frictionStop) {
    return { position, velocity: 0, settled: true };
  }
  return { position, velocity, settled: false };
}

export function isAxisSettled(
  state: AxisMotionState,
  options: Pick<AxisMotionOptions, "min" | "max" | "frictionStop">,
): boolean {
  const frictionStop = options.frictionStop ?? DRAG_FRICTION_STOP;
  const inside =
    state.position >= options.min - DRAG_SPRING_SETTLE_DISTANCE &&
    state.position <= options.max + DRAG_SPRING_SETTLE_DISTANCE;
  const slow = Math.abs(state.velocity) < (options.frictionStop ?? DRAG_SPRING_SETTLE_VELOCITY);
  if (!inside) return false;
  return slow || Math.abs(state.velocity) < frictionStop;
}

/** Keep a ring of pointer samples for release velocity. */
export function pushSample(
  samples: PointerSample[],
  sample: PointerSample,
  maxCount = 8,
): PointerSample[] {
  const next = samples.length >= maxCount ? samples.slice(samples.length - maxCount + 1) : samples.slice();
  next.push(sample);
  return next;
}
