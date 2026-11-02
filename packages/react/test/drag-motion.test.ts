import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clampAxis,
  constrainDragPosition,
  integrateAxis,
  resolveDragMotion,
  rubberBandDistance,
  velocityFromSamples,
} from "../src/drag-motion";

test("resolveDragMotion defaults both flags on", () => {
  assert.deepEqual(resolveDragMotion(undefined), { inertia: true, bounce: true });
  assert.deepEqual(resolveDragMotion({}), { inertia: true, bounce: true });
  assert.deepEqual(resolveDragMotion(false), { inertia: false, bounce: false });
  assert.deepEqual(resolveDragMotion({ inertia: false }), {
    inertia: false,
    bounce: true,
  });
  assert.deepEqual(resolveDragMotion({ bounce: false }), {
    inertia: true,
    bounce: false,
  });
});

test("rubber band stretches less than free overshoot", () => {
  const free = 100;
  const banded = rubberBandDistance(free, 200);
  assert.ok(banded > 0);
  assert.ok(banded < free);
  assert.equal(rubberBandDistance(0, 200), 0);
  assert.equal(rubberBandDistance(-10, 200), 0);
});

test("constrainDragPosition clamps hard when bounce is off", () => {
  assert.equal(constrainDragPosition(-40, -10, 10, 100, false), -10);
  assert.equal(constrainDragPosition(40, -10, 10, 100, false), 10);
  assert.equal(constrainDragPosition(0, -10, 10, 100, false), 0);
});

test("constrainDragPosition rubber-bands past edges when bounce is on", () => {
  const pastMin = constrainDragPosition(-40, -10, 10, 100, true);
  assert.ok(pastMin < -10);
  assert.ok(pastMin > -40);
  const pastMax = constrainDragPosition(40, -10, 10, 100, true);
  assert.ok(pastMax > 10);
  assert.ok(pastMax < 40);
  assert.equal(constrainDragPosition(5, -10, 10, 100, true), 5);
});

test("velocityFromSamples uses recent span", () => {
  const samples = [
    { t: 0, position: 0 },
    { t: 50, position: 50 },
    { t: 100, position: 100 },
  ];
  assert.equal(velocityFromSamples(samples), 1000);
  assert.equal(velocityFromSamples([{ t: 0, position: 0 }]), 0);
  assert.equal(
    velocityFromSamples([
      { t: 0, position: 0 },
      { t: 0.2, position: 80 },
    ]),
    0,
  );
});

test("integrateAxis coasts with inertia and stops below friction", () => {
  let state = { position: 0, velocity: 500 };
  for (let i = 0; i < 120; i += 1) {
    const next = integrateAxis(state, 1 / 60, {
      min: -200,
      max: 200,
      inertia: true,
      bounce: true,
    });
    state = { position: next.position, velocity: next.velocity };
    if (next.settled) break;
  }
  assert.ok(state.position > 0);
  assert.ok(state.position < 200);
  assert.equal(state.velocity, 0);
});

test("integrateAxis kills velocity at the edge when bounce is off", () => {
  const next = integrateAxis(
    { position: 195, velocity: 800 },
    1 / 30,
    { min: -200, max: 200, inertia: true, bounce: false },
  );
  assert.equal(next.position, 200);
  assert.equal(next.velocity, 0);
  assert.equal(next.settled, true);
});

test("integrateAxis springs back when overscrolled with bounce", () => {
  let state = { position: 230, velocity: 0 };
  let settled = false;
  for (let i = 0; i < 180; i += 1) {
    const next = integrateAxis(state, 1 / 60, {
      min: -200,
      max: 200,
      inertia: true,
      bounce: true,
    });
    state = { position: next.position, velocity: next.velocity };
    settled = next.settled;
    if (settled) break;
  }
  assert.equal(settled, true);
  assert.ok(Math.abs(state.position - 200) < 1);
  assert.equal(state.velocity, 0);
});

test("clampAxis handles inverted ranges", () => {
  assert.equal(clampAxis(5, 10, 0), 10);
});
