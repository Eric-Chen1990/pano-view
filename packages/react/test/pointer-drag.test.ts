import assert from "node:assert/strict";
import { test } from "node:test";
import { Euler, MathUtils, PerspectiveCamera, Vector3 } from "three";
import { PointerDragAnchor, createPointerDrag, pointerReleaseVelocity } from "../src/pointer-drag";
import { applyLimitedYawDelta } from "../src/view-limits";
import type { PanoramaViewRuntimeHandle } from "../src/panorama-view-runtime";
import type { PanoViewerState } from "../src/types";

function cameraFor(view: PanoViewerState, width: number, height: number) {
  const camera = new PerspectiveCamera(view.fov, width / height, 0.1, 1000);
  camera.quaternion.setFromEuler(new Euler(MathUtils.degToRad(view.pitch), MathUtils.degToRad(-view.yaw), 0, "YXZ"));
  camera.updateMatrixWorld();
  return camera;
}

for (const [width, height] of [[1600, 900], [600, 900], [800, 800]]) {
  for (const fov of [30, 75, 100]) {
    test(`grab point tracks pointer and returns without drift at ${width}x${height}, FOV ${fov}`, () => {
      for (const yaw of [0, 179, -179]) {
        const view = { yaw, pitch: 20, fov };
        const rect = { left: 41, top: 83, width: width!, height: height! };
        const camera = cameraFor(view, width!, height!);
        const start = { x: rect.left + width! * 0.4, y: rect.top + height! * 0.35 };
        const anchor = new PointerDragAnchor(start, view, rect, camera);
        const world = new Vector3(-0.2, 0.3, 0.5).unproject(camera).normalize().multiplyScalar(100);
        for (const [dx, dy] of [[80, 0], [0, 70], [80, 70], [-70, -50], [0, 0]]) {
          const point = { x: start.x + dx!, y: start.y + dy! };
          const delta = anchor.solve(point);
          const next = cameraFor({ ...view, yaw: view.yaw + delta.yaw, pitch: view.pitch + delta.pitch }, width!, height!);
          const projected = world.clone().project(next);
          const error = Math.hypot(rect.left + (projected.x + 1) * width! / 2 - point.x, rect.top + (1 - projected.y) * height! / 2 - point.y);
          assert.ok(error < 1e-6, `projection error: ${error}px`);
        }
      }
    });
  }
}

test("speed, invert, invalid values and pole inputs remain deterministic", () => {
  const view = { yaw: 0, pitch: 0, fov: 75 };
  const anchor = new PointerDragAnchor({ x: 800, y: 450 }, view, { left: 0, top: 0, width: 1600, height: 900 }, cameraFor(view, 1600, 900));
  assert.deepEqual(anchor.solve({ x: 900, y: 450 }, 0), { yaw: 0, pitch: 0 });
  assert.deepEqual(anchor.solve({ x: 900, y: 450 }, 0.7), anchor.solve({ x: 1000, y: 450 }));
  assert.deepEqual(anchor.solve({ x: 900, y: 450 }, 0.35, true), anchor.solve({ x: 700, y: 450 }));
  assert.deepEqual(anchor.solve({ x: 900, y: 450 }, NaN), anchor.solve({ x: 900, y: 450 }));
  for (const pitch of [-90, -89, 89, 90]) {
    const pose = { ...view, pitch };
    const polar = new PointerDragAnchor({ x: 800, y: 450 }, pose, { left: 0, top: 0, width: 1600, height: 900 }, cameraFor(pose, 1600, 900));
    const delta = polar.solve({ x: 10000, y: -10000 });
    assert.ok(Number.isFinite(delta.yaw) && Number.isFinite(delta.pitch));
    assert.ok(Math.abs(pitch + delta.pitch) <= 90);
  }
});

test("controller keeps its original anchor across clipping and rebases after projection changes", () => {
  let view = { yaw: 0, pitch: 0, fov: 75 };
  let revision = 0;
  const camera = cameraFor(view, 1600, 900);
  const rect = { left: 0, top: 0, width: 1600, height: 900 };
  const element = { getBoundingClientRect: () => rect } as HTMLCanvasElement;
  const handle = {
    getView: () => view,
    getPointerDragState: () => ({ revision, anchored: true }),
    isInteractionLocked: () => false,
    applyViewDelta: (delta, options) => {
      assert.ok(options?.pointerOrigin);
      const origin = options!.pointerOrigin!;
      view = { ...view, yaw: applyLimitedYawDelta(origin.yaw, delta.yaw!, { min: -5, max: 5 }), pitch: MathUtils.clamp(origin.pitch + delta.pitch!, -10, 10) };
    },
  } satisfies Partial<PanoramaViewRuntimeHandle>;
  const drag = createPointerDrag(camera, element, () => handle as PanoramaViewRuntimeHandle, "touch");
  const start = { x: 800, y: 450 };
  drag.start(start);
  drag.move({ x: 1100, y: 750 }, start, 0.35, false);
  drag.flush();
  assert.equal(Math.abs(view.yaw), 5);
  assert.equal(Math.abs(view.pitch), 10);
  drag.move(start, { x: 1100, y: 750 }, 0.35, false);
  drag.flush(1 / 60, true);
  assert.deepEqual(view, { yaw: 0, pitch: 0, fov: 75 });
  camera.fov = 50; camera.updateProjectionMatrix();
  drag.move(start, start, 0.35, false);
  drag.flush(1 / 60, true);
  assert.ok(Math.abs(view.yaw) < 1e-9 && Math.abs(view.pitch) < 1e-9);
  revision++;
  assert.equal(drag.valid(), false);
  drag.start(start);
  assert.equal(drag.valid(), true);
  drag.clear();
  assert.equal(drag.valid(), false);
});

test("frame batching smooths the latest input without overwriting flick samples", () => {
  const view = { yaw: 0, pitch: 0, fov: 75 };
  const camera = cameraFor(view, 1600, 900);
  const rect = { left: 0, top: 0, width: 1600, height: 900 };
  let calls = 0;
  let sampled = false;
  let lastError = Infinity;
  const handle = {
    getView: () => view,
    getPointerDragState: () => ({ revision: 1, anchored: true }),
    isInteractionLocked: () => false,
    applyViewDelta: (delta, options) => {
      calls++;
      sampled = options?.recordVelocity === true;
      const next = cameraFor({ ...view, yaw: delta.yaw!, pitch: delta.pitch! }, 1600, 900);
      const point = new Vector3(0, 0, -100).project(next);
      const error = Math.hypot((point.x + 1) * 800 - 950, (1 - point.y) * 450 - 500);
      assert.ok(error > 0 && error < lastError, `following gap must decrease: ${error}px`);
      lastError = error;
    },
  } satisfies Partial<PanoramaViewRuntimeHandle>;
  const drag = createPointerDrag(camera, { getBoundingClientRect: () => rect } as HTMLCanvasElement, () => handle as PanoramaViewRuntimeHandle, "mouse");
  const start = { x: 800, y: 450 };
  drag.start(start);
  drag.move({ x: 900, y: 450 }, start, 0.35, false);
  drag.move({ x: 950, y: 500 }, { x: 900, y: 450 }, 0.35, false);
  assert.equal(calls, 0);
  drag.flush(1 / 120);
  assert.equal(calls, 1);
  assert.equal(sampled, true);
  drag.flush(1 / 120);
  assert.equal(sampled, false, "settling must preserve flick velocity and its timestamp");
  drag.clear();
  drag.flush();
  assert.equal(calls, 2);
});

test("fast dragging has a short, consistent following delay across refresh rates", () => {
  for (const fps of [30, 60, 120, 144]) {
    const view = { yaw: 0, pitch: 0, fov: 75 };
    const camera = cameraFor(view, 1600, 900);
    const rect = { left: 0, top: 0, width: 1600, height: 900 };
    let renderedX = 800;
    const handle = {
      getView: () => view,
      getPointerDragState: () => ({ revision: 1, anchored: true }),
      isInteractionLocked: () => false,
      applyViewDelta: (delta) => {
        const next = cameraFor({ ...view, yaw: delta.yaw!, pitch: delta.pitch! }, 1600, 900);
        renderedX = (new Vector3(0, 0, -100).project(next).x + 1) * 800;
      },
    } satisfies Partial<PanoramaViewRuntimeHandle>;
    const drag = createPointerDrag(camera, { getBoundingClientRect: () => rect } as HTMLCanvasElement, () => handle as PanoramaViewRuntimeHandle, "mouse");
    let previous = { x: 800, y: 450 };
    drag.start(previous);
    const speed = 1500;
    for (let frame = 1; frame <= fps; frame++) {
      const point = { x: 800 + speed * frame / fps, y: 450 };
      drag.move(point, previous, 0.35, false);
      drag.flush(1 / fps);
      previous = point;
    }
    const delayMs = (previous.x - renderedX) / speed * 1000;
    assert.ok(delayMs >= 8 && delayMs <= 12, `${fps}Hz following delay: ${delayMs}ms`);
    // Stopping converges to the original world anchor, without accumulating drift.
    for (let frame = 0; frame < fps; frame++) drag.flush(1 / fps);
    assert.ok(Math.abs(previous.x - renderedX) < 0.01);
  }
});

test("projection rebasing preserves the pending drag until it settles", () => {
  let view = { yaw: 0, pitch: 0, fov: 75 };
  const camera = cameraFor(view, 1600, 900);
  const rect = { left: 0, top: 0, width: 1600, height: 900 };
  const handle = {
    getView: () => view,
    getPointerDragState: () => ({ revision: 1, anchored: true }),
    isInteractionLocked: () => false,
    applyViewDelta: (delta, options) => {
      const origin = options!.pointerOrigin!;
      view = { ...view, yaw: origin.yaw + delta.yaw!, pitch: origin.pitch + delta.pitch! };
    },
  } satisfies Partial<PanoramaViewRuntimeHandle>;
  const drag = createPointerDrag(camera, { getBoundingClientRect: () => rect } as HTMLCanvasElement, () => handle as PanoramaViewRuntimeHandle, "touch");
  const start = { x: 800, y: 450 };
  drag.start(start);
  view.fov = 50;
  camera.fov = 50;
  camera.updateProjectionMatrix();
  drag.move({ x: 1000, y: 500 }, start, 0.35, false);
  for (let frame = 0; frame < 20; frame++) drag.flush(1 / 60);
  const point = new Vector3(0, 0, -100).project(cameraFor(view, 1600, 900));
  const error = Math.hypot((point.x + 1) * 800 - 1000, (1 - point.y) * 450 - 500);
  assert.ok(error < 0.01, `rebased drag must finish following: ${error}px`);
});

test("release velocity follows recent pointer motion and drops an earlier flick after a pause", () => {
  const solve = (point: { x: number; y: number }) => ({ yaw: -point.x, pitch: point.y / 2 });
  const paused = pointerReleaseVelocity(
    [{ x: 0, y: 0, at: 0 }, { x: 80, y: 40, at: 20 }],
    200,
    solve,
  );
  assert.deepEqual(paused, { yaw: 0, pitch: 0 });

  const flick = pointerReleaseVelocity(
    [{ x: 0, y: 0, at: 1000 }, { x: 80, y: 40, at: 1050 }],
    1060,
    solve,
  );
  assert.ok(Math.abs(flick.yaw - (-80 / 0.05)) < 1e-6);
  assert.ok(Math.abs(flick.pitch - (20 / 0.05)) < 1e-6);

  const later = pointerReleaseVelocity(
    [
      { x: 0, y: 0, at: 0 },
      { x: 400, y: 0, at: 30 },
      { x: 400, y: 0, at: 800 },
      { x: 430, y: 0, at: 830 },
    ],
    840,
    solve,
  );
  assert.ok(Math.abs(later.yaw - (-30 / 0.03)) < 1e-6, `earlier flick leaked: ${later.yaw}`);
});

test("consecutive drags each finish on the pointer", () => {
  let view = { yaw: 0, pitch: 0, fov: 75 };
  const rect = { left: 0, top: 0, width: 1600, height: 900 };
  const camera = cameraFor(view, 1600, 900);
  let velocity = { yaw: Number.NaN, pitch: Number.NaN };
  const handle = {
    getView: () => view,
    getPointerDragState: () => ({ revision: 1, anchored: true }),
    isInteractionLocked: () => false,
    applyViewDelta: (delta: { yaw?: number; pitch?: number }, options?: { pointerOrigin?: { yaw: number; pitch: number }; velocity?: { yaw: number; pitch: number } }) => {
      if (options?.pointerOrigin && delta.yaw !== undefined && delta.pitch !== undefined) {
        view = { ...view, yaw: options.pointerOrigin.yaw + delta.yaw, pitch: options.pointerOrigin.pitch + delta.pitch };
      }
      if (options?.velocity) velocity = options.velocity;
    },
  } satisfies Partial<PanoramaViewRuntimeHandle>;
  const drag = createPointerDrag(camera, { getBoundingClientRect: () => rect } as HTMLCanvasElement, () => handle as PanoramaViewRuntimeHandle, "mouse");
  const strokes = [
    [{ x: 640, y: 360 }, { x: 980, y: 560 }],
    [{ x: 980, y: 560 }, { x: 700, y: 300 }],
    [{ x: 700, y: 300 }, { x: 1120, y: 640 }],
  ];
  for (const [start, end] of strokes) {
    const grabbed = new Vector3(
      (start!.x / rect.width) * 2 - 1,
      1 - (start!.y / rect.height) * 2,
      0.5,
    ).unproject(cameraFor(view, rect.width, rect.height)).normalize().multiplyScalar(100);
    const at = performance.now();
    drag.start(start!, at);
    drag.move(end!, start!, 0.35, false, at + 40);
    drag.release();
    const projected = grabbed.project(cameraFor(view, rect.width, rect.height));
    const error = Math.hypot((projected.x + 1) * rect.width / 2 - end!.x, (1 - projected.y) * rect.height / 2 - end!.y);
    assert.ok(error < 0.01, `released drag must reach the pointer: ${error}px`);
  }
  assert.ok(Number.isFinite(velocity.yaw) && velocity.yaw !== 0);
});
