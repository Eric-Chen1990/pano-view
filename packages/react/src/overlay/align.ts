import type { CSSProperties } from "react";

export const PANO_OVERLAY_ALIGNS = [
  "top",
  "bottom",
  "left",
  "right",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export type PanoOverlayAlign = (typeof PANO_OVERLAY_ALIGNS)[number];

export type PanoOverlayAxis = "horizontal" | "vertical";

export type PanoOverlayInset =
  | number
  | string
  | {
      top?: number | string;
      right?: number | string;
      bottom?: number | string;
      left?: number | string;
    };

/** Shared screen-edge anchor for planar overlay chrome. */
export type PanoOverlayAnchor = {
  align?: PanoOverlayAlign;
  /** Used for corner anchors. Edges infer the axis and ignore this value. */
  axis?: PanoOverlayAxis;
  inset?: PanoOverlayInset;
};

export type PanoOverlayCollapseEdge = "top" | "bottom" | "left" | "right";

export type PanoOverlayContentAlign = "start" | "center" | "end";

export type ResolvedOverlayInset = {
  top: string;
  right: string;
  bottom: string;
  left: string;
};

export type ResolvedOverlayAnchor = {
  align: PanoOverlayAlign;
  axis: PanoOverlayAxis;
  inset: ResolvedOverlayInset;
  collapseEdge: PanoOverlayCollapseEdge;
  contentAlign: PanoOverlayContentAlign;
  dockInset: string;
};

const ALIGN_LIST = PANO_OVERLAY_ALIGNS.join(", ");

const SAFE = {
  top: "var(--pano-safe-top)",
  right: "var(--pano-safe-right)",
  bottom: "var(--pano-safe-bottom)",
  left: "var(--pano-safe-left)",
} as const;

export function cssLength(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

export function isOverlayCorner(align: PanoOverlayAlign): boolean {
  switch (align) {
    case "top-left":
    case "top-right":
    case "bottom-left":
    case "bottom-right":
      return true;
    case "top":
    case "bottom":
    case "left":
    case "right":
      return false;
    default: {
      const exhaustive: never = align;
      return exhaustive;
    }
  }
}

export function resolveOverlayAxis(
  align: PanoOverlayAlign,
  axis: PanoOverlayAxis | undefined,
): PanoOverlayAxis {
  switch (align) {
    case "top":
    case "bottom":
      return "horizontal";
    case "left":
    case "right":
      return "vertical";
    case "top-left":
    case "top-right":
    case "bottom-left":
    case "bottom-right":
      return axis ?? "horizontal";
    default: {
      const exhaustive: never = align;
      return exhaustive;
    }
  }
}

export function overlayCollapseEdge(
  align: PanoOverlayAlign,
  axis: PanoOverlayAxis | undefined,
): PanoOverlayCollapseEdge {
  switch (align) {
    case "top":
      return "top";
    case "bottom":
      return "bottom";
    case "left":
      return "left";
    case "right":
      return "right";
    case "top-left":
      return resolveOverlayAxis(align, axis) === "horizontal" ? "top" : "left";
    case "top-right":
      return resolveOverlayAxis(align, axis) === "horizontal" ? "top" : "right";
    case "bottom-left":
      return resolveOverlayAxis(align, axis) === "horizontal" ? "bottom" : "left";
    case "bottom-right":
      return resolveOverlayAxis(align, axis) === "horizontal" ? "bottom" : "right";
    default: {
      const exhaustive: never = align;
      return exhaustive;
    }
  }
}

export type PanoOverlayChevron = "up" | "down" | "left" | "right";

/** Chevron toward the outer edge when expanded, and back inward when collapsed. */
export function overlayChevron(
  edge: PanoOverlayCollapseEdge,
  collapsed: boolean,
): PanoOverlayChevron {
  switch (edge) {
    case "top":
      return collapsed ? "down" : "up";
    case "bottom":
      return collapsed ? "up" : "down";
    case "left":
      return collapsed ? "right" : "left";
    case "right":
      return collapsed ? "left" : "right";
    default: {
      const exhaustive: never = edge;
      return exhaustive;
    }
  }
}

export function overlayContentAlign(
  align: PanoOverlayAlign,
  axis: PanoOverlayAxis | undefined,
): PanoOverlayContentAlign {
  const resolved = resolveOverlayAxis(align, axis);
  if (resolved === "horizontal") {
    switch (align) {
      case "top-left":
      case "bottom-left":
        return "start";
      case "top-right":
      case "bottom-right":
        return "end";
      case "top":
      case "bottom":
      case "left":
      case "right":
        return "center";
      default: {
        const exhaustive: never = align;
        return exhaustive;
      }
    }
  }
  switch (align) {
    case "top-left":
    case "top-right":
      return "start";
    case "bottom-left":
    case "bottom-right":
      return "end";
    case "top":
    case "bottom":
    case "left":
    case "right":
      return "center";
    default: {
      const exhaustive: never = align;
      return exhaustive;
    }
  }
}

export function resolveOverlayInset(
  inset: PanoOverlayInset | undefined,
  fallback: number | string,
): ResolvedOverlayInset {
  const fallbackLength = cssLength(fallback);
  if (inset === undefined) {
    return {
      top: fallbackLength,
      right: fallbackLength,
      bottom: fallbackLength,
      left: fallbackLength,
    };
  }
  if (typeof inset === "number" || typeof inset === "string") {
    const value = cssLength(inset);
    return { top: value, right: value, bottom: value, left: value };
  }
  return {
    top: cssLength(inset.top ?? fallback),
    right: cssLength(inset.right ?? fallback),
    bottom: cssLength(inset.bottom ?? fallback),
    left: cssLength(inset.left ?? fallback),
  };
}

export function overlayDockInset(
  edge: PanoOverlayCollapseEdge,
  inset: ResolvedOverlayInset,
): string {
  switch (edge) {
    case "top":
      return inset.top;
    case "bottom":
      return inset.bottom;
    case "left":
      return inset.left;
    case "right":
      return inset.right;
    default: {
      const exhaustive: never = edge;
      return exhaustive;
    }
  }
}

export function resolveOverlayAnchor(
  anchor: PanoOverlayAnchor | undefined,
  defaults: { align: PanoOverlayAlign; inset: number | string },
): ResolvedOverlayAnchor {
  const align = anchor?.align ?? defaults.align;
  const axis = resolveOverlayAxis(align, anchor?.axis);
  const inset = resolveOverlayInset(anchor?.inset, defaults.inset);
  const collapseEdge = overlayCollapseEdge(align, anchor?.axis);
  return {
    align,
    axis,
    inset,
    collapseEdge,
    contentAlign: overlayContentAlign(align, anchor?.axis),
    dockInset: overlayDockInset(collapseEdge, inset),
  };
}

function withSafe(inset: string, safeVariable: string): string {
  return `calc(${inset} + ${safeVariable})`;
}

function maxBox(inset: ResolvedOverlayInset): Pick<CSSProperties, "maxWidth" | "maxHeight"> {
  return {
    maxWidth: `calc(100% - ${inset.left} - ${inset.right} - ${SAFE.left} - ${SAFE.right})`,
    maxHeight: `calc(100% - ${inset.top} - ${inset.bottom} - ${SAFE.top} - ${SAFE.bottom})`,
  };
}

function horizontalSpan(
  inset: ResolvedOverlayInset,
  width: string | undefined,
): Pick<CSSProperties, "left" | "right" | "width" | "marginInline"> {
  const left = withSafe(inset.left, SAFE.left);
  const right = withSafe(inset.right, SAFE.right);
  if (width === undefined) {
    return { left, right, width: undefined, marginInline: undefined };
  }
  return { left, right, width, marginInline: "auto" };
}

function verticalSpan(
  inset: ResolvedOverlayInset,
  height: string | undefined,
): Pick<CSSProperties, "top" | "bottom" | "height" | "marginBlock"> {
  const top = withSafe(inset.top, SAFE.top);
  const bottom = withSafe(inset.bottom, SAFE.bottom);
  if (height === undefined) {
    return { top, bottom, height: undefined, marginBlock: undefined };
  }
  return { top, bottom, height, marginBlock: "auto" };
}

/**
 * Position a planar overlay on one of eight anchors.
 * Edge anchors center along that edge when the main-axis size is set, and
 * stretch between the cross-axis insets when it is omitted. Corners pin to
 * both adjacent edges and shrink to content when a size is omitted.
 */
export function overlayBoxStyle(
  align: PanoOverlayAlign,
  inset: ResolvedOverlayInset,
  width: number | string | undefined,
  height: number | string | undefined,
): CSSProperties {
  const widthValue = width === undefined ? undefined : cssLength(width);
  const heightValue = height === undefined ? undefined : cssLength(height);
  const limits = maxBox(inset);
  switch (align) {
    case "top":
      return {
        ...horizontalSpan(inset, widthValue),
        top: withSafe(inset.top, SAFE.top),
        bottom: "auto",
        height: heightValue,
        ...limits,
      };
    case "bottom":
      return {
        ...horizontalSpan(inset, widthValue),
        top: "auto",
        bottom: withSafe(inset.bottom, SAFE.bottom),
        height: heightValue,
        ...limits,
      };
    case "left":
      return {
        ...verticalSpan(inset, heightValue),
        left: withSafe(inset.left, SAFE.left),
        right: "auto",
        width: widthValue,
        ...limits,
      };
    case "right":
      return {
        ...verticalSpan(inset, heightValue),
        left: "auto",
        right: withSafe(inset.right, SAFE.right),
        width: widthValue,
        ...limits,
      };
    case "top-left":
      return {
        top: withSafe(inset.top, SAFE.top),
        left: withSafe(inset.left, SAFE.left),
        right: "auto",
        bottom: "auto",
        width: widthValue,
        height: heightValue,
        ...limits,
      };
    case "top-right":
      return {
        top: withSafe(inset.top, SAFE.top),
        right: withSafe(inset.right, SAFE.right),
        left: "auto",
        bottom: "auto",
        width: widthValue,
        height: heightValue,
        ...limits,
      };
    case "bottom-left":
      return {
        bottom: withSafe(inset.bottom, SAFE.bottom),
        left: withSafe(inset.left, SAFE.left),
        top: "auto",
        right: "auto",
        width: widthValue,
        height: heightValue,
        ...limits,
      };
    case "bottom-right":
      return {
        bottom: withSafe(inset.bottom, SAFE.bottom),
        right: withSafe(inset.right, SAFE.right),
        top: "auto",
        left: "auto",
        width: widthValue,
        height: heightValue,
        ...limits,
      };
    default: {
      const exhaustive: never = align;
      return exhaustive;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInsetLength(value: unknown, field: string): number | string {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) return value;
  throw new Error(`${field}: expected a finite number or a nonempty string`);
}

function parseInset(value: unknown, field: string): PanoOverlayInset {
  if (typeof value === "number" || typeof value === "string") {
    return parseInsetLength(value, field);
  }
  if (!isRecord(value)) throw new Error(`${field}: expected a number, string, or object`);
  const sides = ["top", "right", "bottom", "left"] as const;
  const inset: {
    top?: number | string;
    right?: number | string;
    bottom?: number | string;
    left?: number | string;
  } = {};
  for (const side of sides) {
    if (value[side] === undefined) continue;
    inset[side] = parseInsetLength(value[side], `${field}.${side}`);
  }
  return inset;
}

/** Validate an anchor object from a project document. */
export function parseOverlayAnchor(value: unknown, field: string): PanoOverlayAnchor {
  if (!isRecord(value)) throw new Error(`${field}: expected an object`);
  const align =
    value.align === undefined
      ? undefined
      : typeof value.align === "string" &&
          (PANO_OVERLAY_ALIGNS as readonly string[]).includes(value.align)
        ? (value.align as PanoOverlayAlign)
        : (() => {
            throw new Error(`${field}.align: expected ${ALIGN_LIST}`);
          })();
  const axis =
    value.axis === undefined
      ? undefined
      : value.axis === "horizontal" || value.axis === "vertical"
        ? value.axis
        : (() => {
            throw new Error(`${field}.axis: expected "horizontal" or "vertical"`);
          })();
  const inset = value.inset === undefined ? undefined : parseInset(value.inset, `${field}.inset`);
  return {
    ...(align === undefined ? {} : { align }),
    ...(axis === undefined ? {} : { axis }),
    ...(inset === undefined ? {} : { inset }),
  };
}
