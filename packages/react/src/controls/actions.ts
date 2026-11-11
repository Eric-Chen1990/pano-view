import type {
  PanoVideoController,
  PanoVideoPlaybackSnapshot,
} from "../video/types";
import type { PanoSpatialControlAdapter } from "../spatial/host";
import type { ReactNode } from "react";

export type PanoMediaController = Pick<
  PanoVideoController,
  "subscribe" | "play" | "pause" | "seek" | "setVolume" | "setMuted"
> & {
  getSnapshot: () => Pick<
    PanoVideoPlaybackSnapshot,
    | "ready"
    | "playing"
    | "currentTime"
    | "duration"
    | "hasAudio"
    | "volume"
    | "volumeAdjustable"
    | "muted"
  >;
};
export type PanoControlAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  enabled?: () => boolean;
  activate?: () => void;
  update?: (seconds: number) => void;
  repeatIntervalMs?: number;
  end?: () => void;
};
export const CONTROL_PATHS: Record<string, string> = {
  play: "M8 5 L19 12 L8 19 Z",
  pause: "M8 5 V19 M16 5 V19",
  rewind: "M11 5 L3 12 L11 19 Z M21 5 L13 12 L21 19 Z",
  forward: "M3 5 L11 12 L3 19 Z M13 5 L21 12 L13 19 Z",
  left: "M15 5 L8 12 L15 19",
  right: "M9 5 L16 12 L9 19",
  up: "M5 15 L12 8 L19 15",
  down: "M5 9 L12 16 L19 9",
  "scroll-up": "M5 11 L12 4 L19 11 M5 20 L12 13 L19 20",
  "scroll-down": "M5 4 L12 11 L19 4 M5 13 L12 20 L19 13",
  in: "M12 5 V19 M5 12 H19",
  out: "M5 12 H19",
  reset: "M4 10 A8 8 0 1 1 5 17 M4 4 V10 H10",
  mute: "M3 9 H7 L12 5 V19 L7 15 H3 Z M16 9 L22 15 M22 9 L16 15",
  unmute: "M3 9 H7 L12 5 V19 L7 15 H3 Z M16 8 Q22 12 16 16",
  "vol-": "M3 9 H7 L12 5 V19 L7 15 H3 Z M16 12 H22",
  "vol+": "M3 9 H7 L12 5 V19 L7 15 H3 Z M16 12 H22 M19 9 V15",
};
export function mediaActions(
  controller: PanoMediaController | null,
  seekSpeed = 10,
  volumeSpeed = 0.25
): PanoControlAction[] {
  if (!controller) return [];
  const snapshot = () => controller.getSnapshot();
  const safeVolumeSpeed = Number.isFinite(volumeSpeed) && volumeSpeed >= 0 ? volumeSpeed : 0.25;
  return [
    {
      id: snapshot().playing ? "pause" : "play",
      label: snapshot().playing ? "Pause" : "Play",
      activate: () => {
        if (snapshot().playing) controller.pause();
        else void controller.play().catch(() => {});
      },
    },
    ...([-1, 1] as const).map((direction) => ({
      id: direction < 0 ? "rewind" : "forward",
      label: direction < 0 ? "Seek backward" : "Seek forward",
      enabled: () =>
        snapshot().ready &&
        Number.isFinite(snapshot().duration) &&
        snapshot().duration > 0 &&
        (direction < 0
          ? snapshot().currentTime > 0
          : snapshot().currentTime < snapshot().duration),
      update: (dt: number) =>
        controller.seek(
          Math.max(
            0,
            Math.min(
              snapshot().duration,
              snapshot().currentTime + direction * dt * seekSpeed
            )
          )
        ),
    })),
    ...(snapshot().hasAudio !== false && snapshot().volumeAdjustable ? [-1, 1] as const : []).map((direction) => ({
      id: direction < 0 ? "vol-" : "vol+",
      label: direction < 0 ? "Volume down" : "Volume up",
      enabled: () =>
        snapshot().hasAudio !== false && snapshot().volumeAdjustable &&
        (direction < 0 ? snapshot().volume > 0 : snapshot().volume < 1),
      update: (dt: number) => {
        if (!Number.isFinite(dt) || dt <= 0 || snapshot().hasAudio === false || !snapshot().volumeAdjustable) return;
        controller.setVolume(
          Math.max(0, Math.min(1, snapshot().volume + direction * dt * safeVolumeSpeed))
        );
      },
    })),
    ...(snapshot().hasAudio === false ? [] : [{
      id: snapshot().muted ? "unmute" : "mute",
      label: snapshot().muted ? "Unmute" : "Mute",
      enabled: () => snapshot().hasAudio !== false,
      activate: () => { if (snapshot().hasAudio !== false) controller.setMuted(!snapshot().muted); },
    }]),
  ];
}
export function modelActions(
  adapter: PanoSpatialControlAdapter,
  rotateSpeed = 30,
  zoomSpeed = 1.5
): PanoControlAction[] {
  const actions: PanoControlAction[] = [];
  if (adapter.rotateBy)
    for (const [id, yaw, pitch] of [
      ["left", -1, 0],
      ["right", 1, 0],
      ["up", 0, 1],
      ["down", 0, -1],
    ] as const)
      actions.push({
        id,
        label: `Rotate ${id}`,
        enabled: () => adapter.canExecute?.(id) !== false,
        update: (dt) =>
          adapter.rotateBy?.(yaw * rotateSpeed * dt, pitch * rotateSpeed * dt),
      });
  if (adapter.zoomBy)
    for (const direction of [-1, 1]) {
      const id = direction > 0 ? "in" : "out";
      actions.push({
        id,
        label: `Zoom ${id}`,
        enabled: () => adapter.canExecute?.(id) !== false,
        update: (dt) => adapter.zoomBy?.(zoomSpeed ** (direction * dt)),
      });
    }
  if (adapter.resetView)
    actions.push({
      id: "reset",
      label: "Reset model",
      activate: () => adapter.resetView?.(),
    });
  return actions;
}
export function scrollActions(
  target: HTMLElement | null,
  speed = 0.2,
  repeatIntervalMs = 700
): PanoControlAction[] {
  if (!target) return [];
  return (["up", "down", "left", "right"] as const).flatMap((id) => {
    const vertical = id === "up" || id === "down";
    const extent = () =>
      vertical
        ? target.scrollHeight - target.clientHeight
        : target.scrollWidth - target.clientWidth;
    if (extent() <= 1) return [];
    const direction = id === "up" || id === "left" ? -1 : 1;
    const offset = () => (vertical ? target.scrollTop : target.scrollLeft);
    return [
      {
        id,
        label: `Scroll ${id}`,
        repeatIntervalMs:
          Number.isFinite(repeatIntervalMs) && repeatIntervalMs > 0
            ? repeatIntervalMs
            : 700,
        enabled: () => (direction < 0 ? offset() > 0 : offset() < extent() - 1),
        update: (dt: number) => {
          const next = Math.max(
            0,
            Math.min(
              extent(),
              offset() +
                direction *
                  (vertical ? target.clientHeight : target.clientWidth) *
                  dt *
                  speed
            )
          );
          if (vertical) target.scrollTop = next;
          else target.scrollLeft = next;
        },
      },
    ];
  });
}
export function findScrollTarget(
  root: HTMLElement,
  target: HTMLElement
): HTMLElement | null {
  let node: HTMLElement | null = target;
  while (node && root.contains(node)) {
    const css = getComputedStyle(node);
    if (
      (/(auto|scroll)/.test(css.overflowY) &&
        node.scrollHeight > node.clientHeight + 1) ||
      (/(auto|scroll)/.test(css.overflowX) &&
        node.scrollWidth > node.clientWidth + 1)
    )
      return node;
    if (node === root) break;
    node = node.parentElement;
  }
  return null;
}
