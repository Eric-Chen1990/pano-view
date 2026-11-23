import shutterUrl from "./audio/camera-shutter.mp3";

export type PanoScreenshotFocus = "none" | "reticle" | "lens" | "both";

export type PanoScreenshotFeedback = {
  /** Plays a short shutter sound when browser audio is allowed. Defaults to true. */
  sound?: boolean;
  /** Optional focus animation shown in the viewer. Defaults to "none". */
  focus?: PanoScreenshotFocus;
};

const FOCUS_DURATION = 720;

async function animateFocus(root: HTMLElement, focus: "reticle" | "lens", signal: AbortSignal) {
  signal.throwIfAborted();

  const layer = root.ownerDocument.createElement("div");
  layer.dataset.panoScreenshotFeedback = focus;
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "absolute", inset: "0", zIndex: focus === "lens" ? "1" : "40", pointerEvents: "none",
  });
  const surface = focus === "lens" ? root.querySelector("[data-pano-screenshot-canvas]") : root;
  let animation: Animation;
  if (focus === "reticle") {
    const reticle = root.ownerDocument.createElement("div");
    Object.assign(reticle.style, {
      position: "absolute", left: "50%", top: "50%", translate: "-50% -50%",
      width: "clamp(96px, 16%, 168px)", aspectRatio: "4 / 3",
      color: "#f8fafc", filter: "drop-shadow(0 1px 2px #000d)",
    });
    for (const vertical of ["top", "bottom"] as const) {
      for (const horizontal of ["left", "right"] as const) {
        const corner = root.ownerDocument.createElement("span");
        Object.assign(corner.style, { position: "absolute", width: "20px", height: "16px" });
        corner.style[vertical] = "0";
        corner.style[horizontal] = "0";
        corner.style.setProperty(`border-${vertical}`, "3px solid currentColor");
        corner.style.setProperty(`border-${horizontal}`, "3px solid currentColor");
        reticle.append(corner);
      }
    }
    for (const [width, height] of [["18px", "3px"], ["3px", "18px"]]) {
      const crossbar = root.ownerDocument.createElement("span");
      Object.assign(crossbar.style, {
        position: "absolute", inset: "0", margin: "auto",
        width, height, backgroundColor: "currentColor",
      });
      reticle.append(crossbar);
    }
    layer.append(reticle);
    animation = reticle.animate([
      { opacity: 0, color: "#f8fafc" },
      { opacity: 1, color: "#f8fafc", offset: 0.14 },
      { opacity: 1, color: "#f8fafc", offset: 0.66 },
      { opacity: 1, color: "#80f58b", offset: 0.73 },
      { opacity: 1, color: "#80f58b" },
    ], { duration: FOCUS_DURATION, easing: "linear" });
  } else {
    // Keep the filter inside the render surface so the controls and reticle stay sharp.
    animation = layer.animate([
      { backdropFilter: "blur(0px)", easing: "ease-out" },
      { backdropFilter: "blur(3.5px)", offset: 0.14, easing: "ease-in-out" },
      { backdropFilter: "blur(0px)", offset: 0.66 },
      { backdropFilter: "blur(0px)" },
    ], { duration: FOCUS_DURATION, easing: "linear" });
  }
  const abort = () => animation.cancel();
  signal.addEventListener("abort", abort, { once: true });
  try {
    (surface ?? root).append(layer);
    await animation.finished;
  } finally {
    signal.removeEventListener("abort", abort);
    layer.remove();
  }
}

export function createScreenshotFeedback() {
  let audio: AudioContext | undefined;
  let shutter: Promise<AudioBuffer> | undefined;

  async function play() {
    const context = audio;
    if (!context || !shutter) return;
    const buffer = await shutter;
    if (audio !== context || context.state !== "running") return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    source.onended = () => source.disconnect();
  }

  return {
    prepareSound() {
      try {
        audio ??= new AudioContext();
        if (audio.state !== "running") void audio.resume().catch(() => {});
        if (!shutter) {
          const context = audio;
          // The package build embeds the recording. Vite dev may serve the source asset.
          const bytes = shutterUrl.startsWith("data:")
            ? Promise.resolve(Uint8Array.from(atob(shutterUrl.slice(shutterUrl.indexOf(",") + 1)), (char) => char.charCodeAt(0)).buffer)
            : fetch(shutterUrl).then((response) => response.arrayBuffer());
          shutter = bytes.then((data) => context.decodeAudioData(data));
          void shutter.catch(() => {
            if (audio === context) shutter = undefined;
          });
        }
      } catch {
        // Audio support must not gate capture.
      }
    },
    playShutter() {
      void play().catch(() => {});
    },
    async focus(root: HTMLElement, focus: PanoScreenshotFocus, signal: AbortSignal) {
      if (focus === "none" || root.ownerDocument.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          typeof root.animate !== "function") return;
      if (focus === "both") {
        await Promise.allSettled([animateFocus(root, "lens", signal), animateFocus(root, "reticle", signal)]);
      } else {
        await animateFocus(root, focus, signal);
      }
    },
    dispose() {
      if (audio && audio.state !== "closed") void audio.close().catch(() => {});
      audio = undefined;
      shutter = undefined;
    },
  };
}

