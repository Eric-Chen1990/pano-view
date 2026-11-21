import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLittlePlanetIntro, sampleLittlePlanetIntro } from "../src/little-planet/options";

const landing = { yaw: 30, pitch: 15, fov: 75 };

test("the default intro holds the nadir and eases through a half turn", () => {
  const options = resolveLittlePlanetIntro(true);
  const opening = { yaw: -150, pitch: -90, perspective: 0, opacity: 1 };
  assert.deepEqual(sampleLittlePlanetIntro(0, options, landing), opening);
  assert.deepEqual(sampleLittlePlanetIntro(500, options, landing), opening);
  assert.deepEqual(sampleLittlePlanetIntro(2000, options, landing), {
    yaw: -15, pitch: -11.25, perspective: 0.75, opacity: 1,
  });
  assert.equal(sampleLittlePlanetIntro(3500, options, landing), null);
});

test("custom motion keeps its signed direction and converges on the intended view", () => {
  const options = resolveLittlePlanetIntro({
    holdDuration: 0, duration: 1000, easing: "linear", yawRotation: -240, startPitch: -45,
  });
  assert.equal(sampleLittlePlanetIntro(0, options, landing)?.yaw, 270);
  assert.deepEqual(sampleLittlePlanetIntro(500, options, landing), {
    yaw: 150, pitch: -15, perspective: 0.5, opacity: 1,
  });
  assert.ok(sampleLittlePlanetIntro(999, options, landing)!.opacity < 0.1);
  assert.equal(sampleLittlePlanetIntro(1000, options, landing), null);
});

test("zero durations, invalid times and bounds are deterministic", () => {
  const options = resolveLittlePlanetIntro({
    holdDuration: 100, duration: 0, yawRotation: -1000, startPitch: 95, planetScale: 10,
  });
  assert.deepEqual(options, {
    holdDuration: 100, duration: 0, easing: "easeOutQuad", yawRotation: -360, startPitch: 90, planetScale: 2,
  });
  assert.equal(sampleLittlePlanetIntro(99, options, landing)?.perspective, 0);
  assert.equal(sampleLittlePlanetIntro(100, options, landing), null);
  assert.deepEqual(resolveLittlePlanetIntro({ holdDuration: -1, duration: NaN, planetScale: Infinity }),
    resolveLittlePlanetIntro(true));
});
