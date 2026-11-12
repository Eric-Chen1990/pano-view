import {
  supportsNativeHtmlCapture,
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

/** Native rendering is capability gated; the DOM clone never owns application state. */
async function captureBody(
  element: HTMLElement,
  owner: HTMLElement,
  footer = false,
  overlays: readonly HTMLElement[] = [],
  yielding = true,
): Promise<HTMLCanvasElement> {
  const checkpoint = yielding ? createCaptureCheckpoint() : async () => {};
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const native = ctx as CanvasRenderingContext2D & {
    drawElementImage?: (node: HTMLElement, x: number, y: number) => void;
  };
  canvas.setAttribute("content", "drawable");
  if (
    supportsNativeHtmlCapture(
      canvas as HTMLCanvasElement & {
        content?: string;
        requestPaint?: unknown;
      },
      native,
    )
  ) {
    canvas.width = WIDTH;
    canvas.height = BODY_HEIGHT;
    const clone = element.cloneNode(true) as HTMLElement;
    const originals = [element, ...element.querySelectorAll<HTMLElement>("*")];
    const copies = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
    for (const [i, node] of originals.entries()) {
      const copy = copies[i];
      const css = getComputedStyle(node);
      for (const key of css)
        copy.style.setProperty(key, css.getPropertyValue(key));
      if (node.matches("video,canvas,audio")) {
        const box = document.createElement("div");
        box.style.cssText = copy.style.cssText;
        const rect = node.getBoundingClientRect();
        box.style.width = `${rect.width}px`;
        box.style.height = `${rect.height}px`;
        copy.replaceWith(box);
      }
      await checkpoint();
    }
    hideOverlays(originals, copies, overlays);
    Object.assign(clone.style, {
      left: "0",
      top: "0",
      transform: "none",
      position: "relative",
    });
    if (footer) squareCaptureFooter(clone.style);
    clone.setAttribute("drawable", "");
    canvas.append(clone);
    owner.append(canvas);
    originals.forEach((node, i) => {
      copies[i].scrollTop = node.scrollTop;
      copies[i].scrollLeft = node.scrollLeft;
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("HTML paint timed out")),
          1500,
        );
        canvas.addEventListener(
          "paint",
          () => {
            clearTimeout(timer);
            try {
              originals.forEach((node, i) => {
                copies[i].scrollTop = node.scrollTop;
                copies[i].scrollLeft = node.scrollLeft;
              });
              native.drawElementImage!(clone, 0, 0);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          { once: true },
        );
        (
          canvas as HTMLCanvasElement & { requestPaint: () => void }
        ).requestPaint();
      });
      if (!native.getImageData(20, 20, 1, 1).data[3])
        throw new Error("Native HTML capture produced an empty frame");
      return canvas;
    } catch {
      /* Fall through to the compatible renderer. */
    } finally {
      canvas.remove();
    }
  }
  const { domToCanvas } = await import("modern-screenshot");
  // Snapshot a layout clone with media placeholders, avoiding duplicate video decoders.
  const clone = element.cloneNode(true) as HTMLElement;
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
    return await domToCanvas(clone, {
      width: WIDTH,
      height: Math.min(BODY_HEIGHT, element.offsetHeight),
      scale: 2,
      features: { restoreScrollPosition: true },
      onCloneEachNode: checkpoint,
      timeout: 3000,
    });
  } finally {
    clone.remove();
  }
}

async function captureOverlay(
  element: HTMLElement,
  owner: HTMLElement,
  yielding = true,
): Promise<SpatialCaptureOverlay | null> {
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
  const checkpoint = yielding ? createCaptureCheckpoint() : async () => {};
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
    const image = await domToCanvas(frame, {
      width: bounds.width,
      height: bounds.height,
      scale: 2,
      onCloneEachNode: checkpoint,
      timeout: 3000,
    });
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
  overlays: readonly HTMLElement[],
  captures = { body: captureBody, overlays: captureSpatialOverlays },
) {
  let image: HTMLCanvasElement;
  try {
    image = await captures.body(element, owner, footer, overlays);
  } catch {
    // Retry the original uninterrupted clone path before showing a content failure.
    image = await captures.body(element, owner, footer, overlays, false);
  }
  const annotations = await captures.overlays(overlays, owner).catch(() => []);
  return { image, overlays: annotations };
}

export async function captureSpatialOverlays(
  overlays: readonly HTMLElement[],
  owner: HTMLElement,
  render = captureOverlay,
) {
  const captured: SpatialCaptureOverlay[] = [];
  for (const overlay of overlays) {
    try {
      let frame: SpatialCaptureOverlay | null;
      try {
        frame = await render(overlay, owner);
      } catch {
        frame = await render(overlay, owner, false);
      }
      if (frame) captured.push(frame);
    } catch {
      // A failed optional layer cannot blank the dialog or the other annotations.
    }
  }
  return captured;
}
