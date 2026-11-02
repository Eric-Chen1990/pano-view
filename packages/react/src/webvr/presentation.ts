import {
  exitElementFullscreen,
  getFullscreenElement,
  requestElementFullscreen,
  subscribeFullscreenChange,
} from "../fullscreen";
import {
  acquireIphoneLandscapeFullscreen,
  releaseIphoneLandscapeFullscreen,
  supportsIphoneLandscapeFullscreen,
} from "../ios-landscape-fullscreen";

const PRESENTATION_PROPERTIES = [
  "background",
  "height",
  "inset",
  "left",
  "position",
  "top",
  "width",
  "z-index",
] as const;

const PRESENTATION_STYLE: Readonly<Record<(typeof PRESENTATION_PROPERTIES)[number], string>> = {
  background: "#000",
  height: "100dvh",
  inset: "0",
  left: "0",
  position: "fixed",
  top: "0",
  width: "100%",
  "z-index": "2147483000",
};

const SCROLL_LOCK_OVERFLOW = "hidden";

type ScrollLockSnapshot = {
  bodyOverflow: string;
  documentOverflow: string;
};

type PresentationSnapshot = {
  element: HTMLElement;
  style: Record<(typeof PRESENTATION_PROPERTIES)[number], string>;
  scroll: ScrollLockSnapshot;
};

let activePresentation: PresentationSnapshot | null = null;
let iphonePresentationElement: HTMLElement | null = null;

function capturePresentationStyle(
  element: HTMLElement,
): PresentationSnapshot["style"] {
  const snapshot = {} as PresentationSnapshot["style"];
  for (const property of PRESENTATION_PROPERTIES) {
    snapshot[property] = element.style.getPropertyValue(property);
  }
  return snapshot;
}

function applyPresentationStyle(element: HTMLElement): void {
  for (const property of PRESENTATION_PROPERTIES) {
    element.style.setProperty(property, PRESENTATION_STYLE[property]);
  }
}

function restorePresentationStyle(
  element: HTMLElement,
  snapshot: PresentationSnapshot["style"],
): void {
  for (const property of PRESENTATION_PROPERTIES) {
    const previous = snapshot[property];
    if (previous) {
      element.style.setProperty(property, previous);
    } else {
      element.style.removeProperty(property);
    }
  }
}

function lockScroll(): ScrollLockSnapshot {
  const documentElement = document.documentElement;
  const body = document.body;
  const snapshot: ScrollLockSnapshot = {
    bodyOverflow: body.style.overflow,
    documentOverflow: documentElement.style.overflow,
  };
  documentElement.style.overflow = SCROLL_LOCK_OVERFLOW;
  body.style.overflow = SCROLL_LOCK_OVERFLOW;
  return snapshot;
}

function unlockScroll(snapshot: ScrollLockSnapshot): void {
  document.documentElement.style.overflow = snapshot.documentOverflow;
  document.body.style.overflow = snapshot.bodyOverflow;
}

async function tryLockLandscape(): Promise<void> {
  const orientation = window.screen?.orientation as
    | (ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      })
    | undefined;
  if (typeof orientation?.lock !== "function") {
    return;
  }
  try {
    await orientation.lock("landscape");
  } catch {
    // Orientation lock is best-effort; portrait prompt covers the rest.
  }
}

function tryUnlockOrientation(): void {
  const orientation = window.screen?.orientation;
  if (typeof orientation?.unlock !== "function") {
    return;
  }
  try {
    orientation.unlock();
  } catch {
    // Best-effort.
  }
}

/**
 * Pins the viewer to the viewport so MobileVR / simulated VR fills the screen
 * even when the Fullscreen API is unavailable (iOS Safari, WeChat, etc.).
 * Still requests the Fullscreen API in the same gesture when possible.
 * On iPhone, uses landscape document scrolling to hide Safari chrome.
 */
export async function enterWebVRPresentation(
  element: Element,
): Promise<void> {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (supportsIphoneLandscapeFullscreen()) {
    if (iphonePresentationElement && iphonePresentationElement !== element) {
      releaseIphoneLandscapeFullscreen(iphonePresentationElement, "vr");
    }
    iphonePresentationElement = element;
    acquireIphoneLandscapeFullscreen(element, "vr");
    void tryLockLandscape();
    return;
  }

  if (activePresentation?.element === element) {
    void requestElementFullscreen(element).catch(() => {});
    void tryLockLandscape();
    return;
  }
  if (activePresentation) {
    leaveWebVRPresentation();
  }

  activePresentation = {
    element,
    style: capturePresentationStyle(element),
    scroll: lockScroll(),
  };
  applyPresentationStyle(element);

  try {
    await requestElementFullscreen(element);
  } catch {
    // Keep the fixed-position fallback when the API is denied.
  }
  void tryLockLandscape();
}

export function leaveWebVRPresentation(): void {
  if (iphonePresentationElement) {
    const element = iphonePresentationElement;
    iphonePresentationElement = null;
    releaseIphoneLandscapeFullscreen(element, "vr");
    tryUnlockOrientation();
  }

  const presentation = activePresentation;
  if (!presentation) {
    if (getFullscreenElement()) {
      void exitElementFullscreen();
    }
    return;
  }
  activePresentation = null;
  restorePresentationStyle(presentation.element, presentation.style);
  unlockScroll(presentation.scroll);
  tryUnlockOrientation();
  const fullscreen = getFullscreenElement();
  if (
    fullscreen &&
    (fullscreen === presentation.element ||
      presentation.element.contains(fullscreen))
  ) {
    void exitElementFullscreen();
  }
}

/**
 * Ends the fallback VR session when the user leaves browser fullscreen
 * (Escape) while presentation styles are still active.
 */
export function subscribeWebVRPresentationExit(
  element: Element,
  onExit: () => void,
): () => void {
  if (!(element instanceof HTMLElement)) {
    return () => {};
  }

  return subscribeFullscreenChange(() => {
    const fullscreen = getFullscreenElement();
    if (fullscreen) {
      return;
    }
    if (activePresentation?.element !== element) {
      return;
    }
    onExit();
  });
}

export function getWebVRPresentationElement(): HTMLElement | null {
  return iphonePresentationElement ?? activePresentation?.element ?? null;
}
