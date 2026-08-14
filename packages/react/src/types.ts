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
  startAutoRotate: () => void;
  stopAutoRotate: () => void;
  toggleFullscreen: () => Promise<void>;
};

export type PanoramaControlsOptions = {
  /** Enables drag and zoom inertia. Defaults to true. */
  inertia?: boolean;
  /** Starts automatic horizontal rotation. Defaults to false. */
  autoRotate?: boolean;
  /** Automatic rotation speed in degrees per second. Defaults to 18. */
  autoRotateSpeed?: number;
  /** Pointer drag multiplier. Defaults to 0.35. */
  rotateSpeed?: number;
  /** Wheel zoom multiplier. Defaults to 0.08. */
  zoomSpeed?: number;
  /** Enables focusable keyboard controls. Defaults to true. */
  keyboard?: boolean;
};
