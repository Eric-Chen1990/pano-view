export type PanoViewState = {
  /** Horizontal look angle in degrees. Positive values look right. */
  yaw: number;
  /** Vertical look angle in degrees. Positive values look up. */
  pitch: number;
  /** Vertical perspective field of view in degrees. */
  fov: number;
};

export type SetPanoViewOptions = {
  /** Apply the new view immediately instead of preserving current inertia. */
  immediate?: boolean;
};

export type PanoViewHandle = {
  getView: () => PanoViewState;
  setView: (
    view: Partial<PanoViewState>,
    options?: SetPanoViewOptions,
  ) => void;
  reset: () => void;
  /** @deprecated Control an AutoRotate component's enabled prop instead. */
  startAutoRotate: () => void;
  /** @deprecated Control an AutoRotate component's enabled prop instead. */
  stopAutoRotate: () => void;
  toggleFullscreen: () => Promise<void>;
};

export type PanoramaControlsOptions = {
  /** Enables drag and zoom inertia. Defaults to true. */
  inertia?: boolean;
  /** @deprecated Render <AutoRotate enabled /> inside PanoView instead. */
  autoRotate?: boolean;
  /** @deprecated Use AutoRotate's speed prop instead. */
  autoRotateSpeed?: number;
  /** Pointer drag multiplier. Defaults to 0.35. */
  rotateSpeed?: number;
  /** Wheel zoom multiplier. Defaults to 0.08. */
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
   * Renders the default KeyboardControls instance. Defaults to true. Set to
   * false when providing a custom KeyboardControls child.
   */
  keyboard?: boolean;
};
