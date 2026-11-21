import assert from "node:assert/strict";
import test from "node:test";
import { createSceneLoadProgressStore, type SceneLoadProgress } from "../src/scene-load-progress";

test("publishes measured first-picture progress and reserves 100 for handoff", () => {
  const store = createSceneLoadProgressStore();
  const events: SceneLoadProgress[] = [];
  const unsubscribe = store.subscribe((progress) => events.push(progress));
  const load = store.begin({}, "scene");
  load.measure(1, 4);
  const measured = store.getSnapshot();
  load.measure(0, 4);
  load.measure(4, 4);
  assert.equal(store.getSnapshot(), measured);
  load.ready();
  load.fail(new Error("Late detail failure"));
  assert.deepEqual(events.map(({ status, percent }) => [status, percent]), [
    ["loading", null], ["loading", 25], ["ready", 100],
  ]);
  unsubscribe();
  store.reset();
  assert.equal(events.length, 3);
});

test("discards superseded attempts and resets only the current owner's progress", () => {
  const store = createSceneLoadProgressStore();
  const firstOwner = {};
  const oldLoad = store.begin(firstOwner, "a");
  const secondOwner = {};
  const newLoad = store.begin(secondOwner, "b");
  oldLoad.ready();
  store.release(firstOwner);
  assert.deepEqual(store.getSnapshot(), { status: "loading", sceneId: "b", percent: null });
  store.begin(secondOwner, "a", "ready");
  newLoad.fail(new Error("Outdated request"));
  assert.deepEqual(store.getSnapshot(), { status: "ready", sceneId: "a", percent: 100 });
  store.reset();
  assert.equal(store.getSnapshot().status, "idle");
});

test("supports a deferred load, terminal failure and retry without leaking across viewers", () => {
  const first = createSceneLoadProgressStore();
  const second = createSceneLoadProgressStore();
  const owner = {};
  const video = first.begin(owner, null, "idle");
  assert.equal(first.getSnapshot().status, "idle");
  video.loading();
  const error = new Error("No available video source");
  video.fail(error);
  assert.deepEqual(first.getSnapshot(), { status: "error", sceneId: null, percent: null, error });
  assert.equal(second.getSnapshot().status, "idle");
  video.loading();
  video.ready();
  assert.equal(first.getSnapshot().percent, 100);
  first.release(owner);
  assert.equal(first.getSnapshot().status, "idle");
});

test("keeps the display delay tied to a single uninterrupted loading attempt", () => {
  const store = createSceneLoadProgressStore();
  const owner = {};
  const first = store.begin(owner, "scene");
  const firstAttempt = store.getLoadingAttempt();
  assert.ok(firstAttempt);
  first.measure(1, 4);
  assert.equal(store.getLoadingAttempt(), firstAttempt);
  store.begin(owner, "scene");
  const previousSnapshot = store.getSnapshot();
  const previousAttempt = store.getLoadingAttempt();
  const second = store.begin(owner, "scene");
  const secondAttempt = store.getLoadingAttempt();
  assert.ok(secondAttempt);
  assert.notEqual(secondAttempt, firstAttempt);
  assert.notEqual(secondAttempt, previousAttempt);
  assert.notEqual(store.getSnapshot(), previousSnapshot);
  assert.deepEqual(store.getSnapshot(), previousSnapshot);
  first.ready();
  assert.equal(store.getLoadingAttempt(), secondAttempt);
  second.fail(new Error("Request failed"));
  assert.equal(store.getLoadingAttempt(), null);
  second.loading();
  assert.notEqual(store.getLoadingAttempt(), secondAttempt);
  second.ready();
  assert.equal(store.getLoadingAttempt(), null);
});
