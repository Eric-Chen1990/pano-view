import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bounded,
  sceneMenuControlLayout,
  sceneMenuLayoutConfig,
  sceneMenuAtlasRects,
  sceneMenuPoint,
  sceneMenuFollow,
  sceneMenuNavigationAnchor,
  sceneMenuNavigationFollow,
  sceneMenuNavigationNear,
  sceneMenuView,
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
  Euler,
} from "three";
const items = Array.from({ length: 25 }, (_, i) => ({
  id: String(i),
  thumbnailUrl: "",
}));
test("collapsed controls stay centered with square targets and unchanged icons", () => {
  const controls = sceneMenuControlLayout(1024, 0, false, false);
  assert.equal(controls.height, 220);
  assert.equal(controls.iconSize, 120);
  assert.equal(controls.pageLabel, null);
  for (const [index, button] of [
    controls.previous,
    controls.center,
    controls.next,
  ].entries()) {
    assert.equal(button.w, 128);
    assert.equal(button.h, button.w);
    assert.equal(button.x + button.w / 2, 380 + index * 132);
    assert.equal(button.y + button.h / 2, 110);
  }
  assert.ok(controls.previous.x + controls.previous.w < controls.center.x);
  assert.ok(controls.center.x + controls.center.w < controls.next.x);
});

test("expanded footer separates labels and square controls without empty page space in all mode", () => {
  for (const width of [512, 1024, 2048, 6144]) {
    for (const gridHeight of [151, 453, 1963]) {
      for (const all of [false, true]) {
        const controls = sceneMenuControlLayout(width, gridHeight, true, all);
        assert.equal(controls.height - gridHeight, all ? 136 : 178);
        assert.equal(controls.iconSize, 80);
        if (all) {
          assert.equal(controls.pageLabel, null);
          assert.equal(controls.center.y - gridHeight, 24);
        } else {
          const label = controls.pageLabel!;
          assert.equal(label.x, width / 2);
          assert.equal(label.y - gridHeight, 24);
          assert.equal(label.height, 22);
          assert.equal(controls.center.y - label.y - label.height, 20);
        }
        assert.equal(controls.height - controls.center.y - controls.center.h, 16);
        const buttons = [controls.previous, controls.center, controls.next];
        buttons.forEach((button, index) => {
          assert.equal(button.w, 96);
          assert.equal(button.h, button.w);
          assert.equal(button.y, controls.center.y);
          assert.equal(button.x + button.w / 2, width / 2 + (index - 1) * 144);
          assert.ok(button.x >= 0 && button.x + button.w <= width);
          if (index > 0)
            assert.equal(button.x - buttons[index - 1]!.x - button.w, 48);
        });
      }
    }
  }
});

test("expanded control squares retain their proportions in every spatial layout", () => {
  for (const layout of ["compact", "flat", "arc"] as const) {
    const cols = layout === "compact" ? 4 : 8;
    const width = layout === "compact" ? 1024 : cols * 256;
    const gridHeight = 453;
    const controls = sceneMenuControlLayout(width, gridHeight, true, false);
    for (const button of [controls.previous, controls.center, controls.next]) {
      const point = (x: number, y: number) =>
        new Vector3(
          ...(sceneMenuPoint(
            x, y, width, controls.height, gridHeight, cols, layout, 180, 2, 1
          ) as [number, number, number])
        );
      const topLeft = point(button.x, button.y);
      const horizontal = topLeft.distanceTo(point(button.x + button.w, button.y));
      const vertical = topLeft.distanceTo(point(button.x, button.y + button.h));
      assert.ok(Math.abs(horizontal / vertical - 1) < 0.001);
    }
  }
});

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

const navigationSettings = {
  follow: true,
  followPitch: true,
  navigationPitch: -25,
  scale: 1,
};

test("navigation anchors below the current view and preserves both legacy modes", () => {
  const view = { yaw: 80, pitch: -30 };
  assert.deepEqual(sceneMenuNavigationAnchor(view, navigationSettings), {
    yaw: 80, pitch: -55, returning: false,
  });
  for (const settings of [
    { ...navigationSettings, follow: false },
    { ...navigationSettings, followPitch: false },
  ]) {
    const anchor = sceneMenuNavigationAnchor(view, settings);
    assert.equal(anchor.pitch, -25);
    const next = sceneMenuNavigationFollow(anchor, { yaw: 100, pitch: 40 }, settings, 0.016, false);
    assert.equal(next.pitch, -25);
    assert.equal(next.yaw > anchor.yaw, settings.follow);
    assert.equal(sceneMenuNavigationFollow(anchor, view, settings, 0.016, true).yaw, 80);
  }
  assert.equal(sceneMenuNavigationAnchor({ yaw: 0, pitch: -90 }, navigationSettings).pitch, -75);
  assert.equal(sceneMenuNavigationAnchor(view, { ...navigationSettings, navigationPitch: NaN }).pitch, -55);
});

test("vertical comfort zone holds small head movements and converges after either boundary", () => {
  const anchor = { yaw: 0, pitch: -25, returning: false };
  for (const pitch of [-30, -10, 0, 15]) {
    assert.equal(sceneMenuNavigationFollow(anchor, { yaw: 0, pitch }, navigationSettings, 1 / 60, false).pitch, -25);
  }
  const upward = sceneMenuNavigationFollow(anchor, { yaw: 0, pitch: 35 }, navigationSettings, 1 / 60, false);
  assert.ok(upward.pitch > -25 && upward.pitch < 10);
  assert.equal(upward.returning, true);
  // Look sideways while checking downward recovery so the reticle safety guard
  // doesn't intentionally stop a toolbar that would pass through the gaze ray.
  const downward = sceneMenuNavigationFollow(anchor, { yaw: 90, pitch: -60 }, navigationSettings, 1 / 60, false);
  assert.ok(downward.pitch < -25);
  assert.equal(downward.returning, true);
  let pose = upward;
  for (let i = 0; i < 180; i++)
    pose = sceneMenuNavigationFollow(pose, { yaw: 0, pitch: 35 }, navigationSettings, 1 / 60, false);
  assert.equal(pose.pitch, 10);
  assert.equal(pose.returning, false);
});

test("pitch recovery is frame-rate independent, bounded and rejects invalid deltas", () => {
  const recover = (fps: number) => {
    let pose = { yaw: 0, pitch: -25, returning: false };
    for (let i = 0; i < fps; i++)
      pose = sceneMenuNavigationFollow(pose, { yaw: 0, pitch: 35 }, navigationSettings, 1 / fps, false);
    return pose.pitch;
  };
  assert.ok(Math.abs(recover(30) - recover(120)) < 1e-8);
  const pose = { yaw: 0, pitch: -60, returning: true };
  for (const delta of [NaN, Infinity, 0, -1])
    assert.deepEqual(sceneMenuNavigationFollow(pose, { yaw: 90, pitch: -90 }, navigationSettings, delta, false), pose);
  const next = sceneMenuNavigationFollow(pose, { yaw: 90, pitch: -90 }, navigationSettings, 0.1, false);
  assert.ok(next.pitch >= -75 && next.pitch < -60);
});

test("focus and near-reticle aiming freeze both axes, including slow-frame crossings", () => {
  const pose = { yaw: 0, pitch: -25, returning: true };
  assert.deepEqual(sceneMenuNavigationFollow(pose, { yaw: 40, pitch: 40 }, navigationSettings, 0.1, true), { ...pose, returning: false });
  const near = { yaw: 5, pitch: -22 };
  assert.equal(sceneMenuNavigationNear(pose, near, 1), true);
  assert.deepEqual(sceneMenuNavigationFollow(pose, near, navigationSettings, 0.1, false), { ...pose, returning: false });
  const above = { yaw: 0, pitch: 11, returning: false };
  const stopped = sceneMenuNavigationFollow(above, { yaw: 0, pitch: 0 }, navigationSettings, 0.1, false);
  assert.deepEqual(stopped, above, "do not sweep through the reticle on a slow frame");
  assert.equal(sceneMenuNavigationNear(pose, { yaw: 180, pitch: -25 }, 1), false);
});

test("aim protection includes all three controls at steep pitches and each supported scale", () => {
  const controls = sceneMenuControlLayout(1024, 0, false, false);
  for (const pitch of [-75, -25, 60]) {
    for (const scale of [0.75, 1, 1.25]) {
      for (const button of [controls.previous, controls.center, controls.next]) {
        const theta = ((button.x + button.w / 2) / 1024 - 0.5) * 28 * scale * Math.PI / 180;
        const direction = new Vector3(Math.sin(theta), 0, -Math.cos(theta))
          .applyEuler(new Euler(pitch * Math.PI / 180, -179 * Math.PI / 180, 0, "YXZ"));
        assert.equal(sceneMenuNavigationNear({ yaw: 179, pitch }, sceneMenuView(direction, 179), scale), true);
      }
    }
  }
  assert.equal(sceneMenuView(new Vector3(0, 1, 0), 123).yaw, 123);
});

test("navigation can be approached slowly for gaze and resumes recovery after looking away", () => {
  for (const navigationPitch of [-40, -25, -15]) {
    const settings = { ...navigationSettings, navigationPitch };
    let pose = sceneMenuNavigationAnchor({ yaw: 0, pitch: 0 }, settings);
    for (let i = 0; i <= 120; i++) {
      pose = sceneMenuNavigationFollow(pose, { yaw: 0, pitch: navigationPitch * i / 120 }, settings, 1 / 60, false);
      assert.equal(pose.pitch, navigationPitch, "the target must not escape a slow gaze approach");
    }
    const next = sceneMenuNavigationFollow(pose, { yaw: 30, pitch: 45 }, settings, 1 / 60, false);
    assert.ok(next.yaw > pose.yaw);
    assert.ok(next.pitch > pose.pitch);
  }
});

test("view extraction uses heading and pitch without inheriting head roll", () => {
  for (const pitch of [-75, -25, 60]) {
    for (const roll of [-45, 0, 45]) {
      const direction = new Vector3(0, 0, -1).applyEuler(
        new Euler(pitch * Math.PI / 180, -70 * Math.PI / 180, roll * Math.PI / 180, "YXZ")
      );
      const view = sceneMenuView(direction, 0);
      assert.ok(Math.abs(view.yaw - 70) < 1e-8);
      assert.ok(Math.abs(view.pitch - pitch) < 1e-8);
    }
  }
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
