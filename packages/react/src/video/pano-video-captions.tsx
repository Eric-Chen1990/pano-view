import { useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import type { PanoVideoCaptionAppearance, PanoVideoController } from "./types";

export const DEFAULT_PANO_VIDEO_CAPTION_APPEARANCE: Required<PanoVideoCaptionAppearance> =
  {
    color: "#ffffff",
    background: "rgba(0, 0, 0, 0.55)",
    fontSize: 16,
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    fontWeight: 500,
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
    padding: "6px 10px",
    borderRadius: 6,
    maxWidth: "72%",
    bottom: 72,
    lineHeight: 1.35,
  };

export function resolvePanoVideoCaptionAppearance(
  appearance: PanoVideoCaptionAppearance | undefined,
): Required<PanoVideoCaptionAppearance> {
  return {
    ...DEFAULT_PANO_VIDEO_CAPTION_APPEARANCE,
    ...appearance,
  };
}

export function PanoVideoCaptionsOverlay({
  controller,
}: {
  controller: PanoVideoController;
}) {
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );

  if (!snapshot.captionText) {
    return null;
  }

  const wrapperStyle: CSSProperties = {
    bottom: snapshot.captionAppearance.bottom,
    display: "flex",
    justifyContent: "center",
    left: 0,
    pointerEvents: "none",
    position: "absolute",
    right: 0,
    zIndex: 1,
  };

  const textStyle: CSSProperties = {
    background: snapshot.captionAppearance.background,
    borderRadius: snapshot.captionAppearance.borderRadius,
    color: snapshot.captionAppearance.color,
    fontFamily: snapshot.captionAppearance.fontFamily,
    fontSize: snapshot.captionAppearance.fontSize,
    fontWeight: snapshot.captionAppearance.fontWeight,
    lineHeight: snapshot.captionAppearance.lineHeight,
    maxWidth: snapshot.captionAppearance.maxWidth,
    padding: snapshot.captionAppearance.padding,
    textAlign: "center",
    textShadow: snapshot.captionAppearance.textShadow,
    whiteSpace: "pre-wrap",
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-1 flex justify-center"
      data-pano-video-captions=""
      style={wrapperStyle}
    >
      <div style={textStyle}>{snapshot.captionText}</div>
    </div>
  );
}

/** Marker inside the R3F tree; captions render in the viewer chrome overlay. */
export function PanoVideoCaptions({
  appearance: _appearance,
}: {
  appearance?: PanoVideoCaptionAppearance;
}) {
  return null;
}
