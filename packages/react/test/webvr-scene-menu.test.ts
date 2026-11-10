import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bounded,
  sceneMenuLayoutConfig,
  sceneMenuAtlasRects,
  sceneMenuPoint,
  sceneMenuFollow,
  sceneMenuNeighbor,
  sceneMenuPage,
  wrapSceneTitle,
} from "../src/webvr/scene-menu-layout";
import { resolveGazeTarget } from "../src/webvr/gaze-target";
import {
  Mesh,
  PlaneGeometry,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from "three";
const items = Array.from({ length: 25 }, (_, i) => ({
  id: String(i),
  thumbnailUrl: "",
}));
test("menu locates active pages at capacity boundaries and wraps only scene navigation", () => {
  for (const capacity of [2, 6, 12])
    for (const index of [0, 11, 12, 24])
      assert.equal(
        sceneMenuPage(items, String(index), capacity),
        Math.floor(index / capacity)
      );
  assert.equal(sceneMenuPage([], null, 12), 0);
  assert.equal(sceneMenuNeighbor(items, "24", 1, true), "0");
  assert.equal(sceneMenuNeighbor(items, "0", -1, true), "24");
  assert.equal(sceneMenuNeighbor(items, "0", -1, false), null);
  assert.equal(sceneMenuNeighbor(items.slice(0, 1), "0", 1, true), null);
  assert.equal(sceneMenuNeighbor(items, "missing", 1, true), null);
});
test("configuration rejects nonfinite input and clamps supported values", () => {
  assert.equal(bounded(NaN, 4, 2, 4), 4);
  assert.equal(bounded(Infinity, 4, 2, 4), 4);
  assert.equal(bounded(-1, 4, 2, 4), 2);
  assert.equal(bounded(10, 4, 2, 4), 4);
});
test("follow moves immediately, settles centered and remains stable during gaze", () => {
  let state = { yaw: 0, elapsed: 0 };
  state = sceneMenuFollow(state.yaw, 10, state.elapsed, 1 / 60, false);
  assert.ok(
    state.yaw > 0,
    "small turns must follow without a dead zone or delay"
  );
  for (let i = 0; i < 120; i++)
    state = sceneMenuFollow(state.yaw, 90, state.elapsed, 1 / 60, false);
  assert.ok(
    Math.abs(state.yaw - 90) < 0.01,
    "the group must finish directly ahead"
  );
  assert.deepEqual(sceneMenuFollow(0, 90, 1, 0.04, true), {
    yaw: 0,
    elapsed: 0,
  });
  const wrapped = sceneMenuFollow(179, -179, 0, 0.016, false);
  assert.ok(wrapped.yaw > 179 && wrapped.yaw < 181);
});

test("long Unicode titles use at most two measured lines and ellipsis", () => {
  const lines = wrapSceneTitle(
    "你好世界你好世界你好世界",
    5,
    (text) => Array.from(text).length
  );
  assert.equal(lines.length, 2);
  assert.ok(lines[1]!.endsWith("…"));
  assert.ok(lines.every((line) => Array.from(line).length <= 5));
});
test("native menu resolves without a DOM panel and blank content blocks background hits", () => {
  const mesh = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial());
  mesh.position.z = -2;
  mesh.updateMatrixWorld();
  const ray = new Raycaster(new Vector3(), new Vector3(0, 0, -1));
  mesh.userData.panoGazeResolve = () => ({ id: "menu" });
  assert.deepEqual(
    resolveGazeTarget(ray.intersectObject(mesh), {
      modalOpen: false,
      panelsOpen: false,
    }),
    { channel: "spatial", action: { id: "menu" } }
  );
  mesh.userData.panoGazeResolve = () => null;
  assert.deepEqual(
    resolveGazeTarget(ray.intersectObject(mesh), {
      modalOpen: false,
      panelsOpen: false,
    }),
    { channel: "spatial", action: null }
  );
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test("follow is frame-rate independent and never overshoots across the yaw seam", () => {
  const followFor = (fps: number) => {
    let yaw = 170;
    for (let frame = 0; frame < fps; frame++)
      yaw = sceneMenuFollow(yaw, -170, 0, 1 / fps, false).yaw;
    return yaw;
  };
  assert.ok(Math.abs(followFor(30) - followFor(120)) < 1e-6);
  assert.ok(Math.abs(followFor(60) - 190) < 0.001);
  assert.equal(sceneMenuFollow(20, 100, 0, NaN, false).yaw, 20);
});

test("layouts retain compact defaults and expand all scenes without shrinking cards", () => {
  assert.deepEqual(
    sceneMenuLayoutConfig(
      "compact",
      undefined,
      undefined,
      undefined,
      25,
      false
    ),
    { cols: 4, degrees: 180, capacity: 12, rowCount: 3 }
  );
  assert.equal(
    sceneMenuLayoutConfig("arc", undefined, undefined, 180, 25, true).cols,
    8
  );
  assert.equal(
    sceneMenuLayoutConfig("arc", undefined, undefined, 360, 25, true).cols,
    16
  );
  assert.equal(sceneMenuLayoutConfig("flat", 4, 1, NaN, 25, true).rowCount, 7);
  assert.equal(sceneMenuLayoutConfig("flat", 4, 3, 0, 0, true).rowCount, 0);
  assert.equal(
    sceneMenuLayoutConfig("compact", 24, 100, Infinity, 1, false).cols,
    4
  );
  assert.equal(sceneMenuLayoutConfig("arc", 100, -1, 999, 1, false).cols, 24);
  const small = sceneMenuPoint(128, 8, 1024, 563, 453, 4, "flat", 180, 2, 1);
  const large = sceneMenuPoint(128, 8, 1024, 1167, 1057, 4, "flat", 180, 2, 1);
  assert.equal(small[0], large[0]);
  assert.equal(small[2], -2);
});

test("arc cards face inward, retain planar corners and have unique centers at the seam", () => {
  for (const degrees of [60, 180, 360]) {
    const { cols } = sceneMenuLayoutConfig(
      "arc",
      undefined,
      3,
      degrees,
      48,
      false
    );
    const point = (x: number, y: number) =>
      new Vector3(
        ...(sceneMenuPoint(
          x,
          y,
          cols * 256,
          563,
          453,
          cols,
          "arc",
          degrees,
          2,
          1
        ) as [number, number, number])
      );
    const centers: Vector3[] = [];
    for (let col = 0; col < cols; col++) {
      const center = point(col * 256 + 128, 75);
      centers.push(center);
      assert.ok(Math.abs(Math.hypot(center.x, center.z) - 2) < 1e-6);
      const corners = [
        point(col * 256 + 8, 8),
        point(col * 256 + 248, 8),
        point(col * 256 + 248, 140),
        point(col * 256 + 8, 140),
      ];
      const normal = corners[1]!
        .clone()
        .sub(corners[0]!)
        .cross(corners[3]!.clone().sub(corners[0]!))
        .normalize();
      assert.ok(
        Math.abs(corners[2]!.clone().sub(corners[0]!).dot(normal)) < 1e-6
      );
      const mesh = new Mesh(
        new PlaneGeometry(
          corners[0]!.distanceTo(corners[1]!),
          corners[1]!.distanceTo(corners[2]!)
        ),
        new MeshBasicMaterial()
      );
      mesh.position.copy(center);
      mesh.lookAt(new Vector3(0, center.y, 0));
      mesh.updateMatrixWorld();
      const ray = new Raycaster(new Vector3(), center.clone().normalize());
      assert.ok(
        ray.intersectObject(mesh).length > 0,
        `card ${col} at ${degrees} degrees must be selectable`
      );
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    assert.ok(centers[0]!.distanceTo(centers.at(-1)!) > 0.1);
  }
});

test("large all-scene walls use bounded atlases without losing edge pixels", () => {
  for (const maxSize of [256, 1024, 4096]) {
    const rects = sceneMenuAtlasRects(24 * 256, 100 * 151 + 110, maxSize);
    assert.ok(
      rects.every(
        (r) =>
          r.w > 0 &&
          r.h > 0 &&
          r.w <= Math.min(1024, maxSize) &&
          r.h <= Math.min(1024, maxSize)
      )
    );
    assert.equal(
      rects.reduce((sum, r) => sum + r.w * r.h, 0),
      24 * 256 * (100 * 151 + 110)
    );
    assert.equal(Math.max(...rects.map((r) => r.x + r.w)), 24 * 256);
    assert.equal(Math.max(...rects.map((r) => r.y + r.h)), 100 * 151 + 110);
  }
});

test("supersampled atlases retain logical hit coordinates and respect GPU pixel limits", () => {
  for (const maxSize of [256, 1024, 4096]) {
    const width = 8 * 256,
      height = 4 * 151 + 110;
    const rects = sceneMenuAtlasRects(width, height, maxSize, 2);
    assert.equal(
      rects.reduce((sum, r) => sum + r.w * r.h, 0),
      width * height
    );
    assert.ok(
      rects.every(
        (r) =>
          r.w * 2 <= Math.min(1024, maxSize) &&
          r.h * 2 <= Math.min(1024, maxSize)
      )
    );
    for (const rect of rects) {
      const x = rect.x + rect.w / 2,
        y = rect.y + rect.h / 2;
      const u = (x - rect.x) / rect.w,
        v = 1 - (y - rect.y) / rect.h;
      assert.equal(rect.x + u * rect.w, x);
      assert.equal(rect.y + (1 - v) * rect.h, y);
    }
  }
});
