import {
  squareCaptureFooter,
  createCaptureCheckpoint,
  captureOverlayBounds,
} from "./capture-support";

const WIDTH = 640;
const BODY_HEIGHT = 688;

export type SpatialCaptureOverlay = {
  element: HTMLElement;
  image: HTMLCanvasElement;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

export type ResolveSpatialOverlays = () => readonly HTMLElement[];

function hideOverlays(
  originals: HTMLElement[],
  copies: HTMLElement[],
  overlays: readonly HTMLElement[],
) {
  for (const element of overlays) {
    const index = originals.indexOf(element);
    if (index >= 0)
      copies[index]!.style.setProperty("opacity", "0", "important");
  }
}

/** Stop between cloning slices, including when an uninterrupted retry is used. */
function captureCheckpoint(yielding: boolean, signal?: AbortSignal) {
  const checkpoint = yielding ? createCaptureCheckpoint() : async () => {};
  return async () => {
    signal?.throwIfAborted();
    await checkpoint();
    signal?.throwIfAborted();
  };
}

/** Use the compatible renderer: native HTML-in-Canvas can crash the browser process. */
async function captureBody(
  element: HTMLElement,
  owner: HTMLElement,
  footer = false,
  resolveOverlays: ResolveSpatialOverlays = () => [],
  yielding = true,
  signal?: AbortSignal,
): Promise<HTMLCanvasElement> {
  signal?.throwIfAborted();
  const checkpoint = captureCheckpoint(yielding, signal);
  const { domToCanvas } = await import("modern-screenshot");
  signal?.throwIfAborted();
  // Snapshot a layout clone with media placeholders, avoiding duplicate video decoders.
  const clone = element.cloneNode(true) as HTMLElement;
  // Resolve after the async import + clone so late-mounted markers are hidden.
  const overlays = resolveOverlays();
  const originals = [element, ...element.querySelectorAll<HTMLElement>("*")];
  const copies = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
  for (const [i, node] of originals.entries()) {
    const copy = copies[i];
    const css = getComputedStyle(node);
    for (const key of css)
      copy.style.setProperty(key, css.getPropertyValue(key));
    copy.scrollTop = node.scrollTop;
    copy.scrollLeft = node.scrollLeft;
    if (node.tagName === "IFRAME") {
      const frame = node as HTMLIFrameElement;
      const box = document.createElement("div");
      box.style.cssText = copy.style.cssText;
      box.style.overflow = "hidden";
      try {
        const doc = frame.contentDocument;
        if (doc?.body) {
          const body = doc.body.cloneNode(true) as HTMLElement;
          const from = [
            doc.body,
            ...doc.body.querySelectorAll<HTMLElement>("*"),
          ];
          const to = [body, ...body.querySelectorAll<HTMLElement>("*")];
          for (const [index, original] of from.entries()) {
            const css = doc.defaultView!.getComputedStyle(original);
            for (const key of css)
              to[index].style.setProperty(key, css.getPropertyValue(key));
            if (original.tagName === "IMG")
              (to[index] as HTMLImageElement).src = (
                original as HTMLImageElement
              ).src;
            await checkpoint();
          }
          const scroll = doc.scrollingElement;
          body.style.transform = `translate(${-(
            scroll?.scrollLeft ?? 0
          )}px, ${-(scroll?.scrollTop ?? 0)}px)`;
          box.append(body);
        }
      } catch {
        signal?.throwIfAborted();
        /* Cross-origin frames use the visible fallback message. */
      }
      copy.replaceWith(box);
    }
    if (node.matches("video,canvas,audio")) {
      const box = document.createElement("div");
      box.style.cssText = copy.style.cssText;
      box.style.width = `${node.getBoundingClientRect().width}px`;
      box.style.height = `${node.getBoundingClientRect().height}px`;
      copy.replaceWith(box);
    }
    await checkpoint();
  }
  hideOverlays(originals, copies, overlays);
  Object.assign(clone.style, {
    position: "relative",
    left: "0",
    top: "0",
    transform: "none",
  });
  if (footer) squareCaptureFooter(clone.style);
  owner.append(clone);
  originals.forEach((node, i) => {
    copies[i].scrollTop = node.scrollTop;
    copies[i].scrollLeft = node.scrollLeft;
  });
  try {
    const image = await domToCanvas(clone, {
      width: WIDTH,
      height: Math.min(BODY_HEIGHT, element.offsetHeight),
      scale: 2,
      features: { restoreScrollPosition: true },
      onCloneEachNode: checkpoint,
      timeout: 3000,
    });
    signal?.throwIfAborted();
    return image;
  } finally {
    clone.remove();
  }
}

async function captureOverlay(
  element: HTMLElement,
  owner: HTMLElement,
  yielding = true,
  signal?: AbortSignal,
): Promise<SpatialCaptureOverlay | null> {
  signal?.throwIfAborted();
  const origin = element.getBoundingClientRect();
  // Hidden/occluded source annotations must never acquire a raster or hit area.
  if (
    origin.width <= 0 ||
    origin.height <= 0 ||
    getComputedStyle(element).visibility === "hidden"
  )
    return null;
  const originals = [element, ...element.querySelectorAll<HTMLElement>("*")];
  const bounds = captureOverlayBounds(
    originals.map((node) => node.getBoundingClientRect()),
  );
  if (!bounds) return null;
  const checkpoint = captureCheckpoint(yielding, signal);
  const clone = element.cloneNode(true) as HTMLElement;
  const copies = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
  for (const [index, node] of originals.entries()) {
    const style = getComputedStyle(node);
    for (const key of style)
      copies[index]!.style.setProperty(key, style.getPropertyValue(key));
    await checkpoint();
  }
  const frame = document.createElement("div");
  Object.assign(frame.style, {
    position: "relative",
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    overflow: "hidden",
  });
  Object.assign(clone.style, {
    position: "absolute",
    left: `${origin.left - bounds.left}px`,
    top: `${origin.top - bounds.top}px`,
    transform: "none",
    margin: "0",
    width: `${origin.width}px`,
    height: `${origin.height}px`,
  });
  frame.append(clone);
  owner.append(frame);
  try {
    const { domToCanvas } = await import("modern-screenshot");
    signal?.throwIfAborted();
    const image = await domToCanvas(frame, {
      width: bounds.width,
      height: bounds.height,
      scale: 2,
      onCloneEachNode: checkpoint,
      timeout: 3000,
    });
    signal?.throwIfAborted();
    return {
      element,
      image,
      offsetX: bounds.left - origin.left,
      offsetY: bounds.top - origin.top,
      width: bounds.width,
      height: bounds.height,
    };
  } finally {
    frame.remove();
  }
}

/** Optional annotation failures must never discard the successfully captured dialog. */
export async function captureSpatialSurface(
  element: HTMLElement,
  owner: HTMLElement,
  footer: boolean,
  resolveOverlays: ResolveSpatialOverlays,
  captures = { body: captureBody, overlays: captureSpatialOverlays },
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  let image: HTMLCanvasElement;
  try {
    image = await captures.body(
      element,
      owner,
      footer,
      resolveOverlays,
      true,
      signal,
    );
  } catch {
    signal?.throwIfAborted();
    // Retry the original uninterrupted clone path before showing a content failure.
    image = await captures.body(
      element,
      owner,
      footer,
      resolveOverlays,
      false,
      signal,
    );
  }
  signal?.throwIfAborted();
  // Re-resolve after the body snapshot so late-mounted markers still get a foreground layer.
  const annotations = await captures
    .overlays(resolveOverlays(), owner, undefined, signal)
    .catch(() => {
      signal?.throwIfAborted();
      return [];
    });
  signal?.throwIfAborted();
  return { image, overlays: annotations };
}

export async function captureSpatialOverlays(
  overlays: readonly HTMLElement[],
  owner: HTMLElement,
  render = captureOverlay,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const captured: SpatialCaptureOverlay[] = [];
  for (const overlay of overlays) {
    signal?.throwIfAborted();
    try {
      let frame: SpatialCaptureOverlay | null;
      try {
        frame = await render(overlay, owner, true, signal);
      } catch {
        signal?.throwIfAborted();
        frame = await render(overlay, owner, false, signal);
      }
      signal?.throwIfAborted();
      if (frame) captured.push(frame);
    } catch {
      signal?.throwIfAborted();
      // A failed optional layer cannot blank the dialog or the other annotations.
    }
  }
  return captured;
}
