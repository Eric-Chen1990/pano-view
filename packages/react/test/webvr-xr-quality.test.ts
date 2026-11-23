import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyWebVRFrameRate,
  clampWebVRFoveation,
} from "../src/webvr/xr-quality";

test("foveation clamps to 0–1 and ignores non-finite input", () => {
  assert.equal(clampWebVRFoveation(undefined), undefined);
  assert.equal(clampWebVRFoveation(Number.NaN), undefined);
  assert.equal(clampWebVRFoveation(-1), 0);
  assert.equal(clampWebVRFoveation(0.4), 0.4);
  assert.equal(clampWebVRFoveation(2), 1);
});

test("named and numeric preferences select the same supported XR refresh rates", async () => {
  const requested: number[] = [];
  const session = {
    supportedFrameRates: Float32Array.of(60, 72, 80, 90),
    async updateTargetFrameRate(rate: number) { requested.push(rate); },
  };
  for (const preference of ["low", "mid", "high", undefined, 75, 76] as const) {
    await applyWebVRFrameRate(session, preference);
  }
  assert.deepEqual(requested, [60, 80, 90, 90, 72, 72]);
});

test("unsupported and rejected rate changes leave the XR session usable", async () => {
  const updateTargetFrameRate = (rate: number) => {
    requested.push(rate);
    return Promise.reject(new DOMException("Rate rejected", "NotSupportedError"));
  };
  const requested: number[] = [];
  await applyWebVRFrameRate({ updateTargetFrameRate }, undefined);
  assert.deepEqual(requested, []);
  await applyWebVRFrameRate({ supportedFrameRates: Float32Array.of(72, 90), updateTargetFrameRate }, undefined);
  assert.deepEqual(requested, [90]);
});
