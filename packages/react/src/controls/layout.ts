/** Same centered, wrapping rows as the DOM flex control group. */
export const CONTROL_GROUP_DEFAULTS = { size: 48, gap: 8, padding: 8 };
export function controlGroupLayout(count: number, width: number, size = CONTROL_GROUP_DEFAULTS.size, gap = CONTROL_GROUP_DEFAULTS.gap, padding = CONTROL_GROUP_DEFAULTS.padding) {
  size = Math.max(1, size); gap = Math.max(0, gap); padding = Math.max(0, padding);
  const columns = Math.max(1, Math.floor((width - 2 * padding + gap) / (size + gap)));
  const rows = Math.ceil(count / columns);
  return { height: count ? rows * size + Math.max(0, rows - 1) * gap + 2 * padding : 0,
    buttons: Array.from({ length: count }, (_, i) => {
      const row = Math.floor(i / columns), items = Math.min(columns, count - row * columns);
      return { x: (width - items * size - (items - 1) * gap) / 2 + (i % columns) * (size + gap), y: padding + row * (size + gap), w: size, h: size };
    }) };
}
export function allowsAutomaticMediaControls(media: Pick<HTMLElement, "getAttribute">) {
  return media.getAttribute("data-pano-media-controls") !== "none";
}

/** Only pause media when its dialog actually closes, not when VR presentation ends. */
export function shouldPauseSurfaceMedia(connected: boolean, registered: boolean) { return !connected || !registered; }
