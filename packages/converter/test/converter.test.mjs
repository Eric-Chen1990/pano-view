import assert from "node:assert/strict";
import test from "node:test";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
  symlink,
  mkdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  convertImage,
  restoreImage,
  validateManifest,
  toViewerConfig,
  ConverterError,
} from "../dist/index.mjs";

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), "pano-converter-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function raster(width, height) {
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      data[offset] = (x * 17) % 256;
      data[offset + 1] = (y * 23) % 256;
      data[offset + 2] = ((x + y) * 7) % 256;
      data[offset + 3] = (x + y) % 3 === 0 ? 128 : 255;
    }
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
}

async function pixels(input) {
  return sharp(input)
    .toColourspace("srgb")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function equalPixels(actual, expected) {
  const a = await pixels(actual);
  const b = await pixels(expected);
  assert.equal(a.info.width, b.info.width);
  assert.equal(a.info.height, b.info.height);
  assert.deepEqual(a.data, b.data);
}

const code = (expected) => (error) =>
  error instanceof ConverterError && error.code === expected;
const ffmpegAvailable =
  spawnSync(process.env.FFMPEG_PATH ?? "ffmpeg", ["-version"], {
    stdio: "ignore",
  }).status === 0;
if (process.env.PANO_REQUIRE_FFMPEG && !ffmpegAvailable)
  throw new Error("CI requires FFmpeg; cube tests must not be skipped.");

test("custom planar levels, padded paths, bounded callbacks, and lossless partial-edge reconstruction", async (t) => {
  const root = await workspace(t);
  const input = await raster(131, 67);
  let active = 0;
  let peak = 0;
  let uploads = 0;
  const callbackPaths = [];
  const result = await convertImage(input, {
    projection: "planar",
    layout: "custom",
    outputDir: join(root, "tiles"),
    format: "png",
    tileSize: 32,
    concurrency: 2,
    levels: [
      { width: 65, height: 33 },
      { width: 131, height: 67 },
    ],
    tilePathTemplate: "tiles/z%l/row%00v/col%0h.%e",
    onAsset: async (asset, signal) => {
      assert.equal(signal.aborted, false);
      assert.ok((await stat(asset.absolutePath)).isFile());
      callbackPaths.push(asset.absolutePath);
      active++;
      peak = Math.max(active, peak);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      uploads++;
    },
  });
  assert.equal(active, 0);
  assert.ok(peak <= 2);
  assert.equal(uploads, result.assets.length - 1);
  assert.equal(result.viewerConfig, null);
  assert.equal(result.manifest.thumbnail.path, "thumbnail.png");
  assert.ok(
    result.assets.some((a) => a.relativePath === "tiles/z2/row001/col04.png"),
  );
  assert.ok(!JSON.stringify(result.manifest).includes(root));
  for (const asset of result.assets)
    assert.ok((await stat(asset.absolutePath)).isFile());
  assert.ok(
    callbackPaths.every((path) => !path.startsWith(result.outputDir + "/")),
  );
  assert.equal(
    (await readdir(root)).some(
      (name) => name.includes(".pano-") || name.endsWith(".lock"),
    ),
    false,
  );
  const restored = await restoreImage(join(result.outputDir, "manifest.json"), {
    outputDir: join(root, "restored"),
  });
  await equalPixels(restored.assets[0].absolutePath, input);
  const smaller = await restoreImage(join(result.outputDir, "manifest.json"), {
    outputDir: join(root, "small"),
    level: 1,
  });
  assert.equal(smaller.width, 65);
  assert.equal(smaller.height, 33);
});

test("full equirectangular tiles produce directly usable SphereTile props and legacy preview paths", async (t) => {
  const root = await workspace(t);
  const input = await raster(130, 65);
  const result = await convertImage(input, {
    projection: "equirectangular",
    format: "png",
    tileSize: 32,
    outputDir: join(root, "tiles"),
  });
  assert.equal(result.viewerConfig.type, "sphereTile");
  assert.equal(result.viewerConfig.indexBase, 1);
  assert.equal(result.viewerConfig.previewUrl, "previews/400.png");
  assert.equal(result.manifest.thumbnail.path, "previews/200.png");
  assert.deepEqual(result.viewerConfig.multires.levels.at(-1), {
    width: 130,
    height: 65,
  });
  assert.ok(
    result.assets.some(
      (asset) =>
        asset.relativePath.endsWith("5_3.png") &&
        asset.width === 2 &&
        asset.height === 1,
    ),
  );
  const restored = await restoreImage(join(result.outputDir, "manifest.json"), {
    outputDir: join(root, "restored"),
  });
  await equalPixels(restored.assets[0].absolutePath, input);
  assert.deepEqual(
    validateManifest(
      JSON.parse(
        await readFile(join(result.outputDir, "manifest.json"), "utf8"),
      ),
    ),
    result.manifest,
  );
});

test("default WebP previews preserve existing CMS paths and non-square invalid panoramas fail", async (t) => {
  const root = await workspace(t);
  const result = await convertImage(await raster(128, 64), {
    projection: "equirectangular",
    outputDir: join(root, "tiles"),
  });
  for (const name of ["200", "400", "800"])
    await stat(join(result.outputDir, `previews/${name}.webp`));
  assert.equal(result.manifest.thumbnail.path, "previews/200.webp");
  await assert.rejects(
    convertImage(await raster(128, 80), {
      projection: "equirectangular",
      outputDir: join(root, "bad"),
    }),
    code("INVALID_PROJECTION"),
  );
  assert.deepEqual((await readdir(root)).sort(), ["tiles"]);
});

test("native standard DZI and its JSON manifest reconstruct the same odd-sized image", async (t) => {
  const root = await workspace(t);
  const input = await raster(131, 67);
  const result = await convertImage(input, {
    projection: "planar",
    format: "png",
    tileSize: 32,
    outputDir: join(root, "tiles"),
  });
  assert.equal(result.manifest.tiles.layout, "deepzoom");
  assert.equal(result.manifest.tiles.indexBase, 0);
  assert.equal(result.manifest.tiles.levels[0].width, 1);
  for (const asset of result.assets) await stat(asset.absolutePath);
  const fromDzi = await restoreImage(join(result.outputDir, "image.dzi"), {
    outputDir: join(root, "from-dzi"),
  });
  const fromJson = await restoreImage(join(result.outputDir, "manifest.json"), {
    outputDir: join(root, "from-json"),
  });
  await equalPixels(fromDzi.assets[0].absolutePath, input);
  await equalPixels(fromJson.assets[0].absolutePath, input);
});

test("native Deep Zoom restore crops overlaps correctly and emits all-white tiles", async (t) => {
  const root = await workspace(t);
  const input = await raster(65, 39);
  await sharp(input)
    .png()
    .tile({ size: 16, overlap: 3, depth: "onepixel", skipBlanks: -1 })
    .toFile(join(root, "overlap"));
  const result = await restoreImage(join(root, "overlap.dzi"), {
    outputDir: join(root, "restored"),
  });
  await equalPixels(result.assets[0].absolutePath, input);
  const white = await sharp({
    create: { width: 65, height: 33, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const converted = await convertImage(white, {
    projection: "planar",
    outputDir: join(root, "white"),
    tileSize: 16,
    format: "png",
  });
  const count = converted.manifest.tiles.levels.reduce(
    (sum, level) => sum + level.rows * level.columns,
    0,
  );
  assert.equal(
    converted.assets.filter((asset) => asset.kind === "tile").length,
    count,
  );
});

test("JPEG/WebP encoding and TIFF/AVIF inputs reconstruct to their declared dimensions", async (t) => {
  const root = await workspace(t);
  const input = await raster(65, 33);
  for (const format of ["jpeg", "webp"]) {
    const result = await convertImage(input, {
      projection: "planar",
      format,
      tileSize: 16,
      outputDir: join(root, format),
    });
    const restored = await restoreImage(join(result.outputDir, "image.dzi"), {
      outputDir: join(root, format + "-restored"),
    });
    assert.equal(restored.width, 65);
    assert.equal(restored.height, 33);
    for (const asset of result.assets.filter((asset) => asset.kind === "tile"))
      assert.equal((await sharp(asset.absolutePath).metadata()).format, format);
  }
  for (const format of ["tiff", "avif"]) {
    const encoded = await sharp(input)[format]().toBuffer();
    const result = await convertImage(encoded, {
      projection: "planar",
      layout: "custom",
      format: "png",
      outputDir: join(root, format),
    });
    const restored = await restoreImage(
      join(result.outputDir, "manifest.json"),
      { outputDir: join(root, format + "-restored") },
    );
    await equalPixels(restored.assets[0].absolutePath, encoded);
  }
});

test("output ownership preserves existing files and accepts an empty user directory", async (t) => {
  const root = await workspace(t);
  const output = join(root, "out");
  await mkdir(output);
  await writeFile(join(output, "user.txt"), "preserve me");
  const input = await raster(16, 8);
  await assert.rejects(
    convertImage(input, {
      projection: "planar",
      outputDir: join(output, "user.txt", "child"),
    }),
    code("IO_ERROR"),
  );
  await assert.rejects(
    convertImage(input, { projection: "equirectangular", outputDir: output }),
    code("OUTPUT_CONFLICT"),
  );
  assert.equal(await readFile(join(output, "user.txt"), "utf8"), "preserve me");
  await rm(join(output, "user.txt"));
  const result = await convertImage(input, {
    projection: "equirectangular",
    outputDir: output,
  });
  assert.equal(result.manifest.projection, "equirectangular");
  assert.equal((await readdir(root)).length, 1);
});

test("small and portrait images retain real dimensions and EXIF orientation is applied", async (t) => {
  const root = await workspace(t);
  const tinySphere = await convertImage(await raster(4, 2), {
    projection: "equirectangular",
    format: "png",
    tileSize: 1,
    outputDir: join(root, "tiny-sphere"),
  });
  assert.deepEqual(tinySphere.viewerConfig.multires.levels, [
    { width: 2, height: 1 },
    { width: 4, height: 2 },
  ]);
  for (const [width, height] of [
    [2, 1],
    [1, 31],
    [7, 97],
  ]) {
    const input = await raster(width, height);
    const result = await convertImage(input, {
      projection: "planar",
      layout: "custom",
      format: "png",
      tileSize: 16,
      outputDir: join(root, `${width}-${height}`),
    });
    const restored = await restoreImage(
      join(result.outputDir, "manifest.json"),
      { outputDir: join(root, `restored-${width}-${height}`) },
    );
    await equalPixels(restored.assets[0].absolutePath, input);
  }
  const oriented = await sharp(await raster(40, 80))
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const result = await convertImage(oriented, {
    projection: "equirectangular",
    format: "png",
    tileSize: 16,
    outputDir: join(root, "oriented"),
  });
  assert.deepEqual(result.manifest.source, { width: 80, height: 40 });
  const restored = await restoreImage(join(result.outputDir, "manifest.json"), {
    outputDir: join(root, "oriented-restored"),
  });
  await equalPixels(
    restored.assets[0].absolutePath,
    await sharp(oriented).autoOrient().png().toBuffer(),
  );
});

test(
  "cube conversion and reconstruction preserve face orientation, scene fields, and optional face exports",
  { skip: !ffmpegAvailable },
  async (t) => {
    const root = await workspace(t);
    const width = 512;
    const height = 256;
    // Smooth longitude/latitude signal makes flips and face-order errors visible in the round trip.
    const data = Buffer.alloc(width * height * 3);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 3;
        data[offset] = Math.round(
          127 + 100 * Math.sin((x / width) * Math.PI * 2),
        );
        data[offset + 1] = Math.round(
          127 + 100 * Math.cos((x / width) * Math.PI * 2),
        );
        data[offset + 2] = Math.round((255 * y) / (height - 1));
      }
    const input = await sharp(data, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();
    const result = await convertImage(input, {
      outputDir: join(root, "cube"),
      format: "png",
      tileSize: 32,
      levels: [64, 128],
    });
    assert.deepEqual(result.viewerConfig.multires, {
      tileSize: 32,
      levels: [64, 128],
    });
    assert.equal(result.viewerConfig.type, "tile");
    assert.equal(
      result.viewerConfig.urlTemplate,
      "tiles/%s/l%l/%v/l%l_%s_%v_%h.png",
    );
    assert.deepEqual(result.viewerConfig.previewFaceOrder, [
      "l",
      "f",
      "r",
      "b",
      "u",
      "d",
    ]);
    const cubePreview = result.manifest.previews.find(
      (preview) => preview.role === "viewer",
    );
    assert.equal(cubePreview.width, 128);
    assert.equal(cubePreview.height, 128 * 6);
    const restored = await restoreImage(
      join(result.outputDir, "manifest.json"),
      { outputDir: join(root, "restored"), exportCubeFaces: true },
    );
    assert.equal(
      restored.assets.filter((asset) => asset.kind === "cube-face").length,
      6,
    );
    const actual = await sharp(
      restored.assets.find((asset) => asset.kind === "image").absolutePath,
    )
      .removeAlpha()
      .raw()
      .toBuffer();
    assert.equal(actual.length, data.length);
    let difference = 0;
    for (let i = 0; i < actual.length; i++)
      difference += Math.abs(actual[i] - data[i]);
    assert.ok(
      difference / actual.length < 5,
      `round-trip mean absolute pixel difference: ${difference / actual.length}`,
    );
  },
);

test("invalid options, input errors, native dependencies, and path collisions have actionable errors", async (t) => {
  const root = await workspace(t);
  const input = await raster(128, 64);
  const cases = [
    [{ tileSize: 0 }, "INVALID_OPTIONS"],
    [{ projection: "other" }, "INVALID_OPTIONS"],
    [{ layout: "deepzoom" }, "INVALID_OPTIONS"],
    [
      { projection: "planar", levels: [{ width: 32, height: 16 }] },
      "INVALID_OPTIONS",
    ],
    [{ levels: [128, 64] }, "INVALID_OPTIONS"],
    [{ levels: [32, 32] }, "INVALID_OPTIONS"],
    [{ levels: [32], pyramidDownscale: 2 }, "INVALID_OPTIONS"],
    [{ tilePathTemplate: "../%l_%h_%v.%e" }, "INVALID_OPTIONS"],
    [{ tilePathTemplate: "tiles/CON/%l_%h_%v.%e" }, "INVALID_OPTIONS"],
    [{ tilePathTemplate: "tiles/%s/%l.%e", tileSize: 8 }, "OUTPUT_CONFLICT"],
    [{ limitInputPixels: 32 }, "PIXEL_LIMIT_EXCEEDED"],
    [{ ffmpegPath: join(root, "missing-ffmpeg") }, "FFMPEG_UNAVAILABLE"],
    [{ ffmpegPath: process.execPath }, "FFMPEG_FAILED"],
  ];
  for (const [options, expected] of cases)
    await assert.rejects(
      convertImage(input, { outputDir: join(root, "invalid"), ...options }),
      code(expected),
    );
  await assert.rejects(
    convertImage(Buffer.from("broken"), { outputDir: join(root, "invalid") }),
    code("INVALID_IMAGE"),
  );
  await assert.rejects(
    convertImage(join(root, "missing.png"), {
      outputDir: join(root, "invalid"),
    }),
    code("INPUT_NOT_FOUND"),
  );
  assert.deepEqual(await readdir(root), []);
});

test("callback failure, cancellation, deadline, and concurrent output jobs clean up their own files", async (t) => {
  const root = await workspace(t);
  const input = await raster(128, 64);
  const base = {
    projection: "equirectangular",
    format: "png",
    tileSize: 16,
    outputDir: join(root, "out"),
  };
  await assert.rejects(
    convertImage(input, {
      ...base,
      onAsset: async () => {
        throw new Error("upload failed");
      },
    }),
    code("CALLBACK_FAILED"),
  );
  const controller = new AbortController();
  await assert.rejects(
    convertImage(input, {
      ...base,
      signal: controller.signal,
      onAsset: () => controller.abort(),
    }),
    code("ABORTED"),
  );
  await assert.rejects(
    convertImage(input, { ...base, timeoutMs: 1 }),
    code("TIMEOUT"),
  );
  assert.deepEqual(await readdir(root), []);
  let release;
  let started;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const first = convertImage(input, {
    ...base,
    concurrency: 1,
    onAsset: async () => {
      started();
      await held;
    },
  });
  await entered;
  await assert.rejects(convertImage(input, base), code("OUTPUT_CONFLICT"));
  release();
  await first;
  await assert.rejects(convertImage(input, base), code("OUTPUT_CONFLICT"));
  assert.ok((await stat(join(root, "out", "manifest.json"))).isFile());
});

test("restore rejects malformed/versioned manifests, missing/corrupt tiles, symlink escapes, and missing levels", async (t) => {
  const root = await workspace(t);
  const input = await raster(64, 32);
  const result = await convertImage(input, {
    projection: "equirectangular",
    format: "png",
    tileSize: 32,
    outputDir: join(root, "tiles"),
  });
  const manifestPath = join(result.outputDir, "manifest.json");
  const restoreOptions = { outputDir: join(root, "restored") };
  await assert.rejects(
    restoreImage(manifestPath, { ...restoreOptions, level: 999 }),
    code("LEVEL_NOT_FOUND"),
  );
  const unsupported = structuredClone(result.manifest);
  unsupported.schemaVersion = 2;
  assert.throws(
    () => validateManifest(unsupported),
    code("UNSUPPORTED_SCHEMA_VERSION"),
  );
  const inconsistent = structuredClone(result.manifest);
  inconsistent.tiles.levels[0].rows = 100;
  assert.throws(() => validateManifest(inconsistent), code("INVALID_MANIFEST"));
  const traversal = structuredClone(result.manifest);
  traversal.tiles.urlTemplate = "../%l/%h_%v.png";
  assert.throws(() => validateManifest(traversal), code("INVALID_MANIFEST"));
  const target = result.assets.find((asset) => asset.kind === "tile");
  const original = await readFile(target.absolutePath);
  await rm(target.absolutePath);
  await assert.rejects(
    restoreImage(manifestPath, { ...restoreOptions, level: target.level }),
    code("TILE_MISSING"),
  );
  await writeFile(target.absolutePath, "broken");
  await assert.rejects(
    restoreImage(manifestPath, { ...restoreOptions, level: target.level }),
    code("INVALID_TILE"),
  );
  if (process.platform !== "win32") {
    await rm(target.absolutePath);
    const outside = join(root, "outside.png");
    await writeFile(outside, original);
    await symlink(outside, target.absolutePath);
    await assert.rejects(
      restoreImage(manifestPath, { ...restoreOptions, level: target.level }),
      code("TILE_MISSING"),
    );
  }
  await writeFile(
    join(root, "unsafe.dzi"),
    '<!DOCTYPE Image [<!ENTITY x SYSTEM "file:///etc/passwd">]><Image TileSize="32" Overlap="0" Format="png"><Size Width="64" Height="32"/></Image>',
  );
  await assert.rejects(
    restoreImage(join(root, "unsafe.dzi"), restoreOptions),
    code("INVALID_DZI"),
  );
  for (const [index, xml] of [
    '<Image TileSize="32" Overlap="0" Format="png"><Size Width="64" Height="32"></Image>',
    '<Image TileSize="32" TileSize="16" Overlap="0" Format="png"><Size Width="64" Height="32"/></Image>',
    '<Image TileSize="32" Overlap="0" Format="png"><Size Width="64" Height="32"/><DisplayRect/></Image>',
  ].entries()) {
    const path = join(root, `bad-${index}.dzi`);
    await writeFile(path, xml);
    await assert.rejects(
      restoreImage(path, restoreOptions),
      code("INVALID_DZI"),
    );
  }
  const invalidPreview = structuredClone(result.manifest);
  invalidPreview.previews.find(
    (preview) => preview.role === "viewer",
  ).projection = "planar";
  assert.throws(
    () => validateManifest(invalidPreview),
    code("INVALID_MANIFEST"),
  );
  assert.deepEqual(toViewerConfig(result.manifest), result.viewerConfig);
});

function cli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      fileURLToPath(new URL("../dist/cli.mjs", import.meta.url)),
      ...args,
    ]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

test("CLI help/version, machine-readable errors, conversion, and restore", async (t) => {
  const root = await workspace(t);
  const input = join(root, "input.png");
  await writeFile(input, await raster(65, 33));
  const help = await cli(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /restore/);
  const version = await cli(["--version"]);
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^0\.1\.0/);
  const invalid = await cli(["--unknown", "--json-errors"]);
  assert.equal(invalid.status, 2);
  assert.equal(JSON.parse(invalid.stderr).code, "INVALID_OPTIONS");
  const converted = await cli([
    input,
    "--output",
    join(root, "tiles"),
    "--projection",
    "planar",
    "--format",
    "png",
    "--tile-size",
    "16",
    "--quiet",
  ]);
  assert.equal(converted.status, 0, converted.stderr);
  assert.equal(JSON.parse(converted.stdout).manifest.projection, "planar");
  const restored = await cli([
    "restore",
    join(root, "tiles", "manifest.json"),
    "--output",
    join(root, "restored"),
    "--quiet",
  ]);
  assert.equal(restored.status, 0, restored.stderr);
  await equalPixels(JSON.parse(restored.stdout).assets[0].absolutePath, input);
});
