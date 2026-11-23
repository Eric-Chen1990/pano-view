import assert from "node:assert/strict";
import { test } from "node:test";
import type { PortalHotspotDefinition } from "@ericchen1990/pano-view";
import { portalTransform } from "../src/portal-transform";

const portal: PortalHotspotDefinition = {
  type: "portal", id: "door", position: { yaw: 177, pitch: 31 },
  shape: "ellipse", width: 12, height: 16, rotation: 60, scale: 1.25,
};

function close(actual: number | undefined, expected: number) {
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-8);
}

test("portal resize follows rotated local axes and preserves scale across the panorama seam", () => {
  const start = portalTransform(portal, 4);
  const widened = portalTransform({ ...portal, width: 24 }, 4);
  const taller = portalTransform({ ...portal, height: 21 }, 4);
  const width = start.drag("width", start.width, widened.width);
  close(width?.width, 24);
  assert.equal(width?.height, undefined);
  const height = start.drag("height", start.height, taller.height);
  close(height?.height, 21);
  assert.equal(height?.width, undefined);
  close(start.drag("width", start.width, start.width)?.width, portal.width!);
});

test("a legacy circle resolves its diameter from height and rotates clockwise", () => {
  const circle: PortalHotspotDefinition = { ...portal, shape: "circle", width: undefined };
  const start = portalTransform(circle, 4);
  assert.deepEqual(start.width, portalTransform({ ...circle, width: circle.height }, 4).width);
  assert.equal(start.drag("width", start.width, start.width)?.width, undefined);

  const resized = portalTransform({ ...circle, width: 22 }, 4);
  const diameter = start.drag("width", start.width, resized.width);
  close(diameter?.width, 22);
  assert.equal(diameter?.height, undefined);

  const rotated = portalTransform({ ...circle, rotation: 95 }, 4);
  close(start.drag("rotation", start.rotation, rotated.rotation)?.rotation, 95);
});
