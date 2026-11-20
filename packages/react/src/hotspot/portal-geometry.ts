import { BufferGeometry, Float32BufferAttribute, MathUtils, Vector2 } from "three";

export type PortalHotspotShape = "rectangle" | "circle" | "ellipse";
export type PortalHotspotFrame = {
  color?: string;
  /** Border width as a fraction of the shorter side, from 0 to 0.25. */
  thickness?: number;
  /** An image with a transparent opening, stretched to the outer bounds. */
  src?: string;
};

export const DEFAULT_PORTAL_FRAME_THICKNESS = 0.04;
export const DEFAULT_PORTAL_FRAME_COLOR = "#87ddd4";

const rectangle = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;

export function portalOutline(shape: PortalHotspotShape, x = 0.5, y = 0.5): Vector2[] {
  if (shape === "rectangle") return rectangle.map(([u, v]) => new Vector2(u * x, v * y));
  return Array.from({ length: 64 }, (_, index) => {
    const angle = index * Math.PI / 32;
    return new Vector2(Math.cos(angle) * x, Math.sin(angle) * y);
  });
}

/** Triangle fan for a closed, convex outline. Points run counterclockwise. */
export function portalFanIndices(count: number): number[] {
  return Array.from({ length: count - 2 }, (_, index) => [0, index + 1, index + 2]).flat();
}

export function portalFrameGeometry(
  shape: PortalHotspotShape, width: number, height: number, thickness: number,
) {
  const size = (value: number) => Math.tan(MathUtils.degToRad(MathUtils.clamp(value, 0.01, 179) / 2));
  const w = size(width);
  const h = size(height);
  const ratio = Number.isFinite(thickness) ? MathUtils.clamp(thickness, 0, 0.25) : DEFAULT_PORTAL_FRAME_THICKNESS;
  const inset = Math.min(w, h) * ratio;
  const outer = portalOutline(shape);
  const inner = portalOutline(shape, 0.5 - inset / w, 0.5 - inset / h);
  const window = new BufferGeometry();
  window.setAttribute("position", new Float32BufferAttribute(inner.flatMap(({ x, y }) => [x, y, 0]), 3));
  window.setAttribute("uv", new Float32BufferAttribute(inner.flatMap(({ x, y }) => [x + 0.5, y + 0.5]), 2));
  window.setIndex(portalFanIndices(inner.length));
  window.computeVertexNormals();

  const frame = new BufferGeometry();
  const vertices = outer.flatMap((point, index) => {
    const opening = inner[index]!;
    return [point.x, point.y, 0, opening.x, opening.y, 0];
  });
  const indices = outer.flatMap((_, index) => {
    const i = index * 2;
    const next = ((index + 1) % outer.length) * 2;
    return [i, next, i + 1, next, next + 1, i + 1];
  });
  frame.setAttribute("position", new Float32BufferAttribute(vertices, 3));
  frame.setIndex(indices);
  frame.computeVertexNormals();

  return { window, frame, inner, hasBorder: ratio > 0 };
}
