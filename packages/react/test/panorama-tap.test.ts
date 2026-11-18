import assert from "node:assert/strict";
import { test } from "node:test";
import { createPanoramaTap } from "../src/video/panorama-tap";

function pointer(overrides: Partial<PointerEvent> = {}): PointerEvent {
  return {
    button: 0,
    clientX: 100,
    clientY: 100,
    detail: 1,
    isPrimary: true,
    pointerId: 1,
    ...overrides,
  } as PointerEvent;
}

test("consumes a single completed tap and keeps its activation event identities", () => {
  const tap = createPanoramaTap();
  const down = pointer();
  const up = pointer({ clientX: 103 });
  tap.start(down);
  tap.move(up);
  tap.end(up);
  const gesture = tap.take(pointer({ clientX: 103 }));
  assert.equal(gesture?.start, down);
  assert.equal(gesture?.end, up);
  assert.equal(tap.take(pointer()), undefined);
});

test("rejects a drag that returns to its starting point", () => {
  const tap = createPanoramaTap();
  tap.start(pointer());
  tap.move(pointer({ clientX: 106 }));
  tap.move(pointer());
  tap.end(pointer());
  assert.equal(tap.take(pointer()), undefined);
});

test("rejects additional contacts, cancellation, and clicks outside the pointer gesture", () => {
  const tap = createPanoramaTap();
  tap.start(pointer());
  tap.clear(); // A second pointerdown or pointercancel clears the current gesture.
  tap.start(pointer({ isPrimary: false, pointerId: 2 }));
  tap.end(pointer());
  assert.equal(tap.take(pointer()), undefined);

  tap.start(pointer());
  tap.end(pointer({ pointerId: 2 }));
  assert.equal(tap.take(pointer()), undefined);

  tap.start(pointer());
  tap.end(pointer());
  assert.equal(tap.take(pointer({ detail: 0 })), undefined);

  tap.start(pointer({ button: 2 }));
  tap.end(pointer({ button: 2 }));
  assert.equal(tap.take(pointer({ button: 2 })), undefined);
});
