import { scrollActions } from "../controls/actions";
import type { GazeAction } from "./gaze-action";
export type ScrollBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type ScrollEdge = {
  icon: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  action: GazeAction;
};
const identities = new WeakMap<HTMLElement, Map<string, object>>();
/** Edge positions use the clipped viewport, never the scrollable content height. */
export function scrollEdges(
  target: HTMLElement,
  bounds: ScrollBounds,
  invalidate: () => void
): ScrollEdge[] {
  if (bounds.width < 48 || bounds.height < 96) return [];
  let ids = identities.get(target);
  if (!ids) {
    ids = new Map();
    identities.set(target, ids);
  }
  return scrollActions(target)
    .filter((action) => action.enabled?.() !== false)
    .map((action) => {
      let id = ids!.get(action.id);
      if (!id) {
        id = { target, direction: action.id };
        ids!.set(action.id, id);
      }
      const vertical = action.id === "up" || action.id === "down";
      const w = vertical ? Math.min(112, bounds.width - 12) : 44;
      const h = 44;
      return {
        icon: action.id,
        label: action.label,
        x: vertical
          ? bounds.x + (bounds.width - w) / 2
          : action.id === "left"
          ? bounds.x + 6
          : bounds.x + bounds.width - w - 6,
        y: vertical
          ? action.id === "up"
            ? bounds.y + 6
            : bounds.y + bounds.height - h - 6
          : bounds.y + (bounds.height - h) / 2,
        w,
        h,
        action: {
          id,
          repeatIntervalMs: action.repeatIntervalMs,
          enabled: () =>
            target.isConnected !== false && action.enabled?.() !== false,
          update: (dt) => {
            action.update?.(dt);
            invalidate();
          },
        },
      };
    });
}
export function scrollViewportBounds(
  root: HTMLElement,
  target: HTMLElement,
  maxHeight: number
): ScrollBounds {
  const origin = root.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  let left = Math.max(origin.left, rect.left),
    right = Math.min(origin.right, rect.right);
  let top = Math.max(origin.top, rect.top),
    bottom = Math.min(origin.top + maxHeight, rect.bottom);
  for (
    let node = target.parentElement;
    node && root.contains(node);
    node = node.parentElement
  ) {
    const css = getComputedStyle(node),
      box = node.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(css.overflowX)) {
      left = Math.max(left, box.left);
      right = Math.min(right, box.right);
    }
    if (/(auto|scroll|hidden|clip)/.test(css.overflowY)) {
      top = Math.max(top, box.top);
      bottom = Math.min(bottom, box.bottom);
    }
    if (node === root) break;
  }
  return {
    x: left - origin.left,
    y: top - origin.top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}
