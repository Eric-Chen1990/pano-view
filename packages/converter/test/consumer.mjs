// Copied into the isolated tarball consumer and Linux musl container before execution.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { convertImage, restoreImage } from "@ericchen1990/pano-converter";

const require = createRequire(import.meta.url);
const cjs = require("@ericchen1990/pano-converter");
const sharp = createRequire(require.resolve("@ericchen1990/pano-converter"))(
  "sharp",
);
assert.equal(typeof cjs.convertImage, "function");
assert.equal(typeof cjs.restoreImage, "function");
assert.throws(() => require.resolve("react"), { code: "MODULE_NOT_FOUND" });
const root = await mkdtemp(join(tmpdir(), "pano-consumer-runtime-"));
try {
  const input = await sharp({
    create: { width: 130, height: 65, channels: 3, background: "#7f94ab" },
  })
    .png()
    .toBuffer();
  for (const [name, api] of [
    ["esm", { convertImage, restoreImage }],
    ["cjs", cjs],
  ]) {
    const result = await api.convertImage(input, {
      projection: "equirectangular",
      outputDir: join(root, name),
      format: "png",
      tileSize: 32,
    });
    assert.equal(result.viewerConfig.type, "sphereTile");
    const restored = await api.restoreImage(
      join(result.outputDir, "manifest.json"),
      { outputDir: join(root, name + "-restore") },
    );
    assert.equal(restored.width, 130);
    assert.equal(restored.height, 65);
    const actual = await sharp(restored.assets[0].absolutePath)
      .raw()
      .toBuffer();
    const expected = await sharp(input).ensureAlpha().raw().toBuffer();
    assert.deepEqual(actual, expected);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log(
  JSON.stringify({
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    sharp: sharp.versions.sharp,
    esm: true,
    cjs: true,
  }),
);
