import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PanoModalHost } from "./modal-host";
import { getOverlayVisibleRect } from "./visible-rect";

export type PanoOverlayRenderContext = {
  /** Stable viewer-local portal target; null until the DOM has mounted. */
  portalContainer: HTMLDivElement | null;
  /** Available viewer space in CSS pixels, independent of nested portal targets. */
  size: { width: number; height: number };
  /** Screen-visible part of the viewer, in viewer-local CSS pixels. */
  visibleRect: { left: number; top: number; width: number; height: number };
  isFullscreen: boolean;
};

export const PanoOverlayContext = createContext<PanoOverlayRenderContext | null>(null);
export const PanoModalHostContext = createContext<PanoModalHost | null>(null);

/** Read inside PanoViewer.renderOverlay or its DOM descendants. */
export function usePanoOverlay(): PanoOverlayRenderContext {
  const context = useContext(PanoOverlayContext);
  if (!context) throw new Error("usePanoOverlay must be used inside PanoViewer.renderOverlay.");
  return context;
}

/** Coordinate a custom modal with viewer inputs. Accessibility stays with the modal. */
export function usePanoModal(open: boolean): void {
  const host = useContext(PanoModalHostContext);
  if (!host) throw new Error("usePanoModal must be used inside PanoViewer.renderOverlay.");
  useLayoutEffect(() => open ? host.acquire() : undefined, [host, open]);
}

/** Keep nested portals inside the active dialog's interactive subtree. */
export function PanoOverlayPortalProvider({
  container,
  children,
}: {
  container: HTMLDivElement | null;
  children: ReactNode;
}) {
  const context = usePanoOverlay();
  const value = useMemo(() => ({ ...context, portalContainer: container }), [context, container]);
  return <PanoOverlayContext.Provider value={value}>{children}</PanoOverlayContext.Provider>;
}

export function usePanoOverlayHost(isFullscreen: boolean) {
  const [portalContainer, setPortalContainer] = useState<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = useState({
    size: { width: 0, height: 0 },
    visibleRect: { left: 0, top: 0, width: 0, height: 0 },
  });
  useLayoutEffect(() => {
    if (!portalContainer) return;
    const win = portalContainer.ownerDocument.defaultView;
    if (!win) return;
    const measure = () => {
      const width = portalContainer.clientWidth;
      const height = portalContainer.clientHeight;
      const visual = win.visualViewport;
      const visibleRect = getOverlayVisibleRect(portalContainer.getBoundingClientRect(), {
        left: visual?.offsetLeft ?? 0, top: visual?.offsetTop ?? 0,
        width: visual?.width ?? win.innerWidth, height: visual?.height ?? win.innerHeight,
      });
      setGeometry((previous) => previous.size.width === width && previous.size.height === height
        && Object.keys(visibleRect).every((key) => visibleRect[key as keyof typeof visibleRect] === previous.visibleRect[key as keyof typeof visibleRect])
        ? previous : { size: { width, height }, visibleRect });
    };
    let frame = 0;
    const scheduleMeasure = () => {
      if (!frame) frame = win.requestAnimationFrame(() => { frame = 0; measure(); });
    };
    measure();
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(portalContainer);
    win.addEventListener("scroll", scheduleMeasure, true);
    win.addEventListener("resize", scheduleMeasure);
    win.visualViewport?.addEventListener("resize", scheduleMeasure);
    win.visualViewport?.addEventListener("scroll", scheduleMeasure);
    return () => {
      observer.disconnect();
      win.cancelAnimationFrame(frame);
      win.removeEventListener("scroll", scheduleMeasure, true);
      win.removeEventListener("resize", scheduleMeasure);
      win.visualViewport?.removeEventListener("resize", scheduleMeasure);
      win.visualViewport?.removeEventListener("scroll", scheduleMeasure);
    };
  }, [portalContainer]);
  const context = useMemo(() => ({ portalContainer, ...geometry, isFullscreen }), [portalContainer, geometry, isFullscreen]);
  return { context, setPortalContainer };
}
