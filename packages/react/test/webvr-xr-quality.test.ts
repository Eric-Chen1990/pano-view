import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampWebVRFoveation,
  resolveWebVRFrameRateOption,
} from "../src/webvr/xr-quality";

test("foveation clamps to 0–1 and ignores non-finite input", () => {
  assert.equal(clampWebVRFoveation(undefined), undefined);
  assert.equal(clampWebVRFoveation(Number.NaN), undefined);
  assert.equal(clampWebVRFoveation(-1), 0);
  assert.equal(clampWebVRFoveation(0.4), 0.4);
  assert.equal(clampWebVRFoveation(2), 1);
});

test("named frame rates pass through", () => {
  assert.equal(resolveWebVRFrameRateOption("high"), "high");
  assert.equal(resolveWebVRFrameRateOption("mid"), "mid");
  assert.equal(resolveWebVRFrameRateOption("low"), "low");
  assert.equal(resolveWebVRFrameRateOption(undefined), undefined);
});

test("numeric frame rates pick the closest supported rate", () => {
  const option = resolveWebVRFrameRateOption(75);
  assert.equal(typeof option, "function");
  if (typeof option !== "function") {
    return;
  }
  assert.equal(option([60, 72, 90]), 72);
  assert.equal(option([60, 90]), 60);
  assert.equal(option([]), false);

  const high = resolveWebVRFrameRateOption(88);
  assert.equal(typeof high, "function");
  if (typeof high === "function") {
    assert.equal(high([60, 90]), 90);
  }
});
