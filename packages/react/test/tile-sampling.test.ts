import assert from "node:assert/strict";
import { test } from "node:test";
import { preferredSphereLevel } from "../src/sphere-tile/layout";
import { getPreferredLevel } from "../src/tile/face-layout";
import { mipmappedTextureBytes } from "../src/tile/texture-manager";

const faces = [512, 1024, 2048, 4096];
const sphereLevels = [
  { width: 1024, height: 512 },
  { width: 2048, height: 1024 },
  { width: 4096, height: 2048 },
  { width: 8192, height: 4096 },
];

test("wide fov selects the level that matches the screen center", () => {
  // 800px at dpr 2 is 1600 physical pixels. At 90° that is exactly one cube
  // face, so the resident level steps up to 2048. At 140° the center only
  // needs about 582 texels, so a resident 2048 face drops to 1024.
  assert.equal(getPreferredLevel(faces, 800, 2, 90, 1), 3);
  assert.equal(getPreferredLevel(faces, 800, 2, 140, 3), 2);

  // 600px at fov 120° needs about 544 equirectangular rows.
  assert.equal(preferredSphereLevel(sphereLevels, 600, 1, 120), 1);
  assert.ok(
    preferredSphereLevel(sphereLevels, 600, 2, 60) >
      preferredSphereLevel(sphereLevels, 600, 1, 120),
  );
});

test("tile memory counts the mipmap chain", () => {
  assert.equal(mipmappedTextureBytes(1, 1), 6);
  assert.equal(mipmappedTextureBytes(512, 512), 1_398_102);
});
