import assert from "node:assert/strict";
import { test } from "node:test";
import type { WebGPURenderer } from "three/webgpu";
import { createWebVRHost } from "../src/webvr/host";
import { connectWebGPUXR, handOffWebXRSession } from "../src/webvr/webgpu-xr";

class TestSession extends EventTarget {
  ends = 0;
  async end() {
    this.ends++;
    this.dispatchEvent(new Event("end"));
  }
}

test("a WebGL canvas takes over the session created by the original user gesture", async () => {
  const host = createWebVRHost();
  const session = new TestSession();
  let pendingAtFallback: typeof host.pendingXR;
  const entered = handOffWebXRSession(host, session as unknown as XRSession, () => {
    pendingAtFallback = host.pendingXR;
  });
  assert.equal(pendingAtFallback!.session, session);
  host.pendingXR?.finish(true);
  assert.equal(await entered, true);
  assert.equal(host.pendingXR, null);
  assert.equal(session.ends, 0);
});

test("cancelling a canvas handoff clears and closes the pending session once", async () => {
  const host = createWebVRHost();
  const session = new TestSession();
  const entered = handOffWebXRSession(host, session as unknown as XRSession, () => {});
  const pending = host.pendingXR;
  pending?.finish(false);
  pending?.finish(true);
  assert.equal(await entered, false);
  assert.equal(host.pendingXR, null);
  assert.equal(session.ends, 1);
});

test("native XR installs the R3F callback before binding and restores the original loop on end", async () => {
  const session = new TestSession();
  const original = () => {};
  let loop: (() => void) | null = original;
  const renderer = {
    getAnimationLoop: () => loop,
    async setAnimationLoop(callback: () => void) { loop = callback; },
    xr: {
      enabled: false,
      async setSession() { assert.notEqual(loop, original); },
    },
  };
  await connectWebGPUXR(renderer as unknown as WebGPURenderer, session as unknown as XRSession,
    () => { throw new Error("This test does not advance frames."); });
  assert.equal(renderer.xr.enabled, true);
  await session.end();
  assert.equal(loop, original);
});
