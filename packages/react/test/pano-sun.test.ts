import assert from "node:assert/strict";
import test from "node:test";
import { Euler, MathUtils, Mesh, PerspectiveCamera, Raycaster, Vector2, Vector3, WebGPUCoordinateSystem } from "three";
import { panoPositionToVector3 } from "../src/hotspot/coordinates";
import { raycastPanoramaEventSurface } from "../src/panorama-event-surface";
import { projectSunFlare, resolveSun } from "../src/sun/sun-settings";

const position = { yaw: 0, pitch: 0 };

test("sun normalizes panorama coordinates and hides when the direction is invalid", () => {
  assert.deepEqual(resolveSun({ position: { yaw: 181, pitch: -10 } })?.position,
    { yaw: -179, pitch: -10 });
  assert.deepEqual(resolveSun({ position: { yaw: 120, pitch: 95 } })?.position,
    { yaw: 0, pitch: 90 });
  assert.equal(resolveSun({ position: { yaw: NaN, pitch: 0 } }), null);
  assert.equal(resolveSun({ position: { yaw: 0, pitch: Infinity } }), null);
});

test("glow and ray coverage can resize independently of the sun disc", () => {
  const natural = resolveSun({ position, angularSize: 0.55 })!;
  assert.ok(Math.abs(natural.glowAngularSize - 9.9) < 1e-12);
  assert.ok(Math.abs(natural.raysAngularSize - 7.15) < 1e-12);
  const large = resolveSun({ position, angularSize: 20 })!;
  assert.deepEqual([large.angularSize, large.glowAngularSize, large.raysAngularSize], [6, 42, 34]);
  const custom = resolveSun({ position, angularSize: 0.55, glowAngularSize: 80, raysAngularSize: 0.5 })!;
  assert.deepEqual([custom.angularSize, custom.glowAngularSize, custom.raysAngularSize], [0.55, 60, 1]);
});

test("sun layers can be turned off independently or together", () => {
  const overlay = resolveSun({ position, disc: 0, rays: 0, intensity: 0.5 })!;
  assert.deepEqual([overlay.disc, overlay.glow, overlay.rays, overlay.flare], [0, 0.275, 0, 0.11]);
  assert.equal(resolveSun({ position, disc: 0, glow: 0, rays: 0, flare: 0 }), null);
  assert.equal(resolveSun({ position, enabled: false }), null);
  assert.equal(resolveSun({ position, intensity: 0 }), null);
});

test("flare fades at the viewport edge and vanishes behind the camera", () => {
  const camera = new PerspectiveCamera(90, 1, 0.1, 2000);
  const projected = new Vector3();
  const fade = (yaw: number) => projectSunFlare(panoPositionToVector3({ yaw, pitch: 0 }, 998), camera, projected);
  assert.equal(fade(0), 1);
  const near = fade(40);
  const edge = fade(45);
  assert.ok(1 > near && near > edge && edge > 0);
  assert.equal(fade(50), 0);
  assert.equal(fade(110), 0);
  camera.fov = 50;
  camera.updateProjectionMatrix();
  assert.equal(fade(40), 0);
});

test("calibration registers fractional pointer positions along the panorama equator", () => {
  const camera = new PerspectiveCamera(30, 1218 / 550, 0.1, 2000);
  camera.coordinateSystem = WebGPUCoordinateSystem;
  camera.position.z = 0.01;
  camera.quaternion.setFromEuler(new Euler(0, MathUtils.degToRad(30), 0, "YXZ"));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2((653.809814453125 / 1218) * 2 - 1, 0), camera);
  const surface = new Mesh();
  surface.raycast = raycastPanoramaEventSurface;
  const hits = ray.intersectObject(surface);
  assert.equal(hits.length, 1);
  assert.ok(Math.abs(hits[0].point.length() - 999) < 1e-9);
});
