import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector2,
  Vector3,
} from "three";
import { applyHotspotTransform, resolveFloatingHotspotDistance, selectionFrameScale } from "../src/hotspot/transform";
import { WEBVR_PROFILES } from "../src/webvr/profiles";
import { syncStereoCameras } from "../src/webvr/stereo";
import { createWebVRStereoView } from "../src/webvr/stereo-view";

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

test("VR billboard compensation uses eye projection and keeps the center-view orientation", () => {
  const camera = new PerspectiveCamera(50, 1, 0.1, 2000);
  const group = new Object3D();
  for (const eyeFov of [40, 75, 100]) {
    const eye = new PerspectiveCamera(eyeFov, 1, 0.1, 2000);
    for (const yaw of [0, 0.4, -0.6]) {
      camera.rotation.set(0.1, yaw, 0.03);
      camera.updateMatrixWorld();
      eye.quaternion.copy(camera.quaternion);
      eye.updateMatrixWorld();
      for (const offset of [0, 0.5, -0.45]) {
        group.position.set(offset, 0, -1).normalize().multiplyScalar(10).applyQuaternion(camera.quaternion);
        applyHotspotTransform(group, camera, "billboard", new Quaternion(), 15, "fixed", 75,
          true, 2, 1, 10, eye.projectionMatrix.elements[5]);
        const expected = (Math.cos(Math.PI / 12) + 2 * Math.sin(Math.PI / 12)) * 100
          / (20 * Math.tan(MathUtils.degToRad(75) / 2));
        assert.ok(Math.abs(projectedSize(group, eye, 100, 100)[1]! - expected) < 1e-8);
        const expectedOrientation = camera.quaternion.clone().multiply(
          new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 12),
        );
        assert.ok(1 - Math.abs(group.quaternion.dot(expectedOrientation)) < 1e-10);
        assert.equal(group.scale.x / group.scale.y, 2);
      }
    }
  }
});

test("fallback stereo projects nearby hotspots at a different depth than the panorama", () => {
  const camera = new PerspectiveCamera(75, 2, 0.1, 2000);
  const view = createWebVRStereoView();
  const profile = WEBVR_PROFILES["cardboard-v2"];
  const renderer = { getSize: (target: Vector2) => target.set(1000, 500), getPixelRatio: () => 1 };
  syncStereoCameras(view, camera, profile, 6.5, 1, new Vector2(), renderer);
  const { cameraL, cameraR } = view.stereo;
  const disparity = (distance: number) => {
    const point = new Vector3(0, 0, -distance);
    return point.clone().project(cameraL).x - point.project(cameraR).x;
  };
  assert.ok(Math.abs(disparity(10) - disparity(996)) > 0.005);

  const group = new Object3D();
  group.position.set(0, 0, -10);
  const baseline = new PerspectiveCamera(75, 1, 0.1, 2000);
  applyHotspotTransform(group, baseline, "billboard", new Quaternion(), 0, "fixed", 75, true, 2, 1, 10);
  const expectedHeight = projectedSize(group, baseline, 100, 100)[1]!;
  const projectionScaleY = view.hotspotView.projectionScaleY;
  assert.ok(projectionScaleY);
  applyHotspotTransform(group, camera, "billboard", new Quaternion(), 0, "fixed", 75, true, 2, 1, 10, projectionScaleY);
  for (const eye of [cameraL, cameraR]) {
    assert.ok(Math.abs(projectedSize(group, eye, 100, 100)[1]! / expectedHeight - 1) < 0.02);
  }
});

test("VR applies a minimum floating distance and restores the authored radius on exit", () => {
  assert.equal(resolveFloatingHotspotDistance(0.25, 995, false), 0.25);
  assert.equal(resolveFloatingHotspotDistance(0.25, 995, true), 2);
  assert.equal(resolveFloatingHotspotDistance(0.25, 995, false), 0.25);
  assert.equal(resolveFloatingHotspotDistance(10, 995, true), 10);
  assert.equal(resolveFloatingHotspotDistance(2000, 995, true), 995);
  assert.equal(resolveFloatingHotspotDistance(undefined, 995, true), 10);

  const group = new Object3D();
  const camera = new PerspectiveCamera(75, 1, 0.1, 2000);
  for (const inVR of [false, true, false]) {
    const distance = resolveFloatingHotspotDistance(0.25, 995, inVR);
    group.position.set(0, 0, -distance);
    applyHotspotTransform(group, camera, "billboard", new Quaternion(), 0, "fov", 75, true,
      distance * 0.2, distance * 0.1, distance, inVR ? camera.projectionMatrix.elements[5] : undefined);
    assert.ok(Math.abs(projectedSize(group, camera, 100, 100)[1]! - 5 * camera.projectionMatrix.elements[5]!) < 1e-8);
  }
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

test("selection frame scale keeps a screen-pixel gap outside a non-square hotspot", () => {
  const fov = 75;
  const depth = 1000;
  const viewportHeight = 800;
  const outset = 4.5;
  const worldScaleX = 120;
  const worldScaleY = 40;
  const [scaleX, scaleY] = selectionFrameScale(
    worldScaleX,
    worldScaleY,
    depth,
    fov,
    viewportHeight,
    outset,
  );
  const pixelsPerWorldUnit =
    viewportHeight / (2 * Math.tan(MathUtils.degToRad(fov) * 0.5) * depth);
  const extraPixels = (scale: number, worldScale: number) =>
    (scale * 0.5 - 0.5) * worldScale * pixelsPerWorldUnit;
  assert.ok(Math.abs(extraPixels(scaleX, worldScaleX) - outset) < 1e-6);
  assert.ok(Math.abs(extraPixels(scaleY, worldScaleY) - outset) < 1e-6);
  assert.ok(scaleX > 1 && scaleY > scaleX);
  assert.deepEqual(selectionFrameScale(0, 0, depth, fov, viewportHeight, outset), [1, 1]);
});
