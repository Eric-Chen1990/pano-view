import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calloutAccentShiftX,
  calloutRevealProgress,
  directionAngleDegrees,
  resolveCalloutLayout,
  stepCalloutReveal,
  stepLookGate,
} from "../src/hotspot/callout-layout";

test("callout layout places the card on the line endpoint side", () => {
  const upRight = resolveCalloutLayout(45, 100);
  assert.ok(upRight.endX > 0);
  assert.ok(upRight.endY > 0);
  assert.equal(upRight.card.horizontal, "right");
  assert.equal(upRight.card.vertical, "end");

  const left = resolveCalloutLayout(180, 80);
  assert.ok(left.endX < 0);
  assert.equal(left.card.horizontal, "left");
  assert.equal(left.card.vertical, "center");

  const down = resolveCalloutLayout(-90, 50);
  assert.ok(down.endY < 0);
  assert.equal(down.card.vertical, "start");
});

test("vertical leader centers the accent on the stroke", () => {
  assert.equal(calloutAccentShiftX(90, 2, "right"), -1);
  assert.equal(calloutAccentShiftX(-90, 4, "right"), -2);
  assert.equal(calloutAccentShiftX(90, 4, "left"), 2);
  assert.equal(calloutAccentShiftX(270, 2, "left"), 1);
  assert.ok(Math.abs(calloutAccentShiftX(0, 2, "right")) < 1e-12);
  assert.ok(Math.abs(calloutAccentShiftX(180, 2, "left")) < 1e-12);
  const diagonal = calloutAccentShiftX(45, 2, "right");
  assert.ok(diagonal < 0 && diagonal > -1);
});

test("reveal opens line first then content, and closes in reverse", () => {
  assert.deepEqual(calloutRevealProgress(true, 0), {
    lineProgress: 0,
    contentProgress: 0,
  });
  assert.deepEqual(calloutRevealProgress(true, 0.25), {
    lineProgress: 0.5,
    contentProgress: 0,
  });
  assert.deepEqual(calloutRevealProgress(true, 0.5), {
    lineProgress: 1,
    contentProgress: 0,
  });
  assert.deepEqual(calloutRevealProgress(true, 0.75), {
    lineProgress: 1,
    contentProgress: 0.5,
  });
  assert.deepEqual(calloutRevealProgress(false, 0.25), {
    lineProgress: 1,
    contentProgress: 0.5,
  });
  assert.deepEqual(calloutRevealProgress(false, 0.75), {
    lineProgress: 0.5,
    contentProgress: 0,
  });
});

test("stepCalloutReveal advances phases and unmounts after close", () => {
  const opening = stepCalloutReveal(
    true,
    { lineProgress: 0, contentProgress: 0 },
    140,
    280,
    220,
    false,
  );
  assert.equal(opening.lineProgress, 0.5);
  assert.equal(opening.contentProgress, 0);
  assert.equal(opening.mounted, true);

  const opened = stepCalloutReveal(
    true,
    { lineProgress: 1, contentProgress: 0 },
    220,
    280,
    220,
    false,
  );
  assert.equal(opened.lineProgress, 1);
  assert.equal(opened.contentProgress, 1);

  const closing = stepCalloutReveal(
    false,
    { lineProgress: 1, contentProgress: 1 },
    110,
    280,
    220,
    false,
  );
  assert.equal(closing.contentProgress, 0.5);
  assert.equal(closing.lineProgress, 1);
  assert.equal(closing.mounted, true);

  const closed = stepCalloutReveal(
    false,
    { lineProgress: 0.1, contentProgress: 0 },
    280,
    280,
    220,
    false,
  );
  assert.equal(closed.lineProgress, 0);
  assert.equal(closed.mounted, false);

  const reduced = stepCalloutReveal(
    false,
    { lineProgress: 1, contentProgress: 1 },
    16,
    280,
    220,
    true,
  );
  assert.deepEqual(reduced, {
    lineProgress: 0,
    contentProgress: 0,
    mounted: false,
  });
});

test("look gate uses enter delay and exit hysteresis", () => {
  let state = stepLookGate(
    { inside: false, since: null, open: false },
    3,
    6,
    250,
    1000,
  );
  assert.equal(state.open, false);
  assert.equal(state.inside, true);
  assert.equal(state.since, 1000);

  state = stepLookGate(state, 3, 6, 250, 1200);
  assert.equal(state.open, false);

  state = stepLookGate(state, 3, 6, 250, 1260);
  assert.equal(state.open, true);

  state = stepLookGate(state, 8, 6, 250, 1300);
  assert.equal(state.open, true);

  state = stepLookGate(state, 10, 6, 250, 1400);
  assert.equal(state.open, false);
  assert.equal(state.inside, false);
});

test("directionAngleDegrees measures the smaller angle between unit vectors", () => {
  assert.ok(directionAngleDegrees(0, 0, -1, 0, 0, -1) < 1e-6);
  assert.ok(
    Math.abs(directionAngleDegrees(0, 0, -1, 1, 0, 0) - 90) < 1e-6,
  );
  assert.ok(
    Math.abs(directionAngleDegrees(0, 0, -1, 0, 0, 1) - 180) < 1e-6,
  );
});
