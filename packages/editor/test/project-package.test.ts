import assert from "node:assert/strict";
import { test } from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import {
  loadPanoProject,
  parsePanoProject,
  resolveProjectHotspotAssets,
  type PanoProjectDefinition,
} from "@ericchen1990/pano-view/data";
import { buildProjectPackage } from "../src/project-package";
import { LocalFiles } from "../src/local-files";
import { exportDocument } from "../src/document";
import {
  cursorImage,
  imageCursor,
  mapCursorAssets,
} from "../../../shared/cursor-assets";
import { validateCursorImage } from "../src/cursor-image";

const sphere = {
  schemaVersion: 1,
  type: "sphereTile" as const,
  multires: { tileSize: 2, levels: [{ width: 4, height: 2 }] },
  previewUrl: "preview.png",
  urlTemplate: "tiles/%l/%00x_%0y.png",
  indexBase: 1 as const,
};
function file(path: string, content: string | Uint8Array, type = "image/png") {
  const value = new File(
    [typeof content === "string" ? content : new Uint8Array(content).buffer],
    path.split("/").at(-1)!,
    { type },
  );
  Object.defineProperty(value, "webkitRelativePath", { value: `tour/${path}` });
  return value;
}
const signal = () => new AbortController().signal;
const point = { position: { yaw: 0, pitch: 0 } };

function assertPortable(archive: Record<string, Uint8Array>) {
  const resourceKeys = new Set(["viewerUrl", "previewUrl", "urlTemplate", "src", "poster", "icon", "playingIcon", "image", "baseUrl"]);
  for (const [path, bytes] of Object.entries(archive)) {
    if (!path.endsWith(".json")) continue;
    const base = new URL(path, "https://relocated.test/nested/tour/");
    const check = (reference: string) => {
      assert.ok(reference && !/^(?:[a-z][a-z\d+.-]*:|[\\/])/i.test(reference), reference);
      const resolved = new URL(reference, base);
      assert.ok(resolved.href.startsWith("https://relocated.test/nested/tour/"), reference);
      const target = resolved.pathname.slice("/nested/tour/".length);
      if (target.includes("%")) {
        const pattern = new RegExp("^" + target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%s/g, "[frblud]").replace(/%[lvh]/g, "[0-9]+") + "$");
        assert.ok(Object.keys(archive).some((entry) => pattern.test(entry)), target);
      } else assert.ok(archive[target], target);
    };
    const walk = (value: unknown, key = "") => {
      if (key === "params") return;
      if (typeof value === "string") {
        if (resourceKeys.has(key)) check(value);
        if (key === "cursor" || key === "background") mapCursorAssets(value, (ref) => { check(ref); return ref; });
      } else if (Array.isArray(value)) value.forEach((item) => walk(item, key));
      else if (value && typeof value === "object") Object.entries(value).forEach(([name, item]) => walk(item, name));
    };
    walk(JSON.parse(strFromU8(bytes)));
  }
}

test("local package contains every sphere tile and media, preserves metadata, and reloads without the original source", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Original network unavailable");
  });
  const local = new LocalFiles([
    file("a/viewer.json", JSON.stringify(sphere), "application/json"),
    file("a/preview.png", "preview"),
    file("a/tiles/1/001_01.png", "left"),
    file("a/tiles/1/002_01.png", "right"),
    file("media/image #1.png", "image"),
    file("media/movie.webm", "video", "video/webm"),
    file("media/audio.mp3", "audio", "audio/mpeg"),
    file("media/cursor.png", "cursor"),
    file("media/card.html", "<!doctype html><h1>Guide</h1>", "text/html"),
    file(
      "media/icon.svg",
      '<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>',
      "image/svg+xml",
    ),
  ]);
  const project: PanoProjectDefinition = {
    schemaVersion: 1,
    title: "Portable",
    initialSceneId: "a",
    scenes: [
      {
        id: "a",
        title: "Room",
        initialView: { yaw: 1, pitch: 2, fov: 60 },
        source: { viewerUrl: "a/viewer.json" },
        viewLimits: { yaw: { min: 170, max: -170 }, fov: { min: 40, max: 80 } },
        hotspots: [
          {
            events: { pointerenter: { type: "custom", actionId: "preview", params: { src: "https://business.test/ignored.png" } } },
            id: "image",
            type: "image",
            ...point,
            src: "media/image%20%231.png",
            cursor: imageCursor("media/cursor.png"),
            tooltipAppearance: { background: 'url("media/image%20%231.png")' },
            tooltip: {
              image: "media/image%20%231.png",
              imageAlt: "Description",
            },
          },
          {
            id: "graphic",
            type: "graphic",
            ...point,
            graphic: { kind: "svg", src: "media/icon.svg" },
          },
          {
            id: "sequence",
            type: "sequence",
            ...point,
            src: "media/image%20%231.png",
            frameCount: 2,
          },
          {
            id: "video",
            type: "video",
            ...point,
            src: "media/movie.webm",
            poster: "media/image%20%231.png",
          },
          {
            id: "audio",
            type: "audio",
            ...point,
            src: ["media/audio.mp3"],
            icon: "media/icon.svg",
            playingIcon: "media/image%20%231.png",
          },
          {
            id: "text",
            type: "text",
            ...point,
            text: "URLs in prose stay unchanged: https://example.test/",
            action: { type: "scene", sceneId: "a" },
          },
          { id: "iframe", type: "iframe", ...point, src: "media/card.html" },
          {
            id: "polygon",
            type: "polygon",
            vertices: [
              { yaw: 0, pitch: 0 },
              { yaw: 10, pitch: 0 },
              { yaw: 5, pitch: 10 },
            ],
          },
          {
            id: "polyline",
            type: "polyline",
            vertices: [
              { yaw: 0, pitch: 0 },
              { yaw: 10, pitch: 0 },
            ],
          },
        ],
      },
    ],
  };
  const before = structuredClone(project);
  const progress: { completed: number; total: number }[] = [];
  const blob = await buildProjectPackage(project, {
    local,
    signal: signal(),
    onProgress: (value) => progress.push(value),
  });
  const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.equal(JSON.parse(strFromU8(archive["project.json"]!)).scenes[0].hotspots[0].events.pointerenter.params.src, "https://business.test/ignored.png");
  assertPortable(archive);
  const saved = parsePanoProject(
    JSON.parse(strFromU8(archive["project.json"]!)),
  );
  assert.deepEqual(project, before);
  assert.equal(saved.title, "Portable");
  assert.deepEqual(saved.scenes[0]!.viewLimits, project.scenes[0]!.viewLimits);
  assert.equal(saved.initialSceneId, "a");
  assert.deepEqual(
    saved.scenes[0]!.initialView,
    project.scenes[0]!.initialView,
  );
  assert.equal(saved.scenes[0]!.hotspots!.length, 9);
  assert.equal(strFromU8(archive["panoramas/1/tiles/1/1_1.png"]!), "left");
  assert.equal(strFromU8(archive["panoramas/1/tiles/1/1_2.png"]!), "right");
  assert.equal(
    Object.keys(archive).filter((path) => path.startsWith("assets/")).length,
    6,
  );
  assert.ok(!strFromU8(archive["project.json"]!).includes("blob:"));
  assert.equal(progress.at(-1)!.completed, progress.at(-1)!.total);
  const reopened = new LocalFiles(
    Object.entries(archive).map(([path, bytes]) => file(path, bytes)),
  );
  const restored = await reopened.project();
  assert.deepEqual(restored, saved);
  const source = await reopened.source(saved.scenes[0]!.source);
  assert.equal(source.config.type, "sphereTile");
  if (source.config.type === "sphereTile")
    assert.equal(source.config.indexBase, 1);
  const loaded = resolveProjectHotspotAssets(
    saved.scenes[0]!.hotspots![0]!,
    "https://pano-editor.invalid/",
    "a",
    reopened.resolve,
  );
  assert.match(cursorImage(loaded.cursor)!, /^blob:/);
  reopened.dispose();
  local.dispose();
});

test("online cube packaging handles redirect roots, aliases, every face and level, and a host resolver", async (t) => {
  const requests: string[] = [];
  const cube = {
    schemaVersion: 1,
    type: "tile",
    multires: { tileSize: 2, levels: [2, 4] },
    previewUrl: "preview.png",
    urlTemplate: "tiles/%s/%l/%00x_%0y.png",
    previewFaceOrder: ["l", "f", "r", "b", "u", "d"],
  };
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push(url);
      assert.equal(new Headers(init?.headers).get("x-test"), "yes");
      if (url === "https://origin.test/viewer.json") {
        const response = new Response(JSON.stringify(cube));
        Object.defineProperty(response, "url", {
          value: "https://cdn.test/room/viewer.json",
        });
        return response;
      }
      assert.match(url, /^https:\/\/cdn.test\/(room\/|resolved-image)/);
      return new Response("pixels", {
        headers: { "Content-Type": "image/png" },
      });
    },
  );
  const project: PanoProjectDefinition = {
    schemaVersion: 1,
    scenes: [
      {
        id: "cube",
        source: { viewerUrl: "https://origin.test/viewer.json" },
        hotspots: [{ id: "marker", type: "image", ...point, src: "marker" }],
      },
    ],
  };
  const blob = await buildProjectPackage(project, {
    baseUrl: "https://origin.test/",
    signal: signal(),
    requestInit: { headers: { "x-test": "yes" } },
    resolveAssetUrl: (path, context) =>
      context.kind === "hotspot"
        ? "https://cdn.test/resolved-image"
        : context.defaultUrl,
  });
  const archive = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.equal(requests.filter((url) => url.includes("/tiles/")).length, 30);
  assert.ok(requests.includes("https://cdn.test/room/tiles/d/2/002_02.png"));
  assert.ok(archive["panoramas/1/tiles/d/2/2_2.png"]);
  assert.ok(archive["assets/1.png"]); // extensionless remote media uses its MIME type
  assertPortable(archive);
  const saved = JSON.parse(strFromU8(archive["project.json"]!));
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    assert.match(String(url), /^https:\/\/offline.test\//);
    const path = new URL(String(url)).pathname.slice("/nested/tour/".length);
    const data = archive[path];
    assert.ok(data, path);
    return new Response(new Uint8Array(data).buffer);
  });
  const loaded = await loadPanoProject(saved, {
    baseUrl: "https://offline.test/nested/tour/",
    resolveAssetUrl: (path, context) => {
      assert.ok(archive[new URL(context.defaultUrl).pathname.slice("/nested/tour/".length)], path);
      return context.defaultUrl;
    },
  });
  assert.equal(loaded.scenes[0]!.scene.type, "tile");
});

test("missing tiles, blocked remote media, cancellation and dependent documents never produce a partial package", async (t) => {
  const project: PanoProjectDefinition = {
    schemaVersion: 1,
    scenes: [
      {
        id: "room",
        source: { viewerConfig: sphere, baseUrl: "https://assets.test/" },
      },
    ],
  };
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) =>
    String(url).includes("preview")
      ? new Response("preview")
      : new Response("missing", { status: 404 }),
  );
  await assert.rejects(
    buildProjectPackage(project, {
      baseUrl: "https://example.test/",
      signal: signal(),
    }),
    /panoramas\/1\/tiles.*Could not read resource/,
  );
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    buildProjectPackage(project, {
      baseUrl: "https://example.test/",
      signal: cancelled.signal,
    }),
    /abort/i,
  );
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) =>
    String(url).includes("card.html")
      ? new Response('<html><img src="missing.png"></html>', {
          headers: { "Content-Type": "text/html" },
        })
      : new Response("pixels", { headers: { "Content-Type": "image/png" } }),
  );
  const dependent = structuredClone(project);
  dependent.scenes[0]!.hotspots = [
    {
      id: "page",
      type: "iframe",
      ...point,
      src: "https://web.test/card.html?token=secret",
    },
  ];
  await assert.rejects(
    buildProjectPackage(dependent, {
      baseUrl: "https://example.test/",
      signal: signal(),
    }),
    (error) => {
      assert.match(String(error), /Embedded document has dependencies/);
      assert.ok(!String(error).includes("secret"));
      return true;
    },
  );
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("CORS blocked https://web.test/?secret=private");
  });
  await assert.rejects(
    buildProjectPackage(dependent, {
      baseUrl: "https://example.test/",
      signal: signal(),
    }),
    (error) => {
      assert.match(String(error), /Could not read resource/);
      assert.ok(!String(error).includes("private"));
      return true;
    },
  );
});

test("cursor image URLs resolve as resources, CSS offsets survive, and temporary URLs cannot export", async () => {
  const css = 'url("a%20b.png") 3 4, url(second.png), pointer';
  const mapped = mapCursorAssets(css, (path) => `https://assets.test/${path}`);
  assert.equal(
    mapped,
    'url("https://assets.test/a%20b.png") 3 4, url("https://assets.test/second.png"), pointer',
  );
  assert.equal(
    mapCursorAssets("crosshair", () => {
      throw new Error("No resource");
    }),
    "crosshair",
  );
  const hotspot = resolveProjectHotspotAssets(
    { id: "text", type: "text", text: "Text", ...point, cursor: css },
    "https://assets.test/",
    "room",
  );
  assert.equal(hotspot.cursor, mapped);
  assert.throws(
    () =>
      exportDocument({
        schemaVersion: 1,
        scenes: [
          {
            id: "s",
            source: { viewerConfig: sphere },
            hotspots: [
              {
                id: "text",
                type: "text",
                text: "",
                ...point,
                cursor: imageCursor("blob:temporary"),
              },
            ],
          },
        ],
      }),
    /temporary/,
  );
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(png.buffer).setUint32(16, 32);
  new DataView(png.buffer).setUint32(20, 32);
  await validateCursorImage(new File([png], "cursor.png"));
  new DataView(png.buffer).setUint32(16, 129);
  await assert.rejects(validateCursorImage(new File([png], "large.png")), /32/);
  await assert.rejects(
    validateCursorImage(new File(["invalid"], "fake.png")),
    /PNG/,
  );
});

test("package downloads stay bounded and cancellation interrupts active requests", async (t) => {
  let active = 0,
    maximum = 0;
  const controller = new AbortController();
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string | URL | Request, options?: RequestInit) => {
      active++;
      maximum = Math.max(maximum, active);
      try {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            options?.signal?.removeEventListener("abort", abort);
            resolve();
          }, 5);
          const abort = () => {
            clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
          };
          options?.signal?.addEventListener("abort", abort, { once: true });
        });
        return new Response("pixels", {
          headers: { "Content-Type": "image/png" },
        });
      } finally {
        active--;
      }
    },
  );
  const project: PanoProjectDefinition = {
    schemaVersion: 1,
    scenes: [
      {
        id: "room",
        source: { viewerConfig: sphere, baseUrl: "https://assets.test/" },
        hotspots: Array.from({ length: 12 }, (_, i) => ({
          id: `image-${i}`,
          type: "image",
          ...point,
          src: `https://assets.test/${i}.png`,
        })),
      },
    ],
  };
  await buildProjectPackage(project, {
    baseUrl: "https://assets.test/",
    signal: signal(),
  });
  assert.ok(maximum <= 4 && maximum > 1, String(maximum));
  await assert.rejects(
    buildProjectPackage(project, {
      baseUrl: "https://assets.test/",
      signal: controller.signal,
      onProgress: ({ completed }) => {
        if (completed === 1) controller.abort();
      },
    }),
    (error) => {
      assert.equal((error as Error).name, "AbortError");
      return true;
    },
  );
  assert.equal(active, 0);
});

test("oversized grids reject before downloading and self-contained SVG gradients remain portable", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async () => {
    requests++;
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"/></defs><path fill="url(#g)"/></svg>',
      { headers: { "Content-Type": "image/svg+xml" } },
    );
  });
  const enormous = {
    ...sphere,
    multires: { tileSize: 1, levels: [{ width: 1000, height: 500 }] },
  };
  await assert.rejects(
    buildProjectPackage(
      {
        schemaVersion: 1,
        scenes: [
          {
            id: "large",
            source: { viewerConfig: enormous, baseUrl: "https://assets.test/" },
          },
        ],
      },
      { baseUrl: "https://assets.test/", signal: signal() },
    ),
    /exceeds/,
  );
  assert.equal(requests, 0);
  const config = {
    ...sphere,
    previewUrl: "preview.svg",
    urlTemplate: "tiles/%l/%h_%v.svg",
  };
  const blob = await buildProjectPackage(
    {
      schemaVersion: 1,
      scenes: [
        {
          id: "svg",
          source: { viewerConfig: config, baseUrl: "https://assets.test/" },
        },
      ],
    },
    { baseUrl: "https://assets.test/", signal: signal() },
  );
  assert.ok(
    unzipSync(new Uint8Array(await blob.arrayBuffer()))["project.json"],
  );
});

test("shared and unused popup media are packaged once and reopen with the original network unavailable", async (t) => {
  const { resolveProjectPopupAssets } = await import("@ericchen1990/pano-view/data");
  t.mock.method(globalThis, "fetch", () => { throw new Error("Original source unavailable"); });
  const local = new LocalFiles([
    file("a/viewer.json", JSON.stringify(sphere), "application/json"), file("a/preview.png", "preview"),
    file("a/tiles/1/001_01.png", "left"), file("a/tiles/1/002_01.png", "right"),
    file("media/image.png", "image"), file("media/audio.mp3", "audio", "audio/mpeg"), file("media/video.mp4", "video", "video/mp4"),
  ]);
  const project: PanoProjectDefinition = { schemaVersion: 1, scenes: [{ id: "a", source: { viewerUrl: "a/viewer.json" }, hotspots: [
    { id: "one", type: "image", ...point, src: "media/image.png", action: { type: "popup", popupId: "shared" } },
    { id: "two", type: "text", ...point, text: "Two", action: { type: "popup", popupId: "shared" } },
  ] }], popups: [
    { id: "shared", title: "Shared", blocks: [
      { id: "image", type: "image", src: "media/image.png" }, { id: "video", type: "video", src: "media/video.mp4", poster: "media/image.png" },
    ] },
    { id: "unused", title: "Unused but retained", blocks: [{ id: "audio", type: "audio", src: "media/audio.mp3" }] },
  ] };
  const before = JSON.stringify(project);
  const zip = await buildProjectPackage(project, { local, signal: signal() });
  const archive = unzipSync(new Uint8Array(await zip.arrayBuffer()));
  assert.equal(Object.keys(archive).filter((path) => path.startsWith("assets/")).length, 3);
  assertPortable(archive);
  const saved = parsePanoProject(JSON.parse(strFromU8(archive["project.json"]!)));
  assert.equal(saved.popups?.length, 2);
  assert.equal(JSON.stringify(project), before);
  const reopened = new LocalFiles(Object.entries(archive).map(([path, bytes]) => file(path, bytes)));
  assert.deepEqual(await reopened.project(), saved);
  local.dispose();
  for (const popup of saved.popups!) {
    const loaded = resolveProjectPopupAssets(popup, "https://pano-editor.invalid/", (path, context) => reopened.resolveFrom(path, context, "https://pano-editor.invalid/"));
    for (const block of loaded.blocks) if (block.type !== "text") assert.match(block.src, /^blob:/);
  }
  reopened.dispose();
});
