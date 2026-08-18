import { Html } from "@react-three/drei";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { HotspotTooltipContent, HotspotTooltipPlacement } from "./types";

const TOOLTIP_MAX_WIDTH = 220;
const TOOLTIP_IMAGE_MAX_HEIGHT = 120;

export const DEFAULT_HOTSPOT_TOOLTIP_OFFSET = 12;

const WRAPPER_STYLE: CSSProperties = {
  pointerEvents: "none",
};

const BUBBLE_STYLE: CSSProperties = {
  background: "rgba(22, 22, 22, 0.72)",
  border: "1px solid rgba(46, 46, 46, 0.7)",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
  boxSizing: "border-box",
  color: "#f5fbfc",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 8,
  pointerEvents: "none",
  whiteSpace: "nowrap",
};

const IMAGE_STYLE: CSSProperties = {
  borderRadius: 4,
  display: "block",
  height: "auto",
  maxHeight: TOOLTIP_IMAGE_MAX_HEIGHT,
  maxWidth: TOOLTIP_MAX_WIDTH,
  objectFit: "contain",
};

const TEXT_STYLE: CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  fontSize: 12,
  lineHeight: 1.4,
  margin: 0,
  overflow: "visible",
  whiteSpace: "nowrap",
};

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
}: {
  content: HotspotTooltipContent;
  placement?: HotspotTooltipPlacement;
  offset?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [content.image]);
  const showImage = Boolean(content.image) && !imageFailed;
  const bubbleStyle = useMemo(
    (): CSSProperties => ({
      ...BUBBLE_STYLE,
      transform: tooltipBubbleTransform(
        placement,
        resolveHotspotTooltipOffset(offset),
      ),
    }),
    [offset, placement],
  );
  if (!showImage && !content.text) {
    return null;
  }

  return (
    <Html pointerEvents="none" style={WRAPPER_STYLE} zIndexRange={[20, 10]}>
      <div role="tooltip" style={bubbleStyle}>
        {showImage ? (
          <img
            alt={content.imageAlt ?? content.text ?? ""}
            onError={() => setImageFailed(true)}
            src={content.image}
            style={IMAGE_STYLE}
          />
        ) : null}
        {content.text ? <p style={TEXT_STYLE}>{content.text}</p> : null}
      </div>
    </Html>
  );
}
