import assert from "node:assert/strict";
import { test } from "node:test";
import { Texture, TextureLoader } from "three";
import { SceneSource } from "../src/scenes";
import type { Scene, SphereTileScene } from "../src/index";
import { Sphere } from "../src/sphere";
import { SphereTile } from "../src/sphere-tile/sphere-tile";
import { Tile } from "../src/tile/tile";
import {
  TileTextureManager,
  type TextureAddress,
} from "../src/tile/texture-manager";
import { sphereTileAddresses } from "../src/sphere-tile/layout";

const sphereTileScene: SphereTileScene = {
  id: "sphere-tiles",
  type: "sphereTile",
  baseUrl: "/sphere/",
  multires: "512,500x250,1000x500",
  previewUrl: "previews/400.webp",
  indexBase: 0,
  yawOffset: 25,
  resolveTileUrl: (address) =>
    `${address.level}/${address.col}_${address.row}.webp`,
};

test("Scenes dispatches each projection and preserves sphere tile source options", () => {
  const onReady = () => {};
  const onError = () => {};
  const sources: Array<[Scene, unknown]> = [
    [
      {
        id: "sphere",
        type: "sphere",
        src: "/sphere.webp",
        previewUrl: "/preview.webp",
      },
      Sphere,
    ],
    [
      {
        id: "cube",
        type: "tile",
        baseUrl: "/cube/",
        multires: "512,1000",
        previewUrl: "preview.webp",
      },
      Tile,
    ],
    [sphereTileScene, SphereTile],
  ];
  for (const [scene, component] of sources) {
    const result = SceneSource({
      scene,
      visible: false,
      baseOnly: true,
      onReady,
      onError,
    });
    assert.ok(result);
    assert.equal(result.type, component);
    assert.equal(result.props.visible, false);
    assert.equal(result.props.onReady, onReady);
    if (scene.type !== "sphere") {
      assert.equal(result.props.loadMode, "base");
      assert.equal(result.props.onPreviewError, onError);
      assert.equal(result.props.id, undefined);
      assert.equal(result.props.type, undefined);
    }
    if (scene.type === "sphereTile") {
      assert.equal(result.props.indexBase, 0);
      assert.equal(result.props.yawOffset, 25);
      assert.equal(result.props.resolveTileUrl, sphereTileScene.resolveTileUrl);
      assert.equal(result.props.multires, sphereTileScene.multires);
    }
  }
  const active = SceneSource({
    scene: sphereTileScene,
    visible: true,
    baseOnly: false,
    onReady,
    onError,
  });
  assert.equal(active?.props.loadMode, "full");
  assert.equal(active?.props.visible, true);
  assert.equal(
    SceneSource({
      scene: null,
      visible: false,
      baseOnly: false,
      onReady,
      onError,
    }),
    null,
  );
});

test("mixed cube and sphere tiles share a request queue and release only outgoing textures", async () => {
  const original = TextureLoader.prototype.loadAsync;
  const calls: string[] = [];
  const pending: Array<(texture: Texture) => void> = [];
  TextureLoader.prototype.loadAsync = function (url) {
    calls.push(url);
    return new Promise((resolve) => pending.push(resolve));
  };
  const manager = new TileTextureManager<TextureAddress>({
    anisotropy: 1,
    maxBytes: 4,
    concurrency: 1,
    retryCount: 0,
  });
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
  let cubeDisposed = 0;
  let sphereDisposed = 0;
  try {
    assert.equal(manager.memoryBudgetBytes, 4);
    const releaseCube = manager.acquire(
      "cube",
      "/cube.webp",
      { width: 1, height: 1 },
      () => {},
    );
    const sphere = sphereTileAddresses({ width: 2, height: 1 }, 0, 1)[0]!;
    const releaseSphere = manager.acquire(
      "sphere",
      "/sphere.webp",
      sphere,
      () => {},
    );
    assert.deepEqual(calls, ["/cube.webp"]);
    const cubeTexture = new Texture();
    cubeTexture.addEventListener("dispose", () => cubeDisposed++);
    pending.shift()!(cubeTexture);
    await flush();
    assert.deepEqual(calls, ["/cube.webp", "/sphere.webp"]);
    const sphereTexture = new Texture();
    sphereTexture.addEventListener("dispose", () => sphereDisposed++);
    pending.shift()!(sphereTexture);
    await flush();
    releaseCube();
    manager.releaseUnused();
    assert.equal(cubeDisposed, 1);
    assert.equal(sphereDisposed, 0);
    assert.equal(manager.getSnapshot("sphere").texture, sphereTexture);
    releaseSphere();
    manager.releaseUnused();
    assert.equal(sphereDisposed, 1);
    assert.equal(manager.getSnapshot("sphere").texture, null);
  } finally {
    manager.dispose();
    TextureLoader.prototype.loadAsync = original;
  }
});
