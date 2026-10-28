import { Euler, MathUtils, PerspectiveCamera, Vector3 } from "three";
import type { Camera } from "three";
import {
  POINTER_VELOCITY_MAX_AGE_MS,
  type PanoramaViewRuntimeHandle,
} from "./panorama-view-runtime";
import type { PanoViewerState } from "./types";
import { normalizeViewYaw } from "./view-limits";

export const DEFAULT_POINTER_DRAG_SPEED = 0.35;
const POINTER_FOLLOW_TIME_SECONDS = 0.01;
const MIN_VELOCITY_SAMPLE_SECONDS = 1 / 120;
type Point = { x: number; y: number };
type TimedPoint = Point & { at: number };
type Rect = { left: number; top: number; width: number; height: number };
type ReleaseVelocity = { yaw: number; pitch: number };

/** Recent pointer motion, in degrees per second. A pause before release is zero. */
export function pointerReleaseVelocity(
  samples: readonly TimedPoint[],
  releasedAt: number,
  solve: (point: Point) => { yaw: number; pitch: number },
  maxAgeMs = POINTER_VELOCITY_MAX_AGE_MS,
): ReleaseVelocity {
  if (samples.length < 2) return { yaw: 0, pitch: 0 };
  const newest = samples[samples.length - 1]!;
  if (releasedAt < newest.at || releasedAt - newest.at > maxAgeMs) return { yaw: 0, pitch: 0 };
  let oldest = newest;
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const sample = samples[index]!;
    if (releasedAt - sample.at <= maxAgeMs) oldest = sample;
    else break;
  }
  if (oldest === newest) return { yaw: 0, pitch: 0 };
  const elapsed = Math.max((newest.at - oldest.at) / 1000, MIN_VELOCITY_SAMPLE_SECONDS);
  const from = solve(oldest);
  const to = solve(newest);
  return {
    yaw: normalizeViewYaw(to.yaw - from.yaw) / elapsed,
    pitch: (to.pitch - from.pitch) / elapsed,
  };
}

/** A fixed world ray, rather than accumulated rotations, makes paths reversible. */
export class PointerDragAnchor {
  private readonly anchor: Vector3;
  private readonly local = new Vector3();
  private readonly rotation = new Euler(0, 0, 0, "YXZ");

  constructor(
    readonly start: Point,
    readonly origin: PanoViewerState,
    readonly rect: Rect,
    private readonly projection: PerspectiveCamera,
  ) {
    this.anchor = this.ray(start).clone().applyEuler(this.rotation.set(
      MathUtils.degToRad(origin.pitch), MathUtils.degToRad(-origin.yaw), 0, "YXZ",
    ));
  }

  private ray(point: Point): Vector3 {
    return this.local.set(
      (point.x - this.rect.left) / Math.max(this.rect.width, 1) * 2 - 1,
      1 - (point.y - this.rect.top) / Math.max(this.rect.height, 1) * 2,
      0.5,
    ).applyMatrix4(this.projection.projectionMatrixInverse).normalize();
  }

  solve(point: Point, speed = DEFAULT_POINTER_DRAG_SPEED, invert = false): { yaw: number; pitch: number } {
    const multiplier = (Number.isFinite(speed) && speed >= 0 ? speed : DEFAULT_POINTER_DRAG_SPEED) /
      DEFAULT_POINTER_DRAG_SPEED * (invert ? -1 : 1);
    if (multiplier === 0) return { yaw: 0, pitch: 0 };
    const ray = this.ray({
      x: this.start.x + (point.x - this.start.x) * multiplier,
      y: this.start.y + (point.y - this.start.y) * multiplier,
    });
    const latitude = Math.asin(MathUtils.clamp(this.anchor.y / Math.max(Math.hypot(ray.y, ray.z), 1e-12), -1, 1));
    const offset = Math.atan2(ray.y, -ray.z);
    const originPitch = MathUtils.degToRad(this.origin.pitch);
    // Both solutions are valid near the poles. Select the branch of the initial pose.
    const candidates = [latitude - offset, Math.PI - latitude - offset, -Math.PI - latitude - offset];
    let pitch = candidates[0]!;
    let distance = Infinity;
    for (const candidate of candidates) {
      const bounded = MathUtils.clamp(candidate, -Math.PI / 2, Math.PI / 2);
      const nextDistance = Math.abs(candidate - bounded) * 10 + Math.abs(bounded - originPitch);
      if (nextDistance < distance) { pitch = bounded; distance = nextDistance; }
    }
    const z = Math.sin(pitch) * ray.y + Math.cos(pitch) * ray.z;
    const yaw = MathUtils.radToDeg(Math.atan2(this.anchor.x, -this.anchor.z) - Math.atan2(ray.x, -z));
    return { yaw: normalizeViewYaw(yaw - this.origin.yaw), pitch: MathUtils.radToDeg(pitch) - this.origin.pitch };
  }
}

/** Shared mouse / single-touch lifecycle; gyro retains its relative offset input. */
export function createPointerDrag(
  camera: Camera,
  element: HTMLCanvasElement,
  runtime: () => PanoramaViewRuntimeHandle | null,
  source: "mouse" | "touch",
) {
  let anchor: PointerDragAnchor | undefined;
  let revision = -1;
  let projectionKey = "";
  let pending: { point: Point; previous: Point; speed: number; invert: boolean } | undefined;
  let displayed: Point | undefined;
  let lastPoint: Point | undefined;
  let fresh = false;
  let lastFrameDelta = 1 / 60;
  let samples: TimedPoint[] = [];
  let gestureSpeed = DEFAULT_POINTER_DRAG_SPEED;
  let gestureInvert = false;
  const key = (rect: Rect) => `${rect.left},${rect.top},${rect.width},${rect.height},${camera.projectionMatrix.elements.join(",")}`;
  const place = (point: Point) => {
    const handle = runtime();
    displayed = { ...point };
    lastPoint = { ...point };
    pending = undefined;
    revision = handle?.getPointerDragState().revision ?? -1;
    anchor = undefined;
    if (!(camera instanceof PerspectiveCamera) || !handle?.getPointerDragState().anchored) return;
    const rect = element.getBoundingClientRect();
    projectionKey = key(rect);
    anchor = new PointerDragAnchor(point, handle.getView(), rect, camera.clone());
  };
  const remember = (point: Point, at: number) => {
    samples.push({ x: point.x, y: point.y, at });
    const cutoff = at - POINTER_VELOCITY_MAX_AGE_MS;
    while (samples.length > 2 && samples[0]!.at < cutoff) samples.shift();
  };
  const apply = (
    point: Point,
    previous: Point,
    speed: number,
    invert: boolean,
    recordVelocity: boolean,
    releaseVelocity?: ReleaseVelocity,
  ) => {
    const handle = runtime();
    if (!handle) return;
    const rect = element.getBoundingClientRect();
    if (anchor && key(rect) !== projectionKey) {
      const queued = pending;
      place(displayed ?? previous);
      pending = queued;
    }
    const options = {
      recordVelocity: releaseVelocity ? false : recordVelocity,
      source,
      ...(releaseVelocity ? { velocity: releaseVelocity } : {}),
    };
    if (anchor) {
      handle.applyViewDelta(anchor.solve(point, speed, invert), {
        ...options,
        pointerOrigin: anchor.origin,
      });
    } else {
      handle.applyViewDelta({
        yaw: -(point.x - previous.x) * 360 * speed / Math.max(rect.width, 1) * (invert ? -1 : 1),
        pitch: (point.y - previous.y) * 180 * speed / Math.max(rect.height, 1) * (invert ? -1 : 1),
      }, options);
    }
  };
  const valid = () => revision === (runtime()?.getPointerDragState().revision ?? -1) && !runtime()?.isInteractionLocked();
  const clear = () => {
    anchor = undefined;
    revision = -1;
    pending = undefined;
    displayed = undefined;
    samples = [];
  };
  return {
    start(point: Point, at = performance.now()) {
      gestureSpeed = DEFAULT_POINTER_DRAG_SPEED;
      gestureInvert = false;
      samples = [];
      remember(point, at);
      place(point);
    },
    valid,
    clear,
    suspend: () => { anchor = undefined; pending = undefined; displayed = undefined; samples = []; },
    move(point: Point, previous: Point, speed: number, invert: boolean, at = performance.now()) {
      fresh = true;
      gestureSpeed = speed;
      gestureInvert = invert;
      remember(point, at);
      pending = { point, previous: lastPoint ?? previous, speed, invert };
    },
    flush(deltaSeconds = lastFrameDelta, immediate = false, releaseVelocity?: ReleaseVelocity) {
      if (deltaSeconds > 0) lastFrameDelta = deltaSeconds;
      if (!pending) return;
      const sample = pending;
      if (!anchor || immediate) {
        pending = undefined;
        apply(sample.point, sample.previous, sample.speed, sample.invert, fresh, releaseVelocity);
        fresh = false;
        lastPoint = sample.point;
        displayed = sample.point;
        return;
      }
      const dt = deltaSeconds > 0 ? deltaSeconds : lastFrameDelta;
      const previousDisplay = displayed ?? sample.previous;
      const dx = sample.point.x - previousDisplay.x;
      const dy = sample.point.y - previousDisplay.y;
      const distance = Math.hypot(dx, dy);
      // A time-based filter keeps steady-motion lag near 10ms across refresh rates.
      const ratio = distance > 0.01
        ? POINTER_FOLLOW_TIME_SECONDS / (POINTER_FOLLOW_TIME_SECONDS + dt)
        : 0;
      const point = { x: sample.point.x - dx * ratio, y: sample.point.y - dy * ratio };
      apply(point, sample.previous, sample.speed, sample.invert, fresh);
      fresh = false;
      lastPoint = sample.point;
      displayed = point;
      if (ratio === 0) pending = undefined;
    },
    release() {
      const handle = runtime();
      if (!handle || !valid()) {
        clear();
        return;
      }
      const newestAt = samples[samples.length - 1]?.at ?? 0;
      const velocity = pointerReleaseVelocity(samples, Math.max(performance.now(), newestAt), (point) => {
        if (anchor) return anchor.solve(point, gestureSpeed, gestureInvert);
        const origin = samples[0] ?? point;
        const rect = element.getBoundingClientRect();
        const sign = gestureInvert ? -1 : 1;
        return {
          yaw: -(point.x - origin.x) * 360 * gestureSpeed / Math.max(rect.width, 1) * sign,
          pitch: (point.y - origin.y) * 180 * gestureSpeed / Math.max(rect.height, 1) * sign,
        };
      });
      if (pending) this.flush(lastFrameDelta, true, velocity);
      else handle.applyViewDelta({}, { velocity, source });
      clear();
    },
  };
}
