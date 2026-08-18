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

function resolveAppearance(
  appearance: PanoVideoCaptionAppearance | undefined,
): Required<PanoVideoCaptionAppearance> {
  return {
    ...DEFAULT_PANO_VIDEO_CAPTION_APPEARANCE,
    ...appearance,
  };
}

export function PanoVideoCaptionsOverlay({
  appearance,
  controller,
}: {
  appearance?: PanoVideoCaptionAppearance;
  controller: PanoVideoController;
}) {
  const captionText = useSyncExternalStore(
    controller.subscribe,
    () => controller.getSnapshot().captionText,
    () => controller.getSnapshot().captionText,
  );

  if (!captionText) {
    return null;
  }

  const resolved = resolveAppearance(appearance);
  const style: CSSProperties = {
    background: resolved.background,
    borderRadius: resolved.borderRadius,
    bottom: resolved.bottom,
    color: resolved.color,
    fontFamily: resolved.fontFamily,
    fontSize: resolved.fontSize,
    fontWeight: resolved.fontWeight,
    left: "50%",
    lineHeight: resolved.lineHeight,
    maxWidth: resolved.maxWidth,
    padding: resolved.padding,
    pointerEvents: "none",
    position: "absolute",
    textAlign: "center",
    textShadow: resolved.textShadow,
    transform: "translateX(-50%)",
    whiteSpace: "pre-wrap",
    zIndex: 1,
  };

  return (
    <div data-pano-video-captions="" style={style}>
      {captionText}
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
