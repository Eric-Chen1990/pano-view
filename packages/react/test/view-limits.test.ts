import assert from "node:assert/strict";
import { test } from "node:test";
import { applyLimitedYawDelta, constrainViewYaw, limitedYawDelta, normalizeViewYaw, parseViewLimits, resolveViewLimits } from "../src/view-limits";
import { parsePanoProject, loadPanoProject, PanoDataError } from "../src/data";

const ordinary = { min: -170, max: 170 };
const seam = { min: 170, max: -170 };
test("yaw limits support normal, seam, full-circle and locked arcs", () => {
  assert.equal(constrainViewYaw(179, ordinary), 170);
  assert.equal(constrainViewYaw(-179, ordinary), -170);
  assert.equal(constrainViewYaw(0, seam), 170);
  assert.equal(constrainViewYaw(185, seam), -175);
  assert.equal(constrainViewYaw(900, { min: -180, max: 180 }), -180);
  assert.equal(constrainViewYaw(30, { min: 12, max: 12 }), 12);
  assert.equal(constrainViewYaw(0, { min: 180, max: -180 }), -180);
  assert.equal(applyLimitedYawDelta(160, 720, ordinary), 170);
  assert.equal(applyLimitedYawDelta(175, 20, seam), -170);
  assert.equal(applyLimitedYawDelta(-175, -20, seam), 170);
});
test("navigation and smoothing stay inside the arc, including long permitted routes", () => {
  for (const [range, from, to, expected] of [[ordinary, 160, -160, -320], [seam, 175, -175, 10]] as const) {
    for (const shortest of [true, false]) {
      const delta = limitedYawDelta(from, to, range, shortest);
      assert.equal(delta, expected);
      for (let step = 0; step <= 100; step++) {
        const yaw = normalizeViewYaw(from + delta * step / 100);
        assert.ok(Math.abs(constrainViewYaw(yaw, range) - yaw) < 1e-8);
      }
    }
  }
  assert.equal(limitedYawDelta(0, 720, undefined, false), 720);
});
test("scene axes override independently; legacy defaults retain soft limits", () => {
  const base = { yaw: ordinary, fov: { min: 40, max: 80 } };
  const limits = resolveViewLimits(base, { yaw: seam, pitch: { min: 5, max: 5 } });
  assert.deepEqual(limits, { yaw: seam, pitch: { min: 5, max: 5 }, fov: base.fov, hardPitch: true, hardFov: true });
  assert.deepEqual(resolveViewLimits(undefined, undefined, 20, 110), { yaw: undefined, pitch: { min: -90, max: 90 }, fov: { min: 20, max: 110 }, hardPitch: false, hardFov: false });
});
test("limits validate finite complete pairs and physical domains", () => {
  for (const value of [null, [], 3, { yaw: [] }, { yaw: { min: 0 } }, { yaw: { min: -181, max: 0 } }, { pitch: { min: 10, max: -10 } }, { pitch: { min: -91, max: 90 } }, { fov: { min: 0, max: 180 } }, { fov: { min: NaN, max: Infinity } }])
    assert.throws(() => parseViewLimits(value));
  assert.equal(parseViewLimits(undefined), undefined);
  const input = { yaw: seam, fov: { min: 60, max: 60 } };
  assert.deepEqual(parseViewLimits(input), input);
  assert.notEqual(parseViewLimits(input)!.yaw, input.yaw);
});
test("project parsing and loading preserve limits on runtime scenes without changing initial views", async () => {
  const project = { schemaVersion: 1 as const, scenes: [{ id: "room", source: { viewerConfig: { type: "sphereTile" as const, indexBase: 0 as const, previewUrl: "preview.png", urlTemplate: "tiles/%l/%v_%h.png", multires: { tileSize: 512, levels: [{ width: 1024, height: 512 }] } } }, initialView: { yaw: 0, pitch: 0, fov: 75 }, viewLimits: { yaw: seam, fov: { min: 50, max: 60 } } }] };
  assert.deepEqual(parsePanoProject(project).scenes[0]!.viewLimits, project.scenes[0]!.viewLimits);
  const loaded = await loadPanoProject(project, { baseUrl: "https://test.invalid/sub/" });
  assert.deepEqual(loaded.scenes[0]!.scene.viewLimits, project.scenes[0]!.viewLimits);
  assert.deepEqual(loaded.scenes[0]!.initialView, project.scenes[0]!.initialView);
  assert.throws(() => parsePanoProject({ ...project, scenes: [{ ...project.scenes[0], viewLimits: { pitch: { min: 9, max: 1 } } }] }), (error: unknown) => error instanceof PanoDataError && error.sceneId === "room" && error.field === "scenes[0].viewLimits.pitch");
});
