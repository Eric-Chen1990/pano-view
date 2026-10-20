import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";
import { applyHotspotTransform } from "../src/hotspot/transform";

function projectedSize(
  group: Object3D,
  camera: PerspectiveCamera,
  width: number,
  height: number,
) {
  const corners = [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
  ].map(([x, y]) =>
    new Vector3(x, y, 0).applyMatrix4(group.matrixWorld).project(camera),
  );
  return [
    ((Math.max(...corners.map((p) => p.x)) -
      Math.min(...corners.map((p) => p.x))) *
      width) /
      2,
    ((Math.max(...corners.map((p) => p.y)) -
      Math.min(...corners.map((p) => p.y))) *
      height) /
      2,
  ];
}

for (const [width, height] of [
  [900, 500],
  [400, 700],
]) {
  test(`fixed billboard pixels stay constant at the edges and during zoom (${width}x${height})`, () => {
    const camera = new PerspectiveCamera(100, width! / height!, 0.01, 2000);
    camera.position.set(0.2, -0.1, 0.01);
    camera.rotation.set(0.1, 0.4, 0.02);
    camera.updateMatrixWorld();
    const distance = 10;
    const expected = 64 * 0.7;
    const worldSize =
      (expected / height!) *
      2 *
      distance *
      Math.tan(MathUtils.degToRad(100) / 2);
    for (const fov of [40, 75, 100, 120]) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      for (const [x, y] of [
        [0, 0],
        [0.85, 0],
        [-0.85, 0.6],
        [0.8, -0.8],
      ]) {
        const group = new Object3D();
        group.position.copy(
          new Vector3(x, y, 0)
            .unproject(camera)
            .sub(camera.position)
            .normalize()
            .multiplyScalar(distance)
            .add(camera.position),
        );
        applyHotspotTransform(
          group,
          camera,
          "billboard",
          new Quaternion(),
          0,
          "fixed",
          100,
          true,
          worldSize,
          worldSize,
          distance,
        );
        const actual = projectedSize(group, camera, width!, height!);
        for (const pixels of actual)
          assert.ok(
            Math.abs(pixels - expected) < 1e-8,
            `${fov}, ${x}, ${y}: ${actual}`,
          );
      }
    }
  });
}

test("angular and surface hotspot scales retain their existing behavior", () => {
  const camera = new PerspectiveCamera(100, 1.8, 0.01, 2000);
  camera.updateMatrixWorld();
  const group = new Object3D();
  group.position.set(5, 0, -5);
  for (const orientation of ["billboard", "surface"] as const) {
    applyHotspotTransform(
      group,
      camera,
      orientation,
      new Quaternion(),
      0,
      "fov",
      100,
      true,
      2,
      3,
      10,
    );
    assert.deepEqual(group.scale.toArray(), [2, 3, 1]);
  }
  applyHotspotTransform(
    group,
    camera,
    "surface",
    new Quaternion(),
    0,
    "fixed",
    100,
    true,
    2,
    3,
    10,
  );
  assert.deepEqual(group.scale.toArray(), [2, 3, 1]);
  applyHotspotTransform(
    group,
    camera,
    "billboard",
    new Quaternion(),
    0,
    "fixed",
    100,
    false,
    2,
    3,
    10,
  );
  assert.deepEqual(group.scale.toArray(), [1, 1, 1]);
});

test("fixed billboards behind the camera never acquire a negative or invalid scale", () => {
  const camera = new PerspectiveCamera();
  camera.updateMatrixWorld();
  const group = new Object3D();
  group.position.set(0, 0, 10);
  applyHotspotTransform(
    group,
    camera,
    "billboard",
    new Quaternion(),
    0,
    "fixed",
    100,
    true,
    2,
    2,
    10,
  );
  assert.deepEqual(group.scale.toArray(), [0, 0, 1]);
});
