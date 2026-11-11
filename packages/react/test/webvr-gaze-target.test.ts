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
import { dispatchGazeHotspotClick, isGazeHotspotClick, resolveGazeTarget, type R3FObject } from "../src/webvr/gaze-target";
import { createGazeActionState } from "../src/spatial/gaze-action";
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
test("an open dialog allows background hotspot gaze outside its bounds", () => {
  const f = fixture();
  try {
    const route = resolveGazeTarget(f.hits(), { modalOpen: true, panelsOpen: false });
    assert.equal(route.channel, "hotspot");
    if (route.channel === "hotspot") assert.equal(route.target?.eventObject, f.hotspot);
  } finally {
    f.dispose();
  }
});

test("dialog content, including blank or disabled areas, blocks hotspots behind it", () => {
  const f = fixture();
  try {
    f.panel.position.x = 0;
    const route = resolveGazeTarget(f.hits(), { modalOpen: true, panelsOpen: false });
    assert.equal(route.channel, "spatial");
    if (route.channel === "spatial") assert.equal(route.action?.id, "control");
    f.panel.userData.panoGazeResolve = () => null;
    assert.deepEqual(resolveGazeTarget(f.hits(), { modalOpen: true, panelsOpen: false }), { channel: "spatial", action: null });
    f.panel.position.x = 3;
    f.hotspot.position.x = 3;
    assert.deepEqual(resolveGazeTarget(f.hits(), { modalOpen: true, panelsOpen: false }), { channel: "hotspot", target: null });
  } finally {
    f.dispose();
  }
});

test("completed gaze closes the old stack top first before activating once and keeps new dialogs", () => {
  const calls: string[] = [];
  const newSurface = { close: () => calls.push("close new") };
  const bottom = { close: () => calls.push("close bottom") };
  const top = { close: () => { calls.push("close top"); surfaces.delete(bottom); surfaces.add(newSurface); } };
  const surfaces = new Set([bottom, top]);
  const event = new Event("click");
  const ordinary = new Event("click");
  const state = createGazeActionState();
  const target = { id: "hotspot", activate: () => dispatchGazeHotspotClick(surfaces, event, () => {
    assert.equal(isGazeHotspotClick(event), true);
    assert.equal(isGazeHotspotClick(ordinary), false);
    assert.ok(surfaces.has(top), "React has not unregistered the old surface yet");
    calls.push("activate");
  }) };
  state.tick(target, 0.02, 100);
  state.tick(target, 0.02, 100);
  state.tick(null, 0.02, 100);
  assert.deepEqual(calls, [], "passing over a hotspot does not close dialogs");
  for (let i = 0; i < 5; i++) state.tick(target, 0.02, 100);
  assert.deepEqual(calls, [], "incomplete dwell does not close dialogs");
  for (let i = 0; i < 10; i++) state.tick(target, 0.02, 100);
  assert.deepEqual(calls, ["close top", "close bottom", "activate"]);
  assert.ok(surfaces.has(newSurface));
  assert.equal(isGazeHotspotClick(event), false, "only the current dispatch is exempt from the modal guard");
});

test("gaze click exemption is cleared when the hotspot handler throws", () => {
  const event = new Event("click");
  assert.throws(() => dispatchGazeHotspotClick([], event, () => {
    assert.equal(isGazeHotspotClick(event), true);
    throw new Error("host handler failed");
  }), /host handler failed/);
  assert.equal(isGazeHotspotClick(event), false);
});
