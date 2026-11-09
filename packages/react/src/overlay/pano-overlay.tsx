import { SpatialHostContext, type PanoSpatialControlAdapter, type SpatialSurface } from "../spatial/host";
import {
  createContext,
  useCallback,
  useRef,
  useSyncExternalStore,
  type RefObject,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PanoModalHost } from "./modal-host";
import { PANO_OVERLAY_TYPE } from "./partition";
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

/** True only inside the viewer-plane overlay outlet (not the Three.js tree). */
export const PanoOverlayOutletContext = createContext(false);

export type PanoOverlayProps = {
  children?: ReactNode;
};

/**
 * Screen-plane DOM UI for PanoViewer. Place it as a direct child of PanoViewer
 * (or inside a Fragment under PanoViewer). It stays outside the panorama sphere
 * and remains visible in fullscreen, but is hidden during VR sessions. Dialogs
 * portaled to the viewer host can still render spatially. Interactive children
 * need `pointerEvents: "auto"`.
 */
export function PanoOverlay({ children }: PanoOverlayProps) {
  const inOutlet = useContext(PanoOverlayOutletContext);
  if (!inOutlet) {
    throw new Error(
      "PanoOverlay must be a direct child of PanoViewer (or of a Fragment under PanoViewer), not nested inside scene components.",
    );
  }
  return <>{children}</>;
}

(PanoOverlay as typeof PanoOverlay & { [PANO_OVERLAY_TYPE]: true })[PANO_OVERLAY_TYPE] =
  true;

const OVERLAY_HOOK_SCOPE = "PanoOverlay or PanoViewer.renderOverlay";

/** Read inside PanoOverlay, renderOverlay, or their DOM descendants. */
export function usePanoOverlay(): PanoOverlayRenderContext {
  const context = useContext(PanoOverlayContext);
  if (!context) {
    throw new Error(`usePanoOverlay must be used inside ${OVERLAY_HOOK_SCOPE}.`);
  }
  return context;
}

/** Coordinate a custom modal with viewer inputs. Accessibility stays with the modal. */
export function usePanoModal(open: boolean): void {
  const host = useContext(PanoModalHostContext);
  if (!host) {
    throw new Error(`usePanoModal must be used inside ${OVERLAY_HOOK_SCOPE}.`);
  }
  useLayoutEffect(() => (open ? host.acquire() : undefined), [host, open]);
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
        && visibleRect.left === previous.visibleRect.left && visibleRect.top === previous.visibleRect.top
        && visibleRect.width === previous.visibleRect.width && visibleRect.height === previous.visibleRect.height
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


export type { PanoSpatialControlAdapter } from "../spatial/host";

/** Shared portal/ref adapter for package and third-party dialogs. */
export function usePanoDialogSurface({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const host = useContext(SpatialHostContext);
  const overlay = usePanoOverlay();
  useSyncExternalStore(
    host?.subscribe ?? (() => () => {}),
    host?.getSnapshot ?? (() => 0),
    () => 0
  );
  const spatial = Boolean(host?.mode);
  usePanoModal(open && !spatial);
  const callback = useRef(onOpenChange);
  callback.current = onOpenChange;
  const surface = useRef<SpatialSurface | null>(null);
  const element = useRef<HTMLElement | null>(null);
  const contentRef = useCallback(
    (node: HTMLElement | null) => {
      element.current = node;
      if (host && surface.current) {
        host.surfaces.delete(surface.current);
        surface.current = null;
        host.notify();
      }
      if (host && node && open) {
        const entry = { element: node, close: () => callback.current(false) };
        surface.current = entry;
        host.surfaces.add(entry);
        host.notify();
      }
    },
    [host, open]
  );
  useLayoutEffect(
    () => () => {
      if (host && surface.current) {
        host.surfaces.delete(surface.current);
        surface.current = null;
        host.notify();
      }
    },
    [host]
  );
  // Keep the DOM node and portal target stable; only move its presentation offscreen.
  return {
    ...overlay,
    presentation: spatial ? ("spatial" as const) : ("screen" as const),
    contentRef,
    visibleRect: spatial
      ? { left: 0, top: 0, width: 672, height: 720 }
      : overlay.visibleRect,
  };
}

export function usePanoSpatialControls(
  ref: RefObject<HTMLElement | null>,
  adapter: PanoSpatialControlAdapter
) {
  const host = useContext(SpatialHostContext);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!host || !node) return;
    host.controls.set(node, adapter);
    host.notify();
    return () => {
      host.controls.delete(node);
      host.notify();
    };
  }, [host, ref, adapter]);
}

/** @internal Shared by ESM/CJS dialog parts; owned by the viewer runtime. */
export const PanoDialogSurfaceContext = createContext<ReturnType<typeof usePanoDialogSurface> | null>(null);
