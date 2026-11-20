/// <reference lib="es2022.intl" />

export function tooltipRasterScale(renderHeight: number, referenceHeight: number, zoom: number) {
  // Quantize the density so small viewport changes do not re-upload the texture.
  const pixelsPerReferencePixel = renderHeight * zoom / Math.max(1, referenceHeight);
  return Math.min(8, Math.max(3, Math.ceil(pixelsPerReferencePixel * 2)));
}

export function tooltipBaseline(top: number, lineHeight: number, ascent: number, descent: number) {
  return top + (lineHeight - ascent - descent) / 2 + ascent;
}
export function tooltipLines(text: string, maxWidth: number, measure: (text: string) => number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter() : null;
  for (const word of words) {
    const combined = line ? `${line} ${word}` : word;
    if (measure(combined) <= maxWidth) {
      line = combined;
      continue;
    }
    if (line) lines.push(line);
    line = "";
    const characters = segmenter ? Array.from(segmenter.segment(word), item => item.segment) : word;
    for (const segment of characters) {
      if (line && measure(line + segment) > maxWidth) {
        lines.push(line);
        line = "";
      }
      line += segment;
    }
  }
  if (line) lines.push(line);
  return lines;
}
