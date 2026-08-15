export const MAX_HOTSPOT_PITCH = 89.9;

export type HotspotPosition = {
  /** Horizontal panorama angle in degrees. Positive values look right. */
  yaw: number;
  /** Vertical panorama angle in degrees. Positive values look up. */
  pitch: number;
};

/**
 * A safe point-hotspot rendering mode.
 *
 * `surface` attaches the visual to the panorama shell. `billboard` floats it
 * in front of the shell and keeps it facing the camera.
 */
export type HotspotMode = "surface" | "billboard";

/** Whether a hotspot grows with panorama zoom or preserves its screen size. */
export type HotspotScaleMode = "fov" | "fixed";

export type HotspotInputSource = "pointer" | "keyboard";

export type HotspotInteractionEvent = {
  id: string;
  position: HotspotPosition;
  source: HotspotInputSource;
  nativeEvent: MouseEvent | PointerEvent | KeyboardEvent;
};

export type HotspotDragEvent = HotspotInteractionEvent & {
  source: "pointer";
  startPosition: HotspotPosition;
};

export type HotspotCommonProps = {
  id: string;
  position: HotspotPosition;
  /** Angular width in degrees. Defaults to 12. */
  width?: number;
  /** Angular height in degrees. Defaults to 8. */
  height?: number;
  /** Defaults to "billboard". */
  mode?: HotspotMode;
  /**
   * World-space distance for `mode="billboard"`. Defaults to 10 and is capped
   * when needed so the full hotspot remains inside the panorama shell.
   */
  distance?: number;
  /** FOV grows/shrinks with zoom; fixed preserves the reference screen size. */
  scaleMode?: HotspotScaleMode;
  /** Reference FOV in degrees used when scaleMode is "fixed". Defaults to 75. */
  referenceFov?: number;
  /** Clockwise rotation around the hotspot normal in degrees. */
  rotation?: number;
  opacity?: number;
  renderOrder?: number;
  visible?: boolean;
  /** Whether the hotspot accepts pointer and keyboard interaction. Defaults to true. */
  interactive?: boolean;
  draggable?: boolean;
  /** Required for keyboard-accessible clickable hotspots. */
  ariaLabel?: string;
  onClick?: (event: HotspotInteractionEvent) => void;
  onHoverChange?: (hovered: boolean, event: HotspotInteractionEvent) => void;
  onDragStart?: (event: HotspotDragEvent) => void;
  onPositionChange?: (event: HotspotDragEvent) => void;
  onDragEnd?: (event: HotspotDragEvent) => void;
};

export type PanoramaPointerEvent = {
  position: HotspotPosition;
  nativeEvent: MouseEvent | PointerEvent;
  pointerId?: number;
  button: number;
  buttons: number;
  clientX: number;
  clientY: number;
};
