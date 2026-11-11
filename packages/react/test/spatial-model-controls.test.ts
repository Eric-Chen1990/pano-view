import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSurfaceModelAdapter } from "../src/spatial/model-controls";
import { modelActions } from "../src/controls/actions";
import type { PanoSpatialControlAdapter } from "../src/spatial/host";

function fixture() {
  const node = {} as HTMLElement;
  const other = {} as HTMLElement;
  const descendants = new Set([node]);
  const surface = { contains: (candidate: Node | null) => descendants.has(candidate as HTMLElement) };
  let yaw = 0;
  const model: PanoSpatialControlAdapter = { rotateBy: (value) => { yaw += value; }, zoomBy() {}, resetView() {} };
  const controls = new Map([[node, model]]);
  return { node, other, descendants, surface, model, controls, yaw: () => yaw };
}

test("model footer is present on open and survives gaze moving from model to text, arrows and footer", () => {
  const f = fixture();
  let selected: PanoSpatialControlAdapter | null = null;
  for (const hovered of [null, f.model, null, null, null, f.model, null]) {
    selected = resolveSurfaceModelAdapter(f.surface, f.controls, hovered, selected);
    assert.equal(selected, f.model);
    assert.equal(modelActions(selected!).length, 7);
  }
  modelActions(selected!).find(action => action.id === "right")!.update!(1);
  assert.equal(f.yaw(), 30);
});

test("footer retains the selected model when looking away, but follows another model in the same dialog", () => {
  const f = fixture(), second = { resetView() {} };
  f.descendants.add(f.other); f.controls.set(f.other, second);
  assert.equal(resolveSurfaceModelAdapter(f.surface, f.controls, second, f.model), second);
  assert.equal(resolveSurfaceModelAdapter(f.surface, f.controls, null, second), second);
});

test("removed or external models are never retained by a dialog footer", () => {
  const f = fixture();
  f.descendants.clear();
  assert.equal(resolveSurfaceModelAdapter(f.surface, f.controls, f.model, f.model), null);
  f.descendants.add(f.node); f.controls.clear();
  assert.equal(resolveSurfaceModelAdapter(f.surface, f.controls, null, f.model), null);
});
