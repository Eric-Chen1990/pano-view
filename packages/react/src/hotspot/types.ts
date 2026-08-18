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

/**
 * Pointer hit-testing for a hotspot. `"none"` ignores mouse, touch, and pen
 * so events pass through to the panorama. Defaults to `"auto"`.
 */
export type HotspotPointerEvents = "auto" | "none";

export function acceptsHotspotPointerEvents(
  interactive: boolean,
  pointerEvents: HotspotPointerEvents,
): boolean {
  switch (pointerEvents) {
    case "auto":
      return interactive;
    case "none":
      return false;
    default: {
      const exhaustive: never = pointerEvents;
      return exhaustive;
    }
  }
}

/** Where the tooltip sits relative to the hotspot. Defaults to `"top"`. */
export type HotspotTooltipPlacement = "top" | "bottom" | "left" | "right";

/** Plain-text and/or image content for a hotspot tooltip. */
export type HotspotTooltipContent = {
  text?: string;
  image?: string;
  imageAlt?: string;
};

/** Visual styling for a hotspot tooltip bubble. */
export type HotspotTooltipAppearance = {
  background?: string;
  color?: string;
  border?: string;
  borderRadius?: number | string;
  shadow?: string;
  padding?: number | string;
  fontSize?: number | string;
};

export type HotspotCommonProps = {
  id: string;
  position: HotspotPosition;
  /**
   * Tooltip shown at the hotspot anchor. A string is treated as `{ text }`.
   * Defaults to always visible when content is present.
   */
  tooltip?: string | HotspotTooltipContent;
  /** Defaults to `"always"`. `"hover"` and `"click"` require `interactive` and `pointerEvents` other than `"none"`. */
  tooltipTrigger?: HotspotTooltipTrigger;
  /** Screen direction for the tooltip. Defaults to `"top"`. */
  tooltipPlacement?: HotspotTooltipPlacement;
  /**
   * Screen-space gap in CSS pixels between the hotspot edge and the tooltip.
   * Defaults to 12.
   */
  tooltipOffset?: number;
  /** Optional bubble paint overrides. Unset fields use the library default theme. */
  tooltipAppearance?: HotspotTooltipAppearance;
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
   * Pointer hit-testing. `"none"` ignores mouse, touch, and pen so events
   * pass through to the panorama. Defaults to `"auto"`.
   * `interactive={false}` also disables pointer hits.
   */
  pointerEvents?: HotspotPointerEvents;
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
