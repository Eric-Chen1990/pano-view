import assert from "node:assert/strict";
import { test } from "node:test";
import { Matrix4, Vector3 } from "three";
import {
  panoramaStereoHalfAngle,
  panoramaStereoToeInYaw,
  WEBVR_PANORAMA_VIRTUAL_DISTANCE_M,
} from "../src/webvr/stereo-disparity";
import { computeStereoLayout } from "../src/webvr/stereo-layout";

test("logical 390 with dpr 3 splits into two eyes that fill the canvas", () => {
  const layout = computeStereoLayout(390, 844, 3);
  assert.equal(layout.fullWidth, 390);
  assert.equal(layout.fullHeight, 844);
  assert.equal(layout.left.width + layout.right.width, 390);
  assert.equal(layout.left.offsetX, 0);
  assert.equal(layout.right.offsetX, layout.left.width);
  assert.equal(layout.stereoAspect, layout.left.width / 390);
  assert.equal(layout.renderTargetWidth, Math.floor(layout.left.width * 3));
  assert.equal(layout.renderTargetHeight, Math.floor(844 * 3));
  // Must not treat drawing-buffer width (1170) as a logical viewport.
  assert.notEqual(layout.left.width, 1170);
  assert.ok(layout.renderTargetWidth < 1170);
});

test("odd logical widths give the remainder to the right eye", () => {
  const layout = computeStereoLayout(391, 200, 2);
  assert.equal(layout.left.width, 195);
  assert.equal(layout.right.width, 196);
  assert.equal(layout.left.width + layout.right.width, 391);
});

test("non-finite pixel ratios fall back to 1", () => {
  const layout = computeStereoLayout(400, 300, Number.NaN);
  assert.equal(layout.renderTargetWidth, 200);
  assert.equal(layout.renderTargetHeight, 300);
});

test("oversampling scales only the distortion render target", () => {
  const base = computeStereoLayout(390, 844, 3);
  const boosted = computeStereoLayout(390, 844, 3, 1.5);
  assert.equal(boosted.fullWidth, base.fullWidth);
  assert.equal(boosted.fullHeight, base.fullHeight);
  assert.equal(boosted.left.width, base.left.width);
  assert.equal(boosted.right.offsetX, base.right.offsetX);
  assert.equal(
    boosted.renderTargetWidth,
    Math.floor(base.left.width * 3 * 1.5),
  );
  assert.equal(
    boosted.renderTargetHeight,
    Math.floor(base.fullHeight * 3 * 1.5),
  );
});

test("oversampling defaults to 1 and clamps extreme values", () => {
  const defaulted = computeStereoLayout(400, 300, 2);
  const clampedHigh = computeStereoLayout(400, 300, 2, 8);
  const clampedLow = computeStereoLayout(400, 300, 2, 0.1);
  assert.equal(defaulted.renderTargetWidth, 400);
  assert.equal(clampedHigh.renderTargetWidth, Math.floor(200 * 2 * 2));
  assert.equal(clampedLow.renderTargetWidth, Math.floor(200 * 2 * 0.5));
});

test("60 mm IPD at the virtual distance toes each eye inward", () => {
  const half = panoramaStereoHalfAngle(60, WEBVR_PANORAMA_VIRTUAL_DISTANCE_M);
  assert.ok(half > 0.01 && half < 0.03);
  assert.equal(half, Math.atan(0.03 / WEBVR_PANORAMA_VIRTUAL_DISTANCE_M));
  const forward = new Vector3(0, 0, -1);
  const left = forward
    .clone()
    .applyMatrix4(new Matrix4().makeRotationY(panoramaStereoToeInYaw("left", half)));
  const right = forward
    .clone()
    .applyMatrix4(new Matrix4().makeRotationY(panoramaStereoToeInYaw("right", half)));
  assert.ok(left.x > 0, "left eye looks toward +X");
  assert.ok(right.x < 0, "right eye looks toward -X");
  assert.ok(Math.abs(left.x - -right.x) < 1e-10);
});
