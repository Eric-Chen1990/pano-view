import assert from "node:assert/strict";
import { test } from "node:test";
import { ImportTask } from "../src/import-task";
import { SceneSources } from "../src/sources";
import type { PanoImportContext } from "../src/types";
import { parsePanoProject } from "@ericchen1990/pano-view/data";

const source = { viewerUrl: "https://cdn.test/room/viewer.json" };
const config = {
  schemaVersion: 1,
  type: "tile",
  multires: { tileSize: 512, levels: [512] },
  previewUrl: "preview.webp",
  urlTemplate: "tiles/%s/%l/%v_%h.webp",
  previewFaceOrder: ["l", "f", "r", "b", "u", "d"],
};

test("host imports deliver bounded progress and only return after source validation", async () => {
  const task = new ImportTask();
  const events: unknown[] = [];
  let validated = false;
  const result = await task.run(
    new File(["image"], "room.jpg"),
    async (file, { signal, onProgress }) => {
      assert.equal(file.name, "room.jpg");
      assert.equal(signal.aborted, false);
      onProgress({ stage: "upload", progress: 2 });
      onProgress({ stage: "convert" });
      return source;
    },
    (event) => events.push(event),
    async (value) => {
      assert.deepEqual(value, source);
      validated = true;
    },
  );
  assert.ok(validated);
  assert.deepEqual(result, source);
  assert.deepEqual(events, [
    { stage: "upload", progress: 1 },
    { stage: "convert", progress: undefined },
  ]);
});

test("failed and invalid host results reject without yielding a scene", async () => {
  const task = new ImportTask();
  await assert.rejects(
    task.run(
      new File([], "x"),
      async () => {
        throw new Error("Conversion failed");
      },
      () => {},
      async () => {},
    ),
    /Conversion failed/,
  );
  await assert.rejects(
    task.run(
      new File([], "x"),
      async () => ({ viewerUrl: "" }),
      () => {},
      async (result) => {
        parsePanoProject({
          schemaVersion: 1,
          scenes: [{ id: "x", source: result }],
        });
      },
    ),
    /nonempty/,
  );
});

test("cancellation aborts the host signal and ignores late progress and completion", async () => {
  const task = new ImportTask();
  let context!: PanoImportContext;
  let complete!: (result: typeof source) => void;
  let progress = 0,
    validated = 0;
  const pending = task.run(
    new File([], "x"),
    (_file, value) => {
      context = value;
      return new Promise((resolve) => {
        complete = resolve;
      });
    },
    () => progress++,
    async () => {
      validated++;
    },
  );
  task.cancel();
  assert.ok(context.signal.aborted);
  context.onProgress({ stage: "convert", progress: 1 });
  complete(source);
  assert.equal(await pending, undefined);
  assert.equal(progress, 0);
  assert.equal(validated, 0);
});

test("starting a newer import supersedes the old request even when its host ignores abort", async () => {
  const task = new ImportTask();
  let complete!: (result: typeof source) => void;
  const first = task.run(
    new File([], "a"),
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
    () => {},
    async () => {},
  );
  const second = task.run(
    new File([], "b"),
    async () => source,
    () => {},
    async () => {},
  );
  assert.deepEqual(await second, source);
  complete(source);
  assert.equal(await first, undefined);
});

test("host source loading preserves request options, resolves final directories and caches successful configs", async (t) => {
  let fetches = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string, init?: RequestInit) => {
      fetches++;
      assert.equal(init?.credentials, "include");
      assert.deepEqual(init?.headers, { "x-project": "qa" });
      const response = new Response(JSON.stringify(config));
      Object.defineProperty(response, "url", {
        value: "https://cdn.test/final/room/viewer.json",
      });
      return response;
    },
  );
  const sources = new SceneSources({
    baseUrl: "https://api.test/project/",
    requestInit: { credentials: "include", headers: { "x-project": "qa" } },
  });
  const controller = new AbortController();
  const loaded = await sources.load("room", source, controller.signal);
  controller.abort();
  assert.equal(loaded.previewUrl, "https://cdn.test/final/room/preview.webp");
  assert.equal(
    await sources.load("room", source, new AbortController().signal),
    loaded,
  );
  assert.equal(fetches, 1);
});
