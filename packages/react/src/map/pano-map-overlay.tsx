import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { PanoMapDefinition, PanoMapSpotDefinition } from "../data/map";
import { usePanoModal, usePanoOverlay } from "../overlay/pano-overlay";
import type { PanoViewerState } from "../types";
import { PanoMap, type PanoMapEditChange, type PanoMapProps } from "./pano-map";

export type PanoMapOverlayProps = {
  map: PanoMapDefinition;
  activeSceneId?: string | null;
  onSelectScene?: (sceneId: string, spot: PanoMapSpotDefinition) => void;
  view?: PanoViewerState;
  mode?: PanoMapProps["mode"];
  selectedSpotId?: string | null;
  onSelectedSpotIdChange?: (spotId: string | null) => void;
  onEditChange?: (change: PanoMapEditChange) => void;
  placementSceneId?: string | null;
  /** Force presentation while authoring, ignoring document presentation temporarily. */
  presentationOverride?: PanoMapDefinition["presentation"];
  openLabel?: string;
  closeLabel?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  /** When true, fill a large authoring surface instead of visitor presentation. */
  editorSurface?: boolean;
};

type MapCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/**
 * Anchor the map chrome to the full viewer overlay, not the screen-visible
 * intersection. Parent page scroll must not move, shrink, or re-dock the map.
 */
function dockedBox(
  corner: MapCorner,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
): CSSProperties {
  const horizontal =
    corner === "top-right" || corner === "bottom-right"
      ? { left: "auto" as const, right: offsetX }
      : { left: offsetX, right: "auto" as const };
  const vertical =
    corner === "bottom-left" || corner === "bottom-right"
      ? { top: "auto" as const, bottom: offsetY }
      : { top: offsetY, bottom: "auto" as const };
  return { ...horizontal, ...vertical, width, height };
}

/** Viewer-local map dialog. Avoids document modal locks from Radix Dialog. */
function PanoMapDialogShell({
  open,
  onOpenChange,
  title,
  closeLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  closeLabel: string;
  children: ReactNode;
}) {
  usePanoModal(open);
  const { size } = usePanoOverlay();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const active = panelRef.current?.ownerDocument.activeElement;
    previouslyFocused.current = active instanceof HTMLElement ? active : null;
    const close = panelRef.current?.querySelector<HTMLElement>("[data-pano-map-dialog-close]");
    close?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
      }
    };
    const doc = panelRef.current?.ownerDocument;
    doc?.addEventListener("keydown", onKeyDown, true);
    return () => {
      doc?.removeEventListener("keydown", onKeyDown, true);
      const previous = previouslyFocused.current;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  const width = Math.min(720, Math.max(0, size.width - 32));
  const height = Math.min(520, Math.max(0, size.height - 32));
  const left = Math.max(0, (size.width - width) / 2);
  const top = Math.max(0, (size.height - height) / 2);

  return (
    <>
      <div
        className="pano-map-dialog-backdrop"
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "auto",
        }}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        className="pano-map-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-pano-map-dialog=""
        style={{
          position: "absolute",
          left,
          top,
          width,
          height,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          pointerEvents: "auto",
          zIndex: 1,
        }}
      >
        <header className="pano-map-dialog-header" style={{ flexShrink: 0 }}>
          <h2 id={titleId} className="pano-map-dialog-title">
            {title}
          </h2>
          <button
            type="button"
            className="pano-map-dialog-close"
            data-pano-map-dialog-close=""
            aria-label={closeLabel}
            onClick={() => onOpenChange(false)}
          >
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </header>
        <div className="pano-map-dialog-body" style={{ minHeight: 0, flex: 1 }}>
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * Visitor-facing map chrome for `PanoViewer.renderOverlay`.
 * Docked panels stay in a corner; dialog mode opens the same map in a modal.
 */
export function PanoMapOverlay({
  map,
  activeSceneId,
  onSelectScene,
  view,
  mode = "view",
  selectedSpotId,
  onSelectedSpotIdChange,
  onEditChange,
  placementSceneId,
  presentationOverride,
  openLabel = "Map",
  closeLabel = "Close",
  title = "Map",
  className,
  style,
  editorSurface = false,
}: PanoMapOverlayProps) {
  const { size } = usePanoOverlay();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const presentation = presentationOverride ?? map.presentation ?? {
    mode: "docked" as const,
    corner: "bottom-left" as const,
    width: 220,
    height: 160,
    offsetX: 16,
    offsetY: 16,
  };
  const corner = presentation.corner ?? "bottom-left";
  const offsetX = presentation.offsetX ?? 16;
  const offsetY = presentation.offsetY ?? 16;
  const width = presentation.width ?? (presentation.mode === "dialog" ? 48 : 220);
  const height = presentation.height ?? (presentation.mode === "dialog" ? 48 : 160);

  const mapProps: PanoMapProps = {
    map,
    activeSceneId,
    view,
    mode,
    selectedSpotId,
    onSelectedSpotIdChange,
    onEditChange,
    placementSceneId,
    onSelectScene: (sceneId, spot) => {
      onSelectScene?.(sceneId, spot);
      if (presentation.mode === "dialog") setOpen(false);
    },
  };

  const editorBox = useMemo(() => {
    const panelWidth = Math.min(420, Math.max(240, size.width * 0.45));
    const panelHeight = Math.min(320, Math.max(180, size.height * 0.45));
    return {
      left: 16,
      right: "auto" as const,
      top: "auto" as const,
      bottom: 16,
      width: panelWidth,
      height: panelHeight,
    };
  }, [size.height, size.width]);

  if (editorSurface) {
    return (
      <div
        className={["pano-map-overlay", "pano-map-overlay-editor", className]
          .filter(Boolean)
          .join(" ")}
        style={{
          position: "absolute",
          pointerEvents: "auto",
          ...editorBox,
          ...style,
        }}
        data-pano-map-overlay=""
      >
        <PanoMap {...mapProps} showCollapseControl={false} />
      </div>
    );
  }

  if (presentation.mode === "dialog") {
    const launcherBox = dockedBox(corner, offsetX, offsetY, width, height);
    return (
      <div className={["pano-map-overlay", className].filter(Boolean).join(" ")} data-pano-map-overlay="">
        <button
          type="button"
          className="pano-map-launcher"
          aria-label={openLabel}
          style={{
            position: "absolute",
            pointerEvents: "auto",
            ...launcherBox,
            ...style,
          }}
          onClick={() => setOpen(true)}
        >
          {openLabel}
        </button>
        <PanoMapDialogShell
          open={open}
          onOpenChange={setOpen}
          title={title}
          closeLabel={closeLabel}
        >
          <div style={{ height: "100%" }}>
            <PanoMap {...mapProps} showCollapseControl={false} />
          </div>
        </PanoMapDialogShell>
      </div>
    );
  }

  const panelWidth = collapsed ? Math.max(44, Math.min(width, 56)) : width;
  const panelHeight = collapsed ? Math.max(44, Math.min(height, 56)) : height;
  const box = dockedBox(corner, offsetX, offsetY, panelWidth, panelHeight);

  return (
    <div
      className={["pano-map-overlay", className].filter(Boolean).join(" ")}
      style={{
        position: "absolute",
        pointerEvents: "auto",
        ...box,
        ...style,
      }}
      data-pano-map-overlay=""
      data-presentation="docked"
    >
      <PanoMap
        {...mapProps}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />
    </div>
  );
}
