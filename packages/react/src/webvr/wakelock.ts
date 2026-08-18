import { useEffect } from "react";
import { WEBVR_WAKELOCK_FALLBACK_VIDEO_BASE64 } from "./wakelock-fallback";

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

type WakeLockSession = {
  acquiring: Promise<void> | null;
  sentinel: WakeLockSentinel | null;
  video: HTMLVideoElement | null;
  videoSrc: string | null;
};

const session: WakeLockSession = {
  acquiring: null,
  sentinel: null,
  video: null,
  videoSrc: null,
};

function hasWakeLockApi(): boolean {
  return Boolean((navigator as NavigatorWithWakeLock).wakeLock?.request);
}

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return buffer;
}

function createFallbackVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  video.autoplay = true;
  video.controls = false;
  video.defaultMuted = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.tabIndex = -1;
  video.ariaHidden = "true";
  video.disablePictureInPicture = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("disablepictureinpicture", "");
  video.style.cssText =
    "pointer-events:none;position:fixed;bottom:0;left:0;width:1px;height:1px;opacity:0;";
  const src = URL.createObjectURL(
    new Blob([decodeBase64(WEBVR_WAKELOCK_FALLBACK_VIDEO_BASE64)], {
      type: "video/mp4",
    }),
  );
  session.videoSrc = src;
  video.src = src;
  return video;
}

function stopFallbackVideo(): void {
  const video = session.video;
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    session.video = null;
  }
  if (session.videoSrc) {
    URL.revokeObjectURL(session.videoSrc);
    session.videoSrc = null;
  }
}

async function playFallbackVideo(): Promise<void> {
  if (!session.video) {
    session.video = createFallbackVideo();
    document.body.appendChild(session.video);
  }
  await session.video.play();
}

async function requestNativeWakeLock(): Promise<boolean> {
  if (!hasWakeLockApi()) {
    return false;
  }
  try {
    const sentinel = await (navigator as NavigatorWithWakeLock).wakeLock!.request(
      "screen",
    );
    session.sentinel = sentinel;
    sentinel.addEventListener(
      "release",
      () => {
        if (session.sentinel === sentinel) {
          session.sentinel = null;
        }
      },
      { once: true },
    );
    stopFallbackVideo();
    return true;
  } catch {
    return false;
  }
}

/**
 * Keep the display awake during a fallback VR session. Prefers the Screen
 * Wake Lock API and falls back to a looping hidden video on older browsers.
 */
export async function acquireWebVRWakeLock(): Promise<void> {
  if (typeof navigator === "undefined" || typeof document === "undefined") {
    return;
  }
  if (document.visibilityState !== "visible") {
    return;
  }
  if (session.sentinel && !session.sentinel.released) {
    return;
  }
  if (session.video && !session.video.paused) {
    return;
  }
  if (session.acquiring) {
    await session.acquiring;
    return;
  }

  session.acquiring = (async () => {
    if (await requestNativeWakeLock()) {
      return;
    }
    try {
      await playFallbackVideo();
    } catch {
      // Autoplay / wake lock can be denied; a later user gesture may retry.
    }
  })();

  try {
    await session.acquiring;
  } finally {
    session.acquiring = null;
  }
}

export function releaseWebVRWakeLock(): void {
  const sentinel = session.sentinel;
  session.sentinel = null;
  if (sentinel) {
    void sentinel.release();
  }
  stopFallbackVideo();
}

export function useWebVRWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void acquireWebVRWakeLock();
      }
    };

    void acquireWebVRWakeLock();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      releaseWebVRWakeLock();
    };
  }, [enabled]);
}
