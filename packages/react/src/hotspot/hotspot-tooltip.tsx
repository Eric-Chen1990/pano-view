import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { PanoHtml } from "../webvr/stereo-html";
import type {
  HotspotTooltipAppearance,
  HotspotTooltipContent,
  HotspotTooltipPlacement,
} from "./types";

const TOOLTIP_MAX_WIDTH = 220;
const TOOLTIP_IMAGE_MAX_HEIGHT = 120;

export const DEFAULT_HOTSPOT_TOOLTIP_OFFSET = 12;

export const DEFAULT_HOTSPOT_TOOLTIP_APPEARANCE: Required<HotspotTooltipAppearance> = {
  background: "rgba(22, 22, 22, 0.72)",
  color: "#f5fbfc",
  border: "1px solid rgba(46, 46, 46, 0.7)",
  borderRadius: 8,
  shadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
  padding: 8,
  fontSize: 12,
};

const WRAPPER_STYLE: CSSProperties = {
  pointerEvents: "none",
};

function toCssLength(value: number | string): string {
  return typeof value === "number" ? `${value}px` : value;
}

export function resolveHotspotTooltipAppearance(
  appearance: HotspotTooltipAppearance | undefined,
): Required<HotspotTooltipAppearance> {
  return { ...DEFAULT_HOTSPOT_TOOLTIP_APPEARANCE, ...appearance };
}

export function resolveHotspotTooltipContent(
  tooltip: string | HotspotTooltipContent | undefined,
): HotspotTooltipContent | null {
  if (tooltip == null) {
    return null;
  }
  if (typeof tooltip === "string") {
    const text = tooltip.trim();
    return text ? { text } : null;
  }
  const text = tooltip.text?.trim();
  const image = tooltip.image?.trim();
  if (!text && !image) {
    return null;
  }
  const imageAlt = tooltip.imageAlt?.trim();
  return {
    image: image || undefined,
    imageAlt: imageAlt || undefined,
    text: text || undefined,
  };
}

export function resolveHotspotTooltipOffset(offset: number | undefined): number {
  if (!Number.isFinite(offset)) {
    return DEFAULT_HOTSPOT_TOOLTIP_OFFSET;
  }
  return Math.max(0, offset!);
}

export function tooltipBubbleTransform(
  placement: HotspotTooltipPlacement,
  offset: number,
): string {
  const gap = `${offset}px`;
  switch (placement) {
    case "top":
      return `translate(-50%, calc(-100% - ${gap}))`;
    case "bottom":
      return `translate(-50%, ${gap})`;
    case "left":
      return `translate(calc(-100% - ${gap}), -50%)`;
    case "right":
      return `translate(${gap}, -50%)`;
    default: {
      const exhaustive: never = placement;
      return exhaustive;
    }
  }
}

export function HotspotTooltip({
  content,
  placement = "top",
  offset = DEFAULT_HOTSPOT_TOOLTIP_OFFSET,
  appearance,
}: {
  content: HotspotTooltipContent;
  placement?: HotspotTooltipPlacement;
  offset?: number;
  appearance?: HotspotTooltipAppearance;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [content.image]);
  const showImage = Boolean(content.image) && !imageFailed;
  const resolvedAppearance = useMemo(
    () => resolveHotspotTooltipAppearance(appearance),
    [appearance],
  );
  const bubbleStyle = useMemo(
    (): CSSProperties => ({
      background: resolvedAppearance.background,
      border: resolvedAppearance.border,
      borderRadius: toCssLength(resolvedAppearance.borderRadius),
      boxShadow: resolvedAppearance.shadow,
      color: resolvedAppearance.color,
      fontSize: toCssLength(resolvedAppearance.fontSize),
      padding: toCssLength(resolvedAppearance.padding),
      transform: tooltipBubbleTransform(
        placement,
        resolveHotspotTooltipOffset(offset),
      ),
    }),
    [offset, placement, resolvedAppearance],
  );
  if (!showImage && !content.text) {
    return null;
  }

  return (
    <PanoHtml pointerEvents="none" style={WRAPPER_STYLE} zIndexRange={[20, 10]}>
      <div
        className="pointer-events-none flex gap-2 whitespace-nowrap"
        role="tooltip"
        style={bubbleStyle}
      >
        {showImage ? (
          <img
            alt={content.imageAlt ?? content.text ?? ""}
            className="block h-auto max-h-[120px] max-w-[220px] rounded object-contain"
            onError={() => setImageFailed(true)}
            src={content.image}
          />
        ) : null}
        {content.text ? (
          <p className="m-0 overflow-visible whitespace-nowrap leading-[1.4]">
            {content.text}
          </p>
        ) : null}
      </div>
    </PanoHtml>
  );
}
