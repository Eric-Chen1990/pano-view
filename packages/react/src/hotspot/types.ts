export const MAX_HOTSPOT_PITCH = 89.9;

export type HotspotPosition = {
  /** Horizontal panorama angle in degrees. Positive values look right. */
  yaw: number;
  /** Vertical panorama angle in degrees. Positive values look up. */
  pitch: number;
};

export type HotspotOrientation = "billboard" | "surface";

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
  orientation?: HotspotOrientation;
  /** Clockwise rotation around the hotspot normal in degrees. */
  rotation?: number;
  opacity?: number;
  renderOrder?: number;
  visible?: boolean;
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
