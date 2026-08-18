import type { WebVRChromeAppearance } from "./types";

export const DEFAULT_WEBVR_CHROME_APPEARANCE: Required<
  Omit<WebVRChromeAppearance, "setupTitle">
> = {
  background: "rgba(16, 24, 32, 0.78)",
  color: "#ffffff",
  accent: "#7dd3fc",
  borderRadius: 6,
  fontSize: 14,
};
