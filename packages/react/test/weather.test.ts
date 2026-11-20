import assert from "node:assert/strict";
import test from "node:test";
import {
  createWeatherParticles,
  moveWeatherParticle,
  setWeatherParticleGround,
  weatherFrameStep,
  weatherParticleScale,
} from "../src/weather/particles";
import {
  normalizeWeatherValue,
  PANO_RAIN_PRESETS,
  PANO_SNOW_PRESETS,
  resolveSnowGroundY,
  resolveSnowSizeRange,
  resolveWeatherStyle,
  WEATHER_CAPACITY,
  weatherParticleCount,
  type PanoWeatherProps,
} from "../src/weather/presets";
import { createWeatherTexture } from "../src/weather/texture";

test("weather presets resolve by type and fit their respective instance pool", () => {
  const rain = PANO_RAIN_PRESETS.map((preset) => resolveWeatherStyle({ type: "rain", preset }));
  const snow = PANO_SNOW_PRESETS.map((preset) => resolveWeatherStyle({ type: "snow", preset }));
  assert.deepEqual(rain.map(({ count }) => count), [1400, 2100, WEATHER_CAPACITY.rain]);
  assert.deepEqual(snow.map(({ count }) => count), [WEATHER_CAPACITY.snow, 2200, 1550, 1850, 1750, 2500]);
  assert.equal(resolveWeatherStyle({ type: "rain" }), rain[1]);
  assert.equal(resolveWeatherStyle({ type: "snow" }), snow[1]);
  const wrongPreset = { type: "rain", preset: "crystal" } as unknown as PanoWeatherProps;
  assert.equal(resolveWeatherStyle(wrongPreset), rain[1]);
});

test("the intensity curve supports sparse particles and reaches the full preset budget", () => {
  const capacity = WEATHER_CAPACITY.rain;
  assert.equal(weatherParticleCount(capacity, 0), 0);
  assert.equal(weatherParticleCount(capacity, 0.1), 30);
  assert.equal(weatherParticleCount(capacity, 0.5), capacity / 4);
  assert.equal(weatherParticleCount(capacity, 1), capacity);
});

test("intensity and wind clamp finite inputs and default non-finite inputs", () => {
  assert.equal(normalizeWeatherValue(-0.5, 0, 0.6), 0);
  assert.equal(normalizeWeatherValue(8, 0, 0.6), 1);
  assert.equal(normalizeWeatherValue(undefined, 0, 0.6), 0.6);
  assert.equal(normalizeWeatherValue(NaN, 0, 0.6), 0.6);
  assert.equal(normalizeWeatherValue(-2, -1, 0), -1);
  assert.equal(normalizeWeatherValue(-0.4, -1, 0), -0.4);
  assert.equal(normalizeWeatherValue(Infinity, -1, 0), 0);
});

test("snow can use preset sizes, a bounded size range, or one fixed size", () => {
  const fallback = [0.25, 0.5] as const;
  assert.equal(resolveSnowSizeRange(undefined, fallback), fallback);
  assert.deepEqual(resolveSnowSizeRange([3, 0], fallback), [0.02, 2]);
  assert.deepEqual(resolveSnowSizeRange([0.6, 0.6], fallback), [0.6, 0.6]);
  assert.deepEqual(resolveSnowSizeRange([NaN, 1.5], fallback), [0.25, 1.5]);
});

test("fall, wind and snow sway cover the same distance at 30 and 60 fps", () => {
  function simulate(fps: number) {
    const [particle] = createWeatherParticles(1, () => 0.75);
    const frame = 1 / fps;
    for (let i = 0; i < fps; i++) {
      moveWeatherParticle(particle, frame, i * frame, 2, 1.8, -1, 0.9);
    }
    return particle;
  }
  const low = simulate(30);
  const high = simulate(60);
  for (const axis of ["x", "y", "z"] as const) {
    assert.ok(Math.abs(low[axis] - high[axis]) < 1e-8);
  }
  assert.ok(Math.abs(high.y - (9.5 - 2)) < 1e-8);
});

test("particles wrap inside the volume and fade near its edges and the viewer", () => {
  const [particle] = createWeatherParticles(1, () => 0.5);
  assert.equal(weatherParticleScale(particle), 0);
  particle.x = particle.halfWidth - 0.1;
  particle.y = -particle.halfHeight + 0.1;
  particle.z = -particle.halfWidth + 0.1;
  assert.ok(weatherParticleScale(particle) < 0.01);
  moveWeatherParticle(particle, 0.05, 0, 10, 10, -10, 0);
  assert.ok(Math.abs(particle.x - (-particle.halfWidth + 0.4)) < 1e-8);
  assert.ok(Math.abs(particle.y - (particle.halfHeight - 0.4)) < 1e-8);
  assert.ok(Math.abs(particle.z - (particle.halfWidth - 0.4)) < 1e-8);
  assert.ok(weatherParticleScale(particle) < 0.1);
});

test("hidden and stalled frames do not advance precipitation by a large step", () => {
  assert.equal(weatherFrameStep(30, true), 0);
  assert.equal(weatherFrameStep(30, false), 0.05);
  assert.equal(weatherFrameStep(1 / 60, false), 1 / 60);
  assert.equal(weatherFrameStep(NaN, false), 0);
  assert.equal(weatherFrameStep(-1, false), 0);
});

test("snow fades at a configured ground height and wraps without appearing below it", () => {
  assert.equal(resolveSnowGroundY(5), 0);
  assert.equal(resolveSnowGroundY(-150), -100);
  assert.equal(resolveSnowGroundY(NaN), undefined);
  const [particle] = createWeatherParticles(1, () => 0.75);
  const initialHeight = particle.y;
  setWeatherParticleGround(particle, -4);
  assert.equal(particle.y, 19 - (19 - initialHeight) * (19 + 4) / 38);
  setWeatherParticleGround(particle, undefined);
  assert.equal(particle.y, initialHeight);
  setWeatherParticleGround(particle, -4);
  particle.y = -4;
  assert.equal(weatherParticleScale(particle), 0);
  moveWeatherParticle(particle, 0.05, 0, 2, 0, 0, 0);
  assert.equal(particle.y, 18.9);
});

test("each procedural silhouette has an opaque core and a transparent margin", () => {
  const snowMasks = PANO_SNOW_PRESETS.map(createWeatherTexture);
  const rainMask = createWeatherTexture("streak");
  for (const { image } of [...snowMasks, rainMask]) {
    const { data, width, height } = image;
    assert.equal(data[3], 0);
    const centerAlpha = data[(Math.floor(height / 2) * width + Math.floor(width / 2)) * 4 + 3];
    assert.ok(centerAlpha > 60);
  }
  const silhouettes = snowMasks.map(({ image }) => Buffer.from(image.data).toString("base64"));
  assert.equal(new Set(silhouettes).size, PANO_SNOW_PRESETS.length);
});
