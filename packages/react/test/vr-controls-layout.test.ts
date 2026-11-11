import assert from "node:assert/strict";
import { test } from "node:test";
import { allowsAutomaticMediaControls, controlGroupLayout, shouldPauseSurfaceMedia } from "../src/controls/layout";
import { tooltipBaseline, tooltipLines, tooltipPadding } from "../src/hotspot/tooltip-layout";
test("tooltip uses CSS padding shorthand and balanced glyph space without adding a line", () => {
  assert.deepEqual(tooltipPadding("5px 10px"), [5, 10, 5, 10]);
  assert.deepEqual(tooltipPadding("1px 2px 3px 4px"), [1, 2, 3, 4]);
  assert.deepEqual(tooltipLines("text", 200, text => text.length * 10), ["text"]);
  assert.deepEqual(tooltipLines("中文测试", 40, text => text.length * 20), ["中文", "测试"]);
  assert.deepEqual(tooltipLines("first\nsecond", 200, text => text.length * 10), ["first", "second"]);
  assert.deepEqual(tooltipLines("", 200, () => 0), []);
  const baseline = tooltipBaseline(5, 27, 14, 4);
  assert.equal(baseline - 14 - 5, 5 + 27 - (baseline + 4));
});
test("six media controls fit one centered row and wrap safely in a narrow panel", () => {
  const wide = controlGroupLayout(6, 640);
  assert.equal(wide.height, 64);
  assert.equal(wide.buttons[0]!.x, 156);
  assert.ok(wide.buttons.every(button => button.y === 8 && button.w === 48));
  const narrow = controlGroupLayout(6, 180);
  assert.equal(narrow.height, 120);
  assert.ok(narrow.buttons.every(button => button.x >= 8 && button.x + button.w <= 172));
  assert.equal(controlGroupLayout(0, 640).height, 0);
});
test("host narration opts out while ordinary audio and video remain automatic", () => {
  assert.equal(allowsAutomaticMediaControls({ getAttribute: () => "none" }), false);
  assert.equal(allowsAutomaticMediaControls({ getAttribute: () => null }), true);
});
test("VR exit preserves open-dialog playback; closing or removing the dialog stops it", () => {
  assert.equal(shouldPauseSurfaceMedia(true, true), false);
  assert.equal(shouldPauseSurfaceMedia(true, false), true);
  assert.equal(shouldPauseSurfaceMedia(false, true), true);
});

test("reticle ring has 24 real gaps and a progress-compatible triangle index", async () => {
  const { createReticleRing } = await import("../src/webvr/reticle-geometry");
  const ring = createReticleRing(.05, .058);
  assert.equal(ring.index!.count, 48 * 6);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => ring.index!.getX(i * 6)), [0, 1, 4, 5, 8, 9]);
  ring.dispose();
});
