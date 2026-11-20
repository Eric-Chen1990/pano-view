import assert from "node:assert/strict";
import { test } from "node:test";
import { Frustum, Matrix4, PerspectiveCamera, Texture } from "three";
import {
  preferredSphereLevel,
  sphereTileAddresses,
  sphereTileBounds,
} from "../src/sphere-tile/layout";
import { selectSphereTileLayers } from "../src/sphere-tile/sphere-tile";
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

test("sphere tiles prioritize complete visible detail within the texture budget", () => {
  const levels = [...sphereLevels, { width: 16384, height: 8192 }];
  const width = 1440;
  const height = 900;
  const fov = 75;
  const candidates = levels.map((size, level) =>
    sphereTileAddresses(size, level, 512).map((address) => ({
      address,
      bounds: sphereTileBounds(address, 0),
    })),
  );
  const frustumAt = (fov: number) => {
    const camera = new PerspectiveCamera(fov, width / height, 0.1, 2000);
    camera.position.z = 0.01;
    camera.updateMatrixWorld();
    return new Frustum().setFromProjectionMatrix(
      new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
    );
  };
  const visibleFrustum = frustumAt(fov);
  const paddedFrustum = frustumAt(fov + 8);
  const preferredLevel = preferredSphereLevel(levels, height, 1, fov, width);
  assert.equal(preferredLevel, 4);
  const visible = candidates[preferredLevel]!
    .filter(({ bounds }) => visibleFrustum.intersectsBox(bounds))
    .map(({ address }) => address);
  const padding = candidates[preferredLevel]!
    .filter(({ bounds }) => !visibleFrustum.intersectsBox(bounds) && paddedFrustum.intersectsBox(bounds))
    .map(({ address }) => address);
  assert.ok(visible.length > 0 && padding.length > 0);

  const select = (budgetMiB: number, level = preferredLevel, keepBase = false) => {
    const budget = budgetMiB * 1024 * 1024;
    const layers = selectSphereTileLayers({
      candidates,
      preferredLevel: level,
      budget,
      visibleFrustum,
      paddedFrustum,
      keepBase,
    });
    const bytes = layers.flatMap(({ addresses }) => addresses)
      .reduce((total, address) => total + mipmappedTextureBytes(address.width, address.height), 0);
    assert.ok(bytes <= budget);
    return layers;
  };
  const promoted = select(128);
  assert.deepEqual(promoted.map(({ level }) => level), [0, 4]);
  assert.deepEqual(promoted[1]?.addresses, [...visible, ...padding]);
  const withoutPadding = select(105);
  assert.deepEqual(withoutPadding.map(({ level }) => level), [0, 4]);
  assert.deepEqual(withoutPadding[1]?.addresses, visible);
  assert.deepEqual(select(96).map(({ level }) => level), [0, 1, 2, 3]);
  assert.deepEqual(select(192).map(({ level }) => level), [0, 1, 2, 3, 4]);
  assert.deepEqual(select(128, -1), []);
  assert.deepEqual(select(128, 0, true).map(({ level, addresses }) => [level, addresses.length]), [
    [0, candidates[0]!.length],
  ]);
});

test("mipmapped tiles keep the supplied anisotropy", () => {
  const texture = new Texture();
  configureMipmappedTexture(texture, 16);
  assert.equal(texture.anisotropy, 16);
  texture.dispose();
});
