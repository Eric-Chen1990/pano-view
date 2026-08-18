import type { CSSProperties, ReactNode } from "react";

export type WebVRMode = "webxr" | "mobilevr" | "fake";

export type WebVRProfileId =
  | "none"
  | "cardboard-v1"
  | "cardboard-v2"
  | "gear-vr"
  | "daydream";

export type WebVRProfile = {
  id?: string;
  label?: string;
  /** Vertical field of view for each eye, in degrees. */
  fov: number;
  /** Distance between the eyes, in millimetres. */
  ipdMm: number;
  /** Distance from the display to the headset lens, in millimetres. */
  screenToLensMm?: number;
  /** Radial lens distortion coefficients. Zero disables distortion. */
  k1: number;
  k2: number;
};

export type WebVRChromeAppearance = {
  background?: CSSProperties["background"];
  color?: CSSProperties["color"];
  accent?: CSSProperties["color"];
  borderRadius?: CSSProperties["borderRadius"];
  fontSize?: CSSProperties["fontSize"];
  setupTitle?: ReactNode;
};

export type WebVRChrome = boolean | WebVRChromeAppearance;

export type WebVRProps = {
  /** Mount the built-in Enter / Exit / Setup chrome. Defaults to true. */
  chrome?: WebVRChrome;
  /** Enable the phone stereoscopic fallback. Defaults to true. */
  mobileVr?: boolean;
  /** Treat desktop device-orientation sensors as MobileVR. Defaults to false. */
  desktopSupport?: boolean;
  /** Allow a mouse-driven stereoscopic desktop simulation. Defaults to true. */
  fakeSupport?: boolean;
  /** Physical diagonal screen size in inches, or automatic detection. */
  screensize?: number | "auto";
  /** Headset preset or a custom lens profile. */
  profile?: WebVRProfileId | WebVRProfile;
  /** Show a center reticle in VR. Defaults to true. */
  cursor?: boolean;
  /**
   * Milliseconds to keep looking at a hotspot before a gaze click.
   * Defaults to 1500. Set to 0 to disable auto-click.
   */
  cursorDwellMs?: number;
  /** Keep the display awake while a fallback session is active. Defaults to true. */
  wakelock?: boolean;
  /** Request pointer lock in simulated desktop VR. Defaults to true. */
  mousePointerLock?: boolean;
  onAvailable?: () => void;
  onUnavailable?: () => void;
  onEnterVR?: (mode: WebVRMode) => void;
  onExitVR?: (mode: WebVRMode) => void;
  onDenied?: (error?: unknown) => void;
  onUnknownDevice?: () => void;
};

export type WebVRHandle = {
  enterVR: () => Promise<boolean>;
  exitVR: () => Promise<void>;
  toggleVR: () => Promise<boolean>;
  isAvailable: () => boolean;
  isEnabled: () => boolean;
  getMode: () => WebVRMode | null;
  requestPermission: () => Promise<boolean>;
};

export type WebVRSettings = {
  screensize: number | "auto";
  profileId: WebVRProfileId;
};
