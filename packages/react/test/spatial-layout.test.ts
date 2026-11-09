import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  Vector3,
} from "three";
import { spatialPanelScale, spatialUvToPoint } from "../src/spatial/layout";
import { createGazeActionState } from "../src/spatial/gaze-action";
import { SPATIAL_UI_LAYER } from "../src/spatial/render-layer";

test("short and tall panels stay inside comfortable angular bounds", () => {
  for (const height of [200, 450, 688, 1000, 1600]) {
    const scale = spatialPanelScale(height);
    const yaw = (2 * Math.atan((640 * scale) / 4) * 180) / Math.PI;
    const pitch = (2 * Math.atan((height * scale) / 4) * 180) / Math.PI;
    assert.ok(yaw <= 32.00001);
    assert.ok(pitch <= 40.00001);
  }
});

test("a gaze ray on the spatial layer maps to the resized header close button and activates once", () => {
  const height = 540,
    scale = spatialPanelScale(height);
  const panel = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial());
  panel.position.z = -2;
  panel.scale.set(640 * scale, height * scale, 1);
  panel.layers.set(SPATIAL_UI_LAYER);
  panel.updateMatrixWorld();
  const target = new Vector3(
    (592 / 640 - 0.5) * 640 * scale,
    (0.5 - 48 / height) * height * scale,
    -2
  );
  const ray = new Raycaster(new Vector3(), target.normalize());
  ray.layers.enable(SPATIAL_UI_LAYER);
  const hit = ray.intersectObject(panel)[0];
  assert.ok(hit?.uv);
  const point = spatialUvToPoint(hit.uv, height);
  assert.ok(Math.abs(point.x - 592) < 0.001);
  assert.ok(Math.abs(point.y - 48) < 0.001);
  let closed = 0;
  const action = {
    id: "header-close",
    activate: () => {
      closed++;
    },
  };
  const gaze = createGazeActionState();
  for (let i = 0; i < 120; i++) gaze.tick(action, 1 / 60, 1500);
  assert.equal(closed, 1);
  gaze.stop();
  panel.geometry.dispose();
  panel.material.dispose();
});
