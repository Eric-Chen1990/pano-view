import type { CSSProperties, ReactNode } from "react";

export type PanoOverlayToggleState = {
  collapsed: boolean;
};

/**
 * Icon and chrome for an overlay edge tab.
 * Omit `icon` to keep the default chevron. Pass an element (`<Icon />`), not a
 * component type. A function receives `{ collapsed }` and returns the icon for
 * that state. `style` overrides background, border, color, and size. Position
 * and `transform` stay with the edge layout.
 */
export type PanoOverlayToggle = {
  icon?: ReactNode | ((state: PanoOverlayToggleState) => ReactNode);
  className?: string;
  style?: CSSProperties;
};

/** Custom edge-tab icon, or `undefined` when `icon` was omitted. */
export function resolveOverlayToggleIcon(
  icon: PanoOverlayToggle["icon"],
  collapsed: boolean,
): ReactNode | undefined {
  if (icon === undefined) return undefined;
  if (typeof icon === "function") return icon({ collapsed });
  return icon;
}
