import type { PanoSceneMenuItem } from "../pano-scene-menu";
export const bounded = (
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value!)) : fallback);
export function sceneMenuPage(
  items: readonly PanoSceneMenuItem[],
  activeId: string | null | undefined,
  capacity: number
) {
  return Math.floor(
    Math.max(
      0,
      items.findIndex((item) => item.id === activeId)
    ) / capacity
  );
}
export function sceneMenuNeighbor(
  items: readonly PanoSceneMenuItem[],
  activeId: string | null | undefined,
  direction: number,
  loop: boolean
) {
  const index = items.findIndex((item) => item.id === activeId);
  if (index < 0 || items.length < 2) return null;
  const next = index + direction;
  return loop
    ? items[(next + items.length) % items.length]!.id
    : items[next]?.id ?? null;
}
export function sceneMenuFollow(
  yaw: number,
  target: number,
  _elapsed: number,
  delta: number,
  paused: boolean
) {
  // Always converge to the camera heading: a dead zone leaves a permanent
  // sideways offset, while restarting a delay on every turn causes stop/start motion.
  const difference = ((((target - yaw) % 360) + 540) % 360) - 180;
  if (paused || !Number.isFinite(delta) || delta <= 0)
    return { yaw, elapsed: 0 };
  const blend = -Math.expm1(-Math.min(delta, 0.1) / 0.06);
  return { yaw: yaw + difference * blend, elapsed: 0 };
}

type SceneMenuPose = {
  yaw: number;
  pitch: number;
  returning: boolean;
  approachHold?: number;
};
type SceneMenuView = { yaw: number; pitch: number };
type NavigationSettings = {
  follow: boolean;
  followPitch: boolean;
  navigationPitch: number;
  scale: number;
  pitchLimit?: number;
};

function navigationOffset(settings: NavigationSettings) {
  const requested = bounded(settings.navigationPitch, -25, -40, -15);
  return settings.follow && settings.followPitch
    ? Math.max(requested, bounded(settings.pitchLimit, -40, -40, -1))
    : requested;
}

/** Leave the entire button target above the bottom 10% of the actual eye view. */
export function sceneMenuNavigationPitchLimit(
  projection: ArrayLike<number>,
  scale: number
) {
  const verticalScale = projection[5]!;
  const center = projection[9]!;
  if (
    !Number.isFinite(verticalScale) ||
    verticalScale <= 0 ||
    !Number.isFinite(center)
  )
    return -40;
  const angle = (28 * bounded(scale, 1, 0.75, 1.25) * Math.PI) / 180;
  const halfHeight = Math.atan((NAVIGATION_CONTROLS.center.h * angle) / 2048);
  const available = Math.atan(Math.max(0, 0.8 - center) / verticalScale);
  return -Math.max(1, ((available - halfHeight) * 180) / Math.PI);
}

export function sceneMenuView(
  direction: { x: number; y: number; z: number },
  fallbackYaw: number
): SceneMenuView {
  return {
    yaw:
      Math.hypot(direction.x, direction.z) < 1e-5
        ? fallbackYaw
        : (Math.atan2(direction.x, -direction.z) * 180) / Math.PI,
    pitch:
      (Math.asin(Math.max(-1, Math.min(1, direction.y))) * 180) / Math.PI,
  };
}

export function sceneMenuNavigationAnchor(
  view: SceneMenuView,
  settings: NavigationSettings
): SceneMenuPose {
  const offset = navigationOffset(settings);
  return {
    yaw: view.yaw,
    // Keep the offset in the head's pitch frame even when looking near the
    // floor. A world-pitch clamp would push the toolbar above the gaze ray.
    pitch:
      settings.follow && settings.followPitch
        ? bounded(view.pitch, 0, -90, 90) + offset
        : offset,
    returning: false,
    approachHold: 0,
  };
}

/** Test the view in the toolbar's local frame, including at steep head pitches. */
export function sceneMenuNavigationNear(
  pose: SceneMenuView,
  view: SceneMenuView,
  scale: number
) {
  const rad = Math.PI / 180;
  const difference = (view.yaw - pose.yaw) * rad;
  const pitch = pose.pitch * rad;
  const viewPitch = view.pitch * rad;
  const x = Math.sin(difference) * Math.cos(viewPitch);
  const y =
    Math.cos(pitch) * Math.sin(viewPitch) -
    Math.sin(pitch) * Math.cos(viewPitch) * Math.cos(difference);
  const forward =
    Math.sin(pitch) * Math.sin(viewPitch) +
    Math.cos(pitch) * Math.cos(viewPitch) * Math.cos(difference);
  const angle = 28 * bounded(scale, 1, 0.75, 1.25);
  const controls = NAVIGATION_CONTROLS;
  // Pad the actual three-button bounds so a head-driven approach can settle
  // before the exact gaze/ray hit starts the dwell timer.
  const halfWidth = ((512 - controls.previous.x) * angle) / 1024 + 4;
  const halfHeight =
    Math.atan((controls.center.h * angle * rad) / 2048) / rad + 4;
  return (
    Math.abs(Math.atan2(x, forward) / rad) <= halfWidth &&
    Math.abs(Math.atan2(y, Math.hypot(x, forward)) / rad) <= halfHeight
  );
}

export function sceneMenuNavigationFollow(
  pose: SceneMenuPose,
  view: SceneMenuView,
  settings: NavigationSettings,
  delta: number,
  paused: boolean,
  previousPitch = view.pitch
): SceneMenuPose {
  const offset = navigationOffset(settings);
  if (!settings.follow || !settings.followPitch) {
    return {
      yaw:
        settings.follow
          ? sceneMenuFollow(pose.yaw, view.yaw, 0, delta, paused).yaw
          : pose.yaw,
      pitch: offset,
      returning: false,
      approachHold: 0,
    };
  }
  const relative = pose.pitch - view.pitch;
  const approaching = (view.pitch - previousPitch) * relative > 0;
  const near = sceneMenuNavigationNear(pose, view, settings.scale);
  // Automatic recovery can cross the reticle. Only a head-driven approach or
  // an existing aim lock may stop it; otherwise it would strand itself above
  // the reticle forever. Gaze activation is disabled during that recovery.
  if (paused || (near && (!pose.returning || approaching)))
    return { yaw: pose.yaw, pitch: pose.pitch, returning: false, approachHold: 0 };
  if (!Number.isFinite(delta) || delta <= 0) return pose;
  // Head tracking can update more slowly than rendering. Preserve approach
  // intent briefly across frames with the same head pose, but cancel it as
  // soon as the user moves away.
  const approachHold = approaching
    ? 0.2
    : Math.abs(view.pitch - previousPitch) > 1e-4
      ? 0
      : Math.max(0, (pose.approachHold ?? 0) - Math.min(delta, 0.1));
  if (
    approachHold > 0 &&
    !pose.returning &&
    relative >= offset - 15 &&
    relative <= 10
  )
    return {
      yaw: sceneMenuFollow(pose.yaw, view.yaw, 0, delta, false).yaw,
      pitch: pose.pitch,
      returning: false,
      approachHold,
    };
  const target = bounded(view.pitch, 0, -90, 90) + offset;
  const blend = -Math.expm1(-Math.min(delta, 0.1) / 0.2);
  const pitch = pose.pitch + (target - pose.pitch) * blend;
  return {
    yaw: sceneMenuFollow(pose.yaw, view.yaw, 0, delta, false).yaw,
    pitch: Math.abs(target - pitch) < 0.05 ? target : pitch,
    returning: Math.abs(target - pitch) >= 0.05,
    approachHold: 0,
  };
}
export function wrapSceneTitle(
  text: string,
  maxWidth: number,
  measure: (text: string) => number
) {
  const lines: string[] = [""];
  for (const char of Array.from(text)) {
    const index = lines.length - 1;
    if (measure(lines[index] + char) <= maxWidth) lines[index] += char;
    else if (lines.length === 1) lines.push(char);
    else {
      while (lines[1] && measure(lines[1] + "…") > maxWidth)
        lines[1] = Array.from(lines[1]).slice(0, -1).join("");
      lines[1] += "…";
      break;
    }
  }
  return lines;
}

export type SceneMenuLayout = "compact" | "flat" | "arc";
export function sceneMenuControlLayout(
  width: number,
  gridHeight: number,
  open: boolean,
  all: boolean
) {
  const size = open ? 96 : 128;
  const spacing = open ? 144 : 132;
  const pageLabel =
    open && !all ? { x: width / 2, y: gridHeight + 24, height: 22 } : null;
  const y = open
    ? gridHeight + 24 + (pageLabel ? pageLabel.height + 20 : 0)
    : 110 - size / 2;
  const button = (center: number) => ({
    x: center - size / 2,
    y,
    w: size,
    h: size,
  });
  return {
    height: open ? y + size + 16 : 220,
    iconSize: open ? 80 : 120,
    pageLabel,
    previous: button(width / 2 - spacing),
    center: button(width / 2),
    next: button(width / 2 + spacing),
  };
}

const NAVIGATION_CONTROLS = sceneMenuControlLayout(1024, 0, false, false);

export function sceneMenuLayoutConfig(
  layout: SceneMenuLayout,
  columns: number | undefined,
  rows: number | undefined,
  arcAngle: number | undefined,
  count: number,
  all: boolean
) {
  const degrees = bounded(arcAngle, 180, 60, 360);
  const cols = Math.round(
    bounded(
      columns,
      layout === "arc" ? Math.ceil(degrees / 22.5) : 4,
      2,
      layout === "compact" ? 4 : 24
    )
  );
  const pageRows = Math.round(bounded(rows, 3, 1, 3));
  return {
    cols,
    degrees,
    capacity: cols * pageRows,
    rowCount: all ? Math.ceil(count / cols) : pageRows,
  };
}

/** World-space mapping shared by geometry construction and raycast regression tests. */
export function sceneMenuPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  gridHeight: number,
  cols: number,
  layout: SceneMenuLayout,
  degrees: number,
  radius: number,
  scale: number
) {
  if (layout === "compact") {
    const angle = (cols * 9 * scale * Math.PI) / 180;
    const theta = (x / width - 0.5) * angle;
    return [
      Math.sin(theta) * radius,
      ((0.5 - y / height) * radius * angle * height) / width,
      -Math.cos(theta) * radius,
    ];
  }
  const unit = (((radius * Math.PI) / 180) * 9 * scale) / 256;
  const step = (degrees * Math.PI) / 180 / cols;
  const cardWidth = Math.min(
    radius * Math.tan(Math.min(step, Math.PI / 3) / 2) * 1.8 * scale,
    radius * Math.tan(Math.min(step, Math.PI / 3) / 2) * 1.9
  );
  const cardUnit = layout === "arc" ? cardWidth / 256 : unit;
  const bottom = -Math.min((gridHeight * cardUnit) / 2, radius * 0.25);
  if (y >= gridHeight) {
    return [
      ((x - width / 2) * radius * 0.65) / 1024,
      bottom - radius * 0.12 - ((y - gridHeight) * radius * 0.65) / 1024,
      -radius,
    ];
  }
  const py = bottom + (gridHeight - y) * cardUnit;
  if (layout === "flat") return [(x - width / 2) * unit, py, -radius];
  const col = Math.min(cols - 1, Math.floor(x / 256));
  const theta = (-degrees * Math.PI) / 360 + (col + 0.5) * step;
  const dx = (x - (col + 0.5) * 256) * cardUnit;
  return [
    Math.sin(theta) * radius + Math.cos(theta) * dx,
    py,
    -Math.cos(theta) * radius + Math.sin(theta) * dx,
  ];
}

/** Rectangles partition the logical canvas without exceeding GPU texture limits. */
export function sceneMenuAtlasRects(
  width: number,
  height: number,
  maxTextureSize: number,
  textureScale = 1
) {
  const limit = Math.max(
    1,
    Math.floor(Math.min(1024, maxTextureSize) / textureScale)
  );
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 0; y < height; y += limit)
    for (let x = 0; x < width; x += limit)
      rects.push({
        x,
        y,
        w: Math.min(limit, width - x),
        h: Math.min(limit, height - y),
      });
  return rects;
}
