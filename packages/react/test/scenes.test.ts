import assert from "node:assert/strict";
import { test } from "node:test";
import { Texture, TextureLoader } from "three";
import { SceneSource } from "../src/scenes";
import type { Scene, SphereTileScene } from "../src/index";
import { viewTilesAreDrawable } from "../src/scene-detail";
import {
  acceptDetailWait,
  normalizeTransitionWaitMs,
  pendingSceneUsesBaseLayer,
  phaseAfterSnapshot,
  planDetailHold,
  type SceneRuntimePhase,
} from "../src/scene-transition-policy";
import { Sphere } from "../src/sphere";
import { SphereTile, sphereTileViewShouldRefresh } from "../src/sphere-tile/sphere-tile";
import { Tile, decideTileLodUpdate } from "../src/tile/tile";
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

const tileScene: Scene = {
  id: "cube",
  type: "tile",
  baseUrl: "/cube/",
  multires: "512,1000",
  previewUrl: "preview.webp",
};

test("incoming scenes use full detail during the blend and only base while preloading", () => {
  const onReady = () => {};
  const onError = () => {};
  const phases: SceneRuntimePhase[] = [
    "idle",
    "preloading",
    "capturing",
    "recapturing",
    "awaitingDetail",
    "transitioning",
  ];
  for (const phase of phases) {
    const baseOnly = pendingSceneUsesBaseLayer(phase, true);
    const result = SceneSource({
      scene: tileScene,
      visible: phase !== "preloading" && phase !== "capturing",
      baseOnly,
      onReady,
      onError,
    });
    assert.equal(
      result?.props.loadMode,
      baseOnly ? "base" : "full",
      phase,
    );
  }
  assert.equal(pendingSceneUsesBaseLayer("preloading", true), true);
  assert.equal(pendingSceneUsesBaseLayer("capturing", true), true);
  assert.equal(pendingSceneUsesBaseLayer("transitioning", true), false);
  assert.equal(pendingSceneUsesBaseLayer("awaitingDetail", true), false);
  assert.equal(pendingSceneUsesBaseLayer("transitioning", false), false);
});

test("cube tiles refresh LOD immediately when loadMode changes with a fixed camera", () => {
  const fixed = {
    now: 50,
    lastUpdateAt: 40,
    visibilityDirty: false,
    viewportChanged: false,
    rotationDelta: 0,
    fovDelta: 0,
  };
  assert.equal(
    decideTileLodUpdate({
      ...fixed,
      loadMode: "full",
      trackedLoadMode: "base",
    }),
    true,
  );
  assert.equal(
    decideTileLodUpdate({
      ...fixed,
      loadMode: "full",
      trackedLoadMode: "full",
    }),
    false,
  );
  assert.equal(
    decideTileLodUpdate({
      ...fixed,
      loadMode: "full",
      trackedLoadMode: "full",
      visibilityDirty: true,
    }),
    true,
  );
  assert.equal(
    decideTileLodUpdate({
      loadMode: "preview",
      trackedLoadMode: "full",
      now: 50,
      lastUpdateAt: 0,
      visibilityDirty: true,
      viewportChanged: true,
      rotationDelta: 1,
      fovDelta: 1,
    }),
    false,
  );
  assert.equal(
    decideTileLodUpdate({
      loadMode: "full",
      trackedLoadMode: "full",
      now: 50,
      lastUpdateAt: 40,
      visibilityDirty: false,
      viewportChanged: false,
      rotationDelta: 0.001,
      fovDelta: 0,
    }),
    false,
  );
});

test("sphere tiles refresh immediately on loadMode change and keep the view throttle", () => {
  assert.equal(
    sphereTileViewShouldRefresh({
      loadModeChanged: true,
      managerChanged: false,
      elapsedMs: 0,
      viewUnchanged: true,
    }),
    true,
  );
  assert.equal(
    sphereTileViewShouldRefresh({
      loadModeChanged: false,
      managerChanged: false,
      elapsedMs: 20,
      viewUnchanged: false,
    }),
    false,
  );
  assert.equal(
    sphereTileViewShouldRefresh({
      loadModeChanged: false,
      managerChanged: false,
      elapsedMs: 100,
      viewUnchanged: false,
    }),
    true,
  );
  assert.equal(
    sphereTileViewShouldRefresh({
      loadModeChanged: false,
      managerChanged: false,
      elapsedMs: 500,
      viewUnchanged: true,
    }),
    false,
  );
});

test("detail waits default to zero, start early, time out, and ignore stale reports", () => {
  assert.equal(normalizeTransitionWaitMs(undefined), 0);
  assert.equal(normalizeTransitionWaitMs(0), 0);
  assert.equal(normalizeTransitionWaitMs(-20), 0);
  assert.equal(normalizeTransitionWaitMs(Number.NaN), 0);
  assert.equal(normalizeTransitionWaitMs(Number.POSITIVE_INFINITY), 0);
  assert.equal(normalizeTransitionWaitMs(200), 200);

  const immediate = planDetailHold({
    waitMs: normalizeTransitionWaitMs(undefined),
    now: 1_000,
    generation: 1,
    sceneId: "next",
  });
  assert.equal(immediate, null);
  assert.equal(phaseAfterSnapshot("dissolve", immediate), "transitioning");
  assert.equal(phaseAfterSnapshot("none", null), "idle");

  const hold = planDetailHold({
    waitMs: 200,
    now: 1_000,
    generation: 4,
    sceneId: "next",
  });
  assert.ok(hold);
  assert.equal(hold.deadline, 1_200);
  assert.equal(phaseAfterSnapshot("dissolve", hold), "awaitingDetail");
  assert.equal(phaseAfterSnapshot("none", hold), "awaitingDetail");

  const early = acceptDetailWait(hold, {
    kind: "ready",
    generation: 4,
    sceneId: "next",
  });
  assert.equal(early.start, true);
  assert.equal(early.wait, null);
  assert.ok(1_050 < hold.deadline);

  const tooSoon = acceptDetailWait(hold, {
    kind: "timeout",
    generation: 4,
    now: hold.deadline - 1,
  });
  assert.equal(tooSoon.start, false);
  assert.equal(tooSoon.wait, hold);
  const timedOut = acceptDetailWait(hold, {
    kind: "timeout",
    generation: 4,
    now: hold.deadline,
  });
  assert.equal(timedOut.start, true);

  const cancelled = acceptDetailWait(hold, { kind: "cancel", generation: 4 });
  assert.equal(cancelled.start, false);
  assert.equal(cancelled.wait, null);
  const stale = acceptDetailWait(cancelled.wait, {
    kind: "ready",
    generation: 4,
    sceneId: "next",
  });
  assert.equal(stale.start, false);
  const replacement = planDetailHold({
    waitMs: 200,
    now: 1_500,
    generation: 5,
    sceneId: "later",
  });
  assert.equal(
    acceptDetailWait(replacement, {
      kind: "ready",
      generation: 4,
      sceneId: "next",
    }).start,
    false,
  );
  assert.equal(
    acceptDetailWait(replacement, {
      kind: "ready",
      generation: 5,
      sceneId: "next",
    }).start,
    false,
  );
  assert.equal(
    acceptDetailWait(replacement, {
      kind: "ready",
      generation: 5,
      sceneId: "later",
    }).start,
    true,
  );

  const texture = {};
  assert.equal(viewTilesAreDrawable([]), false);
  assert.equal(viewTilesAreDrawable([texture, null]), false);
  assert.equal(viewTilesAreDrawable([texture, texture]), true);
});
