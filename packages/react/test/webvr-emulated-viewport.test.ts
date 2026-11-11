import assert from "node:assert/strict";
import { test } from "node:test";
import { bindEmulatedXRViewport, fitEmulatedXRViewport } from "../src/webvr/emulated-viewport";

function fixture(runtime?: string) {
  const values = new Map([["width", "1558px"], ["height", "680px"]]);
  let writes = 0;
  const canvas = {
    parentElement: { dataset: { webxr_runtime: runtime } },
    width: 2320, height: 1393,
    style: {
      getPropertyValue: (key: string) => values.get(key) ?? "",
      getPropertyPriority: () => "",
      removeProperty: (key: string) => { values.delete(key); return ""; },
      setProperty: (key: string, value: string) => { writes++; values.set(key, value); },
    },
  } as unknown as HTMLCanvasElement;
  return { canvas, values, writes: () => writes };
}

test("IWER preview fills its viewport host instead of retaining embedded dimensions", () => {
  const f = fixture("Immersive Web Emulation Runtime v2.3.0");
  assert.equal(fitEmulatedXRViewport(f.canvas, 2320, 1393), true);
  assert.equal(f.values.get("width"), "100vw");
  assert.equal(f.values.get("height"), "100dvh");
  assert.equal(f.values.get("max-width"), "none");
  assert.equal(f.values.get("position"), "fixed");
  assert.equal(f.values.get("left"), "0px");
  const writes = f.writes();
  fitEmulatedXRViewport(f.canvas, 2320, 1393);
  assert.equal(f.writes(), writes, "style observation must settle without a mutation loop");
});

test("session cleanup restores embedded styles and releases viewport observation", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousObserver = Object.getOwnPropertyDescriptor(globalThis, "MutationObserver");
  let resize: (() => void) | null = null;
  let disconnected = false;
  const viewport = {
    innerWidth: 2320, innerHeight: 1393,
    addEventListener: (_: string, callback: () => void) => { resize = callback; },
    removeEventListener: () => { resize = null; },
  };
  class Observer {
    observe() {}
    disconnect() { disconnected = true; }
  }
  Object.defineProperty(globalThis, "window", { configurable: true, value: viewport });
  Object.defineProperty(globalThis, "MutationObserver", { configurable: true, value: Observer });
  try {
    const f = fixture("Immersive Web Emulation Runtime v2.3.0");
    const dispose = bindEmulatedXRViewport(f.canvas);
    assert.equal(f.values.get("position"), "fixed");
    viewport.innerWidth = 1330;
    (resize as (() => void) | null)?.();
    assert.equal(f.canvas.width, 1330);
    dispose();
    assert.equal(disconnected, true);
    assert.equal(resize, null);
    assert.equal(f.values.get("width"), "1558px");
    assert.equal(f.values.get("height"), "680px");
    assert.equal(f.values.has("position"), false);
    assert.equal(f.values.has("max-width"), false);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousObserver) Object.defineProperty(globalThis, "MutationObserver", previousObserver);
    else Reflect.deleteProperty(globalThis, "MutationObserver");
  }
});

test("resizing the browser updates the emulated framebuffer aspect ratio", () => {
  const f = fixture("Immersive Web Emulation Runtime v2.3.0");
  fitEmulatedXRViewport(f.canvas, 1330, 900);
  assert.equal(f.canvas.width, 1330);
  assert.equal(f.canvas.height, 900);
  fitEmulatedXRViewport(f.canvas, NaN, 0);
  assert.equal(f.canvas.width, 1330);
  assert.equal(f.canvas.height, 900);
});

test("native XR and ordinary canvases keep their dimensions and inline styles", () => {
  for (const runtime of [undefined, "Another runtime"]) {
    const f = fixture(runtime);
    assert.equal(fitEmulatedXRViewport(f.canvas, 1330, 900), false);
    assert.equal(f.canvas.width, 2320);
    assert.equal(f.canvas.height, 1393);
    assert.equal(f.values.get("width"), "1558px");
    assert.equal(f.writes(), 0);
  }
});
