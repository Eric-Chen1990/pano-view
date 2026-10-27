import assert from "node:assert/strict";
import { test } from "node:test";
import {
  sceneFromViewerConfig,
  loadSceneFromJson,
  parsePanoProject,
  loadPanoProject,
  PanoDataError,
  type ViewerConfig,
  type ProjectHotspotDefinition,
} from "../src/data";
import { resolveRelativeTileUrl } from "../src/tile/multires";

const cube = {
  type: "tile",
  multires: { tileSize: 512, levels: [512, 1024] },
  previewUrl: "previews/cube.webp",
  previewFaceOrder: ["l", "f", "r", "b", "u", "d"],
  urlTemplate: "tiles/%s/l%l/%v_%h.webp",
} satisfies ViewerConfig;
const sphere = {
  type: "sphereTile",
  multires: {
    tileSize: 512,
    levels: [
      { width: 512, height: 256 },
      { width: 1024, height: 512 },
    ],
  },
  previewUrl: "preview.webp",
  urlTemplate: "tiles/%l/%00h_%v.webp",
  indexBase: 1,
} satisfies ViewerConfig;
const errorCode = (code: string) => (error: unknown) =>
  error instanceof PanoDataError && error.code === code;
function json(
  value: unknown,
  url = "https://cdn.test/redirect/room/viewer.json"
) {
  const response = new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
  Object.defineProperty(response, "url", { value: url });
  return response;
}
const project = () => ({
  schemaVersion: 1 as const,
  scenes: [
    { id: "a", source: { viewerConfig: cube } },
    { id: "b", source: { viewerConfig: sphere } },
  ],
});

test("portable configs preserve layout, clone inputs and map final cube/sphere URLs", () => {
  const original = structuredClone(cube);
  const a = sceneFromViewerConfig(cube, {
    id: "a",
    baseUrl: "https://cdn.test/root",
  });
  assert.equal(a.previewUrl, "https://cdn.test/root/previews/cube.webp");
  assert.equal(a.baseUrl, "https://cdn.test/root/");
  assert.equal(a.resolveTileUrl, undefined);
  assert.deepEqual(cube, original);
  assert.notEqual(a.multires, cube.multires);
  for (const config of [cube, sphere]) {
    const seen: string[] = [];
    const scene = sceneFromViewerConfig(config, {
      id: "a",
      baseUrl: "https://cdn.test/root/",
      resolveAssetUrl(path, context) {
        seen.push(path);
        assert.equal(context.sceneId, "a");
        assert.ok(context.defaultUrl.startsWith("https://cdn.test/root/"));
        return `https://signed.test/${path}?signature=abc%2F123`;
      },
    });
    const address = {
      face: "f" as const,
      level: 1,
      row: 2,
      col: 3,
      faceSize: 1024,
      imageWidth: 1024,
      imageHeight: 512,
      tileSize: 512,
      width: 512,
      height: 512,
    };
    const url = scene.resolveTileUrl!(address);
    assert.ok(url.endsWith("?signature=abc%2F123"));
    assert.equal(
      seen[1],
      config.type === "tile" ? "tiles/f/l1/2_3.webp" : "tiles/2/004_3.webp"
    );
    assert.equal(resolveRelativeTileUrl(scene.baseUrl, url), url);
  }
  assert.equal(
    resolveRelativeTileUrl("https://cdn.test/a", "/tile.webp"),
    "/tile.webp"
  );
  assert.equal(
    resolveRelativeTileUrl("https://cdn.test/a/", "tile.webp"),
    "https://cdn.test/a/tile.webp"
  );
});

test("remote viewer documents use final response directories, preserve request options and override roots", async (t) => {
  const controller = new AbortController();
  const mock = t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      assert.equal(init?.credentials, "include");
      assert.equal(init?.signal, controller.signal);
      return json(
        { schemaVersion: 1, ...cube },
        "https://cdn.test/final/room/viewer.json?token=secret"
      );
    }
  );
  const options = {
    id: "room",
    requestInit: { credentials: "include" as const, signal: controller.signal },
  };
  const a = await loadSceneFromJson("https://api.test/viewer", options);
  assert.equal(a.baseUrl, "https://cdn.test/final/room/");
  assert.ok(!a.previewUrl.includes("token="));
  const b = await loadSceneFromJson("https://api.test/viewer", {
    ...options,
    baseUrl: "https://assets.test/prefix",
  });
  assert.equal(b.previewUrl, "https://assets.test/prefix/previews/cube.webp");
  assert.equal(mock.mock.callCount(), 2);
});

test("JSON loaders distinguish version, structure, HTTP, syntax, network and cancellation errors", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () =>
    json({ schemaVersion: 2, ...cube })
  );
  await assert.rejects(
    loadSceneFromJson("https://cdn.test/viewer.json", { id: "a" }),
    errorCode("UNSUPPORTED_SCHEMA_VERSION")
  );
  mock.mock.mockImplementation(async () =>
    json({ schemaVersion: 1, ...cube, type: "planar" })
  );
  await assert.rejects(
    loadSceneFromJson("https://cdn.test/viewer.json", { id: "a" }),
    errorCode("UNSUPPORTED_PROJECTION")
  );
  mock.mock.mockImplementation(
    async () => new Response("missing", { status: 404 })
  );
  await assert.rejects(
    loadSceneFromJson("https://cdn.test/viewer.json", { id: "a" }),
    (error: unknown) =>
      error instanceof PanoDataError &&
      error.code === "HTTP_ERROR" &&
      error.status === 404
  );
  mock.mock.mockImplementation(async () => new Response("<html>login</html>"));
  await assert.rejects(
    loadSceneFromJson("https://cdn.test/viewer.json", { id: "a" }),
    errorCode("INVALID_JSON")
  );
  mock.mock.mockImplementation(async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    loadSceneFromJson("https://cdn.test/viewer.json", { id: "a" }),
    errorCode("FETCH_FAILED")
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    loadSceneFromJson("https://cdn.test/viewer.json", {
      id: "a",
      requestInit: { signal: controller.signal },
    }),
    errorCode("ABORTED")
  );
  assert.throws(
    () =>
      sceneFromViewerConfig(
        { ...cube, multires: { tileSize: 512, levels: [1024, 512] } },
        { id: "a", baseUrl: "https://cdn.test/" }
      ),
    errorCode("INVALID_CONFIG")
  );
  assert.throws(
    () =>
      sceneFromViewerConfig(
        { ...sphere, indexBase: 4 },
        { id: "a", baseUrl: "https://cdn.test/" }
      ),
    errorCode("INVALID_CONFIG")
  );
  await assert.rejects(
    loadSceneFromJson("/viewer.json", { id: "a" }),
    errorCode("INVALID_OPTIONS")
  );
});

const position = { yaw: 0, pitch: 0 };
const hotspots: ProjectHotspotDefinition[] = [
  {
    type: "image",
    id: "image",
    position,
    src: "card.webp",
    tooltip: { image: "tip.webp" },
  },
  {
    type: "graphic",
    id: "graphic",
    position,
    graphic: { kind: "svg", src: "icon.svg" },
  },
  {
    type: "sequence",
    id: "sequence",
    position,
    src: "sprite.webp",
    frameCount: 8,
  },
  {
    type: "video",
    id: "video",
    position,
    src: "clip.mp4",
    poster: "poster.webp",
  },
  {
    type: "audio",
    id: "audio",
    position,
    src: ["clip.mp3", "clip.ogg"],
    icon: "sound.webp",
    playingIcon: "playing.webp",
  },
  {
    type: "text",
    id: "text",
    position,
    text: "card.webp stays text",
    tooltipAppearance: { fontSize: 16 },
  },
  {
    type: "iframe",
    id: "iframe",
    position,
    src: "embed.html",
    pointerPolicy: "content",
  },
  {
    type: "polygon",
    id: "polygon",
    vertices: [position, { yaw: 10, pitch: 0 }, { yaw: 5, pitch: 10 }],
  },
  {
    type: "polyline",
    id: "polyline",
    vertices: [position, { yaw: 10, pitch: 0 }],
  },
];

test("projects validate all hotspot variants and resolve nested resources without modifying input", async () => {
  const definition = {
    ...project(),
    scenes: [{ id: "a", source: { viewerConfig: cube }, hotspots }],
  };
  const before = structuredClone(definition);
  const loaded = await loadPanoProject(definition, {
    baseUrl: "https://cdn.test/tour/",
    resolveAssetUrl(path, context) {
      if (context.kind === "hotspot") {
        assert.ok(context.hotspotId);
        return `https://hotspots.test/${path}`;
      }
      return context.defaultUrl;
    },
  });
  assert.deepEqual(definition, before);
  const hs = loaded.scenes[0]!.hotspots;
  assert.equal(hs.length, 9);
  assert.equal(
    (hs[0] as Extract<ProjectHotspotDefinition, { type: "image" }>).src,
    "https://hotspots.test/card.webp"
  );
  assert.equal(
    (hs[2] as Extract<ProjectHotspotDefinition, { type: "sequence" }>).src,
    "https://hotspots.test/sprite.webp"
  );
  assert.deepEqual(
    (hs[4] as Extract<ProjectHotspotDefinition, { type: "audio" }>).src,
    ["https://hotspots.test/clip.mp3", "https://hotspots.test/clip.ogg"]
  );
  assert.equal(
    (hs[5] as Extract<ProjectHotspotDefinition, { type: "text" }>).text,
    "card.webp stays text"
  );
  assert.equal(loaded.initialSceneId, "a");
});

test("project references, inline configs and per-scene roots have separate URL bases", async (t) => {
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: unknown) => {
    calls.push(String(input));
    return calls.length === 1
      ? json(
          {
            schemaVersion: 1,
            initialSceneId: "b",
            scenes: [
              {
                id: "a",
                source: {
                  viewerUrl: "rooms/a/viewer.json",
                  baseUrl: "assets/a",
                },
              },
              {
                id: "b",
                source: { viewerConfig: sphere },
                initialView: { yaw: 30 },
              },
            ],
          },
          "https://cdn.test/prefix/project.json"
        )
      : json({ schemaVersion: 1, ...cube });
  });
  const loaded = await loadPanoProject("https://api.test/project");
  assert.equal(calls[1], "https://cdn.test/prefix/rooms/a/viewer.json");
  assert.equal(
    loaded.scenes[0]!.scene.baseUrl,
    "https://cdn.test/prefix/assets/a/"
  );
  assert.equal(loaded.scenes[1]!.scene.baseUrl, "https://cdn.test/prefix/");
  assert.deepEqual(loaded.scenes[1]!.initialView, {
    yaw: 30,
    pitch: 0,
    fov: 75,
  });
  assert.equal(loaded.initialSceneId, "b");
});

test("invalid projects fail with scene/field context instead of silently dropping data", async () => {
  assert.throws(
    () => parsePanoProject({ schemaVersion: 1, scenes: [] }),
    errorCode("INVALID_PROJECT")
  );
  assert.throws(
    () => parsePanoProject({ ...project(), initialSceneId: "missing" }),
    errorCode("INVALID_REFERENCE")
  );
  assert.throws(
    () =>
      parsePanoProject({
        ...project(),
        scenes: [project().scenes[0], project().scenes[0]],
      }),
    errorCode("INVALID_PROJECT")
  );
  const invalid = {
    schemaVersion: 1,
    scenes: [
      {
        id: "a",
        source: { viewerConfig: cube },
        hotspots: [
          {
            type: "graphic",
            id: "link",
            position,
            graphic: { kind: "arrow" },
            action: { type: "scene", sceneId: "missing" },
          },
        ],
      },
    ],
  };
  assert.throws(
    () => parsePanoProject(invalid),
    (error: unknown) =>
      error instanceof PanoDataError &&
      error.code === "INVALID_REFERENCE" &&
      error.sceneId === "a" &&
      error.field === "scenes[0].hotspots[0].action.sceneId"
  );
  assert.throws(
    () =>
      parsePanoProject({
        schemaVersion: 1,
        scenes: [
          {
            id: "a",
            source: { viewerConfig: cube },
            hotspots: [{ ...hotspots[0], position: { yaw: 0, pitch: 100 } }],
          },
        ],
      }),
    errorCode("INVALID_PROJECT")
  );
  assert.throws(
    () =>
      parsePanoProject({
        schemaVersion: 1,
        scenes: [
          {
            id: "a",
            source: { viewerConfig: cube },
            hotspots: [hotspots[0], hotspots[0]],
          },
        ],
      }),
    errorCode("INVALID_PROJECT")
  );
  await assert.rejects(
    loadPanoProject(project()),
    errorCode("INVALID_OPTIONS")
  );
});

test("project loading bounds concurrency, cancels in flight and stops scheduling after failure", async (t) => {
  let running = 0,
    peak = 0,
    calls = 0;
  const mock = t.mock.method(globalThis, "fetch", async () => {
    calls++;
    running++;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running--;
    return json({ schemaVersion: 1, ...cube });
  });
  const definition = {
    schemaVersion: 1 as const,
    scenes: Array.from({ length: 9 }, (_, i) => ({
      id: String(i),
      source: { viewerUrl: `${i}/viewer.json` },
    })),
  };
  await loadPanoProject(definition, { baseUrl: "https://cdn.test/" });
  assert.equal(calls, 9);
  assert.equal(peak, 4);
  calls = 0;
  mock.mock.mockImplementation(async (_input: unknown, init?: RequestInit) => {
    calls++;
    if (calls === 1) return new Response("forbidden", { status: 403 });
    return new Promise<Response>((_resolve, reject) =>
      init?.signal?.addEventListener(
        "abort",
        () => reject(new Error("aborted")),
        { once: true }
      )
    );
  });
  await assert.rejects(
    loadPanoProject(definition, { baseUrl: "https://cdn.test/" }),
    (error: unknown) =>
      error instanceof PanoDataError &&
      error.code === "HTTP_ERROR" &&
      error.sceneId === "0"
  );
  assert.ok(calls <= 4);
  const controller = new AbortController();
  mock.mock.mockImplementation(
    async (_input: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true }
        );
        queueMicrotask(() => controller.abort());
      })
  );
  await assert.rejects(
    loadPanoProject(definition, {
      baseUrl: "https://cdn.test/",
      requestInit: { signal: controller.signal },
    }),
    errorCode("ABORTED")
  );
});
