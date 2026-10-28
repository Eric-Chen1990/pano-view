import assert from "node:assert/strict";
import { test } from "node:test";
import { shouldKeepPointerInertia } from "../src/panorama-view-runtime";

test("a fresh drag release preserves inertia, but a paused drag does not", () => {
  assert.equal(shouldKeepPointerInertia(0, 16), true);
  assert.equal(shouldKeepPointerInertia(500, 600), true);
  assert.equal(shouldKeepPointerInertia(500, 601), false);
  assert.equal(shouldKeepPointerInertia(500, 1100), false);
});

test("cancelled input never retains velocity, even immediately after moving", () => {
  assert.equal(shouldKeepPointerInertia(500, 501, true), false);
  assert.equal(shouldKeepPointerInertia(500, 1100, true), false);
});

test("a tap or reset without a velocity sample cannot start inertia", () => {
  assert.equal(shouldKeepPointerInertia(null, 0), false);
  assert.equal(shouldKeepPointerInertia(null, 1000), false);
});
