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
  const result = await captureSpatialSurface(
    element,
    owner,
    true,
    () => [element],
    {
      body: async () => image,
      overlays: async () => {
        throw new Error("annotation SVG decode failed");
      },
    },
  );
  assert.equal(result.image, image);
  assert.deepEqual(result.overlays, []);
});

test("a failed sliced dialog capture retries the original clone path", async () => {
  const attempts: boolean[] = [];
  const result = await captureSpatialSurface(element, owner, false, () => [], {
    body: async (
      _element,
      _owner,
      _footer,
      _resolveOverlays,
      yielding = true,
    ) => {
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

test("overlay capture re-resolves after the body capture completes", async () => {
  const early = {} as HTMLElement;
  const late = {} as HTMLElement;
  let bodyDone = false;
  const resolveOverlays = () => (bodyDone ? [early, late] : [early]);
  const captured: HTMLElement[] = [];

  const result = await captureSpatialSurface(
    element,
    owner,
    false,
    resolveOverlays,
    {
      body: async (_element, _owner, _footer, resolve) => {
        assert.deepEqual([...resolve()], [early]);
        bodyDone = true;
        return image;
      },
      overlays: async (overlays) => {
        captured.push(...overlays);
        return overlays.map((node) => ({
          element: node,
          image,
          offsetX: 0,
          offsetY: 0,
          width: 36,
          height: 36,
        }));
      },
    },
  );

  assert.equal(result.image, image);
  assert.deepEqual(captured, [early, late]);
  assert.equal(result.overlays.length, 2);
});

test("a cancelled surface does not start or retry body capture", async () => {
  const controller = new AbortController();
  let attempts = 0;
  const captures = {
    body: async () => {
      attempts++;
      controller.abort();
      throw new Error("interrupted clone");
    },
    overlays: async () => [],
  };
  await assert.rejects(
    captureSpatialSurface(
      element,
      owner,
      false,
      () => [],
      captures,
      controller.signal,
    ),
    { name: "AbortError" },
  );
  assert.equal(attempts, 1);
  await assert.rejects(
    captureSpatialSurface(
      element,
      owner,
      false,
      () => [],
      captures,
      controller.signal,
    ),
    { name: "AbortError" },
  );
  assert.equal(attempts, 1);
});

test("closing during overlay capture prevents retries and subsequent annotations", async () => {
  const controller = new AbortController();
  let attempts = 0;
  await assert.rejects(
    captureSpatialOverlays(
      [element, element],
      owner,
      async () => {
        attempts++;
        controller.abort();
        throw new Error("closed while decoding");
      },
      controller.signal,
    ),
    { name: "AbortError" },
  );
  assert.equal(attempts, 1);
});

test("a late result from a closed surface is discarded while a reopened surface completes", async () => {
  const controller = new AbortController();
  let complete!: (value: HTMLCanvasElement) => void;
  let annotations = 0;
  const old = captureSpatialSurface(
    element,
    owner,
    false,
    () => [],
    {
      body: () =>
        new Promise<HTMLCanvasElement>((resolve) => {
          complete = resolve;
        }),
      overlays: async () => {
        annotations++;
        return [];
      },
    },
    controller.signal,
  );
  controller.abort();
  const reopened = await captureSpatialSurface(
    element,
    owner,
    false,
    () => [],
    {
      body: async () => image,
      overlays: async () => [],
    },
    new AbortController().signal,
  );
  complete(image);
  await assert.rejects(old, { name: "AbortError" });
  assert.equal(annotations, 0);
  assert.equal(reopened.image, image);
});
