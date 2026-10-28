import assert from "node:assert/strict";
import { test } from "node:test";
import { createPanoModalHost } from "../src/overlay/modal-host";

function runtime() {
  let locks = 0;
  return {
    get locks() { return locks; },
    acquireInteractionLock() {
      locks += 1;
      return () => { locks -= 1; };
    },
  };
}

test("initial-open modals lock a late Canvas and release only after all leases close", () => {
  const host = createPanoModalHost();
  const first = host.acquire();
  const second = host.acquire();
  const view = runtime();
  host.connect(view);
  assert.equal(view.locks, 1);
  first();
  first();
  assert.equal(view.locks, 1);
  assert.equal(host.getSnapshot(), true);
  second();
  assert.equal(view.locks, 0);
  assert.equal(host.getSnapshot(), false);
});

test("Canvas remounts transfer the lock without losing pending modal leases", () => {
  const host = createPanoModalHost();
  const first = runtime();
  const second = runtime();
  const release = host.acquire();
  host.connect(first);
  host.connect(first);
  assert.equal(first.locks, 1);
  host.connect(null);
  assert.equal(first.locks, 0);
  assert.equal(host.getSnapshot(), true);
  host.connect(second);
  assert.equal(second.locks, 1);
  release();
  assert.equal(second.locks, 0);
});

test("Strict Mode setup/cleanup and early close leave no stale lock", () => {
  const host = createPanoModalHost();
  host.acquire()();
  const view = runtime();
  host.connect(view);
  assert.equal(view.locks, 0);
  const release = host.acquire();
  assert.equal(view.locks, 1);
  release();
  const again = host.acquire();
  assert.equal(view.locks, 1);
  again();
  host.connect(null);
  assert.equal(view.locks, 0);
});

test("modal cleanup preserves independent transition locks and other viewers", () => {
  const host = createPanoModalHost();
  const other = createPanoModalHost();
  const view = runtime();
  const otherView = runtime();
  host.connect(view);
  other.connect(otherView);
  const releaseTransition = view.acquireInteractionLock();
  const releaseModal = host.acquire();
  const releaseOther = other.acquire();
  assert.equal(view.locks, 2);
  releaseModal();
  assert.equal(view.locks, 1);
  assert.equal(otherView.locks, 1);
  releaseOther();
  releaseTransition();
  assert.equal(view.locks, 0);
  assert.equal(otherView.locks, 0);
});

test("unsubscribed modal listeners are not called during later cleanup", () => {
  const host = createPanoModalHost();
  let notifications = 0;
  const unsubscribe = host.subscribe(() => { notifications += 1; });
  const release = host.acquire();
  assert.equal(notifications, 1);
  unsubscribe();
  release();
  assert.equal(notifications, 1);
});
