import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadPanoProject,
  parsePanoProject,
  type PanoProjectDefinition,
  type ProjectHotspotDefinition,
  type ViewerConfig,
} from "@ericchen1990/pano-view/data";
import {
  exportDocument,
  removeScene,
  moveScene,
  readDocument,
  emptyProject,
} from "../src/document";
import { DocumentHistory } from "../src/history";

const config: ViewerConfig = {
  type: "tile",
  multires: { tileSize: 512, levels: [512] },
  previewUrl: "preview.webp",
  urlTemplate: "tiles/%s/%l/%v_%h.webp",
  previewFaceOrder: ["l", "f", "r", "b", "u", "d"],
};
const point = { position: { yaw: 10, pitch: 5 } };
const hotspots: ProjectHotspotDefinition[] = [
  {
    id: "image",
    type: "image",
    ...point,
    src: "media/marker.webp",
    referenceFov: 60,
    tooltip: { image: "media/tooltip.webp", imageAlt: "An image" },
  },
  {
    id: "graphic",
    type: "graphic",
    ...point,
    graphic: {
      kind: "path",
      path: "M0 0H10V10Z",
      viewBox: [0, 0, 10, 10],
      strokeWidth: 3,
    },
  },
  {
    id: "sequence",
    type: "sequence",
    ...point,
    src: "media/sprite.webp",
    frameCount: 8,
    fps: 10,
  },
  {
    id: "video",
    type: "video",
    ...point,
    src: "media/movie.mp4",
    poster: "media/poster.webp",
    crossOrigin: "use-credentials",
    playsInline: true,
  },
  {
    id: "audio",
    type: "audio",
    format: ["mp3", "ogg"],
    ...point,
    src: ["media/audio.mp3", "media/audio.ogg"],
    icon: "media/icon.svg",
    pauseWhenHidden: false,
  },
  {
    id: "text",
    type: "text",
    ...point,
    text: "blob: can appear in prose",
    fontWeight: "bold",
    padding: 8,
    lineHeight: 1.5,
    borderRadius: 3,
    tooltipAppearance: { border: "1px solid red", letterSpacing: 1 },
  },
  {
    id: "iframe",
    type: "iframe",
    ...point,
    src: "media/card.html",
    allow: "fullscreen",
    sandbox: "allow-scripts",
    referrerPolicy: "no-referrer",
  },
  {
    id: "polygon",
    type: "polygon",
    vertices: [
      { yaw: -10, pitch: 0 },
      { yaw: 10, pitch: 0 },
      { yaw: 0, pitch: 10 },
    ],
    strokeGapSize: 3,
    fillOpacity: 0.2,
  },
  {
    id: "polyline",
    type: "polyline",
    vertices: [
      { yaw: -10, pitch: -5 },
      { yaw: 10, pitch: -5 },
    ],
    strokeDashSize: 5,
    action: { type: "scene", sceneId: "b" },
  },
];
function project(): PanoProjectDefinition {
  return {
    schemaVersion: 1,
    title: "Roundtrip",
    initialSceneId: "a",
    scenes: [
      {
        id: "a",
        source: { viewerConfig: config, baseUrl: "panos/a/" },
        hotspots: structuredClone(hotspots),
      },
      {
        id: "b",
        source: { viewerConfig: config, baseUrl: "panos/b/" },
        hotspots: [],
      },
    ],
  };
}

test("all nine hotspot types roundtrip unchanged and exported JSON loads as a static tour", async () => {
  const original = project();
  const before = structuredClone(original);
  original.scenes[0]!.hotspots![0]!.label = "Edited image";
  const saved = JSON.parse(exportDocument(original)) as PanoProjectDefinition;
  assert.deepEqual(parsePanoProject(saved), parsePanoProject(original));
  assert.deepEqual(
    saved.scenes[0]!.hotspots!.slice(1),
    before.scenes[0]!.hotspots!.slice(1),
  );
  const loaded = await loadPanoProject(saved, {
    baseUrl: "https://static.test/tour/",
  });
  assert.equal(
    loaded.scenes[0]!.scene.previewUrl,
    "https://static.test/tour/panos/a/preview.webp",
  );
  const image = loaded.scenes[0]!.hotspots[0]!;
  assert.equal(
    "src" in image && image.src,
    "https://static.test/tour/media/marker.webp",
  );
  assert.equal(loaded.scenes[0]!.hotspots.length, 9);
  assert.ok(!exportDocument(original).includes("pano-editor.invalid"));
});

test("scene deletion clears incoming actions atomically and undo restores them", () => {
  const history = new DocumentHistory(project());
  history.commit(removeScene(history.current, "b"));
  assert.equal(history.current.scenes.length, 1);
  assert.equal(history.current.scenes[0]!.hotspots!.at(-1)!.action, undefined);
  assert.equal(
    history.undo().scenes[0]!.hotspots!.at(-1)!.action?.sceneId,
    "b",
  );
  history.redo();
  assert.equal(history.current.scenes.length, 1);
  assert.equal(removeScene(history.current, "a").initialSceneId, undefined);
});

test("scene reordering preserves scene data, the initial scene and links, and supports undo", () => {
  const original = project();
  original.scenes.push({ id: "c", source: { viewerConfig: config } });
  const history = new DocumentHistory(original);
  history.commit(moveScene(history.current, "a", "c"));
  assert.deepEqual(history.current.scenes.map((scene) => scene.id), ["b", "a", "c"]);
  assert.equal(history.current.initialSceneId, "a");
  assert.equal(history.current.scenes[1], original.scenes[0]);
  assert.equal(history.current.scenes[1]!.hotspots!.at(-1)!.action?.sceneId, "b");
  assert.deepEqual(original.scenes.map((scene) => scene.id), ["a", "b", "c"]);
  history.commit(moveScene(history.current, "c", "b"));
  assert.deepEqual(history.current.scenes.map((scene) => scene.id), ["c", "b", "a"]);
  history.commit(moveScene(history.current, "c"));
  assert.deepEqual(history.current.scenes.map((scene) => scene.id), ["b", "a", "c"]);
  assert.deepEqual(history.undo().scenes.map((scene) => scene.id), ["c", "b", "a"]);
  assert.deepEqual(history.redo().scenes.map((scene) => scene.id), ["b", "a", "c"]);
});

test("invalid and unchanged reorder targets preserve the original document", () => {
  const original = project();
  assert.equal(moveScene(original, "a", "a"), original);
  assert.equal(moveScene(original, "a", "b"), original);
  assert.equal(moveScene(original, "b"), original);
  assert.equal(moveScene(original, "missing", "a"), original);
  assert.equal(moveScene(original, "a", "missing"), original);
});

test("gesture history coalesces frames, clears redo, and does not share state between instances", () => {
  const first = new DocumentHistory(project());
  const second = new DocumentHistory(project());
  first.begin();
  first.commit({ ...first.current, title: "frame 1" });
  first.commit({ ...first.current, title: "frame 2" });
  first.end();
  assert.equal(first.past.length, 1);
  assert.equal(first.undo().title, "Roundtrip");
  first.commit({ ...first.current, title: "another edit" });
  assert.equal(first.future.length, 0);
  assert.equal(second.current.title, "Roundtrip");
  first.begin();
  first.end();
  assert.equal(first.past.length, 1);
});

test("empty authoring sessions are valid drafts but cannot export; invalid references, geometry and transient URLs fail", () => {
  assert.deepEqual(readDocument(emptyProject()), emptyProject());
  assert.deepEqual(
    readDocument({ ...emptyProject(), title: "" }),
    emptyProject(),
  );
  assert.throws(() => exportDocument(emptyProject()), /nonempty/);
  const invalid = project();
  invalid.scenes[0]!.hotspots![0]!.action = {
    type: "scene",
    sceneId: "missing",
  };
  assert.throws(() => exportDocument(invalid), /does not exist/);
  const temporary = project();
  temporary.scenes[0]!.hotspots![0] = {
    id: "x",
    type: "image",
    ...point,
    src: "blob:session",
  };
  assert.throws(() => exportDocument(temporary), /temporary/);
  temporary.scenes[0]!.hotspots![0] = {
    id: "x",
    type: "graphic",
    ...point,
    graphic: { kind: "svg", src: "file:///Users/private.svg" },
  };
  assert.throws(() => exportDocument(temporary), /local machine/);
  const geometry = project();
  geometry.scenes[0]!.hotspots = [
    {
      id: "shape",
      type: "polygon",
      vertices: [
        { yaw: -10, pitch: -10 },
        { yaw: 10, pitch: 10 },
        { yaw: -10, pitch: 10 },
        { yaw: 10, pitch: -10 },
      ],
    },
  ];
  assert.throws(() => exportDocument(geometry), /edges cannot cross/i);
});
