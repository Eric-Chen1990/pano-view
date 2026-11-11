const EMULATED_CANVAS_STYLE = {
  position: "fixed",
  top: "0px",
  left: "0px",
  width: "100vw",
  height: "100dvh",
  "max-width": "none",
  "max-height": "none",
  "flex-shrink": "0",
} as const;

function isEmulatedCanvas(canvas: HTMLCanvasElement): boolean {
  return canvas.parentElement?.dataset.webxr_runtime?.startsWith(
    "Immersive Web Emulation Runtime",
  ) === true;
}

/** IWER owns the framebuffer and reparents the canvas into a viewport-sized host. */
export function fitEmulatedXRViewport(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): boolean {
  if (!isEmulatedCanvas(canvas)) return false;
  for (const [name, value] of Object.entries(EMULATED_CANVAS_STYLE)) {
    if (canvas.style.getPropertyValue(name) !== value) {
      canvas.style.setProperty(name, value);
    }
  }
  // The native renderer refuses setSize during XR. IWER's framebuffer getters
  // read the emulated canvas dimensions directly, including after a resize.
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
  }
  return true;
}

/** Leave native headset sessions and browser fullscreen ownership unchanged. */
export function bindEmulatedXRViewport(canvas: HTMLCanvasElement): () => void {
  const originalParent = canvas.parentElement;
  let saved: Array<[string, string, string]> | null = null;
  const restore = () => {
    if (!saved) return;
    for (const [name, value, priority] of saved) {
      if (value) canvas.style.setProperty(name, value, priority);
      else canvas.style.removeProperty(name);
    }
    saved = null;
  };
  const sync = () => {
    if (!isEmulatedCanvas(canvas)) { restore(); return; }
    if (!saved) {
      saved = Object.keys(EMULATED_CANVAS_STYLE).map(name => [
        name, canvas.style.getPropertyValue(name), canvas.style.getPropertyPriority(name),
      ]);
    }
    fitEmulatedXRViewport(canvas, window.innerWidth, window.innerHeight);
  };
  const observer = new MutationObserver(sync);
  // Session setup may finish reparenting after enterVR has resolved.
  if (originalParent) observer.observe(originalParent, { childList: true });
  observer.observe(canvas, { attributes: true, attributeFilter: ["style"] });
  window.addEventListener("resize", sync);
  sync();
  return () => {
    observer.disconnect();
    window.removeEventListener("resize", sync);
    restore();
  };
}
