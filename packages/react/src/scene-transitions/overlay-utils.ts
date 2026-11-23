import type { Camera, Texture, Vector2 } from "three";
import { PerspectiveCamera, PlaneGeometry } from "three";
import type { TransitionDefinition } from "./presets";

export const OVERLAY_RENDER_ORDER = 10_000;

export const FULLSCREEN_PLANE = new PlaneGeometry(1, 1);

export type Snapshot = {
  texture: Texture;
  eyeTextures?: readonly [Texture, Texture];
  dispose: () => void;
};

export type OverlayProps = {
  snapshot: Snapshot;
  transition: TransitionDefinition;
  running: boolean;
  runId: number;
  onFinish: () => void;
};

type SnapshotSize = { width: number; height: number };

export function fitSnapshotSizes(sizes: readonly SnapshotSize[], maxPixels: number): SnapshotSize[] {
  const area = ({ width, height }: SnapshotSize) => width * height;
  const totalPixels = sizes.reduce((total, size) => total + area(size), 0);
  const budget = Math.max(sizes.length, maxPixels);
  const scale = Math.min(1, Math.sqrt(budget / totalPixels));
  const fit = (scale: number) => sizes.map(({ width, height }) => ({
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  }));
  const fitted = fit(scale);
  if (fitted.reduce((total, size) => total + area(size), 0) <= budget) return fitted;

  // A dimension clamped to one pixel can put a very narrow view over budget.
  let low = 0;
  let high = scale;
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2;
    if (fit(middle).reduce((total, size) => total + area(size), 0) <= budget) low = middle;
    else high = middle;
  }
  return fit(low);
}

export function isPerspectiveCamera(camera: Camera): camera is PerspectiveCamera {
  return (camera as PerspectiveCamera).isPerspectiveCamera === true;
}

/** Clip-space overlays pick the matching eye texture while WebGL renders each view. */
export function bindSnapshotEyeTexture(
  snapshot: Snapshot,
  camera: Camera,
  rightEye: Camera | undefined,
  map: { value: Texture },
  resolution?: { value: Vector2 },
  distance?: { value: number },
): void {
  const source = snapshot.eyeTextures && rightEye && camera === rightEye
    ? snapshot.eyeTextures[1]!
    : snapshot.texture;
  map.value = source;
  if (resolution) {
    const size = source.image as { width: number; height: number };
    resolution.value.set(size.width, size.height);
  }
  if (distance && isPerspectiveCamera(camera)) {
    distance.value = Math.max(camera.near * 1.1, 0.11);
  }
}

export function overlayProgress(
  elapsedTime: number,
  duration: number,
  startTime: number | null,
): { startTime: number; progress: number } {
  const started = startTime ?? elapsedTime;
  const progress = duration === 0 ? 1 : Math.min(1, (elapsedTime - started) / duration);
  return { startTime: started, progress };
}
