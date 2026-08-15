import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  ColorRepresentation,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { HotspotAnchor } from "./hotspot-anchor";
import {
  clampPanoPitch,
  normalizePanoPosition,
  normalizePanoYaw,
  panoPositionToVector3,
  vector3ToPanoPosition,
} from "./coordinates";
import type {
  HotspotCommonProps,
  HotspotDragEvent,
  HotspotPosition,
} from "./types";

const POLYLINE_RADIUS = 990;
const MAX_SEGMENT_DEGREES = 7;

export type PolylineValidationIssue = {
  code: "too_few_vertices";
  message: string;
};

export type PolylineVerticesChangeEvent = {
  id: string;
  vertices: HotspotPosition[];
  startVertices: HotspotPosition[];
  position: HotspotPosition;
  startPosition: HotspotPosition;
};

export type PolylineHotspotProps = Omit<
  HotspotCommonProps,
  | "position"
  | "width"
  | "height"
  | "scale"
  | "mode"
  | "distance"
  | "scaleMode"
  | "rotation"
  | "onDragStart"
  | "onPositionChange"
  | "onDragEnd"
> & {
  vertices: HotspotPosition[];
  stroke?: ColorRepresentation;
  /** Screen-space line width in CSS pixels. Defaults to 2. */
  strokeWidth?: number;
  strokeOpacity?: number;
  onVerticesChange?: (event: PolylineVerticesChangeEvent) => void;
  onDragStart?: (event: PolylineVerticesChangeEvent) => void;
  onDragEnd?: (event: PolylineVerticesChangeEvent) => void;
  onInvalid?: (issues: PolylineValidationIssue[]) => void;
};

type UnwrappedVertex = HotspotPosition & { unwrappedYaw: number };

function cloneVertices(vertices: HotspotPosition[]): HotspotPosition[] {
  return vertices.map((vertex) => normalizePanoPosition(vertex));
}

function unwrapVertices(vertices: HotspotPosition[]): UnwrappedVertex[] {
  const unwrapped: UnwrappedVertex[] = [];
  for (const vertex of vertices) {
    const normalized = normalizePanoPosition(vertex);
    const previous = unwrapped[unwrapped.length - 1];
    if (!previous) {
      unwrapped.push({ ...normalized, unwrappedYaw: normalized.yaw });
      continue;
    }
    let yaw = normalized.yaw;
    while (yaw - previous.unwrappedYaw > 180) yaw -= 360;
    while (yaw - previous.unwrappedYaw <= -180) yaw += 360;
    unwrapped.push({ ...normalized, unwrappedYaw: yaw });
  }
  return unwrapped;
}

function polylineCenter(vertices: HotspotPosition[]): HotspotPosition {
  const sum = vertices.reduce(
    (total, vertex) => total.add(panoPositionToVector3(vertex).normalize()),
    new Vector3(),
  );
  return sum.lengthSq() > 1e-8
    ? vector3ToPanoPosition(sum)
    : normalizePanoPosition(vertices[0]!);
}

function surfaceQuaternion(position: HotspotPosition): Quaternion {
  const outward = panoPositionToVector3(position).normalize();
  const inward = outward.clone().negate();
  const pitch = MathUtils.degToRad(position.pitch);
  const yaw = MathUtils.degToRad(position.yaw);
  const localUp = new Vector3(
    -Math.sin(pitch) * Math.sin(yaw),
    Math.cos(pitch),
    Math.sin(pitch) * Math.cos(yaw),
  ).normalize();
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(localUp.clone().cross(inward).normalize(), localUp, inward),
  );
}

function makeWorldToLocal(center: HotspotPosition): Matrix4 {
  return new Matrix4()
    .compose(
      panoPositionToVector3(center, POLYLINE_RADIUS),
      surfaceQuaternion(center),
      new Vector3(1, 1, 1),
    )
    .invert();
}

function subdivisionSteps(vertices: HotspotPosition[]): number {
  let maxAngle = 0;
  for (let index = 0; index < vertices.length - 1; index += 1) {
    maxAngle = Math.max(
      maxAngle,
      panoPositionToVector3(vertices[index]!).angleTo(
        panoPositionToVector3(vertices[index + 1]!),
      ),
    );
  }
  return Math.min(
    8,
    Math.max(1, Math.ceil((MathUtils.radToDeg(maxAngle)) / MAX_SEGMENT_DEGREES)),
  );
}

function makeLinePositions(vertices: HotspotPosition[], center: HotspotPosition): number[] {
  const positions: number[] = [];
  const worldToLocal = makeWorldToLocal(center);
  const unwrapped = unwrapVertices(vertices);
  const steps = subdivisionSteps(vertices);

  for (let edge = 0; edge < unwrapped.length - 1; edge += 1) {
    const start = unwrapped[edge]!;
    const end = unwrapped[edge + 1]!;
    for (let step = 0; step < steps; step += 1) {
      const progress = step / steps;
      const point = panoPositionToVector3(
        {
          yaw: start.unwrappedYaw + (end.unwrappedYaw - start.unwrappedYaw) * progress,
          pitch: start.pitch + (end.pitch - start.pitch) * progress,
        },
        POLYLINE_RADIUS,
      ).applyMatrix4(worldToLocal);
      positions.push(point.x, point.y, point.z);
    }
  }

  const last = unwrapped[unwrapped.length - 1]!;
  const lastPoint = panoPositionToVector3(last, POLYLINE_RADIUS).applyMatrix4(worldToLocal);
  positions.push(lastPoint.x, lastPoint.y, lastPoint.z);
  return positions;
}

function makeLine(
  positions: number[],
  color: ColorRepresentation,
  width: number,
  opacity: number,
): Line2 {
  const geometry = new LineGeometry();
  geometry.setPositions(positions);
  const material = new LineMaterial({
    color,
    depthTest: true,
    depthWrite: false,
    linewidth: Math.max(0.5, width),
    opacity,
    transparent: true,
    worldUnits: false,
    alphaToCoverage: true,
  });
  const line = new Line2(geometry, material);
  line.computeLineDistances();
  return line;
}

function disposeLine(line: Line2 | null): void {
  if (!line) return;
  line.geometry.dispose();
  (line.material as LineMaterial).dispose();
}

function translateVertices(
  vertices: HotspotPosition[],
  from: HotspotPosition,
  to: HotspotPosition,
): HotspotPosition[] {
  const yawOffset = normalizePanoYaw(to.yaw - from.yaw);
  const pitchOffset = to.pitch - from.pitch;
  return vertices.map((vertex) => ({
    yaw: normalizePanoYaw(vertex.yaw + yawOffset),
    pitch: clampPanoPitch(vertex.pitch + pitchOffset),
  }));
}

export function validatePolylineVertices(
  vertices: HotspotPosition[],
): PolylineValidationIssue[] {
  return vertices.length < 2
    ? [{ code: "too_few_vertices", message: "A polyline needs at least two vertices." }]
    : [];
}

export function PolylineHotspot({
  id,
  vertices,
  stroke = "#f5fbfc",
  strokeWidth = 2,
  strokeOpacity = 1,
  renderOrder = 10,
  draggable = false,
  onVerticesChange,
  onDragStart,
  onDragEnd,
  onInvalid,
  ...anchorProps
}: PolylineHotspotProps) {
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const issues = useMemo(() => validatePolylineVertices(vertices), [vertices]);
  const valid = issues.length === 0;
  const center = useMemo(() => valid ? polylineCenter(vertices) : null, [valid, vertices]);
  const linePositions = useMemo(
    () => valid && center ? makeLinePositions(vertices, center) : null,
    [center, valid, vertices],
  );
  const devicePixelRatio = gl.getPixelRatio();
  const opacity = Math.max(0, Math.min(strokeOpacity, 1));
  const line = useMemo(
    () => linePositions ? makeLine(linePositions, stroke, strokeWidth * devicePixelRatio, opacity) : null,
    [devicePixelRatio, linePositions, opacity, stroke, strokeWidth],
  );
  const focusLine = useMemo(
    () => linePositions ? makeLine(linePositions, "#75cbd3", (strokeWidth + 2) * devicePixelRatio, 1) : null,
    [devicePixelRatio, linePositions, strokeWidth],
  );
  const startVerticesRef = useRef<HotspotPosition[] | null>(null);

  useEffect(() => {
    if (!valid) onInvalid?.(issues);
  }, [issues, onInvalid, valid]);
  useEffect(() => () => disposeLine(line), [line]);
  useEffect(() => () => disposeLine(focusLine), [focusLine]);
  useEffect(() => {
    const width = gl.domElement.width;
    const height = gl.domElement.height;
    for (const nextLine of [line, focusLine]) {
      if (nextLine) (nextLine.material as LineMaterial).resolution.set(width, height);
    }
  }, [focusLine, gl, line, size.height, size.width]);

  if (!valid || !center || !line || !focusLine) return null;

  const emitVerticesChange = (
    event: HotspotDragEvent,
    callback?: (event: PolylineVerticesChangeEvent) => void,
  ) => {
    const startVertices = startVerticesRef.current ?? cloneVertices(vertices);
    callback?.({
      id,
      vertices: translateVertices(startVertices, event.startPosition, event.position),
      startVertices,
      position: event.position,
      startPosition: event.startPosition,
    });
  };

  return (
    <HotspotAnchor
      {...anchorProps}
      id={id}
      position={center}
      width={1}
      height={1}
      internalPlacement="floating"
      distance={POLYLINE_RADIUS}
      internalOrientation="surface"
      renderOrder={renderOrder}
      draggable={draggable}
      useAngularScale={false}
      focusContent={<primitive object={focusLine} renderOrder={renderOrder + 2} />}
      onDragStart={(event) => {
        startVerticesRef.current = cloneVertices(vertices);
        emitVerticesChange(event, onDragStart);
      }}
      onPositionChange={(event) => emitVerticesChange(event, onVerticesChange)}
      onDragEnd={(event) => {
        emitVerticesChange(event, onDragEnd);
        startVerticesRef.current = null;
      }}
    >
      <primitive object={line} renderOrder={renderOrder + 1} />
    </HotspotAnchor>
  );
}
