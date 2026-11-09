import assert from "node:assert/strict";
import { test } from "node:test";
import { Matrix4, Object3D, PerspectiveCamera, Vector3 } from "three";
import {
  hotspotScaleMode,
  tooltipScaleMode,
} from "../../../shared/hotspot-rendering";
import { tooltipWorldMatrix, tooltipScreenMatrix } from "../src/hotspot/tooltip-transform";
import { parsePanoProject } from "../src/data";

test("surface scaling is mandatory; floating defaults and tooltip overrides resolve independently", () => {
  assert.equal(hotspotScaleMode(), "fixed");
  assert.equal(hotspotScaleMode("billboard", "fov"), "fov");
  assert.equal(hotspotScaleMode("surface", "fixed"), "fov");
  for (const scale of ["fov", "fixed"] as const) {
    assert.equal(tooltipScaleMode("billboard", undefined, scale), scale);
    assert.equal(tooltipScaleMode("billboard", "inherit", scale), scale);
    assert.equal(tooltipScaleMode("billboard", "fixed", scale), "fixed");
    assert.equal(tooltipScaleMode("billboard", "fov", scale), "fov");
    assert.equal(tooltipScaleMode("surface", "fixed", scale), "fov");
  }
});

test("tooltip pixels remain fixed at edges and fov tooltips grow on zoom despite parent transforms", () => {
  const camera = new PerspectiveCamera(75, 1.8, 0.01, 2000);
  const parent = new Object3D();
  const anchor = new Object3D();
  parent.add(anchor);
  parent.scale.set(12, 3, 1);
  parent.rotation.z = 0.7;
  const measure = (fov: number, mode: "fixed" | "fov", x: number) => {
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    parent.position.set(x, 0, -10);
    parent.updateMatrixWorld(true);
    const matrix = tooltipWorldMatrix(
      new Matrix4(),
      anchor,
      camera,
      800,
      "billboard",
      mode,
      75,
    );
    const left = new Vector3().applyMatrix4(matrix).project(camera);
    const right = new Vector3(100, 0, 0).applyMatrix4(matrix).project(camera);
    return ((right.x - left.x) * 1440) / 2;
  };
  for (const x of [0, 5, -5])
    for (const fov of [40, 75, 110])
      assert.ok(Math.abs(measure(fov, "fixed", x) - 100) < 1e-8);
  assert.ok(measure(40, "fov", 0) > measure(75, "fov", 0));
});

test("surface tooltip stays on the sphere with its plane facing inward", () => {
  const camera = new PerspectiveCamera();
  camera.updateMatrixWorld();
  const anchor = new Object3D();
  anchor.position.set(3, 4, -10);
  anchor.scale.set(50, 2, 1);
  anchor.rotation.z = 1;
  anchor.updateMatrixWorld();
  const matrix = tooltipWorldMatrix(
    new Matrix4(),
    anchor,
    camera,
    800,
    "surface",
    "fixed",
    75,
  );
  const position = new Vector3().setFromMatrixPosition(matrix);
  assert.ok(Math.abs(position.length() - 990) < 1e-8);
  assert.ok(
    new Vector3(0, 0, 1).transformDirection(matrix).dot(position.normalize()) <
      -0.999999,
  );
});

test("tooltip configuration round-trips for all categories and rejects invalid enums", () => {
  for (const type of ["image", "polygon", "polyline"] as const) {
    const hotspot = {
      type,
      id: "h",
      ...(type === "image"
        ? { position: { yaw: 0, pitch: 0 }, src: "image.png" }
        : {
            vertices: [
              { yaw: 0, pitch: 0 },
              { yaw: 10, pitch: 0 },
              { yaw: 5, pitch: 10 },
            ],
          }),
      tooltipMode: "surface",
      tooltipScaleMode: "fixed",
    };
    const project = {
      schemaVersion: 1,
      scenes: [
        { id: "s", source: { viewerUrl: "viewer.json" }, hotspots: [hotspot] },
      ],
    };
    assert.deepEqual(
      parsePanoProject(project).scenes[0]!.hotspots![0],
      hotspot,
    );
    for (const key of ["tooltipMode", "tooltipScaleMode"])
      assert.throws(() =>
        parsePanoProject({
          ...project,
          scenes: [
            {
              ...project.scenes[0],
              hotspots: [{ ...hotspot, [key]: "invalid" }],
            },
          ],
        }),
      );
  }
});


test("CSS tooltip projection remains invertible and preserves pixel offsets", () => {
  const camera = new PerspectiveCamera(75, 1.6, 0.01, 2000);
  camera.updateMatrixWorld();
  const anchor = new Object3D();
  anchor.position.set(0, 0, -10);
  anchor.updateMatrixWorld();
  const world = tooltipWorldMatrix(new Matrix4(), anchor, camera, 500, "billboard", "fixed", 75);
  const screen = tooltipScreenMatrix(new Matrix4(), world, camera, 800, 500, 0, -12);
  assert.ok(Math.abs(screen.determinant()) > 1e-8, "singular CSS matrices hide tooltip contents");
  const origin = new Vector3().applyMatrix4(screen);
  const pixel = new Vector3(1, 1, 0).applyMatrix4(screen);
  assert.ok(Math.abs(origin.x - 400) < 1e-8);
  assert.ok(Math.abs(origin.y - 238) < 1e-8);
  assert.ok(Math.abs(pixel.x - origin.x - 1) < 1e-8);
  assert.ok(Math.abs(pixel.y - origin.y - 1) < 1e-8);
});
