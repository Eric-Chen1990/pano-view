import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_WEBVR_SETTINGS, loadWebVRSettings, saveWebVRSettings, clearWebVRSettings, resolveInitialWebVRSettings } from "../src/webvr/profiles";

test("settings ignore legacy values, isolate modes, reset independently and honor props", () => {
  const values = new Map<string, string>();
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  try {
    values.set("pano-view:webvr-settings:v1", JSON.stringify({ screensize: 5, profileId: "cardboard-v1" }));
    assert.deepEqual(loadWebVRSettings("fake"), { screensize: "auto", profileId: "none" });
    assert.deepEqual(loadWebVRSettings("mobilevr"), DEFAULT_WEBVR_SETTINGS);
    saveWebVRSettings({ screensize: 6.1, profileId: "cardboard-v2" }, "mobilevr");
    assert.equal(loadWebVRSettings("fake").profileId, "none");
    saveWebVRSettings({ screensize: 7, profileId: "daydream" }, "fake");
    assert.deepEqual(resolveInitialWebVRSettings(5.5, "none", loadWebVRSettings("fake")), { screensize: 5.5, profileId: "none" });
    clearWebVRSettings("fake");
    assert.equal(loadWebVRSettings("mobilevr").profileId, "cardboard-v2");
    clearWebVRSettings();
    assert.deepEqual(loadWebVRSettings("mobilevr"), DEFAULT_WEBVR_SETTINGS);
    values.set("pano-view:webvr-settings:v2:fake", "broken");
    assert.deepEqual(loadWebVRSettings("fake"), DEFAULT_WEBVR_SETTINGS);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
