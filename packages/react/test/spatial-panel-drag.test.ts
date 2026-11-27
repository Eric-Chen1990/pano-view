import assert from "node:assert/strict";
import { test } from "node:test";
import { Group, Ray, Vector3 } from "three";
import { createSpatialPanelDrag } from "../src/spatial/panel-drag";

test("dragging preserves the grab offset and orientation in world space", () => {
  const parent = new Group();
  parent.position.set(2, 1, 0);
  parent.rotation.y = Math.PI / 4;
  const panel = new Group();
  parent.add(panel);
  panel.position.set(0, 0, -2);
  const originalPosition = panel.position.clone();
  const originalOrientation = panel.quaternion.clone();
  const hit = panel.localToWorld(new Vector3(0.3, 0.2, 0));
  const direction = new Vector3(0, 0, -1).transformDirection(parent.matrixWorld);
  const ray = new Ray(hit.clone().addScaledVector(direction, -2), direction);
  const move = createSpatialPanelDrag(panel, hit, ray);
  assert.ok(move);
  move(ray);
  assert.ok(panel.position.distanceTo(originalPosition) < 1e-9);

  // The ray can leave the original mesh and still move the captured dialog.
  const shift = new Vector3(1.2, 0.7, 0).applyQuaternion(parent.quaternion);
  move(new Ray(ray.origin.clone().add(shift), ray.direction));
  assert.ok(panel.position.distanceTo(new Vector3(1.2, 0.7, -2)) < 1e-9);
  assert.ok(panel.quaternion.equals(originalOrientation));
  assert.ok(panel.localToWorld(new Vector3(0.3, 0.2, 0)).distanceTo(hit.add(shift)) < 1e-9);
});

test("parallel, behind-controller, and invalid poses leave the panel in place", () => {
  const panel = new Group();
  panel.position.setZ(-2);
  const hit = panel.position.clone();
  const ray = new Ray(new Vector3(), new Vector3(0, 0, -1));
  const move = createSpatialPanelDrag(panel, hit, ray);
  assert.ok(move);
  for (const direction of [new Vector3(1, 0, 0), new Vector3(0, 0, 1), new Vector3(NaN, 0, -1)]) {
    move(new Ray(ray.origin, direction));
    assert.deepEqual(panel.position, new Vector3(0, 0, -2));
  }
});
