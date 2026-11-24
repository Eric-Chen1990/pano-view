/** When a callout is shown. Defaults to `"hover"`. */
export type CalloutTrigger = "click" | "hover" | "look" | "always";

/** Plain-text title/body and/or image content for a callout card. */
export type CalloutContent = {
  title?: string;
  text?: string;
  image?: string;
  imageAlt?: string;
};

/** Screen-space leader line from the marker to the card. */
export type CalloutLine = {
  /** Screen angle in degrees. `0` is right, `90` is up. Defaults to 45. */
  angle?: number;
  /** Length in CSS pixels. Defaults to 96. */
  length?: number;
  /** Stroke color. Defaults to `"#ffffff"`. */
  color?: string;
  /** Stroke width in CSS pixels. Defaults to 2. */
  width?: number;
};

/** Visual styling for the callout card. */
export type CalloutAppearance = {
  /** Card width in CSS pixels. Defaults to 220. */
  width?: number;
  background?: string;
  color?: string;
  titleBackground?: string;
  titleColor?: string;
  /** Vertical accent bar. Defaults to the line color. */
  accentColor?: string;
  fontSize?: number;
  padding?: number;
  borderRadius?: number;
};

export type CalloutAnimation = {
  /** Line draw duration in ms. Defaults to 280. */
  lineDuration?: number;
  /** Content reveal duration in ms. Defaults to 220. */
  contentDuration?: number;
};

export type CalloutMarker = {
  color?: string;
};

export type CalloutCardAlign = {
  /** Horizontal placement of the card relative to the line endpoint. */
  horizontal: "left" | "right";
  /**
   * Vertical placement of the card relative to the line endpoint.
   * `"end"` docks the card bottom to the endpoint (line going up),
   * `"start"` docks the top (line going down), `"center"` centers it.
   */
  vertical: "start" | "center" | "end";
};

export type CalloutLayout = {
  angle: number;
  length: number;
  endX: number;
  endY: number;
  card: CalloutCardAlign;
};

export type CalloutRevealProgress = {
  lineProgress: number;
  contentProgress: number;
};

export const DEFAULT_CALLOUT_LINE_ANGLE = 45;
export const DEFAULT_CALLOUT_LINE_LENGTH = 96;
export const DEFAULT_CALLOUT_LINE_COLOR = "#ffffff";
export const DEFAULT_CALLOUT_LINE_WIDTH = 2;
export const DEFAULT_CALLOUT_CARD_WIDTH = 220;
export const DEFAULT_CALLOUT_LINE_DURATION = 280;
export const DEFAULT_CALLOUT_CONTENT_DURATION = 220;
export const DEFAULT_CALLOUT_LOOK_ANGLE = 6;
export const DEFAULT_CALLOUT_LOOK_DELAY = 250;
export const DEFAULT_CALLOUT_MARKER_COLOR = "#ffffff";

export const DEFAULT_CALLOUT_APPEARANCE: Required<
  Pick<
    CalloutAppearance,
    | "width"
    | "background"
    | "color"
    | "titleBackground"
    | "titleColor"
    | "fontSize"
    | "padding"
    | "borderRadius"
  >
> = {
  width: DEFAULT_CALLOUT_CARD_WIDTH,
  /** Semi-opaque panel so body text stays readable over the panorama. */
  background: "rgba(16, 20, 24, 0.86)",
  color: "#ffffff",
  titleBackground: "#8b1e1e",
  titleColor: "#ffffff",
  fontSize: 13,
  padding: 8,
  borderRadius: 0,
};

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? value! : fallback;
}

function positiveOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && value! > 0 ? value! : fallback;
}

export function resolveCalloutLine(line: CalloutLine | undefined): {
  angle: number;
  length: number;
  color: string;
  width: number;
} {
  return {
    angle: finiteOr(line?.angle, DEFAULT_CALLOUT_LINE_ANGLE),
    length: positiveOr(line?.length, DEFAULT_CALLOUT_LINE_LENGTH),
    color: line?.color?.trim() || DEFAULT_CALLOUT_LINE_COLOR,
    width: positiveOr(line?.width, DEFAULT_CALLOUT_LINE_WIDTH),
  };
}

export function resolveCalloutAppearance(
  appearance: CalloutAppearance | undefined,
  accentFallback: string,
): Required<CalloutAppearance> {
  return {
    ...DEFAULT_CALLOUT_APPEARANCE,
    accentColor: appearance?.accentColor?.trim() || accentFallback,
    ...Object.fromEntries(
      Object.entries(appearance ?? {}).filter(([, value]) => value !== undefined),
    ),
    width: positiveOr(appearance?.width, DEFAULT_CALLOUT_CARD_WIDTH),
    fontSize: positiveOr(appearance?.fontSize, DEFAULT_CALLOUT_APPEARANCE.fontSize),
    padding: Math.max(0, finiteOr(appearance?.padding, DEFAULT_CALLOUT_APPEARANCE.padding)),
    borderRadius: Math.max(
      0,
      finiteOr(appearance?.borderRadius, DEFAULT_CALLOUT_APPEARANCE.borderRadius),
    ),
  };
}

export function resolveCalloutAnimation(animation: CalloutAnimation | undefined): {
  lineDuration: number;
  contentDuration: number;
} {
  return {
    lineDuration: Math.max(
      0,
      finiteOr(animation?.lineDuration, DEFAULT_CALLOUT_LINE_DURATION),
    ),
    contentDuration: Math.max(
      0,
      finiteOr(animation?.contentDuration, DEFAULT_CALLOUT_CONTENT_DURATION),
    ),
  };
}

export function resolveCalloutContent(
  content: CalloutContent | undefined,
): CalloutContent | null {
  if (!content) return null;
  const title = content.title?.trim();
  const text = content.text?.trim();
  const image = content.image?.trim();
  const imageAlt = content.imageAlt?.trim();
  if (!title && !text && !image) return null;
  return {
    title: title || undefined,
    text: text || undefined,
    image: image || undefined,
    imageAlt: imageAlt || undefined,
  };
}

/**
 * Screen-space layout for the leader line and card.
 * Y grows upward in the returned coordinates (SVG / world screen frame).
 */
export function resolveCalloutLayout(
  angleDeg: number,
  lengthPx: number,
): CalloutLayout {
  const angle = finiteOr(angleDeg, DEFAULT_CALLOUT_LINE_ANGLE);
  const length = positiveOr(lengthPx, DEFAULT_CALLOUT_LINE_LENGTH);
  const radians = (angle * Math.PI) / 180;
  const endX = Math.cos(radians) * length;
  const endY = Math.sin(radians) * length;
  const horizontal: CalloutCardAlign["horizontal"] = endX >= 0 ? "right" : "left";
  const vertical: CalloutCardAlign["vertical"] =
    Math.abs(endY) < length * 0.2 ? "center" : endY > 0 ? "end" : "start";
  return { angle, length, endX, endY, card: { horizontal, vertical } };
}

/**
 * Two-phase reveal. `t` is normalized elapsed time in [0, 1] over the total
 * duration (line then content). Opening grows line first; closing shrinks
 * content first.
 */
export function calloutRevealProgress(
  open: boolean,
  phase: number,
): CalloutRevealProgress {
  const t = Math.max(0, Math.min(1, phase));
  if (open) {
    if (t <= 0.5) {
      return { lineProgress: t * 2, contentProgress: 0 };
    }
    return { lineProgress: 1, contentProgress: (t - 0.5) * 2 };
  }
  if (t <= 0.5) {
    return { lineProgress: 1, contentProgress: 1 - t * 2 };
  }
  return { lineProgress: 1 - (t - 0.5) * 2, contentProgress: 0 };
}

/** Weighted phase from separate line/content durations. */
export function calloutRevealPhaseFromDurations(
  open: boolean,
  lineProgress: number,
  contentProgress: number,
  lineDuration: number,
  contentDuration: number,
): number {
  const line = Math.max(0, Math.min(1, lineProgress));
  const content = Math.max(0, Math.min(1, contentProgress));
  const total = Math.max(0, lineDuration) + Math.max(0, contentDuration);
  if (total <= 0) {
    return open
      ? line >= 1 && content >= 1
        ? 1
        : 0
      : line <= 0 && content <= 0
        ? 1
        : 0;
  }
  if (open) {
    const elapsed = line * lineDuration + content * contentDuration;
    return Math.max(0, Math.min(1, elapsed / total));
  }
  const elapsed =
    (1 - content) * contentDuration + (1 - line) * lineDuration;
  return Math.max(0, Math.min(1, elapsed / total));
}

/**
 * Advance two-phase progress by `deltaMs`. Returns the next progress and
 * whether the overlay should stay mounted.
 */
export function stepCalloutReveal(
  open: boolean,
  current: CalloutRevealProgress,
  deltaMs: number,
  lineDuration: number,
  contentDuration: number,
  reducedMotion: boolean,
): CalloutRevealProgress & { mounted: boolean } {
  if (reducedMotion || (lineDuration <= 0 && contentDuration <= 0)) {
    if (open) {
      return { lineProgress: 1, contentProgress: 1, mounted: true };
    }
    return { lineProgress: 0, contentProgress: 0, mounted: false };
  }

  let { lineProgress, contentProgress } = current;
  let remaining = Math.max(0, deltaMs);

  if (open) {
    if (lineProgress < 1) {
      const step =
        lineDuration > 0 ? remaining / lineDuration : 1;
      const next = Math.min(1, lineProgress + step);
      remaining -= (next - lineProgress) * lineDuration;
      lineProgress = next;
    }
    if (lineProgress >= 1 && remaining > 0 && contentProgress < 1) {
      const step =
        contentDuration > 0 ? remaining / contentDuration : 1;
      contentProgress = Math.min(1, contentProgress + step);
    }
    return {
      lineProgress,
      contentProgress,
      mounted: true,
    };
  }

  if (contentProgress > 0) {
    const step =
      contentDuration > 0 ? remaining / contentDuration : 1;
    const next = Math.max(0, contentProgress - step);
    remaining -= (contentProgress - next) * contentDuration;
    contentProgress = next;
  }
  if (contentProgress <= 0 && remaining > 0 && lineProgress > 0) {
    const step = lineDuration > 0 ? remaining / lineDuration : 1;
    lineProgress = Math.max(0, lineProgress - step);
  }
  return {
    lineProgress,
    contentProgress,
    mounted: lineProgress > 0 || contentProgress > 0,
  };
}

export type LookGateState = {
  inside: boolean;
  since: number | null;
  open: boolean;
};

/**
 * Gaze / look-at gate with enter delay and exit hysteresis
 * (`exitAngle = lookAngle * 1.5`).
 */
export function stepLookGate(
  state: LookGateState,
  angleDeg: number,
  lookAngle: number,
  lookDelayMs: number,
  nowMs: number,
): LookGateState {
  const enter = Math.max(0, lookAngle);
  const exit = enter * 1.5;
  if (state.open) {
    if (angleDeg > exit) {
      return { inside: false, since: null, open: false };
    }
    return { inside: true, since: state.since, open: true };
  }
  if (angleDeg <= enter) {
    const since = state.inside && state.since != null ? state.since : nowMs;
    if (nowMs - since >= Math.max(0, lookDelayMs)) {
      return { inside: true, since, open: true };
    }
    return { inside: true, since, open: false };
  }
  return { inside: false, since: null, open: false };
}

/** Smallest angular distance between two unit directions, in degrees. */
export function directionAngleDegrees(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const aLen = Math.hypot(ax, ay, az);
  const bLen = Math.hypot(bx, by, bz);
  if (!(aLen > 0) || !(bLen > 0)) return 180;
  const dot = Math.max(
    -1,
    Math.min(1, (ax * bx + ay * by + az * bz) / (aLen * bLen)),
  );
  return (Math.acos(dot) * 180) / Math.PI;
}
