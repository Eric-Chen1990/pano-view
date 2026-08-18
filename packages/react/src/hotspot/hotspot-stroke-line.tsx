import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useRef, type ComponentRef } from "react";
import {
  MathUtils,
  PerspectiveCamera,
  Vector3,
  type Camera,
  type ColorRepresentation,
} from "three";

export type HotspotStrokePoint = [number, number, number];

export type HotspotStrokeLineProps = {
  points: ReadonlyArray<HotspotStrokePoint>;
  color: ColorRepresentation;
  lineWidth: number;
  opacity: number;
  renderOrder: number;
  /** Dash length in CSS pixels. Omit or 0 for a solid stroke. */
  dashSize?: number;
  /** Gap length in CSS pixels. Defaults to `dashSize` when dashed. */
  gapSize?: number;
};

type DashedLineObject = ComponentRef<typeof Line>;

const LINE_WORLD_POSITION = new Vector3();

function applyScreenSpaceDashScale(
  object: DashedLineObject | null,
  camera: Camera,
  viewportHeight: number,
) {
  const material = object?.material;
  if (!object || typeof material?.dashScale !== "number") {
    return;
  }
  object.getWorldPosition(LINE_WORLD_POSITION);
  const depth = Math.max(camera.position.distanceTo(LINE_WORLD_POSITION), 1);
  const fov = camera instanceof PerspectiveCamera ? camera.fov : 75;
  material.dashScale =
    viewportHeight / (2 * Math.tan(MathUtils.degToRad(fov) * 0.5) * depth);
}

function resolveDash(
  dashSize: number | undefined,
  gapSize: number | undefined,
): { dashed: boolean; dashSize: number; gapSize: number } {
  if (dashSize === undefined || !Number.isFinite(dashSize) || dashSize <= 0) {
    return { dashed: false, dashSize: 1, gapSize: 1 };
  }
  return {
    dashed: true,
    dashSize,
    gapSize: Number.isFinite(gapSize) ? Math.max(0, gapSize!) : dashSize,
  };
}

/** Screen-space fat line shared by polygon and polyline hotspot outlines. */
export function HotspotStrokeLine({
  points,
  color,
  lineWidth,
  opacity,
  renderOrder,
  dashSize,
  gapSize,
}: HotspotStrokeLineProps) {
  const lineRef = useRef<DashedLineObject>(null);
  const { camera, size } = useThree();
  const dash = resolveDash(dashSize, gapSize);

  useLayoutEffect(() => {
    if (!dash.dashed) {
      return;
    }
    applyScreenSpaceDashScale(lineRef.current, camera, size.height);
  }, [camera, dash.dashed, dash.dashSize, dash.gapSize, size.height]);

  useFrame((state) => {
    if (!dash.dashed) {
      return;
    }
    applyScreenSpaceDashScale(lineRef.current, state.camera, state.size.height);
  });

  return (
    <Line
      ref={lineRef}
      alphaToCoverage
      color={color}
      dashed={dash.dashed}
      dashSize={dash.dashSize}
      depthTest
      depthWrite={false}
      gapSize={dash.gapSize}
      lineWidth={Math.max(0.5, lineWidth)}
      opacity={opacity}
      points={points}
      renderOrder={renderOrder}
      transparent
      worldUnits={false}
    />
  );
}
