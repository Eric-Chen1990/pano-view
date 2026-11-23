import assert from "node:assert/strict";
import { test } from "node:test";
import { Group, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { loadPanoProject, parsePanoProject } from "../src/data/project";
import { panoPositionToVector3 } from "../src/hotspot/coordinates";
import { toLeveledPanoPosition, toSourcePanoPosition, levelCorrectionQuaternion } from "../src/level-correction";
import { cameraInSourceSpace } from "../src/level-rotation";

const correction = { pitch: 16, roll: -24 };

test("level correction moves the panorama and its anchors together across the seam and near the poles", () => {
  const rotation = new Quaternion(...levelCorrectionQuaternion(correction.pitch, correction.roll));
  for (const point of [{ yaw: 179, pitch: 7 }, { yaw: -179, pitch: -70 }, { yaw: 12, pitch: 89 }, { yaw: -120, pitch: -90 }]) {
    const local = panoPositionToVector3(point);
    const corrected = toLeveledPanoPosition(point, correction);
    assert.ok(panoPositionToVector3(corrected).distanceTo(local.clone().applyQuaternion(rotation)) < 1e-8);
    assert.ok(panoPositionToVector3(toSourcePanoPosition(corrected, correction)).distanceTo(local) < 1e-8);
  }
  assert.deepEqual(toLeveledPanoPosition({ yaw: 10, pitch: 20 }), { yaw: 10, pitch: 20 });
  assert.ok(toLeveledPanoPosition({ yaw: 0, pitch: 0 }, { pitch: 10 }).pitch > 0);
  assert.ok(toLeveledPanoPosition({ yaw: 45, pitch: 0 }, { roll: 10 }).pitch < 0);
});

test("tile selection projects image-local points the same way as the display camera", () => {
  const rotation = new Quaternion(...levelCorrectionQuaternion(correction.pitch, correction.roll));
  const rig = new Group();
  rig.position.set(0.2, 0.1, -0.2);
  rig.rotateY(0.4);
  const display = new PerspectiveCamera(65, 1.8, 0.1, 100);
  display.rotateX(0.2);
  display.setViewOffset(900, 500, 140, 10, 640, 450);
  rig.add(display);
  rig.updateMatrixWorld(true);
  const local = cameraInSourceSpace(display, rotation.clone().invert(), new PerspectiveCamera());
  local.updateMatrixWorld(true);
  const anchor = new Vector3(3, 1, -10);
  const rendered = anchor.clone().applyQuaternion(rotation).project(display);
  assert.ok(anchor.project(local).distanceTo(rendered) < 1e-8);
});

test("calibration is optional and validated per scene, then propagated by project loading", async () => {
  const source = { viewerConfig: {
    type: "sphereTile",
    multires: { tileSize: 256, levels: [{ width: 512, height: 256 }] },
    urlTemplate: "tiles/%l/%h_%v.webp",
    previewUrl: "preview.webp",
    indexBase: 0,
  } };
  const document = (calibration: object) => ({
    schemaVersion: 1,
    scenes: [{ id: "a", source, ...calibration }, { id: "b", source }],
  });
  const parsed = parsePanoProject(document({ northYaw: 181.5, levelCorrection: correction }));
  assert.equal(parsed.scenes[0]!.northYaw, -178.5);
  assert.deepEqual(parsed.scenes[0]!.levelCorrection, correction);
  assert.equal(parsed.scenes[1]!.northYaw, undefined);
  assert.equal(parsed.scenes[1]!.levelCorrection, undefined);
  const loaded = await loadPanoProject(parsed, { baseUrl: "https://example.test/tour/" });
  assert.equal(loaded.scenes[0]!.scene.northYaw, -178.5);
  assert.deepEqual(loaded.scenes[0]!.scene.levelCorrection, correction);
  assert.throws(() => parsePanoProject(document({ northYaw: Infinity })), /scenes\[0\]\.northYaw/);
  assert.throws(() => parsePanoProject(document({ levelCorrection: { pitch: 91 } })), /scenes\[0\]\.levelCorrection\.pitch/);
  assert.throws(() => parsePanoProject(document({ levelCorrection: { roll: "1" } })), /scenes\[0\]\.levelCorrection\.roll/);
});
