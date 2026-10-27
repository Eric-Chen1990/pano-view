import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveProjectHotspotAssets } from "@ericchen1990/pano-view/data";
import { LocalFiles, LOCAL_ROOT } from "../src/local-files";
import { SceneSources } from "../src/sources";

const config = {
  schemaVersion: 1,
  type: "sphereTile",
  multires: { tileSize: 512, levels: [{ width: 512, height: 256 }] },
  previewUrl: "previews/p.webp",
  urlTemplate: "tiles/%l/%h_%v.webp",
  indexBase: 0,
};
function file(path: string, content: string) {
  const value = new File([content], path.split("/").at(-1)!);
  Object.defineProperty(value, "webkitRelativePath", { value: `tour/${path}` });
  return value;
}
test("selected directory resolves preview, tile and nested hotspot files entirely locally and revokes URLs", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected network request");
  });
  const created: Blob[] = [],
    revoked: string[] = [];
  t.mock.method(URL, "createObjectURL", (blob: Blob) => {
    created.push(blob);
    return `blob:local-${created.length}`;
  });
  t.mock.method(URL, "revokeObjectURL", (url: string) => revoked.push(url));
  const local = new LocalFiles([
    file("panos/room/viewer.json", JSON.stringify(config)),
    file("panos/room/previews/p.webp", "preview"),
    file("panos/room/tiles/0/0_0.webp", "tile"),
    file("media/a #1.svg", "svg"),
  ]);
  const sources = new SceneSources({}, local);
  const controller = new AbortController();
  const scene = await sources.load(
    "room",
    { viewerUrl: "panos/room/viewer.json" },
    controller.signal,
  );
  assert.equal(scene.previewUrl, "blob:local-1");
  assert.equal(scene.type, "sphereTile");
  if (scene.type !== "sphereTile") throw new Error("Expected sphere tile");
  assert.equal(
    scene.resolveTileUrl?.({ level: 0, row: 0, col: 0 }),
    "blob:local-2",
  );
  assert.match(
    scene.resolveTileUrl!({ level: 0, row: 8, col: 9 }),
    /^data:image/,
  );
  assert.match(
    [...local.issues][0]!,
    /Missing local resource: panos\/room\/tiles\/0\/9_8.webp/,
  );
  const hotspot = resolveProjectHotspotAssets(
    {
      id: "svg",
      type: "graphic",
      position: { yaw: 0, pitch: 0 },
      graphic: { kind: "svg", src: "media/a%20%231.svg" },
      tooltip: { image: "media/a%20%231.svg" },
    },
    LOCAL_ROOT,
    "room",
    local.resolve,
  );
  assert.equal(
    hotspot.type === "graphic" &&
      hotspot.graphic.kind === "svg" &&
      hotspot.graphic.src,
    "blob:local-3",
  );
  assert.equal(
    typeof hotspot.tooltip === "object" && hotspot.tooltip.image,
    "blob:local-3",
  );
  assert.equal(created.length, 3);
  controller.abort();
  assert.equal(
    await sources.load(
      "room",
      { viewerUrl: "panos/room/viewer.json" },
      new AbortController().signal,
    ),
    scene,
  );
  local.dispose();
  assert.deepEqual(revoked, ["blob:local-1", "blob:local-2", "blob:local-3"]);
});

test("local project JSON and URL-encoded directories retain portable references", async () => {
  const project = {
    schemaVersion: 1,
    scenes: [{ id: "room", source: { viewerUrl: "a%20%23/viewer.json" } }],
  };
  const local = new LocalFiles([
    file("project.json", JSON.stringify(project)),
    file("a #/viewer.json", JSON.stringify(config)),
    file("a #/previews/p.webp", "preview"),
  ]);
  assert.equal(
    (await local.project())?.scenes[0]!.source.viewerUrl,
    project.scenes[0]!.source.viewerUrl,
  );
  assert.equal(
    (await local.source(project.scenes[0]!.source)).baseUrl,
    LOCAL_ROOT + "a%20%23/",
  );
  assert.deepEqual(local.viewerPaths(), ["a #/viewer.json"]);
  assert.throws(() => local.file("https://unselected.test/a.webp"), /outside/);
  assert.throws(() => local.file("missing.webp"), /Missing local resource/);
  assert.throws(() => local.file("../project.json"), /outside/);
  local.dispose();
});

test("malformed local viewer JSON, unsupported versions and missing files reject without touching a current document", async () => {
  const local = new LocalFiles([
    file("broken/viewer.json", "<html>"),
    file(
      "version/viewer.json",
      JSON.stringify({ ...config, schemaVersion: 2 }),
    ),
  ]);
  await assert.rejects(
    local.source({ viewerUrl: "broken/viewer.json" }),
    /broken\/viewer.json/,
  );
  await assert.rejects(
    local.source({ viewerUrl: "version/viewer.json" }),
    /schemaVersion/,
  );
  await assert.rejects(
    local.source({ viewerUrl: "missing/viewer.json" }),
    /Missing local resource/,
  );
});

test("mounted scene directories keep colliding filenames separate and coexist with HTTP scenes", async (t) => {
  const requests: string[] = [];
  const blobs: Blob[] = [];
  t.mock.method(URL, "createObjectURL", (blob: Blob) => {
    blobs.push(blob);
    return `blob:mounted-${blobs.length}`;
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    requests.push(String(url));
    return new Response(JSON.stringify(config), { headers: { "Content-Type": "application/json" } });
  });
  const first = new LocalFiles([
    file("viewer.json", JSON.stringify(config)),
    file("previews/p.webp", "first"),
    file("tiles/0/0_0.webp", "first tile"),
  ], "imports/first/tour/");
  const second = new LocalFiles([
    file("viewer.json", JSON.stringify(config)),
    file("previews/p.webp", "second"),
  ], "imports/second/tour/");
  try {
    const loader = new SceneSources({ baseUrl: "https://example.test/demo/" }, undefined, [first, second]);
    const signal = new AbortController().signal;
    const a = await loader.load("first", { viewerUrl: first.viewerPaths()[0]! }, signal);
    const b = await loader.load("second", { viewerUrl: second.viewerPaths()[0]! }, signal);
    assert.notEqual(a.previewUrl, b.previewUrl);
    assert.equal(await blobs[0]!.text(), "first");
    assert.equal(await blobs[1]!.text(), "second");
    await loader.load("remote", { viewerUrl: "viewer.json" }, signal);
    assert.equal(requests.at(-1), "https://example.test/demo/viewer.json");
    const count = requests.length;
    await assert.rejects(loader.load("missing", { viewerUrl: "imports/first/tour/missing/viewer.json" }, signal), /Missing local resource/);
    assert.equal(requests.length, count);
    assert.equal(loader.localFor({ viewerUrl: "imports/first/tour/viewer.json" }), first);
    assert.equal(loader.localFor({ viewerUrl: "viewer.json" }), undefined);
  } finally {
    first.dispose();
    second.dispose();
  }
});
