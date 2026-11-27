export const VR_MENU_WIDTH = 1024;
const PADDING = 24;
const GAP = 14;
const LABEL_HEIGHT = 48;
const BUTTON_HEIGHT = 76;
const COLUMNS = 3;

type MenuItem = { kind: "label" | "button" };
type Rect = { x: number; y: number; width: number; height: number };

export function layoutVRMenu<Item extends MenuItem>(items: readonly Item[]) {
  const width = VR_MENU_WIDTH - PADDING * 2;
  const entries: (Item & Rect)[] = [];
  let y = PADDING;
  for (let i = 0; i < items.length;) {
    const first = items[i]!;
    if (first.kind === "label") {
      entries.push({ ...first, x: PADDING, y, width, height: LABEL_HEIGHT });
      y += LABEL_HEIGHT + GAP;
      i++;
      continue;
    }
    let count = 1;
    while (count < COLUMNS && items[i + count]?.kind === "button") count++;
    const columnWidth = (width - GAP * (count - 1)) / count;
    for (let col = 0; col < count; col++) {
      entries.push({ ...items[i + col]!, x: PADDING + col * (columnWidth + GAP), y, width: columnWidth, height: BUTTON_HEIGHT });
    }
    y += BUTTON_HEIGHT + GAP;
    i += count;
  }
  return { height: y + PADDING - GAP, entries };
}
