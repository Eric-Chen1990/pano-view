import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Frustum,
  Matrix4,
  PerspectiveCamera,
  Raycaster,
  Mesh,
  MeshBasicMaterial,
  BackSide,
  Texture,
  TextureLoader,
} from "three";
import {
  parseSphereMultires,
  preferredSphereLevel,
  resolveSphereTemplateUrl,
  spherePoint,
  sphereTileAddresses,
  sphereTileBounds,
  sphereTileGeometry,
} from "../src/sphere-tile/layout";
import { TileTextureManager } from "../src/tile/texture-manager";
import { parseMultires, resolveTemplateUrl } from "../src/tile/multires";
import { resolveAssetUrl } from "../src/asset-url";
import {
  resolvePanoFilterSnapshot,
  type PanoColorMatrix,
} from "../src/pano-filter/presets";
import { injectPanoColorMatrixShader } from "../src/pano-filter/shaders";
import type { WebGLProgramParametersWithUniforms } from "three";

const config = parseSphereMultires(
  "512,257x129,513x257,1025x513,2050x1025,4100x2050",
);
const address = sphereTileAddresses(config.levels[4]!, 4, 512).at(-1)!;

test("Sharp onetile dimensions, zero-based addresses and partial edges are preserved", () => {
  assert.equal(config.levels.length, 5);
  assert.deepEqual(address, {
    level: 4,
    row: 4,
    col: 8,
    imageWidth: 4100,
    imageHeight: 2050,
    tileSize: 512,
    width: 4,
    height: 2,
  });
  assert.equal(
    resolveSphereTemplateUrl("tiles/%l/%h_%v.webp", address, 0),
    "tiles/4/8_4.webp",
  );
  assert.equal(
    resolveSphereTemplateUrl("%l/%00h_%0v.webp", address, 0),
    "4/008_04.webp",
  );
  assert.equal(
    resolveAssetUrl("https://cdn.test/pano/", "tiles/4/8_4.webp"),
    "https://cdn.test/pano/tiles/4/8_4.webp",
  );
  assert.equal(
    resolveAssetUrl("https://cdn.test/pano/", "https://other.test/a.webp"),
    "https://other.test/a.webp",
  );
  assert.deepEqual(parseSphereMultires(config), config);
});

test("invalid sphere pyramids fail explicitly instead of requesting invented tiles", () => {
  for (const input of [
    "",
    "0,1000x500",
    "512,1000",
    "512,1000x0",
    "512,1000x1000",
    "512,1000x500,500x250",
    "512,1000x500,",
  ]) {
    assert.throws(() => parseSphereMultires(input), undefined, input);
  }
});

test("sphere center, poles, seam and positive yaw match stored panorama coordinates", () => {
  assert.ok(spherePoint(0.5, 0.5).distanceTo({ x: 0, y: 0, z: -1000 }) < 1e-8);
  assert.ok(spherePoint(0.75, 0.5).distanceTo({ x: 1000, y: 0, z: 0 }) < 1e-8);
  assert.ok(spherePoint(0.5, 0).distanceTo({ x: 0, y: 1000, z: 0 }) < 1e-8);
  assert.ok(spherePoint(0, 0.5).distanceTo(spherePoint(1, 0.5)) < 1e-8);
  assert.ok(
    spherePoint(0.5, 0.5, 90).distanceTo(spherePoint(0.75, 0.5)) < 1e-8,
  );
});

test("curved bounds contain the geometry, including longitude extrema and poles", () => {
  for (const yaw of [0, 35, -125, 450])
    for (const tile of sphereTileAddresses(
      { width: 2050, height: 1025 },
      0,
      512,
    )) {
      const bounds = sphereTileBounds(tile, yaw).expandByScalar(0.001);
      const geometry = sphereTileGeometry(tile, yaw);
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const point = spherePoint(0, 0).fromBufferAttribute(positions, i);
        assert.ok(
          bounds.containsPoint(point),
          `${yaw}: ${tile.col}/${tile.row}`,
        );
      }
      geometry.dispose();
    }
});

test("inside-facing geometry is visible and adjacent tiles share edges", () => {
  const tiles = sphereTileAddresses({ width: 2048, height: 1024 }, 1, 512);
  const left = sphereTileGeometry(tiles[0]!, 0),
    right = sphereTileGeometry(tiles[1]!, 0);
  const leftUv = left.getAttribute("uv"),
    rightUv = right.getAttribute("uv");
  const leftPositions = left.getAttribute("position"),
    rightPositions = right.getAttribute("position");
  const leftEdge = [],
    rightEdge = [];
  for (let i = 0; i < leftUv.count; i++)
    if (leftUv.getX(i) === 1)
      leftEdge.push([
        leftPositions.getX(i),
        leftPositions.getY(i),
        leftPositions.getZ(i),
      ]);
  for (let i = 0; i < rightUv.count; i++)
    if (rightUv.getX(i) === 0)
      rightEdge.push([
        rightPositions.getX(i),
        rightPositions.getY(i),
        rightPositions.getZ(i),
      ]);
  assert.deepEqual(leftEdge, rightEdge);
  const whole = sphereTileGeometry(
    sphereTileAddresses({ width: 2, height: 1 }, 0, 2)[0]!,
    0,
  );
  const material = new MeshBasicMaterial({ side: BackSide });
  const mesh = new Mesh(whole, material);
  mesh.updateMatrixWorld();
  assert.ok(
    new Raycaster(
      spherePoint(0.5, 0.5, 0, 0),
      spherePoint(0.5, 0.5, 0, 1),
    ).intersectObject(mesh).length > 0,
  );
  [left, right, whole, material].forEach((resource) => resource.dispose());
});

test("view culling rejects the back hemisphere while including both sides of the seam", () => {
  const tiles = sphereTileAddresses({ width: 8192, height: 4096 }, 3, 512);
  const camera = new PerspectiveCamera(60, 1, 0.1, 2000);
  camera.lookAt(0, 0, 1);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const frustum = new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    ),
  );
  const visible = tiles.filter((tile) =>
    frustum.intersectsBox(sphereTileBounds(tile, 0)),
  );
  assert.ok(visible.length < tiles.length / 2);
  assert.ok(visible.some((tile) => tile.col === 0));
  assert.ok(visible.some((tile) => tile.col === 15));
  assert.ok(visible.every((tile) => tile.col !== 7 && tile.col !== 8));
  assert.ok(
    preferredSphereLevel(config.levels, 600, 2, 60) >
      preferredSphereLevel(config.levels, 600, 1, 120),
  );
});

test("cube tile parsing and one-based URL behavior stay compatible", () => {
  assert.deepEqual(parseMultires("512,1000,2000"), {
    tileSize: 512,
    levels: [1000, 2000],
  });
  assert.equal(
    resolveTemplateUrl("tiles/%s/l%l/%v/l%l_%s_%v_%h.webp", {
      face: "f",
      level: 1,
      row: 2,
      col: 3,
      width: 512,
      height: 512,
      tileSize: 512,
      faceSize: 2000,
    }),
    "tiles/f/l1/2/l1_f_2_3.webp",
  );
});

test("display-space matrices preserve all RGBA coefficients and reject invalid numbers", () => {
  const matrix: PanoColorMatrix = [
    0.567, 0.433, 0, 0, 0, 0.558, 0.442, 0, 0, 0, 0, 0.242, 0.758, 0, 0, 0, 0,
    0, 1, 0,
  ];
  const snapshot = resolvePanoFilterSnapshot({
    colorMatrix: matrix,
    colorMatrixScope: "all",
  });
  assert.deepEqual(snapshot.colorMatrix, matrix);
  assert.notEqual(snapshot.colorMatrix, matrix);
  assert.equal(snapshot.colorMatrixScope, "all");
  assert.equal(resolvePanoFilterSnapshot({}).colorMatrix, null);
  assert.throws(() =>
    resolvePanoFilterSnapshot({
      colorMatrix: [NaN, ...matrix.slice(1)] as unknown as PanoColorMatrix,
    }),
  );
  const shader = {
    uniforms: {},
    vertexShader: "",
    fragmentShader:
      "#include <common>\n#include <map_fragment>\n#include <colorspace_fragment>",
  } as WebGLProgramParametersWithUniforms;
  injectPanoColorMatrixShader(shader);
  assert.ok(
    shader.fragmentShader.indexOf("uPanoColorMatrix * gl_FragColor") >
      shader.fragmentShader.indexOf("#include <colorspace_fragment>"),
  );
});

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test("texture queue enforces concurrency, retries and cancels queued unused tiles", async () => {
  const original = TextureLoader.prototype.loadAsync;
  const calls: string[] = [],
    pending: Array<(texture: Texture) => void> = [];
  TextureLoader.prototype.loadAsync = function (url) {
    calls.push(url);
    return new Promise((resolve) => pending.push(resolve));
  };
  const manager = new TileTextureManager<{ width: number; height: number }>({
    anisotropy: 1,
    maxBytes: 8,
    concurrency: 1,
    retryCount: 1,
  });
  try {
    const release = manager.acquire(
      "first",
      "first",
      { width: 1, height: 1 },
      () => {},
    );
    const cancel = manager.acquire(
      "cancel",
      "cancel",
      { width: 1, height: 1 },
      () => {},
    );
    cancel();
    assert.deepEqual(calls, ["first"]);
    pending.shift()!(new Texture());
    await flush();
    release();
    assert.equal(manager.getSnapshot("first").status, "loaded");
    assert.equal(manager.getSnapshot("cancel").status, "idle");
    let attempts = 0,
      errors = 0;
    TextureLoader.prototype.loadAsync = async function () {
      attempts++;
      throw new Error("offline");
    };
    const failing = new TileTextureManager<{ width: number; height: number }>({
      anisotropy: 1,
      maxBytes: 8,
      concurrency: 1,
      retryCount: 1,
      onError: () => errors++,
    });
    failing.acquire("bad", "bad", { width: 1, height: 1 }, () => {});
    await flush();
    assert.equal(attempts, 2);
    assert.equal(errors, 1);
    assert.equal(failing.getSnapshot("bad").status, "error");
    failing.dispose();
  } finally {
    manager.dispose();
    TextureLoader.prototype.loadAsync = original;
  }
});

test("late scene loads dispose their textures and never notify a new generation", async () => {
  const original = TextureLoader.prototype.loadAsync;
  let complete!: (texture: Texture) => void;
  TextureLoader.prototype.loadAsync = function () {
    return new Promise((resolve) => {
      complete = resolve;
    });
  };
  const manager = new TileTextureManager<{ width: number; height: number }>({
    anisotropy: 1,
    maxBytes: 4,
    concurrency: 1,
    retryCount: 1,
  });
  try {
    let notifications = 0,
      disposals = 0;
    manager.acquire(
      "old",
      "old",
      { width: 1, height: 1 },
      () => notifications++,
    );
    manager.dispose();
    manager.resume();
    const before = notifications;
    const texture = new Texture();
    texture.addEventListener("dispose", () => disposals++);
    complete(texture);
    await flush();
    assert.equal(disposals, 1);
    assert.equal(notifications, before);
    assert.equal(manager.getSnapshot("old").texture, null);
  } finally {
    manager.dispose();
    TextureLoader.prototype.loadAsync = original;
  }
});

test("cache evicts unused textures over budget and releases retained textures on unmount", async () => {
  const original = TextureLoader.prototype.loadAsync;
  let disposals = 0;
  TextureLoader.prototype.loadAsync = async function () {
    const texture = new Texture();
    texture.addEventListener("dispose", () => disposals++);
    return texture;
  };
  const manager = new TileTextureManager<{ width: number; height: number }>({
    anisotropy: 1,
    maxBytes: 4,
    concurrency: 1,
    retryCount: 0,
  });
  try {
    const release = manager.acquire(
      "one",
      "one",
      { width: 1, height: 1 },
      () => {},
    );
    await flush();
    release();
    manager.acquire("two", "two", { width: 1, height: 1 }, () => {});
    await flush();
    assert.equal(manager.getSnapshot("one").texture, null);
    assert.equal(disposals, 1);
    manager.dispose();
    assert.equal(disposals, 2);
  } finally {
    manager.dispose();
    TextureLoader.prototype.loadAsync = original;
  }
});

test("a rejected old-source request never retries after disposal", async () => {
  const original = TextureLoader.prototype.loadAsync;
  let rejectLoad!: (error: Error) => void;
  let attempts = 0;
  TextureLoader.prototype.loadAsync = function () {
    attempts++;
    return new Promise((_resolve, reject) => {
      rejectLoad = reject;
    });
  };
  const manager = new TileTextureManager<{ width: number; height: number }>({
    anisotropy: 1,
    maxBytes: 4,
    concurrency: 1,
    retryCount: 2,
  });
  try {
    manager.acquire("old", "old", { width: 1, height: 1 }, () => {});
    manager.dispose();
    rejectLoad(new Error("connection closed"));
    await flush();
    assert.equal(attempts, 1);
  } finally {
    manager.dispose();
    TextureLoader.prototype.loadAsync = original;
  }
});

test("stored CMS krpano resources use one-based URL indices without changing logical geometry", () => {
  const config = parseSphereMultires(
    "512,500x250,1000x500,2000x1000,4000x2000,8000x4000",
  );
  const first = sphereTileAddresses(config.levels[0]!, 0, config.tileSize)[0]!;
  const edge = sphereTileAddresses(config.levels[4]!, 4, config.tileSize).at(
    -1,
  )!;
  assert.equal(
    resolveSphereTemplateUrl("tiles/%l/%h_%v.webp", first),
    "tiles/1/1_1.webp",
  );
  assert.equal(
    resolveSphereTemplateUrl("tiles/%l/%h_%v.webp", edge),
    "tiles/5/16_8.webp",
  );
  assert.equal(edge.width, 320);
  assert.equal(edge.height, 416);
});
