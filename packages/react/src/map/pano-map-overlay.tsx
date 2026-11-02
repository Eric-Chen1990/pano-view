import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  PanoMapCorner,
  PanoMapDefinition,
  PanoMapSpotDefinition,
} from "../data/map";
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
  /** Override presentation mode for this mount. */
  presentation?: "docked" | "dialog";
  /** Override docked corner (or dialog launcher corner). */
  corner?: PanoMapCorner;
  /** Override docked panel or dialog-launcher width in CSS pixels. */
  width?: number;
  /** Override docked panel or dialog-launcher height in CSS pixels. */
  height?: number;
  /** Horizontal inset from the chosen corner in CSS pixels. */
  offsetX?: number;
  /** Vertical inset from the chosen corner in CSS pixels. */
  offsetY?: number;
  /** Preferred dialog body width in CSS pixels; clamped to the viewer. */
  dialogWidth?: number;
  /** Preferred dialog body height in CSS pixels; clamped to the viewer. */
  dialogHeight?: number;
  /** Override map interaction for this mount. */
  interaction?: PanoMapDefinition["interaction"];
  /**
   * Maximum zoom multiplier relative to the contain-fit scale.
   * Values below 1 are treated as 1.
   */
  maxScale?: number;
  /**
   * Opening zoom relative to the contain-fit scale.
   * Clamped to `[1, maxScale]`. View state only; not written to the map document.
   */
  initialScale?: number;
  showZoomControls?: boolean;
  showCollapseControl?: boolean;
  /** Override spot icon edge length in CSS pixels. */
  iconSize?: number;
  openLabel?: string;
  closeLabel?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  /** When true, fill a large authoring surface instead of visitor presentation. */
  editorSurface?: boolean;
};

const DEFAULT_DIALOG_WIDTH = 720;
const DEFAULT_DIALOG_HEIGHT = 520;

/**
 * Anchor the map chrome to the full viewer overlay, not the screen-visible
 * intersection. Parent page scroll must not move, shrink, or re-dock the map.
 */
function dockedBox(
  corner: PanoMapCorner,
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
  dialogWidth,
  dialogHeight,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  closeLabel: string;
  dialogWidth: number;
  dialogHeight: number;
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

  const preferredWidth =
    Number.isFinite(dialogWidth) && dialogWidth > 0
      ? dialogWidth
      : DEFAULT_DIALOG_WIDTH;
  const preferredHeight =
    Number.isFinite(dialogHeight) && dialogHeight > 0
      ? dialogHeight
      : DEFAULT_DIALOG_HEIGHT;
  const width = Math.min(preferredWidth, Math.max(0, size.width - 32));
  const height = Math.min(preferredHeight, Math.max(0, size.height - 32));
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
  presentation: presentationModeProp,
  corner: cornerProp,
  width: widthProp,
  height: heightProp,
  offsetX: offsetXProp,
  offsetY: offsetYProp,
  dialogWidth = DEFAULT_DIALOG_WIDTH,
  dialogHeight = DEFAULT_DIALOG_HEIGHT,
  interaction,
  maxScale,
  initialScale,
  showZoomControls,
  showCollapseControl,
  iconSize,
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
  const basePresentation = presentationOverride ?? map.presentation ?? {
    mode: "docked" as const,
    corner: "bottom-left" as const,
    width: 220,
    height: 160,
    offsetX: 16,
    offsetY: 16,
  };
  const presentationMode = presentationModeProp ?? basePresentation.mode;
  const corner = cornerProp ?? basePresentation.corner ?? "bottom-left";
  const offsetX = offsetXProp ?? basePresentation.offsetX ?? 16;
  const offsetY = offsetYProp ?? basePresentation.offsetY ?? 16;
  const width =
    widthProp ??
    basePresentation.width ??
    (presentationMode === "dialog" ? 48 : 220);
  const height =
    heightProp ??
    basePresentation.height ??
    (presentationMode === "dialog" ? 48 : 160);

  const resolvedMap = useMemo((): PanoMapDefinition => {
    if (
      interaction === undefined &&
      maxScale === undefined &&
      iconSize === undefined
    ) {
      return map;
    }
    return {
      ...map,
      ...(interaction === undefined ? {} : { interaction }),
      ...(maxScale === undefined ? {} : { maxScale }),
      ...(iconSize === undefined ? {} : { iconSize }),
    };
  }, [iconSize, interaction, map, maxScale]);

  const mapProps: PanoMapProps = {
    map: resolvedMap,
    activeSceneId,
    view,
    mode,
    selectedSpotId,
    onSelectedSpotIdChange,
    onEditChange,
    placementSceneId,
    initialScale,
    showZoomControls,
    showCollapseControl,
    onSelectScene: (sceneId, spot) => {
      onSelectScene?.(sceneId, spot);
      if (presentationMode === "dialog") setOpen(false);
    },
  };

  const editorBox = useMemo(() => {
    const panelWidth =
      widthProp !== undefined && Number.isFinite(widthProp) && widthProp > 0
        ? widthProp
        : Math.min(420, Math.max(240, size.width * 0.45));
    const panelHeight =
      heightProp !== undefined && Number.isFinite(heightProp) && heightProp > 0
        ? heightProp
        : Math.min(320, Math.max(180, size.height * 0.45));
    return {
      left: 16,
      right: "auto" as const,
      top: "auto" as const,
      bottom: 16,
      width: panelWidth,
      height: panelHeight,
    };
  }, [heightProp, size.height, size.width, widthProp]);

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

  if (presentationMode === "dialog") {
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
          dialogWidth={dialogWidth}
          dialogHeight={dialogHeight}
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
