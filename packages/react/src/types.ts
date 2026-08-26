import type { BackgroundAudioController } from "./background-audio-host";
import type { KeyboardControlsProps } from "./keyboard-controls";
import type { HotspotPosition } from "./hotspot/types";
import type { PanoVideoController } from "./video/types";
import type { WebVRMode } from "./webvr/types";

export type PanoViewerState = {
  /** Horizontal look angle in degrees. Positive values look right. */
  yaw: number;
  /** Vertical look angle in degrees. Positive values look up. */
  pitch: number;
  /** Vertical perspective field of view in degrees. */
  fov: number;
};

export type SetPanoViewerOptions = {
  /** Apply the new view immediately instead of preserving current inertia. */
  immediate?: boolean;
};

/** Built-in interpolation curves for imperative panorama navigation. */
export type PanoViewEasing = "linear" | "easeInOutCubic";

/** Common options for timed imperative panorama navigation. */
export type PanoViewNavigationOptions = {
  /** Animation time in milliseconds. Defaults to 700. Pass 0 to apply immediately. */
  duration?: number;
  /** Interpolation curve. Defaults to "easeInOutCubic". */
  easing?: PanoViewEasing;
  /** Whether yaw crosses the ±180° seam through the shorter path. Defaults to true. */
  shortestPath?: boolean;
};

/** Navigation options that may also change the field of view. */
export type PanoViewLookToOptions = PanoViewNavigationOptions & {
  /** Target vertical field of view in degrees. Omit to preserve the current FOV. */
  fov?: number;
};

export type PanoViewNavigationResult = {
  status: "completed" | "cancelled" | "not-found";
};

export type PanoViewerHandle = {
  // -- View --
  getView: () => PanoViewerState;
  setView: (
    view: Partial<PanoViewerState>,
    options?: SetPanoViewerOptions,
  ) => void;
  reset: () => void;
  /** Animate to a yaw/pitch position, optionally changing FOV. */
  lookTo: (
    position: HotspotPosition,
    options?: PanoViewLookToOptions,
  ) => Promise<PanoViewNavigationResult>;
  /** Animate yaw and pitch while preserving the current FOV. */
  moveTo: (
    position: HotspotPosition,
    options?: PanoViewNavigationOptions,
  ) => Promise<PanoViewNavigationResult>;
  /** Animate FOV while preserving the current yaw and pitch. */
  zoomTo: (
    fov: number,
    options?: Omit<PanoViewNavigationOptions, "shortestPath">,
  ) => Promise<PanoViewNavigationResult>;
  /** Animate to the representative position of a mounted hotspot. */
  lookToHotspot: (
    id: string,
    options?: PanoViewLookToOptions,
  ) => Promise<PanoViewNavigationResult>;

  /** Runs the same first-interaction media activation used by PanoViewer. */
  activateMedia: () => Promise<void>;

  // -- Fullscreen --
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  isFullscreen: () => boolean;

  // -- Scenes (no-op / null without <Scenes />) --
  setScene: (id: string) => boolean;
  nextScene: () => boolean;
  previousScene: () => boolean;
  getActiveSceneId: () => string | null;
  getSceneIds: () => readonly string[];
  isSceneTransitioning: () => boolean;

  // -- WebVR (no-op / false / null without <WebVR />) --
  enterVR: () => Promise<boolean>;
  exitVR: () => Promise<void>;
  toggleVR: () => Promise<boolean>;
  isVRAvailable: () => boolean;
  isVREnabled: () => boolean;
  getVRMode: () => WebVRMode | null;
  requestVRPermission: () => Promise<boolean>;

  // -- Video (no-op / null without <PanoVideo />) --
  getVideo: () => PanoVideoController | null;
  subscribeVideo: (onStoreChange: () => void) => () => void;
  playVideo: () => Promise<void>;
  pauseVideo: () => void;
  toggleVideo: () => void;
  seekVideo: (time: number) => void;
  setVideoVolume: (volume: number) => void;
  setVideoMuted: (muted: boolean) => void;
  toggleVideoMuted: () => void;

  // -- Background Audio (no-op / null without <BackgroundAudio />) --
  getBackgroundAudio: () => BackgroundAudioController | null;
  subscribeBackgroundAudio: (onStoreChange: () => void) => () => void;
  playBackgroundAudio: () => Promise<void>;
  pauseBackgroundAudio: () => void;
  toggleBackgroundAudio: () => void;
  setBackgroundAudioVolume: (volume: number) => void;
  setBackgroundAudioMuted: (muted: boolean) => void;
  toggleBackgroundAudioMuted: () => void;

  /** @deprecated Control an AutoRotate component's enabled prop instead. */
  startAutoRotate: () => void;
  /** @deprecated Control an AutoRotate component's enabled prop instead. */
  stopAutoRotate: () => void;
};

export type MouseControlButton = "left" | "middle" | "right";

/** Options for the default mouse control channel (also MouseControls props). */
export type MouseControlsOptions = {
  /** Whether mouse handling is active. Defaults to true. */
  enabled?: boolean;
  /** Pointer drag multiplier. Defaults to 0.35. */
  rotateSpeed?: number;
  /** Wheel zoom multiplier. Defaults to 0.08. */
  zoomSpeed?: number;
  /** Whether mouse-wheel zoom is enabled. Defaults to true. */
  wheel?: boolean;
  /** Inverts drag direction. Defaults to the all-mode `invert` value. */
  invert?: boolean;
  /** Mouse buttons that may drag the panorama. Defaults to `["left"]`. */
  buttons?: readonly MouseControlButton[];
};

/** Options for the default touch control channel (also TouchControls props). */
export type TouchControlsOptions = {
  /** Whether touch handling is active. Defaults to true. */
  enabled?: boolean;
  /** Pointer drag multiplier. Defaults to 0.35. */
  rotateSpeed?: number;
  /** Inverts drag direction. Defaults to the all-mode `invert` value. */
  invert?: boolean;
  /** Whether two-finger pinch zoom is enabled. Defaults to true. */
  pinchZoom?: boolean;
};

export type PanoramaControlsOptions = {
  /**
   * Master switch for user view controls. Defaults to true. Setting
   * `controls={false}` on PanoViewer still disables all user input.
   */
  enabled?: boolean;
  /** Enables drag and zoom inertia. Defaults to true. */
  inertia?: boolean;
  /** @deprecated Render <AutoRotate enabled /> inside PanoViewer instead. */
  autoRotate?: boolean;
  /** @deprecated Use AutoRotate's speed prop instead. */
  autoRotateSpeed?: number;
  /**
   * Inverts drag/pan direction for mouse and touch. Defaults to false.
   * Per-channel `invert` on MouseControls / TouchControls overrides this.
   */
  invert?: boolean;
  /**
   * Allows pitch and FOV to briefly overshoot hard limits while dragging,
   * then spring back on release. Defaults to false.
   */
  bouncingLimits?: boolean;
  /**
   * Maximum FOV change rate in degrees per second for wheel and keyboard
   * zoom. When omitted, no extra rate cap is applied.
   */
  fovSpeed?: number;
  /**
   * Relative factor for stopping inertia. Lower values fade out more
   * smoothly. Defaults to 0.01.
   */
  frictionStop?: number;
  /**
   * Default pointer drag multiplier for mouse and touch. Defaults to 0.35.
   * Prefer `controls.mouse` / `controls.touch` for per-channel overrides.
   */
  rotateSpeed?: number;
  /**
   * Default wheel zoom multiplier for mouse. Defaults to 0.08.
   * Prefer `controls.mouse.zoomSpeed` for overrides.
   */
  zoomSpeed?: number;
  /**
   * Rotation target-following speed in seconds^-1. Defaults to 14; use 0 for
   * immediate response. Must be a non-negative finite number.
   */
  rotateDamping?: number;
  /**
   * FOV target-following speed in seconds^-1. Defaults to 16; use 0 for
   * immediate response. Must be a non-negative finite number.
   */
  zoomDamping?: number;
  /**
   * Mouse channel. `true` / omit mounts defaults; `false` disables the
   * default instance; an object merges with defaults and supports `enabled`.
   * Rendering `<MouseControls />` as a child also replaces the default.
   */
  mouse?: boolean | MouseControlsOptions;
  /**
   * Touch channel. Same shape as `mouse`.
   */
  touch?: boolean | TouchControlsOptions;
  /**
   * Keyboard channel. Same shape as `mouse`. Rendering `<KeyboardControls />`
   * as a child replaces the default (no need to set this to false).
   */
  keyboard?: boolean | KeyboardControlsProps;
};
