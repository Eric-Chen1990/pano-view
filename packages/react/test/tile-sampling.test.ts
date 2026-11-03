import assert from "node:assert/strict";
import { test } from "node:test";
import { Texture } from "three";
import { preferredSphereLevel } from "../src/sphere-tile/layout";
import { getPreferredLevel } from "../src/tile/face-layout";
import {
  configureMipmappedTexture,
  mipmappedTextureBytes,
} from "../src/tile/texture-manager";

const faces = [512, 1024, 2048, 4096];
const sphereLevels = [
  { width: 1024, height: 512 },
  { width: 2048, height: 1024 },
  { width: 4096, height: 2048 },
  { width: 8192, height: 4096 },
];

test("level selection keeps wide-view edges near one texel per pixel", () => {
  // 800px at dpr 2 is 1600 physical pixels. A square 90° view matches the
  // center and the face edge, so the resident level is 2048.
  assert.equal(getPreferredLevel(faces, 800, 2, 90, 1), 3);
  // At 140° the center only needs about 582 texels, but the screen edge is
  // magnified to about 4396. Stay on the finest face instead of dropping.
  assert.equal(getPreferredLevel(faces, 800, 2, 140, 3), 4);
  // 16:9 at 100° needs about 6036 texels across the left and right edges,
  // versus about 1343 at the center.
  assert.equal(getPreferredLevel(faces, 800, 2, 100, 1, 800), 3);
  assert.equal(getPreferredLevel(faces, 800, 2, 100, 1, 1422), 4);
  // Zoomed in, the center still outruns the edges, including on a wide screen.
  assert.equal(getPreferredLevel(faces, 546, 1, 40, 1, 971), 3);

  // Square 60° and 120° need the same equirectangular height: Hπ / sin(fov).
  assert.equal(
    preferredSphereLevel(sphereLevels, 200, 1, 60),
    preferredSphereLevel(sphereLevels, 200, 1, 120),
  );
  // The same 120° view on 16:9 has to cover the sharper horizontal edges.
  assert.ok(
    preferredSphereLevel(sphereLevels, 200, 1, 120, 356) >
      preferredSphereLevel(sphereLevels, 200, 1, 120, 200),
  );
});

test("tile memory counts the mipmap chain", () => {
  assert.equal(mipmappedTextureBytes(1, 1), 6);
  assert.equal(mipmappedTextureBytes(512, 512), 1_398_102);
});

test("mipmapped tiles keep the supplied anisotropy", () => {
  const texture = new Texture();
  configureMipmappedTexture(texture, 16);
  assert.equal(texture.anisotropy, 16);
  texture.dispose();
});
