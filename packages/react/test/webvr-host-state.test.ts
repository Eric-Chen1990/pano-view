import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWebVRHost,
  EMPTY_WEBVR_STATE,
  getWebVRState,
  getWebVRIframeSupport,
  subscribeWebVRHost,
  updateWebVRHost,
} from "../src/webvr/host";

test("createWebVRHost starts with the empty VR state constant", () => {
  const host = createWebVRHost();
  assert.equal(getWebVRState(host), EMPTY_WEBVR_STATE);
});

test("updateWebVRHost keeps state reference stable when available and mode are unchanged", () => {
  const host = createWebVRHost();
  updateWebVRHost(host, { available: true });
  const afterAvailable = getWebVRState(host);
  assert.equal(afterAvailable.available, true);
  assert.equal(afterAvailable.enabled, false);
  assert.equal(afterAvailable.mode, null);

  updateWebVRHost(host, {
    settings: { screensize: "auto", profileId: "cardboard-v2" },
  });
  assert.equal(getWebVRState(host), afterAvailable);

  updateWebVRHost(host, { setupOpen: true });
  assert.equal(getWebVRState(host), afterAvailable);
});

test("updateWebVRHost replaces state when mode changes", () => {
  const host = createWebVRHost();
  updateWebVRHost(host, { available: true });
  const idle = getWebVRState(host);

  updateWebVRHost(host, { mode: "mobilevr" });
  const active = getWebVRState(host);
  assert.notEqual(active, idle);
  assert.deepEqual(active, {
    available: true,
    enabled: true,
    mode: "mobilevr",
  });

  updateWebVRHost(host, { mode: null });
  const exited = getWebVRState(host);
  assert.notEqual(exited, active);
  assert.deepEqual(exited, {
    available: true,
    enabled: false,
    mode: null,
  });
});

test("iframe support follows spatial presentation, stays stable and notifies through subscribeVR", () => {
  const host = createWebVRHost();
  const native = getWebVRIframeSupport(host);
  assert.deepEqual(native, { sameOrigin: "native", crossOrigin: "native" });
  let notifications = 0;
  const unsubscribe = subscribeWebVRHost(host, () => notifications++);
  let spatial;
  for (const mode of ["webxr", "mobilevr", "fake"] as const) {
    updateWebVRHost(host, { mode });
    const support = getWebVRIframeSupport(host);
    assert.deepEqual(support, {
      sameOrigin: "limited",
      crossOrigin: "unsupported",
    });
    spatial ??= support;
    assert.equal(support, spatial);
    updateWebVRHost(host, { setupOpen: true });
    assert.equal(getWebVRIframeSupport(host), support);
    updateWebVRHost(host, { mode: null });
    assert.equal(getWebVRIframeSupport(host), native);
  }
  assert.equal(notifications, 9);
  unsubscribe();
});
