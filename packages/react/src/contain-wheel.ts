/** Cancel a wheel event so the page does not scroll under a viewer. */
export function preventWheelPageScroll(event: WheelEvent): void {
  if (event.cancelable) event.preventDefault();
}

function overflowAllowsScroll(style: CSSStyleDeclaration, axis: "x" | "y"): boolean {
  const value = axis === "x" ? style.overflowX : style.overflowY;
  return value === "auto" || value === "scroll" || value === "overlay";
}

function elementCanScroll(
  element: HTMLElement,
  deltaX: number,
  deltaY: number,
): boolean {
  const style = getComputedStyle(element);
  if (Math.abs(deltaY) >= Math.abs(deltaX)) {
    if (!overflowAllowsScroll(style, "y") || deltaY === 0) return false;
    if (deltaY < 0) return element.scrollTop > 0;
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }
  if (!overflowAllowsScroll(style, "x") || deltaX === 0) return false;
  if (deltaX < 0) return element.scrollLeft > 0;
  return element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
}

/** True when a scrollable ancestor under `root` can still move with this wheel. */
export function wheelTargetCanScroll(root: HTMLElement, event: WheelEvent): boolean {
  let node: Node | null = event.target instanceof Node ? event.target : null;
  if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement;
  while (node) {
    if (node instanceof HTMLElement && elementCanScroll(node, event.deltaX, event.deltaY)) {
      return true;
    }
    if (node === root) break;
    node = node.parentNode;
  }
  return false;
}
