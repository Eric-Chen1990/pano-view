import assert from "node:assert/strict";
import test from "node:test";
import { chromaKeyAlpha, resolveHotspotChromaKey } from "../../../shared/chroma-key";
import { parsePanoProject } from "../src/data";

test("chroma key masks the selected color with hard and soft edges", () => {
  const hard = resolveHotspotChromaKey({ color: "#00FF00", threshold: 0, smoothing: 0 })!;
  const soft = resolveHotspotChromaKey({ color: "#00FF00", threshold: 0, smoothing: 0.5 })!;
  assert.equal(chromaKeyAlpha(hard, 0, 1, 0), 0);
  assert.equal(chromaKeyAlpha(hard, 0, 0.8, 0), 1);
  assert.equal(chromaKeyAlpha(soft, 0, 1, 0), 0);
  const edge = chromaKeyAlpha(soft, 0, 0.8, 0);
  assert.ok(edge > 0 && edge < 1);
  assert.equal(chromaKeyAlpha(soft, 1, 0, 0), 1);
  assert.equal(chromaKeyAlpha(soft, 1, 0, 0, 0.3), 0.3);
  assert.ok(Math.abs(chromaKeyAlpha(soft, 0, 0.8, 0, 0.5) - edge * 0.5) < 1e-9);
  assert.equal(chromaKeyAlpha(soft, 1, 0.8, 1), chromaKeyAlpha(soft, 0.2, 0, 0.2));
});

const base = { id: "subject", src: "subject.png", position: { yaw: 0, pitch: 0 } };
function parse(hotspot: object) {
  return parsePanoProject({
    schemaVersion: 1,
    scenes: [{
      id: "room",
      source: { viewerConfig: { type: "sphereTile", multires: { tileSize: 2, levels: [{ width: 4, height: 2 }] }, indexBase: 0, previewUrl: "p.jpg", urlTemplate: "%l/%v_%h.jpg" } },
      hotspots: [hotspot],
    }],
  }).scenes[0]!.hotspots![0];
}

test("schema v1 preserves chroma key settings and accepts existing hotspots", () => {
  for (const type of ["image", "video"]) {
    assert.deepEqual(parse({ ...base, type }), { ...base, type });
    const chromaKey = { color: "#1853E6", threshold: 0, smoothing: 0.5 };
    assert.deepEqual(parse({ ...base, type, chromaKey }), { ...base, type, chromaKey });
  }
});

test("project parsing reports the invalid chroma key field", () => {
  for (const [chromaKey, field] of [
    [null, "chromaKey"],
    [{ color: "#abc" }, "chromaKey.color"],
    [{ color: "#00B140", threshold: Number.NaN }, "chromaKey.threshold"],
    [{ color: "#00B140", smoothing: 1.5 }, "chromaKey.smoothing"],
  ] as const) {
    assert.throws(() => parse({ ...base, type: "image", chromaKey }), {
      code: "INVALID_PROJECT",
      field: `scenes[0].hotspots[0].${field}`,
    });
  }
});
