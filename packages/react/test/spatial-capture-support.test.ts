import assert from "node:assert/strict";
import { test } from "node:test";
import { supportsNativeHtmlCapture, squareCaptureFooter, fillCaptureFooter } from "../src/spatial/capture-support";

test("old drawElementImage implementations cannot select the native capture path", () => {
  const context = { drawElementImage() {} };
  assert.equal(
    supportsNativeHtmlCapture({ requestPaint() {} }, context),
    false
  );
  assert.equal(
    supportsNativeHtmlCapture(
      { content: "drawable", requestPaint() {} },
      context
    ),
    true
  );
  assert.equal(
    supportsNativeHtmlCapture({ content: "drawable" }, context),
    false
  );
  assert.equal(
    supportsNativeHtmlCapture({ content: "drawable", requestPaint() {} }, null),
    false
  );
});

test("footer snapshots clear shorthand, physical and logical bottom radii while preserving top corners", () => {
  const declarations = new Map<string, { value: string; priority?: string }>();
  squareCaptureFooter({
    borderTopLeftRadius: "12px", borderTopRightRadius: "8px",
    setProperty(name, value, priority) { declarations.set(name, { value: value ?? "", priority }); },
  });
  assert.deepEqual(declarations.get("border-radius"), { value: "12px 8px 0px 0px", priority: "important" });
  for (const property of ["border-bottom-left-radius", "border-bottom-right-radius", "border-end-start-radius", "border-end-end-radius"]) {
    assert.deepEqual(declarations.get(property), { value: "0px", priority: "important" });
  }
});

test("final footer raster flattens both corners and uses the dialog background", () => {
  const rectangles: number[][] = [];
  const context = { fillStyle: "", fillRect: (...values: [number, number, number, number]) => { rectangles.push(values); } };
  fillCaptureFooter(context, 640, 688, 64, 12, "rgb(255, 255, 255)");
  assert.equal(context.fillStyle, "rgb(255, 255, 255)");
  assert.deepEqual(rectangles, [[0, 675, 13, 13], [627, 675, 13, 13], [0, 688, 640, 64]]);
});
