import type { KeyboardControlsProps } from "./keyboard-controls";

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

export type PanoViewerHandle = {
  getView: () => PanoViewerState;
  setView: (
    view: Partial<PanoViewerState>,
    options?: SetPanoViewerOptions,
  ) => void;
  reset: () => void;
  /** @deprecated Control an AutoRotate component's enabled prop instead. */
  startAutoRotate: () => void;
  /** @deprecated Control an AutoRotate component's enabled prop instead. */
  stopAutoRotate: () => void;
  toggleFullscreen: () => Promise<void>;
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
