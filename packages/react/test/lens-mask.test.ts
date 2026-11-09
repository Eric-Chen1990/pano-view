import assert from "node:assert/strict";
import { test } from "node:test";
import { isInsideStereoLens } from "../src/webvr/lens-mask";

test("lens aperture includes the optical center and excludes distorted corners", () => {
  const distortion = { x: 0.34, y: 0.55 },
    center = { x: 0, y: 0 };
  assert.equal(isInsideStereoLens(0.5, 0.5, distortion, center), true);
  for (const [u, v] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ])
    assert.equal(isInsideStereoLens(u!, v!, distortion, center), false);
  assert.equal(isInsideStereoLens(0.5, 0.05, distortion, center), false);
  assert.equal(isInsideStereoLens(0.5, 0.3, distortion, center), true);
});

test("zero distortion leaves the full eye rectangle visible; optical centers mirror between eyes", () => {
  for (const [u, v] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ])
    assert.equal(
      isInsideStereoLens(u!, v!, { x: 0, y: 0 }, { x: 0.1, y: -0.2 }),
      true
    );
  for (let u = 0; u <= 1; u += 0.125)
    for (let v = 0; v <= 1; v += 0.125) {
      assert.equal(
        isInsideStereoLens(u, v, { x: 0.34, y: 0.55 }, { x: 0.1, y: 0.04 }),
        isInsideStereoLens(1 - u, v, { x: 0.34, y: 0.55 }, { x: -0.1, y: 0.04 })
      );
    }
});
