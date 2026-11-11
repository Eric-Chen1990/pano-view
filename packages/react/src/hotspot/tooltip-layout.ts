export function tooltipPadding(value: string | number): [number, number, number, number] {
  const values = String(value).trim().split(/\s+/).map(value => Math.max(0, parseFloat(value) || 0));
  const [top = 0, right = top, bottom = top, left = right] = values;
  return [top, right, bottom, left];
}
export function tooltipBaseline(top: number, lineHeight: number, ascent: number, descent: number) {
  return top + (lineHeight - ascent - descent) / 2 + ascent;
}
export function tooltipLines(text: string, maxWidth: number, measure: (text: string) => number) {
  const lines: string[] = [];
  if (!text) return lines;
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const char of paragraph) {
      if (line && measure(line + char) > maxWidth) { lines.push(line); line = ""; }
      line += char;
    }
    lines.push(line);
  }
  return lines;
}
