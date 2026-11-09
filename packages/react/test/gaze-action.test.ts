import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canRunSpatialGaze,
  createGazeActionState,
  createActionUpdateState,
} from "../src/spatial/gaze-action";

test("dwell fires once, continuous actions stop on exit and require fresh dwell", () => {
  const state = createGazeActionState();
  let clicks = 0,
    movement = 0,
    ends = 0;
  const action = {
    id: "rotate",
    activate: () => clicks++,
    update: (dt: number) => {
      movement += dt;
    },
    end: () => ends++,
  };
  state.tick(action, 0.02, 100);
  for (let i = 0; i < 10; i++) state.tick(action, 0.02, 100);
  assert.equal(clicks, 1);
  assert.ok(movement > 0);
  state.tick(null, 0.02, 100);
  const before = movement;
  assert.equal(ends, 1);
  state.tick(null, 0.02, 100);
  assert.equal(movement, before);
  state.tick(action, 0.02, 100);
  state.tick(action, 0.02, 100);
  assert.equal(clicks, 1);
});

test("target changes, disabled actions and frame interruptions cancel without catching up", () => {
  const state = createGazeActionState();
  let moved = 0;
  const action = {
    id: 1,
    update: (dt: number) => {
      moved += dt;
    },
  };
  state.tick(action, 0.02, 10);
  state.tick(action, 0.02, 10);
  const before = moved;
  assert.equal(state.tick(action, 1, 10), 0);
  assert.equal(moved, before);
  state.tick(action, 0.02, 10);
  state.tick({ ...action, enabled: () => false }, 0.02, 10);
  assert.equal(moved, before);
  state.tick(action, 0.02, 0);
  assert.equal(moved, before);
});

test("immersive gaze uses XR visibility and expired pointer suppression cannot lock gaze", () => {
  assert.equal(canRunSpatialGaze(true, "visible", 0, 100), true);
  assert.equal(canRunSpatialGaze(false, "visible-blurred", 0, 100), false);
  assert.equal(canRunSpatialGaze(true, undefined, 0, 100), false);
  assert.equal(canRunSpatialGaze(false, undefined, 350, 100), false);
  assert.equal(canRunSpatialGaze(false, undefined, 350, 351), true);
});

test("scroll gaze repeats at a paced interval rather than every rendered frame", () => {
  const state = createGazeActionState();
  const steps: number[] = [];
  const action = {
    id: "scroll",
    repeatIntervalMs: 700,
    update: (seconds: number) => steps.push(seconds),
  };
  for (let frame = 0; frame < 100; frame++) state.tick({ ...action }, 0.02, 100);
  assert.equal(steps.length, 3);
  assert.ok(steps.every((seconds) => seconds === 0.7));
  state.tick(null, 0.02, 100);
  for (let frame = 0; frame < 4; frame++) state.tick(action, 0.02, 100);
  assert.equal(steps.length, 3);
  for (let frame = 0; frame < 4; frame++) state.tick(action, 0.02, 100);
  assert.equal(steps.length, 4);
});


test("pointer hold cadence resets between presses and does not replay delayed steps", () => {
  const state = createActionUpdateState();
  let steps = 0;
  const action = { id: "scroll", repeatIntervalMs: 700, update: () => steps++ };
  state.tick(action, .02);
  for (let frame = 0; frame < 20; frame++) state.tick({ ...action }, .02);
  assert.equal(steps, 1);
  state.reset(); state.tick(action, .02); assert.equal(steps, 2);
  state.tick(action, 2); assert.equal(steps, 2);
  state.tick(action, .02); assert.equal(steps, 3);
});


test("paced updates measure elapsed time independently of render frame rate", () => {
  const state = createActionUpdateState();
  let steps = 0;
  const action = { id: "scroll", repeatIntervalMs: 700, update: () => steps++ };
  for (let frame = 0; frame < 8; frame++) state.tick(action, .1);
  assert.equal(steps, 2);
});
