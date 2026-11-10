type Frame = { image: CanvasImageSource; width: number; height: number };

/** Owns only preview resources; the original video retains playback and source ownership. */
export function createSpatialVideo(video: HTMLVideoElement) {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const context = probe.getContext("2d", { willReadFrequently: true });
  let source = "", currentSource = "", poster = "";
  let image: HTMLImageElement | null = null;
  let readableVideo: boolean | undefined;
  let readablePoster: boolean | undefined;
  let started = !video.paused || video.currentTime > 0;
  let disposed = false;
  let previousPreload: string | null | undefined;

  const restorePreload = () => {
    if (previousPreload !== undefined && video.preload === "auto") {
      if (previousPreload === null) video.removeAttribute("preload");
      else video.setAttribute("preload", previousPreload);
    }
    previousPreload = undefined;
  };
  const releasePoster = () => {
    image?.removeAttribute("src");
    image = null;
  };
  const reset = () => {
    readableVideo = undefined;
    started = !video.paused || video.currentTime > 0;
  };
  const play = () => { started = true; };
  video.addEventListener("emptied", reset);
  video.addEventListener("play", play);

  const readable = (input: CanvasImageSource) => {
    if (!context) return false;
    try {
      context.clearRect(0, 0, 1, 1);
      context.drawImage(input, 0, 0, 1, 1);
      // Some decoders report HAVE_CURRENT_DATA before exposing a drawable frame.
      // Leave readiness uncached so a transparent initial frame can be retried.
      return context.getImageData(0, 0, 1, 1).data[3] ? true : undefined;
    } catch (error) {
      // Never let an unreadable cross-origin frame taint the panel's WebGL texture.
      probe.width = 1;
      return error && typeof error === "object" && "name" in error && error.name === "SecurityError" ? false : undefined;
    }
  };

  return {
    getFrame(): Frame | null {
      if (disposed) return null;
      if (source !== video.src || currentSource !== video.currentSrc) {
        source = video.src;
        currentSource = video.currentSrc;
        reset();
      }
      started ||= !video.paused || video.currentTime > 0;
      if (poster !== video.poster) {
        releasePoster();
        poster = video.poster;
        readablePoster = undefined;
        if (poster) {
          image = new Image();
          image.crossOrigin = "anonymous";
          image.src = poster;
        }
      }
      if (!poster && previousPreload === undefined) {
        previousPreload = video.getAttribute("preload");
        // A preload hint can expose the first frame without playing, seeking or reloading.
        video.preload = "auto";
      } else if (poster) restorePreload();

      const posterFrame = () => {
        if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return null;
        readablePoster ??= readable(image);
        return readablePoster
          ? { image, width: image.naturalWidth, height: image.naturalHeight }
          : null;
      };
      if (!started) {
        const preview = posterFrame();
        if (preview) return preview;
      }
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        // A paused/offscreen decoder can drop its bitmap without changing readyState.
        if (readableVideo !== false && (readableVideo === undefined || video.paused)) readableVideo = readable(video);
        if (readableVideo) return { image: video, width: video.videoWidth, height: video.videoHeight };
      }
      return posterFrame();
    },
    dispose() {
      disposed = true;
      video.removeEventListener("emptied", reset);
      video.removeEventListener("play", play);
      releasePoster();
      restorePreload();
      probe.width = probe.height = 1;
    },
  };
}

export type SpatialVideo = ReturnType<typeof createSpatialVideo>;
