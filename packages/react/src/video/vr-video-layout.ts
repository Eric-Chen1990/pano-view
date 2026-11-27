export function vrVideoLookDown(pitch: number, referencePitch: number, barPitch: number, visible: boolean) {
  const down = referencePitch - pitch;
  const reveal = Math.min(13, (referencePitch - barPitch) * 0.72);
  return down >= reveal - (visible ? Math.min(4, reveal / 2) : 0);
}

const LOOK_DOWN_SAMPLE_COUNT = 64;
const LOOK_DOWN_WINDOW = 0.22;
const LOOK_DOWN_MIN_PITCH_CHANGE = 10;

export function createVRVideoLookDownGesture() {
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
      if (!vrVideoLookDown(pitch, referencePitch, barPitch, true)) {
        pitches[next] = pitch;
        times[next] = time;
        next = (next + 1) % LOOK_DOWN_SAMPLE_COUNT;
        count = Math.min(count + 1, LOOK_DOWN_SAMPLE_COUNT);
        return false;
      }
      if (!vrVideoLookDown(pitch, referencePitch, barPitch, false)) return false;
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

export function vrVideoFollowBlend(delta: number) {
  return -Math.expm1(-Math.min(delta, 0.05) / 0.16);
}

export function vrVideoToolbarTransition(progress: number, show: boolean, delta: number, reducedMotion: boolean) {
  const step = Math.min(delta, 0.05) / 0.24;
  const next = reducedMotion ? Number(show) : Math.max(0, Math.min(1, progress + (show ? step : -step)));
  const opacity = next * next * (3 - 2 * next);
  return { progress: next, opacity, interactive: show && next === 1 };
}

/** Keep the painted caption, including multiline cues, in the lower part of both eye views. */
export function vrVideoCaptionBounds(halfWidth: number, eyeBottom: number, contentHeightPerWidth: number) {
  const top = eyeBottom * 0.5;
  const bottom = eyeBottom * 0.96;
  const width = Math.min(1.72, halfWidth * 1.76, (bottom - top) / contentHeightPerWidth);
  const minBottom = top + width * contentHeightPerWidth;
  const maxOffsetX = Math.min(0.14, halfWidth - width / 2);
  return { width, minBottom, bottom, maxOffsetX, targetBottom: Math.max(minBottom, eyeBottom * 0.82) };
}

export function vrVideoSeekTime(fraction: number, duration: number): number | null {
  if (!Number.isFinite(fraction) || !Number.isFinite(duration) || duration <= 0) return null;
  return Math.max(0, Math.min(1, fraction)) * duration;
}

/** Wrap words when possible, with character breaks for CJK and unbroken text. */
export function wrapVRCaption(text: string, width: number, measure: (line: string) => number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/u)) {
    let line = "";
    for (const part of paragraph.split(/(\s+)/u)) {
      if (measure(line + part) <= width) {
        if (line || part.trim()) line += part;
        continue;
      }
      if (line.trim()) lines.push(line.trimEnd());
      line = "";
      if (!part.trim()) continue;
      for (const character of part) {
        if (line && measure(line + character) > width) {
          lines.push(line);
          line = "";
        }
        line += character;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export function vrVideoEyeBounds(
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
