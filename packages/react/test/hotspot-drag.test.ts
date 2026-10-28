import assert from "node:assert/strict";
import { test } from "node:test";
import { translateHotspotPosition } from "../src/hotspot/coordinates";
import {
  suppressFollowingClick,
  trackPointerDrag,
  type DragCaptureElement,
  type DragEventSource,
  type DragPointerLike,
} from "../src/hotspot/drag-session";

type ListenerMap = Map<string, Set<(event: DragPointerLike) => void>>;

function createSource(): DragEventSource & {
  emit(type: "pointermove" | "pointerup" | "pointercancel", event: DragPointerLike): void;
} {
  const listeners: ListenerMap = new Map();
  return {
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type, event) {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener(event);
      }
    },
  };
}

function createElement(): DragCaptureElement & {
  emitLost(event: DragPointerLike): void;
  capture: number | null;
} {
  const listeners = new Set<(event: DragPointerLike) => void>();
  const element = {
    capture: null as number | null,
    setPointerCapture(pointerId: number) {
      element.capture = pointerId;
    },
    releasePointerCapture(pointerId: number) {
      if (element.capture === pointerId) {
        element.capture = null;
      }
    },
    hasPointerCapture(pointerId: number) {
      return element.capture === pointerId;
    },
    addEventListener(_type: "lostpointercapture", listener: (event: DragPointerLike) => void) {
      listeners.add(listener);
    },
    removeEventListener(_type: "lostpointercapture", listener: (event: DragPointerLike) => void) {
      listeners.delete(listener);
    },
    emitLost(event: DragPointerLike) {
      for (const listener of [...listeners]) {
        listener(event);
      }
    },
  };
  return element;
}

test("hotspot drag keeps the grabbed point and wraps yaw the short way", () => {
  assert.deepEqual(
    translateHotspotPosition({ yaw: 10, pitch: -4 }, { yaw: 20, pitch: 1 }, { yaw: 20, pitch: 1 }),
    { yaw: 10, pitch: -4 },
  );
  assert.deepEqual(
    translateHotspotPosition({ yaw: 10, pitch: -4 }, { yaw: 16, pitch: -2 }, { yaw: 19, pitch: 1 }),
    { yaw: 13, pitch: -1 },
  );
  assert.deepEqual(
    translateHotspotPosition({ yaw: 170, pitch: 0 }, { yaw: 170, pitch: 0 }, { yaw: -170, pitch: 2 }),
    { yaw: -170, pitch: 2 },
  );
  assert.deepEqual(
    translateHotspotPosition({ yaw: 40, pitch: 80 }, { yaw: 0, pitch: 0 }, { yaw: 15, pitch: 30 }),
    { yaw: 0, pitch: 90 },
  );
});

test("pointer tracking continues after the pointer leaves the mesh and ends once", () => {
  const source = createSource();
  const element = createElement();
  const moves: number[] = [];
  const ends: number[] = [];
  const stop = trackPointerDrag(
    source,
    element,
    3,
    (event) => moves.push(event.clientX),
    (event) => ends.push(event.clientX),
  );

  assert.equal(element.capture, 3);
  source.emit("pointermove", { pointerId: 9, clientX: 1, clientY: 0 });
  source.emit("pointermove", { pointerId: 3, clientX: 40, clientY: 0 });
  source.emit("pointerup", { pointerId: 3, clientX: 80, clientY: 0 });
  source.emit("pointermove", { pointerId: 3, clientX: 90, clientY: 0 });
  source.emit("pointerup", { pointerId: 3, clientX: 100, clientY: 0 });
  element.emitLost({ pointerId: 3, clientX: 80, clientY: 0 });

  assert.deepEqual(moves, [40]);
  assert.deepEqual(ends, [80]);
  assert.equal(element.capture, null);
  stop();
});

test("losing pointer capture while the button is held does not end the drag", () => {
  const source = createSource();
  const element = createElement();
  const moves: number[] = [];
  const ends: number[] = [];
  trackPointerDrag(
    source,
    element,
    4,
    (event) => moves.push(event.clientX),
    (event) => ends.push(event.clientX),
  );

  element.emitLost({ pointerId: 4, clientX: 10, clientY: 0, buttons: 1 });
  source.emit("pointermove", { pointerId: 4, clientX: 30, clientY: 0 });
  element.emitLost({ pointerId: 4, clientX: 30, clientY: 0 });

  assert.deepEqual(moves, [30]);
  assert.deepEqual(ends, [30]);
  assert.equal(element.capture, null);
});

test("failed pointer capture still tracks inside the page", () => {
  const source = createSource();
  const element = createElement();
  element.setPointerCapture = () => {
    throw new Error("no capture");
  };
  let ended = false;
  trackPointerDrag(source, element, 1, () => undefined, () => {
    ended = true;
  });
  source.emit("pointercancel", { pointerId: 1, clientX: 0, clientY: 0 });
  assert.equal(ended, true);
});

test("stopping a drag ignores later pointer events", () => {
  const source = createSource();
  const element = createElement();
  let moves = 0;
  const stop = trackPointerDrag(source, element, 1, () => {
    moves += 1;
  }, () => undefined);
  stop();
  source.emit("pointermove", { pointerId: 1, clientX: 5, clientY: 0 });
  source.emit("pointerup", { pointerId: 1, clientX: 5, clientY: 0 });
  assert.equal(moves, 0);
  assert.equal(element.capture, null);
});

test("the click after a drag is swallowed, and the next press is not", () => {
  const dragged = new EventTarget();
  suppressFollowingClick(dragged);
  let draggedClick = false;
  dragged.addEventListener("click", () => {
    draggedClick = true;
  });
  dragged.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
  assert.equal(draggedClick, false);

  const nextPress = new EventTarget();
  suppressFollowingClick(nextPress);
  nextPress.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  let nextClick = false;
  nextPress.addEventListener("click", () => {
    nextClick = true;
  });
  nextPress.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
  assert.equal(nextClick, true);
});
