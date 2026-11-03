import assert from "node:assert/strict";
import { createElement, Fragment, type ReactElement, type ReactNode } from "react";
import { test } from "node:test";
import { PanoOverlay } from "../src/overlay/pano-overlay";
import {
  isPanoOverlayElement,
  partitionPanoOverlay,
} from "../src/overlay/partition";

function Scene() {
  return null;
}

test("isPanoOverlayElement recognizes the marked component", () => {
  assert.equal(isPanoOverlayElement(createElement(PanoOverlay, null, "ui")), true);
  assert.equal(isPanoOverlayElement(createElement(Scene)), false);
  assert.equal(isPanoOverlayElement("text"), false);
  assert.equal(isPanoOverlayElement(null), false);
});

test("without overlays, sceneChildren keeps the original children reference", () => {
  const children = createElement(Scene);
  const result = partitionPanoOverlay(children);
  assert.equal(result.overlayElements.length, 0);
  assert.equal(result.sceneChildren, children);
});

test("without overlays, array and fragment children keep the original reference", () => {
  const arrayChildren = [createElement(Scene, { key: "a" }), createElement(Scene, { key: "b" })];
  assert.equal(partitionPanoOverlay(arrayChildren).sceneChildren, arrayChildren);

  const fragmentChildren = createElement(
    Fragment,
    null,
    createElement(Scene, { key: "a" }),
    createElement(Scene, { key: "b" }),
  );
  assert.equal(partitionPanoOverlay(fragmentChildren).sceneChildren, fragmentChildren);
});

test("splits direct overlays from scene children and preserves order", () => {
  const menu = createElement(PanoOverlay, { key: "menu" }, "menu");
  const hud = createElement(PanoOverlay, { key: "hud" }, "hud");
  const scene = createElement(Scene, { key: "scene" });
  const result = partitionPanoOverlay([scene, menu, hud]);

  assert.deepEqual(
    (result.sceneChildren as ReactElement[]).map((node) => node.key),
    [".$scene"],
  );
  assert.deepEqual(
    result.overlayElements.map((node) => node.key),
    [".$menu", ".$hud"],
  );
  assert.equal(result.overlayElements[0]?.props.children, "menu");
  assert.equal(result.overlayElements[1]?.props.children, "hud");
});

test("flattens Fragments so overlays beside scene nodes are found", () => {
  const children = createElement(
    Fragment,
    null,
    createElement(Scene, { key: "sphere" }),
    createElement(PanoOverlay, { key: "chrome" }, "chrome"),
  );
  const result = partitionPanoOverlay(children);
  assert.equal((result.sceneChildren as ReactNode[]).length, 1);
  assert.equal(result.overlayElements.length, 1);
  assert.equal(result.overlayElements[0]?.props.children, "chrome");
});

test("does not lift overlays nested inside other components", () => {
  function Wrapper({ children }: { children?: ReactNode }) {
    return createElement(Fragment, null, children);
  }
  const nested = createElement(
    Wrapper,
    null,
    createElement(PanoOverlay, null, "hidden"),
  );
  const result = partitionPanoOverlay(nested);
  assert.equal(result.overlayElements.length, 0);
  assert.equal(result.sceneChildren, nested);
});
