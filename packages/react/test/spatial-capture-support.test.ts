import assert from "node:assert/strict";
import { test } from "node:test";
import { supportsNativeHtmlCapture } from "../src/spatial/capture-support";

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
