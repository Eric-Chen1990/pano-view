import assert from 'node:assert/strict';
import { test } from 'node:test';
import { axisValue, createVRInput, type InputSource } from '../src/webvr/input';

const controller = (): InputSource => ({ targetRayMode: 'tracked-pointer' });
test('auto separates fallback gaze from explicit WebXR selection', () => {
  const input = createVRInput();
  input.configure('fake', 'auto');
  assert.equal(input.getSnapshot().mode, 'gaze');
  input.configure('webxr', 'auto');
  assert.equal(input.getSnapshot().mode, 'pointer');
  assert.equal(input.getSnapshot().source, null);
});
test('tracking loss pauses, reconnect consumes the entire first selection', () => {
  const input = createVRInput(), source = controller();
  const event = { pointerId: 1, pointerState: { inputSource: source } };
  input.configure('webxr', 'auto');
  assert.equal(input.accept(event, 'down', true), true);
  input.observe(source, false, false);
  assert.equal(input.getSnapshot().mode, 'paused');
  input.observe(source, true, true);
  assert.equal(input.getSnapshot().mode, 'paused');
  assert.equal(input.accept(event, 'down', true), false);
  assert.equal(input.accept(event, 'up'), false);
  assert.equal(input.accept(event, 'click'), false);
  assert.equal(input.accept(event, 'down', true), true);
  assert.equal(input.hasStick, true);
});
test('transient source removal does not pause or start dwell', () => {
  const input = createVRInput(), source = { targetRayMode: 'transient-pointer' };
  input.configure('webxr', 'auto');
  input.accept({ pointerId: 1, pointerState: { inputSource: source } }, 'down');
  input.observe(source, false, false);
  assert.deepEqual(input.getSnapshot(), { mode: 'pointer', source: 'system' });
});
test('host gaze policy rejects XR selection and session controls cannot override it', () => {
  const input = createVRInput();
  input.configure('webxr', 'gaze'); input.enablePointer();
  assert.equal(input.accept({ pointerId: 1, pointerState: { inputSource: controller() } }, 'down'), false);
  assert.equal(input.getSnapshot().mode, 'gaze');
  input.configure('webxr', 'pointer'); input.enableGaze();
  assert.equal(input.getSnapshot().mode, 'pointer');
});
test('ownership prevents another hand from cancelling or taking over a held target', () => {
  const input = createVRInput(), source = controller(), target = {};
  input.configure('webxr', 'auto');
  input.accept({ pointerId: 1, pointerState: { inputSource: source } }, 'down');
  assert.equal(input.claim(target, 1), true);
  assert.equal(input.claim(target, 2), false);
  assert.equal(input.accept({ pointerId: 2, pointerState: { inputSource: controller() } }, 'down'), false);
  input.release(target, 2);
  assert.equal(input.claim(target, 2), false);
  input.release(target, 1);
  assert.equal(input.claim(target, 2), true);
});
test('input changes cancel operations and restore capability defaults', () => {
  const input = createVRInput(), source = controller(); let stopped = 0;
  input.configure('webxr', 'auto');
  input.accept({ pointerId: 1, pointerState: { inputSource: source } }, 'down', true);
  input.onCancel(() => stopped++);
  input.enableGaze();
  assert.equal(stopped, 1); assert.equal(input.hasStick, false); assert.equal(input.canDrag, false);
});
test('thumbstick dead zone rejects drift and normalizes remaining travel', () => {
  assert.equal(axisValue(undefined), 0); assert.equal(axisValue(NaN), 0);
  assert.equal(axisValue(.2), 0); assert.equal(axisValue(-.1), 0);
  assert.equal(axisValue(1), 1); assert.equal(axisValue(-1), -1);
  assert.ok(Math.abs(axisValue(.6) - .5) < 1e-9);
});

test('model axes respect limits and take precedence over outer scrolling', async () => {
  const { applySpatialAxes } = await import('../src/webvr/input');
  const scroll = { isConnected: true, scrollTop: 0, scrollLeft: 0, clientHeight: 500, clientWidth: 300 };
  let zoom = 1;
  applySpatialAxes({ zoomBy: factor => { zoom *= factor; } }, scroll, 1, -1, .02);
  assert.ok(zoom > 1); assert.equal(scroll.scrollTop, 0); assert.equal(scroll.scrollLeft, 0);
  const previous = zoom;
  applySpatialAxes({ zoomBy: factor => { zoom *= factor; }, canExecute: () => false }, scroll, 0, -1, .02);
  assert.equal(zoom, previous); assert.equal(scroll.scrollTop, 0);
  applySpatialAxes(null, scroll, 1, 1, .02);
  assert.equal(scroll.scrollTop, 10); assert.equal(scroll.scrollLeft, 6);
  scroll.isConnected = false;
  applySpatialAxes(null, scroll, 1, 1, .02);
  assert.equal(scroll.scrollTop, 10);
  scroll.isConnected = true;
  applySpatialAxes(null, scroll, 1, 1, 1);
  assert.equal(scroll.scrollTop, 10);
});
