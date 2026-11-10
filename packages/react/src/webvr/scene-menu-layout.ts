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
