import assert from "node:assert/strict";
import { test } from "node:test";
import {
  squareCaptureFooter,
  fillCaptureFooter,
  commitSpatialCapture,
  failSpatialCapture,
  createCaptureCheckpoint,
  captureOverlayBounds,
} from "../src/spatial/capture-support";

test("footer snapshots clear shorthand, physical and logical bottom radii while preserving top corners", () => {
  const declarations = new Map<string, { value: string; priority?: string }>();
  squareCaptureFooter({
    borderTopLeftRadius: "12px",
    borderTopRightRadius: "8px",
    setProperty(name, value, priority) {
      declarations.set(name, { value: value ?? "", priority });
    },
  });
  assert.deepEqual(declarations.get("border-radius"), {
    value: "12px 8px 0px 0px",
    priority: "important",
  });
  for (const property of [
    "border-bottom-left-radius",
    "border-bottom-right-radius",
    "border-end-start-radius",
    "border-end-end-radius",
  ]) {
    assert.deepEqual(declarations.get(property), {
      value: "0px",
      priority: "important",
    });
  }
});

test("final footer raster flattens both corners and uses the dialog background", () => {
  const rectangles: number[][] = [];
  const context = {
    fillStyle: "",
    fillRect: (...values: [number, number, number, number]) => {
      rectangles.push(values);
    },
  };
  fillCaptureFooter(context, 640, 688, 64, 12, "rgb(255, 255, 255)");
  assert.equal(context.fillStyle, "rgb(255, 255, 255)");
  assert.deepEqual(rectangles, [
    [0, 675, 13, 13],
    [627, 675, 13, 13],
    [0, 688, 640, 64],
  ]);
});

function captureState() {
  return {
    disposed: false,
    generation: 1,
    revision: 0,
    dirty: false,
    failed: false,
    image: null as string | null,
  };
}

test("continuous DOM movement publishes every completed capture and queues the next frame", () => {
  const state = captureState();
  state.failed = true;
  for (let frame = 0; frame < 5; frame++) {
    const revision = state.revision;
    state.dirty = false;
    // Several DOM mutations arrive while this asynchronous capture is pending.
    state.revision += 3;
    assert.equal(
      commitSpatialCapture(state, 1, revision, `frame-${frame}`),
      true,
    );
    assert.equal(state.image, `frame-${frame}`);
    assert.equal(state.dirty, true);
    assert.equal(state.failed, false);
  }
  state.dirty = false;
  assert.equal(commitSpatialCapture(state, 1, state.revision, "settled"), true);
  assert.equal(state.image, "settled");
  assert.equal(state.dirty, false);
});

test("frame subscriptions and resize invalidations remain queued without a DOM revision change", () => {
  const state = captureState();
  state.dirty = true;
  assert.equal(commitSpatialCapture(state, 1, 0, "frame"), true);
  assert.equal(state.dirty, true);
});

test("captures and errors cannot change a closed or replaced panel", () => {
  for (const lifecycle of [
    { disposed: true, generation: 1 },
    { disposed: false, generation: 2 },
  ]) {
    const state = { ...captureState(), ...lifecycle, image: "current" };
    const before = { ...state };
    assert.equal(commitSpatialCapture(state, 1, 0, "obsolete"), false);
    assert.deepEqual(state, before);
    assert.equal(failSpatialCapture(state, 1), false);
    assert.deepEqual(state, before);
  }
});

test("a reopened panel accepts its own result while rejecting its previous lifecycle", () => {
  const state = captureState();
  state.generation++;
  assert.equal(failSpatialCapture(state, 2), true);
  assert.equal(state.failed, true);
  assert.equal(commitSpatialCapture(state, 2, 0, "reopened"), true);
  assert.equal(state.failed, false);
  const before = { ...state };
  assert.equal(commitSpatialCapture(state, 1, 0, "old"), false);
  assert.equal(failSpatialCapture(state, 1), false);
  assert.deepEqual(state, before);
});

test("capture cloning yields its time slice and resumes with a fresh budget", async () => {
  let time = 0;
  let pauses = 0;
  let resume: (() => void) | undefined;
  const checkpoint = createCaptureCheckpoint(
    () => time,
    () => {
      pauses++;
      return new Promise<void>((resolve) => {
        resume = resolve;
      });
    },
  );
  time = 3;
  await checkpoint();
  assert.equal(pauses, 0);
  time = 5;
  let continued = false;
  const pending = checkpoint().then(() => {
    continued = true;
  });
  await Promise.resolve();
  assert.equal(pauses, 1);
  assert.equal(continued, false);
  // Rendering/input time is outside the next cloning slice.
  time = 30;
  resume!();
  await pending;
  time = 33;
  await checkpoint();
  assert.equal(pauses, 1);
});

test("annotation snapshots include floating titles and ignore occluded zero-area nodes", () => {
  assert.deepEqual(
    captureOverlayBounds([
      { left: -100, top: 50, width: 36, height: 36 },
      { left: -140, top: 10, width: 116, height: 30 },
      { left: 0, top: 0, width: 0, height: 0 },
    ]),
    { left: -148, top: 2, width: 132, height: 92 },
  );
  assert.equal(
    captureOverlayBounds([{ left: 0, top: 0, width: 0, height: 0 }]),
    null,
  );
});
