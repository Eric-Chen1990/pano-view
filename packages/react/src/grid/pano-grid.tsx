import { useMemo } from "react";
import type { ColorRepresentation } from "three";
import type { PanoLevelCorrection } from "../level-correction";
import { useLevelRotation } from "../level-rotation";
import { DEFAULT_PANORAMA_RADIUS } from "../panorama-radius";
import {
  clampPanoGridDivisions,
  createPanoGridPositions,
  type PanoGridProjection,
} from "./geometry";
import { PanoGridLines } from "./grid-lines";

export type PanoGridProps = {
  /** Sphere latitude/longitude net, or cube face grid. */
  projection?: PanoGridProjection;
  /**
   * Grid density. For both projections this is cells across a ~90° cube-face
   * span: cube uses it per face edge; sphere uses the same angular step
   * (`90° / divisions`) around the full shell.
   */
  divisions?: number;
  color?: ColorRepresentation;
  opacity?: number;
  /** Match a panorama source that applies the same pitch/roll correction. */
  levelCorrection?: PanoLevelCorrection;
  /** World-space shell radius. Defaults to the shared panorama radius. */
  radius?: number;
};

const GRID_RENDER_ORDER = -40;
const GRID_LINE_WIDTH = 2;

/**
 * Debug / test reference grid for panorama space. Mount alone inside
 * `PanoViewer` when no panorama image is present, or beside `Sphere` / `Tile`
 * to check alignment.
 *
 * Lines use screen-space width on WebGL and WebGPU so they stay continuous
 * under perspective foreshortening.
 */
export function PanoGrid({
  projection = "sphere",
  divisions = 8,
  color = "#ffffff",
  opacity = 0.8,
  levelCorrection,
  radius = DEFAULT_PANORAMA_RADIUS,
}: PanoGridProps) {
  const levelRotation = useLevelRotation(levelCorrection);
  const resolvedDivisions = clampPanoGridDivisions(projection, divisions);
  const resolvedRadius =
    Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_PANORAMA_RADIUS;
  const positions = useMemo(
    () => createPanoGridPositions(projection, resolvedDivisions, resolvedRadius),
    [projection, resolvedDivisions, resolvedRadius],
  );

  return (
    <group quaternion={levelRotation ?? undefined}>
      <PanoGridLines
        positions={positions}
        color={color}
        opacity={opacity}
        lineWidth={GRID_LINE_WIDTH}
        renderOrder={GRID_RENDER_ORDER}
      />
    </group>
  );
}
