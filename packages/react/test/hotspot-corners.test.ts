import assert from "node:assert/strict";
import { test } from "node:test";
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { fitHotspotCorners, getHotspotCornerCenter, moveHotspotCorners, rotateHotspotCorners, validateHotspotCorners } from "../src/hotspot/corners";
import { panoPositionToVector3 } from "../src/hotspot/coordinates";
import type { HotspotCorners } from "../src/hotspot/types";

const trapezoid: HotspotCorners = [
  { yaw: -13, pitch: 7 }, { yaw: 7, pitch: 10 },
  { yaw: 15, pitch: -5 }, { yaw: -9, pitch: -6 },
];
const seam: HotspotCorners = [
  { yaw: 175, pitch: 8 }, { yaw: -176, pitch: 10 },
  { yaw: -171, pitch: -7 }, { yaw: 172, pitch: -9 },
];

test("four rays form one planar UV mapping with continuous texture interpolation", () => {
  const fit = fitHotspotCorners(trapezoid);
  assert.ok(fit);
  for (const [index, vertex] of fit.vertices.entries()) {
    assert.ok(vertex.clone().normalize().distanceTo(panoPositionToVector3(trapezoid[index]!)) < 1e-12);
  }
  const [a, b, c, d] = fit.vertices;
  assert.ok(a.clone().add(c).distanceTo(b.clone().add(d)) < 1e-10);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(fit.vertices.flatMap((p) => p.toArray()), 3));
  geometry.setAttribute("uv", new Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  geometry.setIndex([0, 2, 1, 0, 3, 2]);
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  const origin = new Vector3();
  for (const [u, v] of [[0.25, 0.68], [0.34, 0.49], [0.8, 0.6], [0.76, 0.13]] as const) {
    const direction = d.clone().addScaledVector(c.clone().sub(d), u).addScaledVector(a.clone().sub(d), v);
    const [hit] = new Raycaster(origin, direction.normalize()).intersectObject(mesh);
    assert.ok(hit?.uv);
    assert.ok(Math.hypot(hit.uv.x - u, hit.uv.y - v) < 1e-6);
  }
  geometry.dispose();
  mesh.material.dispose();
});

test("rotation and movement preserve angular shape across the yaw seam", () => {
  const center = getHotspotCornerCenter(seam);
  assert.ok(center && Math.abs(center.yaw) > 170);
  const rotated = rotateHotspotCorners(seam, 90);
  const newCenter = getHotspotCornerCenter(rotated);
  assert.ok(newCenter);
  assert.ok(panoPositionToVector3(newCenter).distanceTo(panoPositionToVector3(center)) < 1e-12);
  const target = { yaw: -60, pitch: 80 };
  const moved = moveHotspotCorners(rotated, center, target);
  const movedCenter = getHotspotCornerCenter(moved);
  assert.ok(movedCenter);
  assert.ok(panoPositionToVector3(movedCenter).distanceTo(panoPositionToVector3(target)) < 1e-12);
  const angularEdge = ([a, b]: HotspotCorners) => panoPositionToVector3(a).angleTo(panoPositionToVector3(b));
  assert.ok(Math.abs(angularEdge(seam) - angularEdge(moved)) < 1e-12);
});

test("crossed, duplicate, concave, degenerate and non-finite corners are rejected", () => {
  const [a, b, c, d] = trapezoid;
  assert.equal(validateHotspotCorners([a, c, b, d]), false);
  assert.equal(validateHotspotCorners([a, b, b, d]), false);
  assert.equal(validateHotspotCorners([a, b, { yaw: 0, pitch: 4 }, d]), false);
  assert.equal(validateHotspotCorners([a, { ...a, pitch: 2 }, { ...a, pitch: -1 }, { ...a, pitch: -4 }]), false);
  assert.equal(validateHotspotCorners([a, b, c, { yaw: 0, pitch: NaN }]), false);
});
