import assert from "node:assert/strict";
import { test } from "node:test";
import {
  captureSpatialSurface,
  captureSpatialOverlays,
  type SpatialCaptureOverlay,
} from "../src/spatial/capture";

const element = {} as HTMLElement;
const owner = {} as HTMLElement;
const image = {} as HTMLCanvasElement;

test("an annotation failure preserves the successfully captured dialog", async () => {
  const result = await captureSpatialSurface(element, owner, true, [element], {
    body: async () => image,
    overlays: async () => {
      throw new Error("annotation SVG decode failed");
    },
  });
  assert.equal(result.image, image);
  assert.deepEqual(result.overlays, []);
});

test("a failed sliced dialog capture retries the original clone path", async () => {
  const attempts: boolean[] = [];
  const result = await captureSpatialSurface(element, owner, false, [], {
    body: async (_element, _owner, _footer, _overlays, yielding = true) => {
      attempts.push(yielding);
      if (yielding) throw new Error("interrupted capture");
      return image;
    },
    overlays: async () => [],
  });
  assert.equal(result.image, image);
  assert.deepEqual(attempts, [true, false]);
});

test("one broken annotation does not suppress other model markers", async () => {
  const broken = {} as HTMLElement;
  const frame: SpatialCaptureOverlay = {
    element,
    image,
    offsetX: 0,
    offsetY: 0,
    width: 36,
    height: 36,
  };
  const attempts: boolean[] = [];
  const result = await captureSpatialOverlays(
    [broken, element],
    owner,
    async (node, _owner, yielding = true) => {
      if (node === broken) {
        attempts.push(yielding);
        throw new Error("broken layer");
      }
      return frame;
    },
  );
  assert.deepEqual(result, [frame]);
  assert.deepEqual(attempts, [true, false]);
});
