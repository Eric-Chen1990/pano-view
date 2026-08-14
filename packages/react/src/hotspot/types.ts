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

export type PanoramaPointerEvent = {
  position: HotspotPosition;
  nativeEvent: MouseEvent | PointerEvent;
  pointerId?: number;
  button: number;
  buttons: number;
  clientX: number;
  clientY: number;
};
