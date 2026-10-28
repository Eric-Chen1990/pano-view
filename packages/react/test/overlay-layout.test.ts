import assert from "node:assert/strict";
import { test } from "node:test";
import { getOverlayVisibleRect } from "../src/overlay/visible-rect";

test("embedded dialogs fit the visible viewer when the page is scrolled", () => {
  assert.deepEqual(getOverlayVisibleRect(
    { left: 20, top: -240, width: 1000, height: 560 },
    { left: 0, top: 0, width: 1280, height: 580 },
  ), { left: 0, top: 240, width: 1000, height: 320 });
});

test("fullscreen uses the whole screen and narrow visual viewports clip both axes", () => {
  const fullscreen = { left: 0, top: 0, width: 1280, height: 720 };
  assert.deepEqual(getOverlayVisibleRect(fullscreen, fullscreen), { left: 0, top: 0, width: 1280, height: 720 });
  assert.deepEqual(getOverlayVisibleRect(fullscreen, { left: 100, top: 200, width: 400, height: 300 }), { left: 100, top: 200, width: 400, height: 300 });
});

test("offscreen and not-yet-sized viewers never produce negative available space", () => {
  assert.deepEqual(getOverlayVisibleRect(
    { left: 1400, top: 800, width: 600, height: 500 },
    { left: 0, top: 0, width: 1280, height: 720 },
  ), { left: 0, top: 0, width: 0, height: 0 });
});
