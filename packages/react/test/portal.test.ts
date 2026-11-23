import assert from "node:assert/strict";
import { test } from "node:test";
import { Object3D, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { parsePanoProject, resolveProjectHotspotAssets } from "../src/data";
import { portalFrameGeometry } from "../src/hotspot/portal-geometry";
import { matchesPortalSelection } from "../src/hotspot/portal-host";
import { portalCameraRotation, portalReadyForZoomEntry, portalTargetSize, portalViewRotation, projectPortal, setPortalCameraProjection } from "../src/hotspot/portal-projection";

test("a stationary aperture samples a different sightline as the viewer pans", () => {
  const door = { yaw: 179, pitch: 0 };
  const target = { yaw: 35, pitch: -15 };
  const centered = portalViewRotation(door, new Quaternion());
  const turned = portalViewRotation({ yaw: -171, pitch: 0 }, new Quaternion());
  const world = new Vector3(0, 0, -1).applyQuaternion(centered);
  const sample = (source: Quaternion) => world.clone().applyQuaternion(source.clone().invert())
    .applyQuaternion(portalCameraRotation(source, door, target, new Quaternion()));
  const arrival = new Vector3(0, 0, -1).applyQuaternion(portalViewRotation(target, new Quaternion()));

  assert.ok(sample(centered).distanceTo(arrival) < 1e-9);
  assert.ok(Math.abs(sample(centered).angleTo(sample(turned)) - 6.5 * Math.PI / 180) < 1e-8);
});

test("source zoom enlarges the aperture without magnifying destination landmarks", () => {
  const viewport = { width: 800, height: 500 };
  const source = new PerspectiveCamera(75, viewport.width / viewport.height, 0.1, 100);
  const destination = new PerspectiveCamera();
  const door = new Object3D();
  door.position.set(0.3, 0, -3);
  const landmarks = [new Vector3(0, 0, -4), new Vector3(0.25, 0, -4)];
  const sample = (fov: number) => {
    source.fov = fov;
    source.updateProjectionMatrix();
    const { bounds } = projectPortal(door, source)!;
    destination.copy(source);
    setPortalCameraProjection(destination, 60, viewport, bounds);
    const pixels = landmarks.map(point => bounds.x + (point.clone().project(destination).x + 1) / 2 * bounds.width);
    setPortalCameraProjection(destination, 60, viewport);
    for (const [i, point] of landmarks.entries()) {
      assert.ok(Math.abs(pixels[i]! - (point.clone().project(destination).x + 1) / 2) < 1e-9);
    }
    return { width: bounds.width, pixels };
  };

  const wide = sample(75);
  const zoomed = sample(40);
  assert.ok(zoomed.width > wide.width);
  assert.ok(Math.abs(zoomed.pixels[1]! - wide.pixels[1]!) < 1e-9);
});

test("projection clips a rotated door to screen and bounds the preview buffer", () => {
  const camera = new PerspectiveCamera(65, 1.75, 0.1, 100);
  const mesh = new Object3D();
  mesh.position.set(5, 0, -5);
  mesh.scale.set(3, 3, 1);
  mesh.rotation.z = 0.25;
  const door = projectPortal(mesh, camera);
  assert.ok(door);
  assert.ok(door.bounds.x >= 0 && door.bounds.x + door.bounds.width <= 1);
  assert.ok(door.area < door.bounds.width * door.bounds.height);
  const [width, height] = portalTargetSize(1800, 1000, 512 * 512);
  assert.ok(width * height <= 512 * 512);
  mesh.position.z = 5;
  assert.equal(projectPortal(mesh, camera), null);
});

test("zoom entry needs a close door with the camera aimed at its center", () => {
  const camera = new PerspectiveCamera(75, 1.8, 0.1, 100);
  const door = new Object3D();
  door.position.z = -3;
  door.scale.set(1, 1.5, 1);
  assert.equal(portalReadyForZoomEntry(projectPortal(door, camera)!), false);
  camera.fov = 30;
  camera.updateProjectionMatrix();
  assert.equal(portalReadyForZoomEntry(projectPortal(door, camera)!), true);
  door.position.x = 0.35;
  assert.equal(portalReadyForZoomEntry(projectPortal(door, camera)!), false);
});

test("portal borders join at the corners and rounded apertures project their actual outline", () => {
  const rectangle = portalFrameGeometry("rectangle", 14, 24, 0.04);
  assert.equal(rectangle.frame.index!.count, 24);
  rectangle.frame.computeBoundingBox();
  assert.equal(rectangle.frame.boundingBox!.min.x, -0.5);
  assert.equal(rectangle.frame.boundingBox!.max.y, 0.5);
  const ellipse = portalFrameGeometry("ellipse", 14, 24, 0.04);
  const mesh = new Object3D();
  mesh.position.z = -4;
  const camera = new PerspectiveCamera(70, 1.5, 0.1, 100);
  const projected = projectPortal(mesh, camera, ellipse.inner)!;
  const boundedArea = projected.bounds.width * projected.bounds.height;
  assert.equal(projected.corners.length, 64);
  assert.ok(Math.abs(projected.area / boundedArea - Math.PI / 4) < 0.002);
});

test("only matching, fresh selection can start a portal navigation", () => {
  const request = { sourceId: "a", targetId: "b", hotspotId: "door", requestedAt: 100 };
  assert.equal(matchesPortalSelection(request, "a", "b", 1099), true);
  assert.equal(matchesPortalSelection(request, "a", "b", 1100), false);
  assert.equal(matchesPortalSelection(request, "other", "b", 101), false);
  assert.equal(matchesPortalSelection(request, "a", "other", 101), false);
});

test("project portal uses a scene action and rejects invalid destinations on export", () => {
  const source = { viewerUrl: "viewer.json" };
  const door = { type: "portal", id: "door", position: { yaw: 12, pitch: 5 }, width: 10, height: 16,
    shape: "ellipse", enterOnZoom: true, frame: { src: "door.webp", color: "#ffaa99", thickness: 0.06 } };
  const project = (sceneId?: string) => ({
    schemaVersion: 1,
    scenes: [
      { id: "a", source, hotspots: [{ ...door, events: sceneId ? { click: { type: "scene", sceneId } } : undefined }] },
      { id: "b", source },
    ],
  });
  const parsed = parsePanoProject(project("b"));
  const parsedDoor = parsed.scenes[0]!.hotspots![0]!;
  assert.ok(parsedDoor.type === "portal" && parsedDoor.enterOnZoom);
  assert.deepEqual(parsePanoProject(JSON.parse(JSON.stringify(parsed))), parsed);
  const withOldGlow = project("b");
  Object.assign(withOldGlow.scenes[0]!.hotspots![0]!.frame, { glow: { color: "#ffc37b" } });
  assert.deepEqual(parsePanoProject(withOldGlow), parsed);
  const resolved = resolveProjectHotspotAssets(parsed.scenes[0]!.hotspots![0]!, "https://example.com/rooms/", "a");
  assert.equal(resolved.type === "portal" && resolved.frame?.src, "https://example.com/rooms/door.webp");
  assert.equal(parsePanoProject(project(), { draft: true }).scenes[0]!.hotspots![0]!.type, "portal");
  assert.throws(() => parsePanoProject(project()), /requires a target scene/);
  assert.throws(() => parsePanoProject(project("a")), /different scene/);
  assert.throws(() => parsePanoProject(project("missing")), /scene does not exist/);
});

test("a portal's optional arrival view survives project parsing and asset resolution", () => {
  const source = { viewerUrl: "viewer.json" };
  const arrivalView = { yaw: -42, pitch: 12, fov: 56 };
  const door = {
    type: "portal", id: "door", position: { yaw: 20, pitch: 0 }, arrivalView,
    events: { click: { type: "scene", sceneId: "hall" } },
  };
  const project = (view: unknown) => ({
    schemaVersion: 1,
    scenes: [
      { id: "lobby", source, hotspots: [{ ...door, arrivalView: view }] },
      { id: "hall", source, initialView: { yaw: 10, pitch: 0, fov: 75 } },
    ],
  });
  const parsed = parsePanoProject(project(arrivalView));
  const hotspot = parsed.scenes[0]!.hotspots![0]!;
  assert.ok(hotspot.type === "portal");
  assert.deepEqual(hotspot.arrivalView, arrivalView);
  assert.deepEqual(parsePanoProject(JSON.parse(JSON.stringify(parsed))), parsed);
  const resolved = resolveProjectHotspotAssets(hotspot, "https://example.com/", "lobby");
  assert.deepEqual(resolved.type === "portal" && resolved.arrivalView, arrivalView);
  assert.equal(parsed.scenes[1]!.initialView?.yaw, 10);
  assert.throws(() => parsePanoProject(project({ ...arrivalView, pitch: 91 })), /arrivalView.pitch/);
  assert.throws(() => parsePanoProject(project({ ...arrivalView, fov: 180 })), /arrivalView.fov/);
  assert.throws(() => parsePanoProject(project({ yaw: 0 })), /arrivalView.pitch/);
});
