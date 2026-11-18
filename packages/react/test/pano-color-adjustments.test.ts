import assert from "node:assert/strict";
import { test } from "node:test";
import { ShaderLib, type WebGLProgramParametersWithUniforms } from "three";
import { clarityBufferSize } from "../src/pano-filter/clarity-pass";
import {
  isPanoFilterActive,
  resolvePanoFilterSnapshot,
} from "../src/pano-filter/presets";
import {
  injectPanoColorAdjustmentsShader,
  injectPanoColorMatrixShader,
  injectPanoFilterShader,
} from "../src/pano-filter/shaders";

test("adjustments default to neutral and normalize each finite value independently", () => {
  assert.equal(resolvePanoFilterSnapshot({}).adjustments, null);
  assert.equal(isPanoFilterActive(resolvePanoFilterSnapshot({ adjustments: {} })), false);
  const snapshot = resolvePanoFilterSnapshot({
    adjustments: { exposure: 12, saturation: -2, contrast: NaN, clarity: 0.35 },
    intensity: 0,
  });
  assert.deepEqual(snapshot.adjustments, {
    exposure: 2, saturation: -1, contrast: 0, clarity: 0.35,
  });
  assert.equal(isPanoFilterActive(snapshot), true);
  assert.equal(isPanoFilterActive({ ...snapshot, enabled: false }), false);
  assert.equal(resolvePanoFilterSnapshot({ adjustments: { exposure: Infinity } }).adjustments?.exposure, 0);
});

test("adjustments run after texture decode and before the legacy preset and matrix", () => {
  const shader = { ...ShaderLib.basic, uniforms: {} } as WebGLProgramParametersWithUniforms;
  injectPanoFilterShader(shader, "pencil");
  injectPanoColorAdjustmentsShader(shader);
  injectPanoColorMatrixShader(shader);
  const stages = [
    "#include <map_fragment>",
    "diffuseColor.rgb = applyPanoAdjustments",
    "diffuseColor.rgb = mix",
    "#include <colorspace_fragment>",
    "gl_FragColor = mix",
  ];
  let previous = -1;
  for (const stage of stages) {
    const position = shader.fragmentShader.indexOf(stage);
    assert.ok(position > previous, stage);
    previous = position;
  }
});

test("clarity buffers are half-size and bounded per view", () => {
  assert.deepEqual(clarityBufferSize(1280, 720), [640, 360]);
  assert.deepEqual(clarityBufferSize(1, 1), [1, 1]);
  const [width, height] = clarityBufferSize(4096, 2160);
  assert.ok(width * height <= 524_288);
  assert.ok(Math.abs(width / height - 4096 / 2160) < 0.01);
});
