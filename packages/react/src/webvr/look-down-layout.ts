import { Euler, Vector3 } from "three";

export function lookDownThreshold(pitch: number, referencePitch: number, barPitch: number, visible: boolean) {
  const down = referencePitch - pitch;
  const reveal = Math.min(13, (referencePitch - barPitch) * 0.72);
  return down >= reveal - (visible ? Math.min(4, reveal / 2) : 0);
}

const LOOK_DOWN_SAMPLE_COUNT = 64;
const LOOK_DOWN_WINDOW = 0.22;
const LOOK_DOWN_MIN_PITCH_CHANGE = 10;

export function createLookDownGesture() {
  const pitches = new Float64Array(LOOK_DOWN_SAMPLE_COUNT);
  const times = new Float64Array(LOOK_DOWN_SAMPLE_COUNT);
  let next = 0;
  let count = 0;
  let time = 0;
  const reset = () => {
    next = 0;
    count = 0;
    time = 0;
  };

  return {
    reset,
    update(pitch: number, referencePitch: number, barPitch: number, delta: number) {
      if (!Number.isFinite(delta) || delta <= 0 || delta > 0.12) {
        reset();
        return false;
      }
      time += delta;
      // A new gesture starts above the same boundary used to hide the toolbar.
      if (!lookDownThreshold(pitch, referencePitch, barPitch, true)) {
        pitches[next] = pitch;
        times[next] = time;
        next = (next + 1) % LOOK_DOWN_SAMPLE_COUNT;
        count = Math.min(count + 1, LOOK_DOWN_SAMPLE_COUNT);
        return false;
      }
      if (!lookDownThreshold(pitch, referencePitch, barPitch, false)) return false;
      for (let back = 1; back <= count; back++) {
        const index = (next - back + LOOK_DOWN_SAMPLE_COUNT) % LOOK_DOWN_SAMPLE_COUNT;
        if (time - times[index]! > LOOK_DOWN_WINDOW) break;
        if (pitches[index]! - pitch >= LOOK_DOWN_MIN_PITCH_CHANGE) {
          reset();
          return true;
        }
      }
      return false;
    },
  };
}

export function lookDownPanelTransition(progress: number, show: boolean, delta: number, reducedMotion: boolean) {
  const step = Math.min(delta, 0.05) / 0.24;
  const next = reducedMotion ? Number(show) : Math.max(0, Math.min(1, progress + (show ? step : -step)));
  const opacity = next * next * (3 - 2 * next);
  return { progress: next, opacity, interactive: show && next === 1 };
}

export function vrEyeBounds(
  eyes: Iterable<{ projectionMatrix: { elements: readonly number[] } }>,
  distance: number,
) {
  let halfWidth = Infinity;
  let below = Infinity;
  for (const { projectionMatrix: { elements } } of eyes) {
    const [x, y, shiftX, shiftY] = [elements[0]!, elements[5]!, elements[8]!, elements[9]!];
    if (x <= 0 || y <= 0 || ![x, y, shiftX, shiftY].every(Number.isFinite)) continue;
    halfWidth = Math.min(halfWidth, distance * (0.8 - Math.abs(shiftX)) / x);
    below = Math.min(below, distance * (0.8 - shiftY) / y);
  }
  return Number.isFinite(halfWidth) && halfWidth > 0 && below > 0 ? { halfWidth, below } : null;
}

export const LOOK_DOWN_DISTANCE = 2;
const RAD = Math.PI / 180;

export function lookDownPanelDrop(below: number, gripMode: boolean) {
  return gripMode ? Math.min(0.28, below * 0.5) : Math.min(0.72, below * 0.77);
}

export function lookDownPanelSize(halfWidth: number, below: number, aspect: number, gripMode = false) {
  const drop = lookDownPanelDrop(below, gripMode);
  // Leave room below the controller panel for the WebXR input and exit strip.
  const halfHeight = Math.min(drop, below - drop, gripMode ? 0.25 : Infinity);
  const width = Math.min(1.64, halfWidth * 2, below * 1.8, 2 * halfHeight / aspect);
  return { width, height: width * aspect, drop };
}

export function captureLookDownPanelPose(
  position: Vector3,
  rotation: Euler,
  origin: Vector3,
  yaw: number,
  pitch: number,
  referencePitch: number,
  drop: number,
) {
  rotation.set(referencePitch * RAD, -yaw * RAD, 0, "YXZ");
  position.set(0, -drop, -LOOK_DOWN_DISTANCE).applyEuler(rotation).add(origin);
  rotation.set(pitch * RAD, -yaw * RAD, 0, "YXZ");
}
