import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWebVRHost,
  EMPTY_WEBVR_STATE,
  getWebVRState,
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
