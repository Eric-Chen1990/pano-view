import { Line } from "@react-three/drei";
import type { ColorRepresentation } from "three";

export type HotspotStrokePoint = [number, number, number];

export type HotspotStrokeLineProps = {
  points: ReadonlyArray<HotspotStrokePoint>;
  color: ColorRepresentation;
  lineWidth: number;
  opacity: number;
  renderOrder: number;
};

/** Screen-space fat line shared by polygon and polyline hotspot outlines. */
export function HotspotStrokeLine({
  points,
  color,
  lineWidth,
  opacity,
  renderOrder,
}: HotspotStrokeLineProps) {
  return (
    <Line
      alphaToCoverage
      color={color}
      depthTest
      depthWrite={false}
      lineWidth={Math.max(0.5, lineWidth)}
      opacity={opacity}
      points={points}
      renderOrder={renderOrder}
      transparent
      worldUnits={false}
    />
  );
}
