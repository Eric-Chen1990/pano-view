import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useContext, useEffect, useLayoutEffect, useMemo, useRef, type ComponentRef } from "react";
import {
  MathUtils,
  PerspectiveCamera,
  Vector3,
  type Camera,
  type ColorRepresentation,
} from "three";

import type { Line2 } from "three/addons/lines/webgpu/Line2.js";
import { WebGPURuntimeContext } from "../pano-renderer";

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

function screenSpaceDashScale(
  object: DashedLineObject | Line2,
  camera: Camera,
  viewportHeight: number,
): number {
  object.getWorldPosition(LINE_WORLD_POSITION);
  const depth = Math.max(camera.position.distanceTo(LINE_WORLD_POSITION), 1);
  const fov = camera instanceof PerspectiveCamera ? camera.fov : 75;
  return viewportHeight / (2 * Math.tan(MathUtils.degToRad(fov) * 0.5) * depth);
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
export function HotspotStrokeLine(props: HotspotStrokeLineProps) {
  const runtime = useContext(WebGPURuntimeContext);
  return runtime
    ? <WebGPUHotspotStrokeLine {...props} Line={runtime.Line2} />
    : <WebGLHotspotStrokeLine {...props} />;
}

function WebGLHotspotStrokeLine({
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
    const line = lineRef.current;
    if (line) line.material.dashScale = screenSpaceDashScale(line, camera, size.height);
  }, [camera, dash.dashed, dash.dashSize, dash.gapSize, size.height]);

  useFrame((state) => {
    if (!dash.dashed) {
      return;
    }
    const line = lineRef.current;
    if (line) line.material.dashScale = screenSpaceDashScale(line, state.camera, state.size.height);
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

function WebGPUHotspotStrokeLine({
  Line,
  points,
  color,
  lineWidth,
  opacity,
  renderOrder,
  dashSize,
  gapSize,
}: HotspotStrokeLineProps & { Line: typeof Line2 }) {
  const line = useMemo(() => {
    const object = new Line();
    object.geometry.setPositions(points.flat());
    object.computeLineDistances();
    return object;
  }, [Line, points]);
  const dash = resolveDash(dashSize, gapSize);

  useLayoutEffect(() => {
    line.material.dashed = dash.dashed;
    line.material.setValues({
      alphaToCoverage: true,
      color,
      dashSize: dash.dashSize,
      depthTest: true,
      depthWrite: false,
      gapSize: dash.gapSize,
      linewidth: Math.max(0.5, lineWidth),
      opacity,
      transparent: true,
      worldUnits: false,
    });
    line.renderOrder = renderOrder;
  }, [line, color, dash.dashed, dash.dashSize, dash.gapSize, lineWidth, opacity, renderOrder]);
  useEffect(() => () => {
    line.geometry.dispose();
    line.material.dispose();
  }, [line]);

  useFrame(({ camera, size }) => {
    if (dash.dashed) line.material.scale = screenSpaceDashScale(line, camera, size.height);
  });

  return <primitive object={line} />;
}
