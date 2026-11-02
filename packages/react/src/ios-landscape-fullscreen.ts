import { isFullscreenEnabled } from "./fullscreen";

export type IphoneFullscreenHolder = "viewer" | "vr";

/** Matches krpano `display.iphonefullscreen`: 0 ready, 1 swipe up, 2 swipe down then up. */
export type IphoneFullscreenState = 0 | 1 | 2;

export type IphoneFullscreenViewport = {
  inIframe: boolean;
  landscape: boolean;
  /** Large viewport height (`100lvh`): the size Safari uses once its bars are retracted. */
  largeViewportHeight: number;
  scrollY: number;
  visualViewportHeight: number;
  visualViewportOffsetTop: number;
};

export type IphoneFullscreenExtents = {
  maxVisualHeight: number;
  minVisualHeight: number;
};

export type IphoneFullscreenSessionSnapshot = {
  active: boolean;
  /** True while landscape bars still need a document scroll gesture. */
  allowsDocumentScroll: boolean;
  element: HTMLElement | null;
  /** Portrait while session is active — show rotate hint. */
  portrait: boolean;
  state: IphoneFullscreenState;
};

/** Home-indicator / safe-area leftover after the URL bar itself is gone. */
const BAR_COLLAPSED_TOLERANCE_PX = 32;
const CHROME_GROWTH_PX = 24;
const SCROLL_OFFSET_TOLERANCE_PX = 2;
const REMEASURE_DELAY_MS = 280;
const ELEMENT_STYLE_PROPERTIES = [
  "background",
  "height",
  "left",
  "position",
  "top",
  "width",
  "z-index",
] as const;

type ElementStyleSnapshot = Record<(typeof ELEMENT_STYLE_PROPERTIES)[number], string>;

type DocumentStyleSnapshot = {
  bodyHeight: string;
  bodyMinHeight: string;
  bodyOverflow: string;
  documentHeight: string;
  documentOverflow: string;
  scrollX: number;
  scrollY: number;
};

type ActiveSession = {
  /** Latched after the bars collapse so a leftover scroll offset cannot bring the hint back. */
  barsHidden: boolean;
  documentStyle: DocumentStyleSnapshot;
  element: HTMLElement;
  elementStyle: ElementStyleSnapshot;
  extents: IphoneFullscreenExtents;
  extentsLandscape: boolean | null;
  holders: Set<IphoneFullscreenHolder>;
  orientationCleanup: (() => void) | null;
  remeasureTimer: number;
};

const globalListeners = new Set<() => void>();

let activeSession: ActiveSession | null = null;
let lastSnapshot: IphoneFullscreenSessionSnapshot = {
  active: false,
  allowsDocumentScroll: false,
  element: null,
  portrait: false,
  state: 0,
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function readStandaloneDisplay(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  const nav = navigator as NavigatorWithStandalone;
  if (nav.standalone === true) {
    return true;
  }
  try {
    return window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

/**
 * True for iPhone / iPod browsers where the Fullscreen API is unavailable and
 * landscape document scrolling can hide the Safari chrome.
 */
export function isIphoneLandscapeFullscreenCandidate(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
  options: {
    fullscreenEnabled?: boolean;
    standalone?: boolean;
  } = {},
): boolean {
  if (!userAgent) {
    return false;
  }
  // iPadOS may report as Macintosh; iPhone fullscreen scrolling does not apply.
  if (/iPad/i.test(userAgent)) {
    return false;
  }
  if (!/iPhone|iPod/i.test(userAgent)) {
    return false;
  }
  const fullscreenEnabled =
    options.fullscreenEnabled ??
    (typeof document !== "undefined" ? isFullscreenEnabled() : false);
  if (fullscreenEnabled) {
    return false;
  }
  const standalone = options.standalone ?? readStandaloneDisplay();
  if (standalone) {
    return false;
  }
  return true;
}

export function supportsIphoneLandscapeFullscreen(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return isIphoneLandscapeFullscreenCandidate();
}

/** True when the Fullscreen API or the iPhone landscape scroll-away fallback is available. */
export function canEnterViewerFullscreen(): boolean {
  return isFullscreenEnabled() || supportsIphoneLandscapeFullscreen();
}

function readLargeViewportHeight(win: Window): number {
  const root = win.document.documentElement;
  let probe = root.querySelector<HTMLElement>("[data-pano-lvh-probe]");
  if (!probe) {
    probe = win.document.createElement("div");
    probe.setAttribute("data-pano-lvh-probe", "");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;left:0;top:0;width:0;height:100lvh;visibility:hidden;pointer-events:none;";
    root.appendChild(probe);
  }
  const measured = probe.getBoundingClientRect().height;
  if (measured > 0) {
    return measured;
  }
  const screen = win.screen;
  if (screen?.width > 0 && screen.height > 0) {
    // Landscape height is the short side even when screen.height stays portrait.
    return Math.min(screen.width, screen.height);
  }
  return win.innerHeight;
}

function removeLargeViewportProbe(win: Window = window): void {
  win.document.documentElement
    .querySelector("[data-pano-lvh-probe]")
    ?.remove();
}

export function readIphoneFullscreenViewport(
  win: Window = window,
): IphoneFullscreenViewport {
  const visual = win.visualViewport;
  const landscape =
    typeof win.matchMedia === "function"
      ? win.matchMedia("(orientation: landscape)").matches
      : win.innerWidth > win.innerHeight;
  let inIframe = false;
  try {
    inIframe = win.self !== win.top;
  } catch {
    inIframe = true;
  }
  return {
    inIframe,
    landscape,
    largeViewportHeight: readLargeViewportHeight(win),
    scrollY: win.scrollY || win.pageYOffset || 0,
    visualViewportHeight: visual?.height ?? win.innerHeight,
    visualViewportOffsetTop: visual?.offsetTop ?? 0,
  };
}

export function computeChromeOverlapPx(
  viewport: IphoneFullscreenViewport,
): number {
  return Math.max(0, viewport.largeViewportHeight - viewport.visualViewportHeight);
}

function emptyExtents(): IphoneFullscreenExtents {
  return {
    maxVisualHeight: 0,
    minVisualHeight: Number.POSITIVE_INFINITY,
  };
}

function noteVisualHeight(
  extents: IphoneFullscreenExtents,
  height: number,
): void {
  if (!(height > 0)) {
    return;
  }
  extents.minVisualHeight = Math.min(extents.minVisualHeight, height);
  extents.maxVisualHeight = Math.max(extents.maxVisualHeight, height);
}

/**
 * True once Safari's toolbar is gone. A scrolled page is not enough: the
 * visual viewport has to catch the large viewport, leaving at most the
 * home-indicator gap. Growth to a high-water mark covers the case where
 * `100lvh` stays taller than the viewport Safari will actually reveal.
 */
export function isIphoneChromeCollapsed(
  viewport: IphoneFullscreenViewport,
  extents?: IphoneFullscreenExtents,
): boolean {
  const overlap = computeChromeOverlapPx(viewport);
  if (overlap <= BAR_COLLAPSED_TOLERANCE_PX) {
    return true;
  }
  if (!extents || !(extents.minVisualHeight > 0) || !(extents.maxVisualHeight > 0)) {
    return false;
  }
  // A finished swipe-up leaves scrollY and offsetTop above zero. That used to
  // flip the hint to "swipe down, then swipe up" even though the bars were gone.
  // Growth of the visual viewport is the collapse signal, not the scroll offset.
  const growth = extents.maxVisualHeight - extents.minVisualHeight;
  const atHighWater =
    viewport.visualViewportHeight >= extents.maxVisualHeight - 2;
  return growth >= CHROME_GROWTH_PX && atHighWater;
}

export function computeScrollAwayDistance(
  viewport: IphoneFullscreenViewport,
  extents?: IphoneFullscreenExtents,
): number {
  if (!viewport.landscape || viewport.inIframe) {
    return 0;
  }
  if (isIphoneChromeCollapsed(viewport, extents)) {
    return 0;
  }
  return Math.max(1, Math.ceil(computeChromeOverlapPx(viewport)));
}

/**
 * Derives the swipe instruction state from a viewport measurement.
 * Portrait and iframes report 0 (no swipe UI); covering still applies.
 * State 0 also means the bars are already collapsed, even if the document
 * is still scrolled.
 */
export function computeIphoneFullscreenState(
  viewport: IphoneFullscreenViewport,
  extents?: IphoneFullscreenExtents,
): IphoneFullscreenState {
  if (!viewport.landscape || viewport.inIframe) {
    return 0;
  }
  if (isIphoneChromeCollapsed(viewport, extents)) {
    return 0;
  }
  if (
    viewport.scrollY > SCROLL_OFFSET_TOLERANCE_PX ||
    viewport.visualViewportOffsetTop > SCROLL_OFFSET_TOLERANCE_PX
  ) {
    return 2;
  }
  return 1;
}

function captureElementStyle(element: HTMLElement): ElementStyleSnapshot {
  const snapshot = {} as ElementStyleSnapshot;
  for (const property of ELEMENT_STYLE_PROPERTIES) {
    snapshot[property] = element.style.getPropertyValue(property);
  }
  return snapshot;
}

function restoreElementStyle(
  element: HTMLElement,
  snapshot: ElementStyleSnapshot,
): void {
  for (const property of ELEMENT_STYLE_PROPERTIES) {
    const previous = snapshot[property];
    if (previous) {
      element.style.setProperty(property, previous);
    } else {
      element.style.removeProperty(property);
    }
  }
}

function captureDocumentStyle(): DocumentStyleSnapshot {
  const documentElement = document.documentElement;
  const body = document.body;
  return {
    bodyHeight: body.style.height,
    bodyMinHeight: body.style.minHeight,
    bodyOverflow: body.style.overflow,
    documentHeight: documentElement.style.height,
    documentOverflow: documentElement.style.overflow,
    scrollX: window.scrollX || window.pageXOffset || 0,
    scrollY: window.scrollY || window.pageYOffset || 0,
  };
}

function restoreDocumentStyle(snapshot: DocumentStyleSnapshot): void {
  const documentElement = document.documentElement;
  const body = document.body;
  documentElement.style.overflow = snapshot.documentOverflow;
  documentElement.style.height = snapshot.documentHeight;
  body.style.overflow = snapshot.bodyOverflow;
  body.style.height = snapshot.bodyHeight;
  body.style.minHeight = snapshot.bodyMinHeight;
  window.scrollTo(snapshot.scrollX, snapshot.scrollY);
}

function applyCoverStyle(element: HTMLElement): void {
  const visual = window.visualViewport;
  const top = visual?.offsetTop ?? 0;
  const left = visual?.offsetLeft ?? 0;
  const width = visual?.width ?? window.innerWidth;
  const height = visual?.height ?? window.innerHeight;
  element.style.setProperty("background", "#000");
  element.style.setProperty("position", "fixed");
  element.style.setProperty("top", `${top}px`);
  element.style.setProperty("left", `${left}px`);
  element.style.setProperty("width", `${width}px`);
  element.style.setProperty("height", `${height}px`);
  element.style.setProperty("z-index", "2147483000");
}

function setDocumentScrollable(scrollDistance: number): void {
  const documentElement = document.documentElement;
  const body = document.body;
  documentElement.style.overflow = "visible";
  body.style.overflow = "visible";
  if (scrollDistance > 0) {
    body.style.minHeight = `${window.innerHeight + scrollDistance + 64}px`;
  } else {
    body.style.minHeight = "";
  }
}

function lockDocumentScroll(): void {
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.minHeight = "";
}

function notifyListeners(): void {
  for (const listener of globalListeners) {
    listener();
  }
}

function publishSnapshot(
  session: ActiveSession,
  viewport: IphoneFullscreenViewport,
  state: IphoneFullscreenState,
): void {
  lastSnapshot = {
    active: true,
    allowsDocumentScroll:
      viewport.landscape && !viewport.inIframe && state !== 0,
    element: session.element,
    portrait: !viewport.landscape,
    state,
  };
  notifyListeners();
}

function rememberViewport(
  session: ActiveSession,
  viewport: IphoneFullscreenViewport,
): void {
  if (session.extentsLandscape !== viewport.landscape) {
    session.extents = emptyExtents();
    session.extentsLandscape = viewport.landscape;
    session.barsHidden = false;
  }
  noteVisualHeight(session.extents, viewport.visualViewportHeight);
}

function resolveState(
  session: ActiveSession,
  viewport: IphoneFullscreenViewport,
): IphoneFullscreenState {
  const state = computeIphoneFullscreenState(viewport, session.extents);
  if (!viewport.landscape || viewport.inIframe) {
    return state;
  }
  if (state === 0) {
    session.barsHidden = true;
    return 0;
  }
  if (!session.barsHidden) {
    return state;
  }
  // Bars already collapsed. A later sample can still report scroll offset;
  // only a real shrink means the chrome came back.
  if (viewport.visualViewportHeight < session.extents.maxVisualHeight - 48) {
    session.barsHidden = false;
    return state;
  }
  return 0;
}

function syncSessionLayout(
  session: ActiveSession,
  options?: { followUp?: boolean },
): void {
  const viewport = readIphoneFullscreenViewport();
  rememberViewport(session, viewport);
  const state = resolveState(session, viewport);
  applyCoverStyle(session.element);

  if (!viewport.landscape || viewport.inIframe || state === 0) {
    // Keep the scrolled position so Safari does not restore the bars.
    lockDocumentScroll();
    publishSnapshot(session, viewport, state);
    return;
  }

  const distance = computeScrollAwayDistance(viewport, session.extents);
  setDocumentScrollable(distance);
  if (distance > 0 && viewport.scrollY < distance - 1) {
    window.scrollTo(0, distance);
  }
  applyCoverStyle(session.element);
  const settled = readIphoneFullscreenViewport();
  rememberViewport(session, settled);
  publishSnapshot(session, settled, resolveState(session, settled));

  if (options?.followUp) {
    return;
  }
  window.clearTimeout(session.remeasureTimer);
  session.remeasureTimer = window.setTimeout(() => {
    if (activeSession !== session) {
      return;
    }
    syncSessionLayout(session, { followUp: true });
  }, REMEASURE_DELAY_MS);
  window.requestAnimationFrame(() => {
    if (activeSession !== session) {
      return;
    }
    syncSessionLayout(session, { followUp: true });
  });
}

function attachSessionListeners(session: ActiveSession): void {
  const onChange = () => {
    if (activeSession !== session) {
      return;
    }
    syncSessionLayout(session);
  };
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("scroll", onChange, { passive: true });
  window.visualViewport?.addEventListener("resize", onChange);
  window.visualViewport?.addEventListener("scroll", onChange);
  session.orientationCleanup = () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("scroll", onChange);
    window.visualViewport?.removeEventListener("resize", onChange);
    window.visualViewport?.removeEventListener("scroll", onChange);
  };
}

function endSession(session: ActiveSession): void {
  if (activeSession !== session) {
    return;
  }
  activeSession = null;
  window.clearTimeout(session.remeasureTimer);
  session.orientationCleanup?.();
  session.orientationCleanup = null;
  restoreElementStyle(session.element, session.elementStyle);
  removeLargeViewportProbe();
  restoreDocumentStyle(session.documentStyle);
  lastSnapshot = {
    active: false,
    allowsDocumentScroll: false,
    element: null,
    portrait: false,
    state: 0,
  };
  notifyListeners();
}

/**
 * Starts or joins an iPhone landscape fullscreen session for `element`.
 * No-ops when the environment is not a candidate.
 */
export function acquireIphoneLandscapeFullscreen(
  element: Element,
  holder: IphoneFullscreenHolder,
): boolean {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (!supportsIphoneLandscapeFullscreen()) {
    return false;
  }

  if (activeSession) {
    if (activeSession.element !== element) {
      endSession(activeSession);
    } else {
      activeSession.holders.add(holder);
      syncSessionLayout(activeSession);
      return true;
    }
  }

  const session: ActiveSession = {
    barsHidden: false,
    documentStyle: captureDocumentStyle(),
    element,
    elementStyle: captureElementStyle(element),
    extents: emptyExtents(),
    extentsLandscape: null,
    holders: new Set([holder]),
    orientationCleanup: null,
    remeasureTimer: 0,
  };
  activeSession = session;
  attachSessionListeners(session);
  syncSessionLayout(session);
  return true;
}

export function releaseIphoneLandscapeFullscreen(
  element: Element,
  holder: IphoneFullscreenHolder,
): void {
  const session = activeSession;
  if (!session || session.element !== element) {
    return;
  }
  session.holders.delete(holder);
  if (session.holders.size > 0) {
    return;
  }
  endSession(session);
}

export function isIphoneLandscapeFullscreenActive(
  element?: Element | null,
): boolean {
  if (!activeSession) {
    return false;
  }
  if (!element) {
    return true;
  }
  return (
    activeSession.element === element ||
    activeSession.element.contains(element) ||
    element.contains(activeSession.element)
  );
}

export function getIphoneLandscapeFullscreenSnapshot(): IphoneFullscreenSessionSnapshot {
  return lastSnapshot;
}

/**
 * Subscribe to session snapshot changes. Works before a session starts so
 * chrome and touch controls can react to acquire/release.
 */
export function subscribeIphoneLandscapeFullscreen(
  onChange: () => void,
): () => void {
  globalListeners.add(onChange);
  return () => {
    globalListeners.delete(onChange);
  };
}

/** @internal Test helper — tear down any leftover session. */
export function __resetIphoneLandscapeFullscreenForTests(): void {
  if (activeSession) {
    endSession(activeSession);
  }
  lastSnapshot = {
    active: false,
    allowsDocumentScroll: false,
    element: null,
    portrait: false,
    state: 0,
  };
  globalListeners.clear();
}
