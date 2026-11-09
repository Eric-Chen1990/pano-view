import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSpatialEye, SPATIAL_UI_MASK } from "../src/spatial/render-layer";

test("each eye renders spatial UI after distortion without clearing the panorama", () => {
  const camera = { layers: { mask: 1 | SPATIAL_UI_MASK } };
  const calls: string[] = [];
  const renderer = {
    autoClear: true,
    clearDepth: () => {
      calls.push("depth");
    },
  };
  renderSpatialEye(
    renderer,
    camera,
    () => {
      assert.equal(camera.layers.mask, 1);
      calls.push("panorama + tooltip/distortion");
    },
    () => {
      assert.equal(camera.layers.mask, SPATIAL_UI_MASK);
      assert.equal(renderer.autoClear, false);
      calls.push("flat dialog");
    },
    () => {
      calls.push("lens aperture");
    }
  );
  assert.deepEqual(calls, [
    "panorama + tooltip/distortion",
    "depth",
    "flat dialog",
    "lens aperture",
  ]);
  assert.equal(camera.layers.mask, 1 | SPATIAL_UI_MASK);
  assert.equal(renderer.autoClear, true);
});

test("a failed custom overlay restores camera layers and autoClear", () => {
  const camera = { layers: { mask: 3 } };
  const renderer = { autoClear: true, clearDepth() {} };
  assert.throws(() =>
    renderSpatialEye(
      renderer,
      camera,
      () => {},
      () => {
        throw new Error("host failure");
      }
    )
  );
  assert.equal(camera.layers.mask, 3);
  assert.equal(renderer.autoClear, true);
});
