export function vrVideoFollowBlend(delta: number) {
  return -Math.expm1(-Math.min(delta, 0.05) / 0.16);
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
