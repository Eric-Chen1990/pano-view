import type { CSSProperties } from "react";

export const MAX_HOTSPOT_PITCH = 90;

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

/** When a hotspot tooltip is shown. Defaults to `"always"`. */
export type HotspotTooltipTrigger = "always" | "hover" | "click";

/** Where the tooltip sits relative to the hotspot. Defaults to `"top"`. */
export type HotspotTooltipPlacement = "top" | "bottom" | "left" | "right";

/** Plain-text and/or image content for a hotspot tooltip. */
export type HotspotTooltipContent = {
  text?: string;
  image?: string;
  imageAlt?: string;
};

export type HotspotCommonProps = {
  id: string;
  position: HotspotPosition;
  /**
   * Tooltip shown at the hotspot anchor. A string is treated as `{ text }`.
   * Defaults to always visible when content is present.
   */
  tooltip?: string | HotspotTooltipContent;
  /** Defaults to `"always"`. `"hover"` and `"click"` require `interactive`. */
  tooltipTrigger?: HotspotTooltipTrigger;
  /** Defaults to `"top"`. */
  tooltipPlacement?: HotspotTooltipPlacement;
  /**
   * Screen-space gap in CSS pixels between the hotspot edge and the tooltip.
   * Defaults to 12.
   */
  tooltipOffset?: number;
  /** Angular width in degrees. Defaults to 12. */
  width?: number;
  /** Angular height in degrees. Defaults to 8. */
  height?: number;
  /** Overall multiplier for the hotspot's angular width and height. Defaults to 1. */
  scale?: number;
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
  /**
   * Canvas cursor while this hotspot is hovered. Defaults to the viewer's
   * `cursors.hotspot` value (`"pointer"`).
   */
  cursor?: CSSProperties["cursor"];
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
