import assert from "node:assert/strict";
import test from "node:test";
import {
  clampPanoGridDivisions,
  countGridSegments,
  createCubeGridPositions,
  createSphereGridPositions,
  sphereMeridianCount,
  sphereParallelCount,
  sphereYawStepDegrees,
} from "../src/grid/geometry";
import { DEFAULT_PANORAMA_RADIUS } from "../src/panorama-radius";

function eachEndpoint(positions: Float64Array, visit: (x: number, y: number, z: number) => void) {
  for (let i = 0; i < positions.length; i += 3) {
    visit(positions[i], positions[i + 1], positions[i + 2]);
  }
}

function segmentKey(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): string {
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  const a = [round(ax), round(ay), round(az)] as const;
  const b = [round(bx), round(by), round(bz)] as const;
  const ordered =
    a[0] < b[0] ||
    (a[0] === b[0] && a[1] < b[1]) ||
    (a[0] === b[0] && a[1] === b[1] && a[2] <= b[2])
      ? [a, b]
      : [b, a];
  return ordered.map((point) => point.join(",")).join("|");
}

test("cube grid segment count is 12 times divisions after shared-edge dedupe", () => {
  for (const divisions of [1, 2, 8, 16]) {
    const positions = createCubeGridPositions(divisions, 10);
    assert.equal(countGridSegments(positions), 12 * divisions);
  }
});

test("cube grid points lie on the cube shell of the requested radius", () => {
  const radius = 25;
  const positions = createCubeGridPositions(4, radius);
  eachEndpoint(positions, (x, y, z) => {
    const onFace =
      Math.abs(Math.abs(x) - radius) < 1e-9 ||
      Math.abs(Math.abs(y) - radius) < 1e-9 ||
      Math.abs(Math.abs(z) - radius) < 1e-9;
    assert.ok(onFace);
    assert.ok(Math.abs(x) <= radius + 1e-9);
    assert.ok(Math.abs(y) <= radius + 1e-9);
    assert.ok(Math.abs(z) <= radius + 1e-9);
  });
});

test("cube grid does not duplicate shared border segments", () => {
  const positions = createCubeGridPositions(3, 10);
  const keys = new Set<string>();
  for (let i = 0; i < positions.length; i += 6) {
    const key = segmentKey(
      positions[i],
      positions[i + 1],
      positions[i + 2],
      positions[i + 3],
      positions[i + 4],
      positions[i + 5],
    );
    assert.equal(keys.has(key), false, `duplicate segment ${key}`);
    keys.add(key);
  }
});

test("sphere density matches cube-face angular step across 90 degrees", () => {
  const divisions = 8;
  assert.equal(sphereYawStepDegrees(divisions), 11.25);
  assert.equal(sphereMeridianCount(divisions), 32);
  assert.equal(sphereParallelCount(divisions), 16);
});

test("sphere grid points lie on the panorama sphere", () => {
  const radius = 40;
  const positions = createSphereGridPositions(8, radius);
  eachEndpoint(positions, (x, y, z) => {
    assert.ok(Math.abs(Math.hypot(x, y, z) - radius) < 1e-9);
  });
});

test("sphere grid uses denser meridians than the raw divisions value", () => {
  const divisions = 8;
  const positions = createSphereGridPositions(divisions, DEFAULT_PANORAMA_RADIUS);
  const meridians = sphereMeridianCount(divisions);
  const yawStep = sphereYawStepDegrees(divisions);
  const pitchStep = yawStep;
  const meridianSegments = Math.max(sphereParallelCount(divisions) * 4, 48);
  const parallelSegments = Math.max(meridians * 2, 64);
  let parallelCount = 0;
  for (let pitch = -90 + pitchStep; pitch < 90 - 1e-9; pitch += pitchStep) {
    parallelCount += 1;
  }
  assert.equal(
    countGridSegments(positions),
    meridians * meridianSegments + parallelCount * parallelSegments,
  );
  assert.equal(meridians, 32);
  assert.equal(parallelCount, 15);
});

test("sphere grid keeps a single seam meridian at the ±180 boundary", () => {
  const divisions = 4;
  const meridians = sphereMeridianCount(divisions);
  const yawStep = sphereYawStepDegrees(divisions);
  const yaws = Array.from({ length: meridians }, (_, index) => {
    const yaw = -180 + yawStep * index;
    return yaw === 180 ? -180 : yaw;
  });
  assert.equal(yaws.includes(-180), true);
  assert.equal(yaws.includes(180), false);
  assert.equal(new Set(yaws.map((yaw) => Math.round(yaw))).size, meridians);
  // Geometry starts each meridian at the south pole then steps toward the north.
  const positions = createSphereGridPositions(divisions, 10);
  const meridianSegments = Math.max(sphereParallelCount(divisions) * 4, 48);
  const firstEquatorIndex = Math.round(meridianSegments / 2);
  const [x, , z] = [
    positions[firstEquatorIndex * 6],
    positions[firstEquatorIndex * 6 + 1],
    positions[firstEquatorIndex * 6 + 2],
  ];
  const yaw = (Math.atan2(x, -z) * 180) / Math.PI;
  assert.ok(Math.abs(Math.abs(yaw) - 180) < 1e-6 || Math.abs(yaw + 180) < 1e-6);
});

test("grid divisions clamp to the projection ranges", () => {
  assert.equal(clampPanoGridDivisions("sphere", 1), 2);
  assert.equal(clampPanoGridDivisions("sphere", 100), 64);
  assert.equal(clampPanoGridDivisions("cube", 0), 1);
  assert.equal(clampPanoGridDivisions("cube", 100), 64);
  assert.equal(clampPanoGridDivisions("sphere", Number.NaN), 8);
});
