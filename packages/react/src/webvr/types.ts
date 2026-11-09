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
  /**
   * Distance from the headset tray bottom to the lens center, in millimetres.
   * `0` or omitted keeps the optical axis on the vertical screen center.
   */
  trayDistanceMm?: number;
  /** Radial lens distortion coefficients. Zero disables distortion. */
  k1: number;
  k2: number;
};

/** Target WebXR session refresh rate. Omitting keeps the store default (`"high"`). */
export type WebVRFrameRate = "low" | "mid" | "high" | number;

export type WebVRChromeAppearance = {
  background?: CSSProperties["background"];
  color?: CSSProperties["color"];
  accent?: CSSProperties["color"];
  borderRadius?: CSSProperties["borderRadius"];
  fontSize?: CSSProperties["fontSize"];
  setupTitle?: ReactNode;
};

export type WebVRChrome = boolean | WebVRChromeAppearance;

export type WebVRState = {
  available: boolean;
  enabled: boolean;
  mode: WebVRMode | null;
};

export type WebVRProps = {
  /**
   * Mount the built-in session chrome (Exit VR / MobileVR Setup). Defaults to
   * true. Enter VR is not rendered; host apps drive entry through the handle
   * or `usePanoViewer`.
   */
  chrome?: WebVRChrome;
  /** Enable the phone stereoscopic fallback. Defaults to true. */
  mobileVr?: boolean;
  /** Treat desktop device-orientation sensors as MobileVR. Defaults to false. */
  desktopSupport?: boolean;
  /** Allow a mouse-driven stereoscopic desktop simulation. Defaults to true. */
  fakeSupport?: boolean;
  /** Physical diagonal screen size in inches, or automatic detection. */
  screensize?: number | "auto";
  /**
   * Cardboard Device Parameter Database URL used when `screensize` is
   * `"auto"`. Defaults to Google's public DPDB. Pass `""` or `null` to skip
   * the online lookup for unknown devices.
   */
  databaseUrl?: string | null;
  /** Headset preset or a custom lens profile. */
  profile?: WebVRProfileId | WebVRProfile;
  /**
   * Follow compass-oriented headings in MobileVR. Defaults to false.
   * Has no effect in WebXR sessions.
   */
  absolute?: boolean;
  /** Panorama yaw that represents North when `absolute` is enabled. Defaults to 0. */
  north?: number;
  /**
   * Gyro smoothing from 0 (none) to 0.99 (strong). Defaults to 0.
   * Keep at 0 for normal viewing.
   */
  friction?: number;
  /**
   * Allow horizontal touch dragging to correct MobileVR heading. Defaults to
   * false because headset trays can trigger false touches.
   */
  touchSupport?: boolean;
  /**
   * Distortion / WebXR framebuffer scale factor. Defaults to 1. Clamped to
   * 0.5–2. Must be set before entering WebXR (cannot change mid-session).
   */
  oversampling?: number;
  /**
   * WebXR fixed foveation in the range 0–1. Omit to keep the device default.
   * `0` is full resolution; `1` is maximum edge downsampling.
   */
  foveation?: number;
  /**
   * Target WebXR refresh rate. Omit to keep the store default (`"high"`).
   * A numeric Hz picks the closest rate from `session.supportedFrameRates`.
   */
  frameRate?: WebVRFrameRate;
  /** Show a center reticle in VR. Defaults to true. */
  cursor?: boolean;
  /**
   * Milliseconds to keep looking at a hotspot before a gaze click.
   * Defaults to 1500. Set to 0 to disable auto-click.
   */
  cursorDwellMs?: number;
  /**
   * Keep the display awake while MobileVR or simulated VR is active.
   * Uses the Screen Wake Lock API when available, otherwise a looping
   * hidden video. Defaults to true.
   */
  wakelock?: boolean;
  /**
   * Lock the mouse in simulated desktop VR so movement looks around with
   * no visible cursor. Right-click to release; left-click the view to re-lock.
   * While unlocked, the reticle and gaze actions are paused. Defaults to true.
   */
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
  getState: () => WebVRState;
  subscribe: (onStoreChange: () => void) => () => void;
  requestPermission: () => Promise<boolean>;
  /** Reset the active fallback mode, or both modes outside VR; explicit props still apply. */
  resetSettings: () => void;
};

export type WebVRSettings = {
  screensize: number | "auto";
  profileId: WebVRProfileId;
};
