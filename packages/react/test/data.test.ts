import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
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

const skillReferences = join(__dirname, "../../../skills/pano-view-project/references");
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validateProjectSchema = ajv.compile(JSON.parse(readFileSync(join(skillReferences, "project.schema.json"), "utf8")));
const validateViewerSchema = ajv.compile(JSON.parse(readFileSync(join(skillReferences, "viewer.schema.json"), "utf8")));

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
    format: ["mp3", "ogg"],
    position,
    src: ["clip.mp3", "clip.ogg"],
    icon: "sound.webp",
    playingIcon: "playing.webp",
    spatialAudio: true,
    soundDistance: 4.5,
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
    type: "callout",
    id: "callout",
    position,
    content: {
      title: "Default style",
      text: "A callout",
      image: "callout.webp",
    },
    trigger: "hover",
    line: { angle: 45, length: 96, color: "#ffffff" },
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
  assert.ok(validateProjectSchema(definition), ajv.errorsText(validateProjectSchema.errors));
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
  assert.equal(hs.length, 10);
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
  assert.deepEqual(
    (hs[4] as Extract<ProjectHotspotDefinition, { type: "audio" }>).format,
    ["mp3", "ogg"]
  );
  assert.equal(hs[4]?.type, "audio");
  if (hs[4]?.type === "audio") {
    assert.equal(hs[4].spatialAudio, true);
    assert.equal(hs[4].soundDistance, 4.5);
  }
  assert.equal(
    (hs[5] as Extract<ProjectHotspotDefinition, { type: "text" }>).text,
    "card.webp stays text"
  );
  assert.equal(hs[7]?.type, "callout");
  if (hs[7]?.type === "callout") {
    assert.equal(hs[7].content.image, "https://hotspots.test/callout.webp");
    assert.equal(hs[7].trigger, "hover");
  }
  assert.equal(loaded.initialSceneId, "a");
});

test("authoring schemas accept SDK fixtures and the Skill's two-scene project", () => {
  const quickstart = readFileSync(join(skillReferences, "quickstart.md"), "utf8");
  const example = /^```json\n([\s\S]*?)^```/m.exec(quickstart);
  assert.ok(example);
  const tour = JSON.parse(example[1]!);
  assert.ok(validateProjectSchema(tour), ajv.errorsText(validateProjectSchema.errors));
  assert.equal(parsePanoProject(tour).scenes.length, 2);
  for (const config of [cube, sphere]) {
    assert.ok(validateViewerSchema({ schemaVersion: 1, ...config }), ajv.errorsText(validateViewerSchema.errors));
    assert.equal(sceneFromViewerConfig(config, { id: "room", baseUrl: "https://cdn.test/" }).type, config.type);
    assert.equal(validateViewerSchema(config), false);
  }

  const base = project();
  const definition = {
    ...base,
    scenes: [
      {
        ...base.scenes[0]!,
        hotspots: [
          { type: "portal", id: "portal", position, events: { click: { type: "scene", sceneId: "b" } } },
          {
            type: "text", id: "labels", position, text: "Enter",
            events: {
              click: { type: "popup", popupId: "details" },
              pointerenter: { type: "custom", actionId: "show", params: { ui: [null, { size: 3 }] } },
              pointerleave: { type: "view", view: { ...position, fov: 90 } },
            },
          },
        ],
      },
      base.scenes[1]!,
    ],
    popups: [{ id: "details", title: "Details", blocks: [{ id: "photo", type: "image", src: "details.webp" }] }],
    map: {
      image: "floor.webp",
      presentation: { mode: "panel", width: "40%", anchor: { inset: { top: 10 } } },
      spots: [{ id: "point", sceneId: "a", x: 0.1, y: 1, heading: 0 }],
    },
    geoMap: {
      sector: false,
      spots: [{ id: "geo", sceneId: "a", positions: { wgs84: { lat: 90, lng: 180 } } }],
    },
  };
  assert.ok(validateProjectSchema(definition), ajv.errorsText(validateProjectSchema.errors));
  assert.equal(parsePanoProject(definition).geoMap?.spots.length, 1);
});

test("authoring schemas reject structural errors and leave project semantics to the SDK", () => {
  const scene = project().scenes[0]!;
  const single = (input: unknown) => ({ schemaVersion: 1, scenes: [input] });
  const portal = { type: "portal", id: "portal", position };
  for (const input of [
    { ...project(), schemaVersion: 2 },
    { ...project(), scenes: [] },
    single({ ...scene, source: { viewerUrl: "viewer.json", viewerConfig: cube } }),
    single({ ...scene, source: { viewerConfig: { schemaVersion: 1, ...cube } } }),
    single({ ...scene, initialView: { fov: 180 } }),
    single({ ...scene, hotspots: [{ ...hotspots[0], tooltipAppearance: { fonSize: 12 } }] }),
    single({ ...scene, hotspots: [portal] }),
    single({ ...scene, hotspots: [{ ...portal, action: { type: "scene", sceneId: "a" }, events: { click: { type: "popup", popupId: "a" } } }] }),
  ]) assert.equal(validateProjectSchema(input), false);

  assert.equal(validateViewerSchema({ schemaVersion: 1, ...cube, urlTemplate: "tiles/%q.webp" }), false);
  assert.equal(validateViewerSchema({ schemaVersion: 1, ...sphere, urlTemplate: "tiles/%s.webp" }), false);
  assert.equal(validateViewerSchema({ schemaVersion: 1, ...cube, previewFaceOrder: ["f", "f", "b", "l", "u", "d"] }), false);

  for (const [input, error] of [
    [{ ...project(), scenes: [scene, scene] }, /duplicate scene ID/],
    [{ ...project(), initialSceneId: "missing" }, /scene does not exist/],
    [single({ ...scene, hotspots: [{ ...portal, action: { type: "scene", sceneId: "a" } }] }), /must be a different scene/],
    [single({ ...scene, hotspots: [{ ...hotspots[0], action: { type: "popup", popupId: "missing" } }] }), /target popup does not exist/],
  ] as const) {
    assert.ok(validateProjectSchema(input), ajv.errorsText(validateProjectSchema.errors));
    assert.throws(() => parsePanoProject(input), error);
  }

  const unordered = { schemaVersion: 1, ...cube, multires: { tileSize: 512, levels: [1024, 512] } };
  assert.ok(validateViewerSchema(unordered), ajv.errorsText(validateViewerSchema.errors));
  assert.throws(() => sceneFromViewerConfig(unordered, { id: "room", baseUrl: "https://cdn.test/" }), /face sizes must increase/);

  const legacy = single({ ...scene, ignoredMetadata: true });
  assert.equal(validateProjectSchema(legacy), false);
  assert.equal(parsePanoProject(legacy).scenes[0]?.id, scene.id);
});

test("callout hotspots require content and reject empty cards", () => {
  const withCallout = (hotspot: unknown) => ({
    ...project(),
    scenes: [{ id: "a", source: { viewerConfig: cube }, hotspots: [hotspot] }],
  });
  const parsed = parsePanoProject(
    withCallout({
      type: "callout",
      id: "info",
      position,
      content: { title: "Hello" },
      trigger: "look",
      lookAngle: 8,
      lookDelay: 100,
      line: { angle: 30, length: 120, color: "#ff0", width: 3 },
      appearance: {
        titleBackground: "#800",
        width: 200,
        titleFontSize: 18,
        fontSize: 14,
        fontFamily: "Georgia, serif",
      },
      animation: { lineDuration: 200, contentDuration: 100 },
      marker: { color: "#fff" },
    }),
  ).scenes[0]?.hotspots?.[0];
  assert.equal(parsed?.type, "callout");
  if (parsed?.type === "callout") {
    assert.equal(parsed.content.title, "Hello");
    assert.equal(parsed.trigger, "look");
    assert.equal(parsed.lookAngle, 8);
    assert.equal(parsed.appearance?.titleFontSize, 18);
    assert.equal(parsed.appearance?.fontSize, 14);
    assert.equal(parsed.appearance?.fontFamily, "Georgia, serif");
  }
  assert.throws(
    () =>
      parsePanoProject(
        withCallout({
          type: "callout",
          id: "empty",
          position,
          content: { title: "  ", text: "" },
        }),
      ),
    /content/,
  );
  assert.throws(
    () =>
      parsePanoProject(
        withCallout({
          type: "callout",
          id: "missing",
          position,
        }),
      ),
    /content/,
  );
  assert.throws(
    () =>
      parsePanoProject(
        withCallout({
          type: "callout",
          id: "bad-trigger",
          position,
          content: { text: "x" },
          trigger: "focus",
        }),
      ),
    /trigger/,
  );
});

test("older audio definitions omit 3D sound settings and new distances must be positive", () => {
  const audio = { type: "audio", id: "sound", src: "sound.mp3", position };
  const withAudio = (hotspot: unknown) => ({
    ...project(),
    scenes: [{ id: "a", source: { viewerConfig: cube }, hotspots: [hotspot] }],
  });
  const hotspot = parsePanoProject(withAudio(audio)).scenes[0]?.hotspots?.[0];
  assert.deepEqual(hotspot, audio);
  assert.throws(() => parsePanoProject(withAudio({ ...audio, soundDistance: 0 })), /soundDistance/);
  assert.throws(() => parsePanoProject(withAudio({ ...audio, spatialAudio: "true" })), /spatialAudio/);
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
