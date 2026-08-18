type DocumentWithWebkitFullscreen = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type ElementWithWebkitFullscreen = Element & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function isFullscreenEnabled(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const doc = document as DocumentWithWebkitFullscreen;
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

export function getFullscreenElement(): Element | null {
  if (typeof document === "undefined") {
    return null;
  }
  const doc = document as DocumentWithWebkitFullscreen;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export async function requestElementFullscreen(element: Element): Promise<void> {
  if (typeof element.requestFullscreen === "function") {
    await element.requestFullscreen();
    return;
  }
  const prefixed = element as ElementWithWebkitFullscreen;
  prefixed.webkitRequestFullscreen?.();
}

export async function exitElementFullscreen(): Promise<void> {
  if (typeof document === "undefined") {
    return;
  }
  const doc = document as DocumentWithWebkitFullscreen;
  if (typeof doc.exitFullscreen === "function" && getFullscreenElement()) {
    await doc.exitFullscreen();
    return;
  }
  await doc.webkitExitFullscreen?.();
}

export function subscribeFullscreenChange(onChange: () => void): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }
  document.addEventListener("fullscreenchange", onChange);
  document.addEventListener("webkitfullscreenchange", onChange);
  return () => {
    document.removeEventListener("fullscreenchange", onChange);
    document.removeEventListener("webkitfullscreenchange", onChange);
  };
}
