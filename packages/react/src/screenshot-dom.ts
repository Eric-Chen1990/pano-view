import type { PanoScreenshotMode } from "./screenshot";

const hotspotSelector = "[data-pano-screenshot-hotspot]";
const canvasSlot = "[data-pano-screenshot-canvas]";

export async function loadScreenshotDom() {
  // The single-file build hoists static imports even from lazily loaded local modules.
  const { domToCanvas } = await import("modern-screenshot");
  return captureScreenshotDom.bind(null, domToCanvas);
}

async function captureScreenshotDom(
  domToCanvas: typeof import("modern-screenshot").domToCanvas,
  root: HTMLDivElement,
  liveCanvas: HTMLCanvasElement,
  snapshot: HTMLCanvasElement,
  mode: Exclude<PanoScreenshotMode, "panorama">,
  signal: AbortSignal,
) {
  const { width, height } = root.getBoundingClientRect();
  if (!width || !height) throw new DOMException("The viewer has no visible area.", "InvalidStateError");

  const keep = new Set<Node>();
  const projected = new Map<string, { transform: string; display: string; zIndex: string }>();
  const labels = root.querySelectorAll<HTMLElement>(hotspotSelector);
  for (const el of labels) {
    const marker = el.getAttribute("data-pano-screenshot-hotspot");
    if (marker) projected.set(marker, { transform: el.style.transform, display: el.style.display, zIndex: el.style.zIndex });
    for (let node = el.parentElement; node && node !== root; node = node.parentElement) {
      keep.add(node);
    }
  }
  if (mode === "hotspots" && labels.length === 0) return snapshot;

  const source = mode === "viewer" ? snapshot.toDataURL("image/png") : undefined;
  const canvasStyle = liveCanvas.ownerDocument.defaultView!.getComputedStyle(liveCanvas);
  const canvasWidth = canvasStyle.width;
  const canvasHeight = canvasStyle.height;
  const formStates: boolean[] = [];
  let formStateIndex = 0;
  const image = await domToCanvas(root, {
    width,
    height,
    scale: snapshot.width / width,
    style: {
      overflow: "hidden",
      transform: "none",
      ...(mode === "hotspots" ? { background: "transparent", borderColor: "transparent", boxShadow: "none" } : {}),
    },
    features: { restoreScrollPosition: true },
    timeout: 2500,
    fetch: { requestInit: { cache: "force-cache", signal } },
    filter(node) {
      if (node === liveCanvas) return false;
      const element = node.nodeType === 1 ? node as Element : null;
      if (element?.hasAttribute("data-pano-screenshot-feedback")) return false;
      if (mode === "hotspots" && !keep.has(node) && !(element ?? node.parentElement)?.closest(hotspotSelector)) return false;
      // The serializer copies value attributes. Checked/selected state lives on the control.
      if (element?.tagName === "OPTION") formStates.push((element as HTMLOptionElement).selected);
      if (element?.tagName === "INPUT") formStates.push((element as HTMLInputElement).checked);
      return true;
    },
    onCloneEachNode(clone) {
      signal.throwIfAborted();
      if (clone.nodeType !== 1) return;
      const node = clone as HTMLElement;
      if (node.tagName === "OPTION") node.toggleAttribute("selected", formStates[formStateIndex++]);
      if (node.tagName === "INPUT") node.toggleAttribute("checked", formStates[formStateIndex++]);
      if (node.tagName === "TEXTAREA") node.textContent = node.getAttribute("value");
      const position = projected.get(node.getAttribute("data-pano-screenshot-hotspot") ?? "");
      if (position) Object.assign(node.style, position);
      if (source && node.matches(canvasSlot) && node.firstElementChild) {
        // The first child of Fiber's canvas wrapper is its measurement box.
        const image = root.ownerDocument.createElement("img");
        image.src = source;
        Object.assign(image.style, { display: "block", width: canvasWidth, height: canvasHeight });
        node.firstElementChild.prepend(image);
      }
      if (node.tagName === "IFRAME") {
        // A readable frame is cloned as HTML by modern-screenshot.
        node.removeAttribute("src");
        node.removeAttribute("srcdoc");
        node.style.visibility = "hidden";
      }
    },
  });

  signal.throwIfAborted();
  const ctx = snapshot.getContext("2d")!;
  if (mode === "viewer") ctx.clearRect(0, 0, snapshot.width, snapshot.height);
  ctx.drawImage(image, 0, 0, snapshot.width, snapshot.height);
  return snapshot;
}
