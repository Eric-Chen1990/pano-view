import assert from "node:assert/strict";
import { test } from "node:test";
import { bindWebVRPointerLock, exitWebVRPointerLock, requestWebVRPointerLock } from "../src/webvr/pointerlock-runtime";

function fixture() {
  const doc = new EventTarget() as EventTarget & {
    pointerLockElement: HTMLElement | null;
    exitPointerLock: () => void;
  };
  const target = new EventTarget() as HTMLElement;
  let calls = 0;
  Object.defineProperty(target, "ownerDocument", { value: doc });
  target.requestPointerLock = () => { calls++; };
  doc.pointerLockElement = null;
  doc.exitPointerLock = () => {
    doc.pointerLockElement = null;
    doc.dispatchEvent(new Event("pointerlockchange"));
  };
  const lock = () => {
    doc.pointerLockElement = target;
    doc.dispatchEvent(new Event("pointerlockchange"));
  };
  const dispatch = (type: string, button = 0, pointerType = "mouse") => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { button, pointerType });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return { doc, target, lock, dispatch, calls: () => calls };
}

test("entry requests synchronously, coalesces legacy requests, and retries after errors", async () => {
  const f = fixture();
  const first = requestWebVRPointerLock(f.target);
  assert.equal(f.calls(), 1, "request must run before the caller proceeds to fullscreen");
  assert.equal(requestWebVRPointerLock(f.target), first);
  f.doc.dispatchEvent(new Event("pointerlockerror"));
  await first;
  const retry = requestWebVRPointerLock(f.target);
  assert.equal(f.calls(), 2);
  f.lock();
  await retry;
  await requestWebVRPointerLock(f.target);
  assert.equal(f.calls(), 2);
});

test("right-click unlocks without relocking; the first left-click only locks", async () => {
  const f = fixture();
  const states: boolean[] = [];
  const dispose = bindWebVRPointerLock(f.target, (locked) => states.push(locked));
  f.lock();
  assert.equal(f.dispatch("pointerdown", 2), true);
  assert.equal(f.doc.pointerLockElement, null);
  assert.equal(f.dispatch("contextmenu", 2), true);
  assert.equal(f.calls(), 0);
  assert.equal(f.dispatch("pointerdown"), true);
  assert.equal(f.calls(), 1);
  f.lock();
  for (const type of ["mousedown", "pointerup", "mouseup", "click"]) {
    assert.equal(f.dispatch(type), true, type);
  }
  assert.equal(f.dispatch("pointerdown"), false);
  assert.equal(f.dispatch("click"), false);
  assert.deepEqual(states, [false, true, false, true]);
  dispose();
  assert.equal(f.doc.pointerLockElement, null);
  assert.equal(f.dispatch("pointerdown"), false);
  assert.equal(f.dispatch("contextmenu", 2), false);
});

test("external unlock and errors update state without automatically retrying", () => {
  const f = fixture();
  let locked = false;
  const dispose = bindWebVRPointerLock(f.target, (value) => { locked = value; });
  f.lock();
  assert.equal(locked, true);
  f.doc.exitPointerLock();
  assert.equal(locked, false);
  f.doc.dispatchEvent(new Event("pointerlockerror"));
  assert.equal(f.calls(), 0);
  assert.equal(f.dispatch("pointerdown", 0, "touch"), false);
  dispose();
});

test("cleanup cancels pending acquisition and never releases another viewer's lock", async () => {
  const f = fixture();
  const dispose = bindWebVRPointerLock(f.target, () => {});
  const pending = requestWebVRPointerLock(f.target);
  dispose();
  f.lock();
  await pending;
  assert.equal(f.doc.pointerLockElement, null);
  f.doc.pointerLockElement = {} as HTMLElement;
  exitWebVRPointerLock(f.target);
  assert.notEqual(f.doc.pointerLockElement, null);
});

test("promise rejection, unsupported API, and synchronous failures remain retryable", async () => {
  const f = fixture();
  f.target.requestPointerLock = () => Promise.reject(new Error("denied"));
  await requestWebVRPointerLock(f.target);
  f.target.requestPointerLock = () => { throw new Error("denied"); };
  await requestWebVRPointerLock(f.target);
  Object.defineProperty(f.target, "requestPointerLock", { value: undefined, configurable: true });
  await requestWebVRPointerLock(f.target);
  assert.equal(f.doc.pointerLockElement, null);
});
