import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePanoProject, hotspotAction, setHotspotAction, type ProjectHotspotDefinition } from "../src/data";
import { handleProjectHotspotClick } from "../src/project-scenes";
const hotspot: ProjectHotspotDefinition = { id: "h", type: "text", text: "hello", position: { yaw: 0, pitch: 0 }, action: { type: "scene", sceneId: "old" }, events: { click: { type: "custom", actionId: "show", params: { value: [0, false, null] } }, pointerenter: { type: "scene", sceneId: "room" }, pointerleave: { type: "popup", popupId: "info" } } };
const project = () => ({ schemaVersion: 1, scenes: [{ id: "room", source: { viewerConfig: { type: "sphereTile", multires: { tileSize: 2, levels: [{ width: 4, height: 2 }] }, indexBase: 0, previewUrl: "p.jpg", urlTemplate: "%l/%v_%h.jpg" } }, hotspots: [structuredClone(hotspot)] }], popups: [{ id: "info", title: "Info", blocks: [] }] });
const interaction = () => ({ id: "h", position: { yaw: 0, pitch: 0 }, source: "keyboard" as const, nativeEvent: new Event("click", { cancelable: true }) as MouseEvent });
test("events parse and round trip while preserving legacy click; all references validated", () => {
  const parsed = parsePanoProject(project());
  assert.deepEqual(parsed.scenes[0]!.hotspots![0]!.events, hotspot.events);
  assert.deepEqual(parsePanoProject(JSON.parse(JSON.stringify(parsed))), parsed);
  const invalid = project(); invalid.scenes[0]!.hotspots[0]!.events!.pointerenter = { type: "scene", sceneId: "missing" };
  assert.throws(() => parsePanoProject(invalid), /scene does not exist/);
  invalid.scenes[0]!.hotspots[0]!.events!.pointerenter = { type: "popup", popupId: "missing" };
  assert.throws(() => parsePanoProject(invalid), /popup does not exist/);
  for (const value of [NaN, Infinity, undefined, () => {}, new Date(), { nested: undefined }]) {
    const input = project(); input.scenes[0]!.hotspots[0]!.events!.click = { type: "custom", actionId: "show", params: { value } as never };
    assert.throws(() => parsePanoProject(input), /JSON data/);
  }
});
test("editing click removes its legacy fallback; hover edits preserve it", () => {
  assert.equal(hotspotAction(hotspot, "click")!.type, "custom");
  assert.equal(setHotspotAction(hotspot, "pointerenter").action!.type, "scene");
  const cleared = setHotspotAction(hotspot, "click");
  assert.equal(cleared.action, undefined); assert.equal(hotspotAction(cleared, "click"), undefined);
});
test("unified callback precedes legacy click and either can cancel; hover has no media default", async () => {
  const calls: string[] = [];
  const run = () => handleProjectHotspotClick(hotspot, "room", interaction(), () => { calls.push("legacy"); }, () => assert.fail(), () => assert.fail(), async (action, event) => { calls.push(action.type); assert.equal(event.trigger, "click"); }, "click", () => { calls.push("unified"); });
  await run(); assert.deepEqual(calls, ["unified", "legacy", "custom"]);
  handleProjectHotspotClick(hotspot, "room", interaction(), event => event.preventDefault(), () => assert.fail(), () => assert.fail(), () => assert.fail());
  handleProjectHotspotClick(hotspot, "room", interaction(), () => {}, () => assert.fail(), () => assert.fail(), () => assert.fail(), "click", event => event.preventDefault());
  await assert.rejects(async () => handleProjectHotspotClick(hotspot, "room", interaction(), undefined, () => {}, () => {}, async () => { throw new Error("request failed"); }), /request failed/);
  handleProjectHotspotClick({ id: "audio", type: "audio", src: "a.mp3", position: hotspot.position }, "room", interaction(), () => assert.fail(), () => assert.fail(), () => assert.fail(), undefined, "pointerleave");
});
