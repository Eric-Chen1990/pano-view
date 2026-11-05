import assert from "node:assert/strict";
import { test } from "node:test";
import {
  containRect,
  containerPointToImage,
  headingFromVector,
  horizontalFov,
  imagePointToContainer,
  sectorRotation,
} from "../src/map/geometry";
import { parsePanoMap, resolvePanoMapAssets } from "../src/data/map";
import { parsePanoProject } from "../src/data";

test("sector rotation adds heading and yaw", () => {
  assert.equal(sectorRotation(30, 45), 75);
  assert.equal(sectorRotation(-10, 10), 0);
});

test("horizontal fov grows with wider aspect", () => {
  const narrow = horizontalFov(75, 1);
  const wide = horizontalFov(75, 16 / 9);
  assert.ok(wide > narrow);
});

test("containRect centers the fitted image", () => {
  const rect = containRect(200, 100, 100, 100);
  assert.deepEqual(rect, { left: 50, top: 0, width: 100, height: 100 });
});

test("image anchors follow zoom while staying in container pixels", () => {
  const fit = containRect(200, 100, 100, 100);
  assert.deepEqual(fit, { left: 50, top: 0, width: 100, height: 100 });
  const viewport = { fit, scale: 2, panX: -50, panY: 0 };
  const point = imagePointToContainer({ x: 0.5, y: 0.5 }, viewport);
  assert.deepEqual(point, { x: 100, y: 100 });
  const back = containerPointToImage(point, viewport);
  assert.ok(back);
  assert.ok(Math.abs(back.x - 0.5) < 1e-9);
  assert.ok(Math.abs(back.y - 0.5) < 1e-9);
});

test("headingFromVector measures clockwise from image up", () => {
  assert.equal(headingFromVector(0, -1), 0);
  assert.equal(headingFromVector(1, 0), 90);
  assert.equal(headingFromVector(0, 1), 180);
  assert.equal(headingFromVector(-1, 0), -90);
});

test("parsePanoMap validates spots against scenes", () => {
  const map = parsePanoMap(
    {
      image: "floor.png",
      interaction: "zoom",
      presentation: {
        mode: "panel",
        anchor: { align: "bottom-left", axis: "vertical", inset: 16 },
        width: 240,
        height: 160,
      },
      controls: { collapse: true, zoom: true },
      iconSize: 28,
      maxScale: 4,
      dragMotion: { inertia: true, bounce: false },
      sector: {
        angle: 70,
        radius: 48,
        followFov: true,
        color: "#38bdf8",
        opacity: 0.6,
        strokeColor: "#0f172a",
        strokeWidth: 2,
        strokeOpacity: 0.8,
        gradient: {
          type: "radial",
          stops: [
            { offset: 0, color: "#ffffff", opacity: 0.7 },
            { offset: 1, color: "#ffffff", opacity: 0 },
          ],
        },
      },
      spots: [{ id: "a", sceneId: "entrance", x: 0.2, y: 0.4, heading: 15 }],
    },
    new Set(["entrance", "hall"]),
  );
  assert.equal(map?.spots[0]?.sceneId, "entrance");
  assert.equal(map?.controls?.zoom, true);
  assert.equal(map?.presentation?.mode, "panel");
  assert.equal(map?.presentation?.anchor?.align, "bottom-left");
  assert.equal(map?.presentation?.anchor?.axis, "vertical");
  assert.throws(
    () =>
      parsePanoMap(
        {
          image: "floor.png",
          presentation: { mode: "docked" },
          spots: [{ id: "a", sceneId: "entrance", x: 0.2, y: 0.4, heading: 0 }],
        },
        new Set(["entrance"]),
      ),
    /docked/,
  );
  assert.throws(
    () =>
      parsePanoMap(
        {
          image: "floor.png",
          presentation: { mode: "panel", offsetX: 8 },
          spots: [{ id: "a", sceneId: "entrance", x: 0.2, y: 0.4, heading: 0 }],
        },
        new Set(["entrance"]),
      ),
    /offsetX/,
  );
  assert.equal(map?.maxScale, 4);
  assert.deepEqual(map?.dragMotion, { inertia: true, bounce: false });
  assert.equal(map?.sector?.strokeColor, "#0f172a");
  assert.equal(map?.sector?.strokeWidth, 2);
  assert.equal(map?.sector?.color, "#38bdf8");
  assert.equal(
    parsePanoMap(
      {
        image: "floor.png",
        dragMotion: false,
        spots: [{ id: "a", sceneId: "entrance", x: 0.2, y: 0.4, heading: 0 }],
      },
      new Set(["entrance"]),
    )?.dragMotion,
    false,
  );
  assert.throws(
    () =>
      parsePanoMap(
        {
          image: "floor.png",
          spots: [{ id: "a", sceneId: "missing", x: 0.2, y: 0.4, heading: 0 }],
        },
        new Set(["entrance"]),
      ),
    /scene does not exist/,
  );
  assert.throws(
    () =>
      parsePanoMap(
        {
          image: "floor.png",
          dragMotion: { inertia: "yes" },
          spots: [{ id: "a", sceneId: "entrance", x: 0.2, y: 0.4, heading: 0 }],
        },
        new Set(["entrance"]),
      ),
    /dragMotion\.inertia/,
  );
});

test("parsePanoProject keeps map optional and resolves assets", () => {
  const project = parsePanoProject({
    schemaVersion: 1,
    scenes: [
      {
        id: "entrance",
        source: {
          viewerConfig: {
            type: "tile",
            multires: { tileSize: 512, levels: [512] },
            previewUrl: "p.webp",
            previewFaceOrder: ["l", "f", "r", "b", "u", "d"],
            urlTemplate: "tiles/%s/l%l/%v_%h.webp",
          },
        },
      },
    ],
    map: {
      image: "maps/floor.svg",
      spots: [{ id: "s1", sceneId: "entrance", x: 0.5, y: 0.5, heading: 0, icon: "maps/pin.svg" }],
    },
  });
  assert.equal(project.map?.image, "maps/floor.svg");
  const resolved = resolvePanoMapAssets(project.map!, "https://cdn.test/tour/");
  assert.equal(resolved.image, "https://cdn.test/tour/maps/floor.svg");
  assert.equal(resolved.spots[0]?.icon, "https://cdn.test/tour/maps/pin.svg");
});
