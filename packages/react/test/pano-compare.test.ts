import assert from "node:assert/strict";
import { test } from "node:test";
import { PerspectiveCamera, Raycaster, Vector2, Vector3 } from "three";
import { aimComparePointer, comparePaneViewport, compareRects, createCompareHost, normalizeCompareSplit } from "../src/compare/view";

const size = { width: 801, height: 501 };

test("separating the projections moves their centers apart without uncovering either crop", () => {
  const dpr = 1.5;
  for (const layout of ["left-right", "top-bottom"] as const) {
    const axis = layout === "left-right" ? "x" : "y";
    const extent = layout === "left-right" ? "width" : "height";
    let previousDistance = -1;
    for (const separation of [0, 0.25, 0.5, 0.75, 1]) {
      const before = comparePaneViewport(size, layout, "before", separation, dpr);
      const after = comparePaneViewport(size, layout, "after", separation, dpr);
      const distance = (after[axis] + after[extent] / 2) - (before[axis] + before[extent] / 2);
      assert.ok(distance > previousDistance);
      previousDistance = distance;
      for (const split of [0, 0.33, 0.8, 1]) {
        const [first, second] = compareRects(size, layout, split + (0.5 - split) * separation, dpr);
        assert.ok(first[extent] <= before[extent] + 1 / dpr);
        assert.ok(second[axis] >= after[axis] - 1 / dpr);
      }
    }
  }
});

test("wipe bounds meet at one edge at fractional DPR, including both endpoints", () => {
  for (const layout of ["left-right", "top-bottom"] as const) {
    for (const split of [0, 0.33, 0.5, 1]) {
      const [before, after] = compareRects(size, layout, split, 1.5);
      if (layout === "left-right") {
        assert.equal(before.width, after.x);
        assert.equal(after.x + after.width, size.width);
        assert.equal(before.height, after.height);
      } else {
        assert.equal(before.height, after.y);
        assert.equal(after.y + after.height, size.height);
        assert.equal(before.width, after.width);
      }
    }
  }
  assert.equal(normalizeCompareSplit(-1), 0);
  assert.equal(normalizeCompareSplit(2), 1);
  assert.equal(normalizeCompareSplit(Number.NaN), 0.5);
});

test("split pane centers hit the same camera direction in either layout", () => {
  const host = createCompareHost();
  const camera = new PerspectiveCamera(68, size.width / size.height, 0.1, 2000);
  camera.rotation.set(0.3, -0.7, 0.1);
  camera.position.set(0.01, 0.02, 0.03);
  camera.updateMatrixWorld();
  const direction = camera.getWorldDirection(new Vector3());
  const pointer = new Vector2();
  const raycaster = new Raycaster();
  const canvas = {
    getBoundingClientRect: () => ({ left: 40, top: 30, width: size.width * 2, height: size.height * 2 }),
  } as HTMLCanvasElement;
  for (const layout of ["left-right", "top-bottom"] as const) {
    host.setConfig({ layout, presentation: "split-view", split: 0.8, changeSplit: () => {} });
    const rects = host.getRects(size, 1.5)!;
    for (const [index, side] of ["before", "after"].entries()) {
      const rect = rects[index]!;
      const event = {
        clientX: 40 + (rect.x + rect.width / 2) * 2,
        clientY: 30 + (rect.y + rect.height / 2) * 2,
      };
      const hit = aimComparePointer(host, event, canvas, camera, size, 1.5, pointer);
      assert.equal(hit?.side, side);
      assert.equal(hit?.camera.aspect, rect.width / rect.height);
      assert.equal(hit?.camera.fov, camera.fov);
      raycaster.setFromCamera(pointer, hit!.camera);
      assert.ok(raycaster.ray.direction.distanceTo(direction) < 1e-10);
    }
  }
});

test("wheel and pointer events return to the full viewport in wipe mode", () => {
  const host = createCompareHost();
  host.setConfig({ layout: "top-bottom", presentation: "wipe", split: 0.25, changeSplit: () => {} });
  const camera = new PerspectiveCamera();
  assert.equal(host.getPane(camera, size, 1, "before"), null);
  const canvas = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: size.width, height: size.height }),
  } as HTMLCanvasElement;
  assert.equal(aimComparePointer(host, { clientX: 400, clientY: 300 }, canvas, camera, size, 1, new Vector2()), null);
});
