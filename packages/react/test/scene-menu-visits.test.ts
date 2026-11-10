import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PanoSceneMenu, type PanoSceneMenuProps } from "../src/pano-scene-menu";
import {
  createScenesHost,
  markSceneVisited,
  ScenesHostContext,
  subscribeScenesHost,
  type ScenesHost,
} from "../src/scenes-host";

const items = [
  { id: "a", title: "Room A", thumbnailUrl: "a.webp" },
  { id: "b", title: "Room B", thumbnailUrl: "b.webp" },
];

function renderMenu(host: ScenesHost, props: Partial<PanoSceneMenuProps> = {}) {
  return renderToStaticMarkup(
    createElement(
      ScenesHostContext.Provider,
      { value: host },
      createElement(PanoSceneMenu, { items, activeId: "a", ...props }),
    ),
  );
}

test("viewer visits start empty and update immutable snapshots only once per scene", () => {
  const host = createScenesHost();
  const initial = host.visitedSceneIds;
  let notifications = 0;
  const unsubscribe = subscribeScenesHost(host, () => notifications++);
  assert.equal(initial.size, 0);
  markSceneVisited(host, "a");
  const first = host.visitedSceneIds;
  assert.notEqual(first, initial);
  assert.equal(initial.size, 0);
  markSceneVisited(host, "a");
  assert.equal(host.visitedSceneIds, first);
  assert.equal(notifications, 1);
  markSceneVisited(host, "b");
  assert.deepEqual([...host.visitedSceneIds], ["a", "b"]);
  assert.deepEqual([...first], ["a"]);
  unsubscribe();
  markSceneVisited(host, "c");
  assert.equal(notifications, 2);
});

test("each viewer owns its history and a fresh viewer resets it", () => {
  const first = createScenesHost();
  const second = createScenesHost();
  markSceneVisited(first, "a");
  assert.equal(second.visitedSceneIds.size, 0);
  assert.equal(createScenesHost().visitedSceneIds.size, 0);
});

test("active scene selection alone does not mark a visit and the option defaults off", () => {
  const host = createScenesHost();
  assert.doesNotMatch(renderMenu(host, { showVisited: true }), /data-visited/);
  assert.equal(host.visitedSceneIds.size, 0);
  markSceneVisited(host, "a");
  assert.doesNotMatch(renderMenu(host), /data-visited|pano-scene-menu-visited/);
});

test("current and previous scenes keep icon-only badges across hiding, toggling and remounts", () => {
  const host = createScenesHost();
  markSceneVisited(host, "a");
  const first = renderMenu(host, { showVisited: true, visitedLabel: "已浏览" });
  assert.equal((first.match(/data-visited="true"/g) ?? []).length, 1);
  assert.match(first, /aria-description="已浏览"/);
  assert.match(first, /<svg aria-hidden="true" class="pano-scene-menu-visited"/);
  assert.doesNotMatch(first, />已浏览</);
  renderMenu(host, { showVisited: false });
  renderMenu(host, { showVisited: true, collapsible: true, expanded: false });
  markSceneVisited(host, "b");
  const next = renderMenu(host, { showVisited: true, activeId: "b" });
  assert.equal((next.match(/data-visited="true"/g) ?? []).length, 2);
  assert.deepEqual([...host.visitedSceneIds], ["a", "b"]);
});

test("standalone menus have no automatic visits and expose the new border tokens", () => {
  const html = renderToStaticMarkup(
    createElement(PanoSceneMenu, {
      items,
      activeId: "a",
      showVisited: true,
      appearance: { selectionWidth: 0, focusColor: "#ff0000" },
    }),
  );
  assert.doesNotMatch(html, /data-visited/);
  assert.match(html, /--pano-scene-menu-focus-color:#ff0000/);
  assert.match(html, /--pano-scene-menu-selection-width:0px/);
});
