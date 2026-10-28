import assert from "node:assert/strict";
import { test } from "node:test";
import { loadPanoProject, parsePanoProject, resolveProjectPopupAssets, type PanoProjectDefinition } from "../src/data";
import { handleProjectHotspotClick } from "../src/project-scenes";

const project: PanoProjectDefinition = {
  schemaVersion: 1,
  scenes: [{ id: "room", source: { viewerConfig: {
    type: "sphereTile", multires: { tileSize: 2, levels: [{ width: 4, height: 2 }] },
    previewUrl: "p.jpg", urlTemplate: "%l/%v_%h.jpg", indexBase: 0,
  } }, hotspots: [{ id: "info", type: "text", text: "Info", position: { yaw: 0, pitch: 0 }, action: { type: "popup", popupId: "story" } }] }],
  popups: [{ id: "story", title: "A shared story", blocks: [
    { id: "words", type: "text", text: "<script>plain text</script>\nA second line" },
    { id: "image", type: "image", src: "media/photo.jpg", alt: "Photo" },
    { id: "video", type: "video", src: "media/movie.mp4", poster: "media/photo.jpg" },
    { id: "audio", type: "audio", src: "media/audio.mp3" },
  ] }],
};

test("shared popup parsing retains content, validates IDs and references, and accepts authoring drafts only explicitly", () => {
  const parsed = parsePanoProject(project);
  assert.deepEqual(parsed.popups, project.popups);
  const invalid = (change: (copy: PanoProjectDefinition) => void) => {
    const copy = structuredClone(project); change(copy);
    assert.throws(() => parsePanoProject(copy));
  };
  invalid((copy) => copy.popups!.push(copy.popups![0]!));
  invalid((copy) => copy.popups![0]!.blocks.push(copy.popups![0]!.blocks[0]!));
  invalid((copy) => { copy.popups = []; });
  invalid((copy) => { copy.popups![0]!.title = ""; });
  invalid((copy) => { copy.popups![0]!.blocks[1] = { id: "image", type: "image", src: "javascript:alert(1)" }; });
  const draft = { schemaVersion: 1, scenes: [], popups: [{ id: "draft", title: "", blocks: [{ id: "image", type: "image", src: "" }] }] };
  assert.throws(() => parsePanoProject(draft));
  assert.equal(parsePanoProject(draft, { draft: true }).popups?.[0]?.blocks.length, 1);
});

test("popup resources use the project directory and a separate resolver with content IDs", async () => {
  const contexts: string[] = [];
  const loaded = await loadPanoProject(project, { baseUrl: "https://cdn.test/tour/", resolvePopupAssetUrl(path, context) {
    contexts.push(`${context.popupId}/${context.blockId}/${context.field}`);
    assert.equal(context.defaultUrl, `https://cdn.test/tour/${path}`);
    return `https://media.test/${path}`;
  } });
  assert.equal(contexts.length, 4);
  assert.ok(contexts.includes("story/video/poster"));
  assert.equal(loaded.popups?.[0]?.blocks[1]?.type, "image");
  assert.match(JSON.stringify(loaded.popups), /https:\/\/media.test\/media\/photo.jpg/);
  assert.deepEqual(project.popups?.[0]?.blocks[1], { id: "image", type: "image", src: "media/photo.jpg", alt: "Photo" });
  assert.throws(() => resolveProjectPopupAssets(project.popups![0]!, "https://cdn.test/", () => "relative.jpg"));
});

test("view actions validate camera and duration; popup and view clicks share cancellation and override media playback", () => {
  const hotspot = project.scenes[0]!.hotspots![0]!;
  for (const view of [{ yaw: 0, pitch: 91, fov: 75 }, { yaw: NaN, pitch: 0, fov: 75 }, { yaw: 0, pitch: 0, fov: 180 }]) {
    const copy = structuredClone(project);
    copy.scenes[0]!.hotspots![0]!.action = { type: "view", view };
    assert.throws(() => parsePanoProject(copy));
  }
  const copy = structuredClone(project);
  copy.scenes[0]!.hotspots![0]!.action = { type: "view", view: { yaw: 180, pitch: -90, fov: 30 }, duration: -1 };
  assert.throws(() => parsePanoProject(copy));
  copy.scenes[0]!.hotspots![0]!.action.duration = 0;
  assert.equal(parsePanoProject(copy).scenes[0]!.hotspots![0]!.action?.type, "view");
  let executed = 0;
  const interaction = { id: hotspot.id, position: { yaw: 0, pitch: 0 }, source: "keyboard" as const, nativeEvent: new Event("click", { cancelable: true }) as MouseEvent };
  const unexpected = () => assert.fail("Popup must not navigate or toggle playback");
  handleProjectHotspotClick(hotspot, "room", interaction, (event) => event.preventDefault(), unexpected, unexpected, () => executed++);
  assert.equal(executed, 0);
  handleProjectHotspotClick(hotspot, "room", interaction, undefined, unexpected, unexpected, (action) => { assert.equal(action.type, "popup"); executed++; });
  assert.equal(executed, 1);
});
