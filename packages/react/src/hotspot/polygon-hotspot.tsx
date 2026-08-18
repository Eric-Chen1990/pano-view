import { useEffect, useMemo, useRef } from "react";
import {
  BufferGeometry,
  ColorRepresentation,
  DoubleSide,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  ShapeUtils,
  Vector2,
  Vector3,
} from "three";
import { HotspotAnchor } from "./hotspot-anchor";
import {
  HotspotStrokeLine,
  type HotspotStrokePoint,
} from "./hotspot-stroke-line";
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
  HotspotInteractionEvent,
  HotspotPosition,
} from "./types";

const POLYGON_RADIUS = 990;
const MAX_FILL_SEGMENT_DEGREES = 7;

export type PolygonValidationCode =
  | "too_few_vertices"
  | "self_intersection"
  | "contains_pole"
  | "outside_hemisphere";

export type PolygonValidationIssue = {
  code: PolygonValidationCode;
  message: string;
};

export type PolygonVerticesChangeEvent = {
  id: string;
  vertices: HotspotPosition[];
  startVertices: HotspotPosition[];
  position: HotspotPosition;
  startPosition: HotspotPosition;
};

export type PolygonHotspotProps = Omit<
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
  fill?: ColorRepresentation;
  fillOpacity?: number;
  stroke?: ColorRepresentation;
  /** Screen-space border width in CSS pixels. Defaults to 2. */
  strokeWidth?: number;
  /** Opacity of the polygon boundary, from 0 to 1. Defaults to 1. */
  strokeOpacity?: number;
  /** Dash length in CSS pixels. Omit or 0 for a solid stroke. */
  strokeDashSize?: number;
  /** Gap length in CSS pixels. Defaults to `strokeDashSize` when dashed. */
  strokeGapSize?: number;
  onVerticesChange?: (event: PolygonVerticesChangeEvent) => void;
  onDragStart?: (event: PolygonVerticesChangeEvent) => void;
  onDragEnd?: (event: PolygonVerticesChangeEvent) => void;
  onInvalid?: (issues: PolygonValidationIssue[]) => void;
};

type UnwrappedVertex = HotspotPosition & { unwrappedYaw: number };

function cloneVertices(vertices: HotspotPosition[]): HotspotPosition[] {
  return vertices.map((vertex) => normalizePanoPosition(vertex));
}

export function unwrapPolygonVertices(
  vertices: HotspotPosition[],
): UnwrappedVertex[] {
  const unwrapped: UnwrappedVertex[] = [];
  for (const vertex of vertices) {
    const normalized = normalizePanoPosition(vertex);
    const previous = unwrapped[unwrapped.length - 1];
    if (!previous) {
      unwrapped.push({ ...normalized, unwrappedYaw: normalized.yaw });
      continue;
    }
    const previousYaw = previous.unwrappedYaw;
    let yaw = normalized.yaw;
    while (yaw - previousYaw > 180) yaw -= 360;
    while (yaw - previousYaw <= -180) yaw += 360;
    unwrapped.push({ ...normalized, unwrappedYaw: yaw });
  }
  return unwrapped;
}

function orientation(a: Vector2, b: Vector2, c: Vector2): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function intersects(a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return (
    Math.sign(abC) !== Math.sign(abD) &&
    Math.sign(cdA) !== Math.sign(cdB)
  );
}

function hasSelfIntersection(vertices: UnwrappedVertex[]): boolean {
  const points = vertices.map((vertex) =>
    new Vector2(vertex.unwrappedYaw, vertex.pitch),
  );
  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length;
    for (let other = index + 1; other < points.length; other += 1) {
      const otherNext = (other + 1) % points.length;
      if (
        index === other ||
        nextIndex === other ||
        otherNext === index ||
        (index === 0 && otherNext === 0)
      ) {
        continue;
      }
      if (intersects(points[index]!, points[nextIndex]!, points[other]!, points[otherNext]!)) {
        return true;
      }
    }
  }
  return false;
}

function polygonContainsDirection(
  vertices: HotspotPosition[],
  direction: Vector3,
): boolean {
  let winding = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const a = panoPositionToVector3(vertices[index]!).normalize();
    const b = panoPositionToVector3(vertices[(index + 1) % vertices.length]!).normalize();
    const projectedA = a.clone().addScaledVector(direction, -a.dot(direction));
    const projectedB = b.clone().addScaledVector(direction, -b.dot(direction));
    if (projectedA.lengthSq() < 1e-8 || projectedB.lengthSq() < 1e-8) {
      return false;
    }
    projectedA.normalize();
    projectedB.normalize();
    winding += Math.atan2(
      direction.dot(projectedA.clone().cross(projectedB)),
      projectedA.dot(projectedB),
    );
  }
  return Math.abs(winding) > Math.PI;
}

function fitsHemisphere(vertices: HotspotPosition[]): boolean {
  const directions = vertices.map((vertex) => panoPositionToVector3(vertex).normalize());
  const candidates = [new Vector3()];
  for (const direction of directions) {
    candidates[0]!.add(direction);
    candidates.push(direction.clone());
  }
  for (let index = 0; index < directions.length; index += 1) {
    for (let other = index + 1; other < directions.length; other += 1) {
      candidates.push(directions[index]!.clone().add(directions[other]!));
    }
  }
  return candidates.some((candidate) =>
    candidate.lengthSq() > 1e-8 &&
    directions.every((direction) => candidate.dot(direction) > 1e-6),
  );
}

export function validatePolygonVertices(
  vertices: HotspotPosition[],
): PolygonValidationIssue[] {
  if (vertices.length < 3) {
    return [{ code: "too_few_vertices", message: "A polygon needs at least three vertices." }];
  }
  const normalized = cloneVertices(vertices);
  const unwrapped = unwrapPolygonVertices(normalized);
  const issues: PolygonValidationIssue[] = [];
  if (hasSelfIntersection(unwrapped)) {
    issues.push({ code: "self_intersection", message: "Polygon edges cannot cross." });
  }
  if (
    polygonContainsDirection(normalized, new Vector3(0, 1, 0)) ||
    polygonContainsDirection(normalized, new Vector3(0, -1, 0))
  ) {
    issues.push({ code: "contains_pole", message: "Polygons cannot contain a panorama pole." });
  }
  if (!fitsHemisphere(normalized)) {
    issues.push({ code: "outside_hemisphere", message: "Polygons must fit within one hemisphere." });
  }
  return issues;
}

function polygonCenter(vertices: HotspotPosition[]): HotspotPosition {
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
  const pitch = (position.pitch * Math.PI) / 180;
  const yaw = (position.yaw * Math.PI) / 180;
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
      panoPositionToVector3(center, POLYGON_RADIUS),
      surfaceQuaternion(center),
      new Vector3(1, 1, 1),
    )
    .invert();
}

function projectedPoint(
  a: UnwrappedVertex,
  b: UnwrappedVertex,
  c: UnwrappedVertex,
  weightB: number,
  weightC: number,
  radius: number,
  worldToLocal: Matrix4,
): Vector3 {
  const weightA = 1 - weightB - weightC;
  return panoPositionToVector3(
    {
      yaw: a.unwrappedYaw * weightA + b.unwrappedYaw * weightB + c.unwrappedYaw * weightC,
      pitch: a.pitch * weightA + b.pitch * weightB + c.pitch * weightC,
    },
    radius,
  ).applyMatrix4(worldToLocal);
}

function polygonSubdivisionSteps(vertices: HotspotPosition[]): number {
  let maxAngle = 0;
  for (let index = 0; index < vertices.length; index += 1) {
    const start = panoPositionToVector3(vertices[index]!).normalize();
    for (let other = index + 1; other < vertices.length; other += 1) {
      maxAngle = Math.max(
        maxAngle,
        start.angleTo(panoPositionToVector3(vertices[other]!).normalize()),
      );
    }
  }
  return Math.min(
    8,
    Math.max(1, Math.ceil((maxAngle * 180) / Math.PI / MAX_FILL_SEGMENT_DEGREES)),
  );
}

function addSubdividedTriangle(
  positions: number[],
  indices: number[],
  a: UnwrappedVertex,
  b: UnwrappedVertex,
  c: UnwrappedVertex,
  worldToLocal: Matrix4,
  steps: number,
): void {
  const grid = new Map<string, number>();
  const pointIndex = (i: number, j: number) => {
    const key = `${i}:${j}`;
    const existing = grid.get(key);
    if (existing !== undefined) return existing;
    const point = projectedPoint(a, b, c, i / steps, j / steps, POLYGON_RADIUS, worldToLocal);
    const index = positions.length / 3;
    positions.push(point.x, point.y, point.z);
    grid.set(key, index);
    return index;
  };
  for (let i = 0; i <= steps; i += 1) {
    for (let j = 0; j <= steps - i; j += 1) pointIndex(i, j);
  }
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < steps - i; j += 1) {
      indices.push(pointIndex(i, j), pointIndex(i + 1, j), pointIndex(i, j + 1));
      if (i + j < steps - 1) {
        indices.push(pointIndex(i + 1, j), pointIndex(i + 1, j + 1), pointIndex(i, j + 1));
      }
    }
  }
}

function makeFillGeometry(vertices: HotspotPosition[], center: HotspotPosition): BufferGeometry {
  const unwrapped = unwrapPolygonVertices(vertices);
  const contour = unwrapped.map((vertex) => new Vector2(vertex.unwrappedYaw, vertex.pitch));
  const triangles = ShapeUtils.triangulateShape(contour, []);
  const positions: number[] = [];
  const indices: number[] = [];
  const worldToLocal = makeWorldToLocal(center);
  const steps = polygonSubdivisionSteps(vertices);
  for (const [a, b, c] of triangles) {
    addSubdividedTriangle(
      positions,
      indices,
      unwrapped[a]!,
      unwrapped[b]!,
      unwrapped[c]!,
      worldToLocal,
      steps,
    );
  }
  return new BufferGeometry()
    .setAttribute("position", new Float32BufferAttribute(positions, 3))
    .setIndex(indices);
}

function makeStrokePositions(
  vertices: HotspotPosition[],
  center: HotspotPosition,
): HotspotStrokePoint[] {
  const points: HotspotStrokePoint[] = [];
  const worldToLocal = makeWorldToLocal(center);
  const unwrapped = unwrapPolygonVertices(vertices);
  const steps = polygonSubdivisionSteps(vertices);

  for (let edge = 0; edge < unwrapped.length; edge += 1) {
    const start = unwrapped[edge]!;
    const end = unwrapped[(edge + 1) % unwrapped.length]!;

    // This is intentionally the same yaw/pitch interpolation and segment
    // density used by the fill geometry. The outline therefore sits directly
    // on its outer boundary instead of following a different great-circle arc.
    for (let step = 0; step < steps; step += 1) {
      const progress = step / steps;
      const point = panoPositionToVector3(
        {
          yaw: start.unwrappedYaw + (end.unwrappedYaw - start.unwrappedYaw) * progress,
          pitch: start.pitch + (end.pitch - start.pitch) * progress,
        },
        POLYGON_RADIUS,
      )
      .applyMatrix4(worldToLocal);
      points.push([point.x, point.y, point.z]);
    }
  }
  const first = points[0];
  if (first) {
    points.push(first);
  }
  return points;
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

export function PolygonHotspot({
  id,
  vertices,
  fill = "#df6b42",
  fillOpacity = 0.34,
  stroke = "#f5fbfc",
  strokeWidth = 2,
  strokeOpacity = 1,
  strokeDashSize,
  strokeGapSize,
  interactive = true,
  renderOrder = 10,
  draggable = false,
  onVerticesChange,
  onDragStart,
  onDragEnd,
  onInvalid,
  ...anchorProps
}: PolygonHotspotProps) {
  const issues = useMemo(() => validatePolygonVertices(vertices), [vertices]);
  const valid = issues.length === 0;
  const center = useMemo(() => valid ? polygonCenter(vertices) : null, [valid, vertices]);
  const fillGeometry = useMemo(
    () => valid && center ? makeFillGeometry(vertices, center) : null,
    [center, valid, vertices],
  );
  const strokePoints = useMemo(
    () => valid && center ? makeStrokePositions(vertices, center) : null,
    [center, valid, vertices],
  );
  const resolvedStrokeOpacity = Math.max(0, Math.min(strokeOpacity, 1));
  const startVerticesRef = useRef<HotspotPosition[] | null>(null);
  const issuesKey = issues.map((issue) => issue.code).join(",");

  useEffect(() => {
    if (!valid) onInvalid?.(issues);
  }, [issues, issuesKey, onInvalid, valid]);
  useEffect(() => () => fillGeometry?.dispose(), [fillGeometry]);

  if (!valid || !center || !fillGeometry || !strokePoints || strokePoints.length < 2) {
    return null;
  }

  const emitVerticesChange = (event: HotspotDragEvent, callback?: (event: PolygonVerticesChangeEvent) => void) => {
    const startVertices = startVerticesRef.current ?? cloneVertices(vertices);
    const nextVertices = translateVertices(startVertices, event.startPosition, event.position);
    callback?.({
      id,
      vertices: nextVertices,
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
      distance={POLYGON_RADIUS}
      internalOrientation="surface"
      renderOrder={renderOrder}
      draggable={draggable}
      interactive={interactive}
      useAngularScale={false}
      focusContent={
        <HotspotStrokeLine
          color="#75cbd3"
          dashSize={strokeDashSize}
          gapSize={strokeGapSize}
          lineWidth={strokeWidth + 2}
          opacity={1}
          points={strokePoints}
          renderOrder={renderOrder + 2}
        />
      }
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
      <mesh geometry={fillGeometry} renderOrder={renderOrder}>
        <meshBasicMaterial
          color={fill}
          depthWrite={false}
          opacity={Math.max(0, Math.min(fillOpacity, 1))}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <HotspotStrokeLine
        color={stroke}
        dashSize={strokeDashSize}
        gapSize={strokeGapSize}
        lineWidth={strokeWidth}
        opacity={resolvedStrokeOpacity}
        points={strokePoints}
        renderOrder={renderOrder + 1}
      />
    </HotspotAnchor>
  );
}
