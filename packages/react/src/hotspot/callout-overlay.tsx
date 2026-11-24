import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { PanoHtml } from "../webvr/stereo-html";
import {
  calloutAccentContentGap,
  calloutAccentShiftX,
  calloutTitleBodyGap,
  calloutTitlePaddingY,
  resolveCalloutAppearance,
  resolveCalloutLayout,
  resolveCalloutLine,
  type CalloutAppearance,
  type CalloutContent,
  type CalloutLine,
  type CalloutRevealProgress,
} from "./callout-layout";

const WRAPPER_STYLE: CSSProperties = {
  pointerEvents: "none",
};

function applyRevealStyles(
  line: SVGLineElement | null,
  card: HTMLElement | null,
  accent: HTMLElement | null,
  progress: CalloutRevealProgress,
  layoutLength: number,
  expandFrom: "left" | "right",
) {
  if (line) {
    const length = Math.max(1, layoutLength);
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length * (1 - progress.lineProgress)}`;
    line.style.opacity = progress.lineProgress > 0 ? "1" : "0";
  }
  if (accent) {
    accent.style.opacity = String(progress.lineProgress);
  }
  if (card) {
    const t = progress.contentProgress;
    card.style.opacity = String(t);
    if (t >= 1) {
      card.style.clipPath = "none";
    } else {
      const hidden = ((1 - t) * 100).toFixed(2);
      card.style.clipPath =
        expandFrom === "left"
          ? `inset(0 ${hidden}% 0 0)`
          : `inset(0 0 0 ${hidden}%)`;
    }
  }
}

export function CalloutOverlay({
  content,
  line,
  appearance,
  progress,
}: {
  content: CalloutContent;
  line?: CalloutLine;
  appearance?: CalloutAppearance;
  progress: RefObject<CalloutRevealProgress>;
}) {
  const resolvedLine = useMemo(() => resolveCalloutLine(line), [line]);
  const resolvedAppearance = useMemo(
    () => resolveCalloutAppearance(appearance, resolvedLine.color),
    [appearance, resolvedLine.color],
  );
  const layout = useMemo(
    () => resolveCalloutLayout(resolvedLine.angle, resolvedLine.length),
    [resolvedLine.angle, resolvedLine.length],
  );
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [content.image]);
  const showImage = Boolean(content.image) && !imageFailed;
  const lineRef = useRef<SVGLineElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const accentRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const expandFrom = layout.card.horizontal === "right" ? "left" : "right";
  const accentWidth = Math.max(1, resolvedLine.width);
  const accentShiftX = calloutAccentShiftX(
    layout.angle,
    accentWidth,
    layout.card.horizontal,
  );

  useLayoutEffect(() => {
    applyRevealStyles(
      lineRef.current,
      cardRef.current,
      accentRef.current,
      progress.current ?? { lineProgress: 0, contentProgress: 0 },
      layout.length,
      expandFrom,
    );
  });

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      applyRevealStyles(
        lineRef.current,
        cardRef.current,
        accentRef.current,
        progress.current ?? { lineProgress: 0, contentProgress: 0 },
        layout.length,
        expandFrom,
      );
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [expandFrom, layout.length, progress]);

  const titlePaddingY = calloutTitlePaddingY(resolvedAppearance.padding);
  const titleBodyGap = calloutTitleBodyGap(resolvedAppearance.padding);
  const accentContentGap = calloutAccentContentGap(resolvedAppearance.padding);
  const hasBody = Boolean(content.text) || showImage;
  const cardStyle: CSSProperties = {
    width: resolvedAppearance.width,
    color: resolvedAppearance.color,
    fontSize: resolvedAppearance.fontSize,
    fontFamily: resolvedAppearance.fontFamily,
    lineHeight: 1.45,
    padding: resolvedAppearance.padding,
    borderRadius: resolvedAppearance.borderRadius,
    background: resolvedAppearance.background,
  };

  const cardPositionStyle: CSSProperties = {
    left: layout.endX + accentShiftX,
    top: -layout.endY,
    transform: [
      layout.card.horizontal === "right" ? "translateX(0)" : "translateX(-100%)",
      layout.card.vertical === "end"
        ? "translateY(-100%)"
        : layout.card.vertical === "start"
          ? "translateY(0)"
          : "translateY(-50%)",
    ].join(" "),
  };

  const accentOnLeft = layout.card.horizontal === "right";

  return (
    <PanoHtml
      mode="billboard"
      scaleMode="fixed"
      pointerEvents="none"
      style={WRAPPER_STYLE}
      zIndexRange={[30, 20]}
    >
      <div
        ref={rootRef}
        className="pano-callout"
        style={{ width: 0, height: 0, position: "relative" }}
      >
        <svg
          className="pano-callout-line"
          aria-hidden="true"
          overflow="visible"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            overflow: "visible",
            pointerEvents: "none",
          }}
          width={1}
          height={1}
        >
          <line
            ref={lineRef}
            x1={0}
            y1={0}
            x2={layout.endX}
            y2={-layout.endY}
            stroke={resolvedLine.color}
            strokeWidth={resolvedLine.width}
            strokeLinecap="round"
          />
        </svg>
        <div
          className="pano-callout-panel"
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: accentOnLeft ? "row" : "row-reverse",
            alignItems: "stretch",
            gap: accentContentGap,
            ...cardPositionStyle,
          }}
        >
          <div
            ref={accentRef}
            className="pano-callout-accent"
            aria-hidden="true"
            style={{
              width: accentWidth,
              background: resolvedAppearance.accentColor,
              flex: "0 0 auto",
              alignSelf: "stretch",
            }}
          />
          <div
            ref={cardRef}
            className="pano-callout-card"
            role="tooltip"
            style={cardStyle}
          >
            {content.title ? (
              <div
                className="pano-callout-title"
                style={{
                  background: resolvedAppearance.titleBackground,
                  color: resolvedAppearance.titleColor,
                  margin: `-${resolvedAppearance.padding}px -${resolvedAppearance.padding}px ${hasBody ? titleBodyGap : 0}px`,
                  padding: `${titlePaddingY}px ${resolvedAppearance.padding}px`,
                  fontSize: resolvedAppearance.titleFontSize,
                  fontWeight: 700,
                  lineHeight: 1.25,
                }}
              >
                {content.title}
              </div>
            ) : null}
            {showImage ? (
              <img
                alt={content.imageAlt ?? content.title ?? content.text ?? ""}
                className="pano-callout-image"
                onError={() => setImageFailed(true)}
                src={content.image}
              />
            ) : null}
            {content.text ? (
              <p className="pano-callout-text">{content.text}</p>
            ) : null}
          </div>
        </div>
      </div>
    </PanoHtml>
  );
}
