import assert from "node:assert/strict";
import { test } from "node:test";
import { customActionDefaults, customActionIssue, validateCustomActions, type PanoCustomActionDefinition } from "../src/custom-actions";
import { removeScene, popupReferences, removePopup, exportDocument } from "../src/document";
import type { PanoProjectDefinition } from "@ericchen1990/pano-view/data";
import { DocumentHistory } from "../src/history";
const definitions: PanoCustomActionDefinition[] = [{ id: "show", label: "Show", fields: [{ name: "id", label: "ID", type: "string", required: true }, { name: "count", label: "Count", type: "number", min: 0, max: 5, defaultValue: 0 }, { name: "enabled", label: "Enabled", type: "boolean", required: true, defaultValue: false }, { name: "mode", label: "Mode", type: "select", options: ["a", "b"] }] }];
const project: PanoProjectDefinition = { schemaVersion: 1, scenes: [{ id: "room", source: { viewerConfig: { type: "sphereTile", multires: { tileSize: 2, levels: [{ width: 4, height: 2 }] }, indexBase: 0, previewUrl: "p.jpg", urlTemplate: "%l/%v_%h.jpg" } }, hotspots: [{ id: "h", type: "text", text: "Hi", position: { yaw: 0, pitch: 0 }, events: { pointerenter: { type: "scene", sceneId: "room" }, pointerleave: { type: "popup", popupId: "info" }, click: { type: "custom", actionId: "show", params: { id: "123", enabled: false, extra: "blob:do-not-rewrite" } } } }] }], popups: [{ id: "info", title: "Info", blocks: [] }] };
test("action forms validate required fields, false/zero, ranges and enums without losing extra params", () => {
  assert.deepEqual(customActionDefaults(definitions[0]!), { count: 0, enabled: false });
  assert.equal(customActionIssue({ type: "custom", actionId: "show", params: { id: "1", count: 0, enabled: false } }, definitions), undefined);
  for (const params of [{ id: "", enabled: false }, { id: "1", count: 6, enabled: false }, { id: "1", enabled: false, mode: "c" }]) assert.ok(customActionIssue({ type: "custom", actionId: "show", params }, definitions));
  assert.doesNotThrow(() => validateCustomActions(project, definitions));
  assert.equal(customActionIssue({ type: "custom", actionId: "unknown" }, definitions), undefined);
  assert.match(exportDocument(project), /blob:do-not-rewrite/);
});
test("hover references participate in atomic deletion cleanup and history", () => {
  assert.equal(popupReferences(project, "info")[0]!.trigger, "pointerleave");
  const withoutPopup = removePopup(project, "info");
  assert.equal(withoutPopup.scenes[0]!.hotspots![0]!.events!.pointerleave, undefined);
  assert.deepEqual(withoutPopup.scenes[0]!.hotspots![0]!.events!.click, project.scenes[0]!.hotspots![0]!.events!.click);
  const withSecond = { ...project, scenes: [...project.scenes, { ...project.scenes[0]!, id: "second" }] };
  const history = new DocumentHistory(withSecond); history.commit(removeScene(withSecond, "room"));
  assert.equal(history.current.scenes[0]!.hotspots![0]!.events!.pointerenter, undefined);
  history.undo(); assert.equal(history.current.scenes.length, 2);
  history.redo(); assert.equal(history.current.scenes.length, 1);
});
