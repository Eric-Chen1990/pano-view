import { Line } from "@react-three/drei";
import { useContext, useEffect, useLayoutEffect, useMemo } from "react";
import type { ColorRepresentation } from "three";
import type { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { WebGPURuntimeContext } from "../pano-renderer";

export type PanoGridLinesProps = {
  /** Flat xyz xyz segment pairs. */
  positions: Float64Array | Float32Array | number[];
  color: ColorRepresentation;
  opacity: number;
  renderOrder: number;
  /** Screen-space width in CSS pixels. */
  lineWidth?: number;
};

const ignoreRaycast = () => undefined;
const DEFAULT_LINE_WIDTH = 2;

function toPointList(positions: ArrayLike<number>): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  for (let i = 0; i + 2 < positions.length; i += 3) {
    points.push([positions[i], positions[i + 1], positions[i + 2]]);
  }
  return points;
}

function toFloat32Positions(positions: ArrayLike<number>): Float32Array {
  return positions instanceof Float32Array
    ? positions
    : Float32Array.from(positions as ArrayLike<number>);
}

/** Screen-space grid strokes for WebGL and WebGPU. */
export function PanoGridLines(props: PanoGridLinesProps) {
  const runtime = useContext(WebGPURuntimeContext);
  return runtime
    ? <WebGPUPanoGridLines {...props} LineSegments2={runtime.LineSegments2} />
    : <WebGLPanoGridLines {...props} />;
}

function WebGLPanoGridLines({
  positions,
  color,
  opacity,
  renderOrder,
  lineWidth = DEFAULT_LINE_WIDTH,
}: PanoGridLinesProps) {
  const points = useMemo(() => toPointList(positions), [positions]);
  if (points.length < 2) {
    return null;
  }
  return (
    <Line
      alphaToCoverage
      color={color}
      depthTest={false}
      depthWrite={false}
      lineWidth={Math.max(0.5, lineWidth)}
      opacity={opacity}
      points={points}
      raycast={ignoreRaycast}
      renderOrder={renderOrder}
      segments
      transparent
      worldUnits={false}
    />
  );
}

function WebGPUPanoGridLines({
  LineSegments2: LineSegments2Ctor,
  positions,
  color,
  opacity,
  renderOrder,
  lineWidth = DEFAULT_LINE_WIDTH,
}: PanoGridLinesProps & { LineSegments2: typeof LineSegments2 }) {
  const line = useMemo(() => {
    const object = new LineSegments2Ctor();
    object.geometry.setPositions(toFloat32Positions(positions));
    object.computeLineDistances();
    return object;
  }, [LineSegments2Ctor, positions]);

  useLayoutEffect(() => {
    line.material.setValues({
      alphaToCoverage: true,
      color,
      depthTest: false,
      depthWrite: false,
      linewidth: Math.max(0.5, lineWidth),
      opacity,
      transparent: true,
      worldUnits: false,
    });
    line.renderOrder = renderOrder;
    line.frustumCulled = false;
  }, [color, line, lineWidth, opacity, renderOrder]);

  useEffect(() => () => {
    line.geometry.dispose();
    line.material.dispose();
  }, [line]);

  return <primitive object={line} raycast={ignoreRaycast} />;
}
