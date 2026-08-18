import { ParticleOverlay } from "./particle-overlay";
import type { OverlayProps } from "./overlay-utils";
import { SnapshotOverlay } from "./snapshot-overlay";

export function TransitionOverlay(props: OverlayProps) {
  const { preset } = props.transition;
  switch (preset) {
    case "none":
      return null;
    case "particles":
      return <ParticleOverlay {...props} />;
    case "crossfade":
    case "zoom":
    case "blackout":
    case "whiteFlash":
    case "slideRightToLeft":
    case "slideTopToBottom":
    case "slideDiagonal":
    case "circleOpen":
    case "verticalOpen":
    case "horizontalOpen":
    case "ellipticZoomOpen":
    case "pixelate":
    case "gridWipe":
    case "gridWipeUp":
    case "gridWipeRight":
    case "gridWipeDiagonal":
    case "gridWipeCenter":
    case "gridWipeChecker":
    case "dissolve":
    case "shatter":
    case "glitch":
    case "swirl":
    case "clockWipe":
    case "ripple":
    case "zoomBlur":
    case "hexDissolve":
    case "filmBurn":
      return <SnapshotOverlay {...props} />;
    default: {
      const exhaustive: never = preset;
      void exhaustive;
      return null;
    }
  }
}
