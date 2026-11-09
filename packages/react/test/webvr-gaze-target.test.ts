import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Raycaster,
  Vector3,
} from "three";
import { resolveGazeTarget, type R3FObject } from "../src/webvr/gaze-target";
function fixture() {
  const scene = new Group();
  const hotspot = new Mesh(
    new PlaneGeometry(1, 1),
    new MeshBasicMaterial()
  ) as R3FObject;
  hotspot.position.z = -4;
  hotspot.__r3f = { handlers: { onClick: () => {}, onPointerOver: () => {} } };
  const panel = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial());
  panel.position.set(3, 0, -2);
  panel.userData.panoGazeResolve = () => ({
    id: "control",
    activate: () => {},
  });
  scene.add(hotspot, panel);
  const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
  const hits = () => {
    scene.updateMatrixWorld(true);
    return ray.intersectObjects(scene.children, true);
  };
  const dispose = () => {
    hotspot.geometry.dispose();
    hotspot.material.dispose();
    panel.geometry.dispose();
    panel.material.dispose();
  };
  return { hotspot, panel, hits, dispose };
}
test("an off-axis nonmodal control bar leaves centered hotspot gaze available", () => {
  const f = fixture();
  try {
    const route = resolveGazeTarget(f.hits(), {
      modalOpen: false,
      panelsOpen: true,
    });
    assert.equal(route.channel, "hotspot");
    if (route.channel === "hotspot")
      assert.equal(route.target?.eventObject, f.hotspot);
  } finally {
    f.dispose();
  }
});
test("hitting a control bar takes priority over the hotspot behind it", () => {
  const f = fixture();
  try {
    f.panel.position.x = 0;
    const route = resolveGazeTarget(f.hits(), {
      modalOpen: false,
      panelsOpen: true,
    });
    assert.equal(route.channel, "spatial");
    if (route.channel === "spatial") assert.equal(route.action?.id, "control");
    f.panel.userData.panoGazeResolve = () => null;
    assert.deepEqual(
      resolveGazeTarget(f.hits(), { modalOpen: false, panelsOpen: true }),
      { channel: "spatial", action: null }
    );
  } finally {
    f.dispose();
  }
});
test("an open dialog blocks background hotspot gaze even outside its bounds", () => {
  const f = fixture();
  try {
    assert.deepEqual(
      resolveGazeTarget(f.hits(), { modalOpen: true, panelsOpen: false }),
      { channel: "spatial", action: null }
    );
  } finally {
    f.dispose();
  }
});
