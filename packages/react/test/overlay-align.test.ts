import assert from "node:assert/strict";
import { test } from "node:test";
import {
  overlayBoxStyle,
  overlayCollapseEdge,
  overlayContentAlign,
  parseOverlayAnchor,
  resolveOverlayAnchor,
  resolveOverlayAxis,
} from "../src/overlay/align";

test("edges infer axis and corners keep the requested axis", () => {
  assert.equal(resolveOverlayAxis("top", "vertical"), "horizontal");
  assert.equal(resolveOverlayAxis("left", "horizontal"), "vertical");
  assert.equal(resolveOverlayAxis("top-left", undefined), "horizontal");
  assert.equal(resolveOverlayAxis("bottom-right", "vertical"), "vertical");
});

test("collapse edge follows the outer side", () => {
  assert.equal(overlayCollapseEdge("top", "vertical"), "top");
  assert.equal(overlayCollapseEdge("right", "horizontal"), "right");
  assert.equal(overlayCollapseEdge("top-left", "horizontal"), "top");
  assert.equal(overlayCollapseEdge("top-left", "vertical"), "left");
  assert.equal(overlayCollapseEdge("bottom-right", "horizontal"), "bottom");
  assert.equal(overlayCollapseEdge("bottom-right", "vertical"), "right");
});

test("short content packs toward a corner and centers on an edge", () => {
  assert.equal(overlayContentAlign("bottom", "vertical"), "center");
  assert.equal(overlayContentAlign("bottom-left", "horizontal"), "start");
  assert.equal(overlayContentAlign("bottom-right", "horizontal"), "end");
  assert.equal(overlayContentAlign("top-left", "vertical"), "start");
  assert.equal(overlayContentAlign("bottom-left", "vertical"), "end");
});

test("edge boxes stretch or center, and corners pin", () => {
  const inset = { top: "12px", right: "12px", bottom: "16px", left: "16px" };
  const top = overlayBoxStyle("top", inset, undefined, 40);
  assert.equal(top.left, "calc(16px + var(--pano-safe-left))");
  assert.equal(top.right, "calc(12px + var(--pano-safe-right))");
  assert.equal(top.width, undefined);
  assert.equal(top.marginInline, undefined);

  const bottom = overlayBoxStyle("bottom", inset, 200, undefined);
  assert.equal(bottom.marginInline, "auto");
  assert.equal(bottom.width, "200px");
  assert.equal(bottom.bottom, "calc(16px + var(--pano-safe-bottom))");

  const corner = overlayBoxStyle("top-left", inset, undefined, undefined);
  assert.equal(corner.top, "calc(12px + var(--pano-safe-top))");
  assert.equal(corner.left, "calc(16px + var(--pano-safe-left))");
  assert.equal(corner.right, "auto");
  assert.equal(corner.bottom, "auto");
  assert.equal(corner.width, undefined);
});

test("resolveOverlayAnchor keeps caller defaults", () => {
  const scene = resolveOverlayAnchor(undefined, { align: "bottom", inset: 12 });
  assert.equal(scene.align, "bottom");
  assert.equal(scene.axis, "horizontal");
  assert.equal(scene.inset.top, "12px");
  assert.equal(scene.collapseEdge, "bottom");
  assert.equal(scene.dockInset, "12px");

  const map = resolveOverlayAnchor(
    { align: "top-right", axis: "vertical", inset: { top: 8, right: 24 } },
    { align: "bottom-left", inset: 16 },
  );
  assert.equal(map.collapseEdge, "right");
  assert.equal(map.inset.top, "8px");
  assert.equal(map.inset.left, "16px");
  assert.equal(map.dockInset, "24px");
});

test("parseOverlayAnchor accepts eight aligns and rejects removed fields via map", () => {
  assert.deepEqual(parseOverlayAnchor({ align: "left", inset: "1rem" }, "anchor"), {
    align: "left",
    inset: "1rem",
  });
  assert.throws(
    () => parseOverlayAnchor({ align: "center" }, "anchor"),
    /anchor\.align/,
  );
  assert.throws(
    () => parseOverlayAnchor({ axis: "diagonal" }, "anchor"),
    /anchor\.axis/,
  );
});
