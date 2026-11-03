import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeStereoLensCenters,
  physicalScreenFromDiagonal,
} from "../src/webvr/lens-center";
import { WEBVR_PROFILES } from "../src/webvr/profiles";

test("unknown screensize keeps zero lens centers", () => {
  const centers = computeStereoLensCenters(
    WEBVR_PROFILES["cardboard-v1"],
    "auto",
    16 / 9,
  );
  assert.deepEqual(centers.left, { x: 0, y: 0 });
  assert.deepEqual(centers.right, { x: 0, y: 0 });
});

test("trayDistanceMm of 0 keeps a vertical center", () => {
  const centers = computeStereoLensCenters(
    { ipdMm: 60, trayDistanceMm: 0 },
    5.5,
    16 / 9,
  );
  assert.equal(centers.left.y, 0);
  assert.equal(centers.right.y, 0);
  assert.ok(centers.left.x > 0);
  assert.equal(centers.right.x, -centers.left.x);
});

test("Cardboard V1 tray distance shifts the optical center upward", () => {
  const aspect = 16 / 9;
  const screen = physicalScreenFromDiagonal(5.5, aspect);
  assert.ok(screen);
  const centers = computeStereoLensCenters(
    WEBVR_PROFILES["cardboard-v1"],
    5.5,
    aspect,
  );
  const expectedY = (2 * 35) / screen.heightMm - 1;
  assert.ok(Math.abs(centers.left.y - expectedY) < 1e-10);
  assert.equal(centers.right.y, centers.left.y);
  assert.ok(centers.left.y > -1 && centers.left.y < 1);
  assert.ok(centers.left.x > 0);
  assert.equal(centers.right.x, -centers.left.x);
});

test("IPD equal to half-eye width yields a zero horizontal offset", () => {
  const aspect = 2;
  const screen = physicalScreenFromDiagonal(5, aspect);
  assert.ok(screen);
  const halfEyeWidthMm = screen.widthMm / 4;
  const centers = computeStereoLensCenters(
    { ipdMm: halfEyeWidthMm * 2, trayDistanceMm: 0 },
    5,
    aspect,
  );
  assert.ok(Math.abs(centers.left.x) < 1e-10);
  assert.ok(Math.abs(centers.right.x) < 1e-10);
});
