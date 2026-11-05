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
import {
  overlayBoxStyle,
  overlayChevron,
  resolveOverlayAnchor,
  type PanoOverlayAnchor,
} from "../overlay/align";
import {
  resolveOverlayToggleIcon,
  type PanoOverlayToggle,
} from "../overlay/toggle";
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
  presentation?: "panel" | "dialog";
  /**
   * Override the document anchor for this mount.
   * Fields replace the document anchor field by field.
   */
  anchor?: PanoOverlayAnchor;
  /** Override panel or dialog-launcher width in CSS pixels. */
  width?: number;
  /** Override panel or dialog-launcher height in CSS pixels. */
  height?: number;
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
  /**
   * Panel edge-tab icon and chrome. Omit to keep the default chevron.
   * Dialog mode has no edge tab.
   */
  toggle?: PanoOverlayToggle;
  /** When true, fill a large authoring surface instead of visitor presentation. */
  editorSurface?: boolean;
};

const DEFAULT_DIALOG_WIDTH = 720;
const DEFAULT_DIALOG_HEIGHT = 520;

const MAP_ANCHOR_DEFAULTS = { align: "bottom-left" as const, inset: 16 };

function mergeAnchor(
  base: PanoOverlayAnchor | undefined,
  override: PanoOverlayAnchor | undefined,
): PanoOverlayAnchor | undefined {
  if (base === undefined && override === undefined) return undefined;
  return {
    ...base,
    ...override,
    inset: override?.inset !== undefined ? override.inset : base?.inset,
  };
}

const CHEVRON_PATHS = {
  up: "M3 11l5-6 5 6",
  down: "M3 5l5 6 5-6",
  left: "M11 3 5 8l6 5",
  right: "M5 3l6 5-6 5",
} as const;

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
 * Visitor-facing map chrome for `PanoOverlay`.
 * Panel mode anchors the map on the viewer; dialog mode opens it from a launcher.
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
  anchor: anchorProp,
  width: widthProp,
  height: heightProp,
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
  toggle,
  editorSurface = false,
}: PanoMapOverlayProps) {
  const { size } = usePanoOverlay();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const basePresentation = presentationOverride ?? map.presentation ?? {
    mode: "panel" as const,
    width: 220,
    height: 160,
  };
  const presentationMode = presentationModeProp ?? basePresentation.mode;
  const resolvedAnchor = resolveOverlayAnchor(
    mergeAnchor(basePresentation.anchor, anchorProp),
    MAP_ANCHOR_DEFAULTS,
  );
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
    const launcherBox = overlayBoxStyle(resolvedAnchor.align, resolvedAnchor.inset, width, height);
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

  const collapseEnabled = showCollapseControl ?? map.controls?.collapse === true;
  const box = overlayBoxStyle(resolvedAnchor.align, resolvedAnchor.inset, width, height);
  const arrow = overlayChevron(resolvedAnchor.collapseEdge, collapsed);

  return (
    <div
      className={["pano-overlay-anchor", "pano-map-overlay", className].filter(Boolean).join(" ")}
      style={{
        position: "absolute",
        pointerEvents: collapseEnabled && collapsed ? "none" : "auto",
        ["--pano-overlay-dock-inset" as string]: resolvedAnchor.dockInset,
        ["--pano-overlay-anchor-radius" as string]: "8px",
        ...box,
        ...style,
      }}
      data-pano-map-overlay=""
      data-presentation="panel"
      data-collapse-edge={resolvedAnchor.collapseEdge}
      data-collapsed={collapseEnabled && collapsed ? "true" : "false"}
    >
      <div
        className="pano-map-overlay-surface"
        aria-hidden={collapseEnabled && collapsed ? true : undefined}
        {...(collapseEnabled && collapsed ? ({ inert: true } as { inert: boolean }) : null)}
        style={{ height: "100%", width: "100%" }}
      >
        <PanoMap {...mapProps} showCollapseControl={false} />
      </div>
      {collapseEnabled ? (
        <button
          type="button"
          className={["pano-map-control", "pano-overlay-anchor-toggle", toggle?.className]
            .filter(Boolean)
            .join(" ")}
          aria-label={collapsed ? "Expand map" : "Collapse map"}
          aria-pressed={!collapsed}
          style={toggle?.style}
          onClick={() => setCollapsed((value) => !value)}
        >
          {toggle?.icon === undefined ? (
            <svg
              aria-hidden
              fill="none"
              height="16"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
              viewBox="0 0 16 16"
              width="16"
            >
              <path d={CHEVRON_PATHS[arrow]} />
            </svg>
          ) : (
            resolveOverlayToggleIcon(toggle.icon, collapsed)
          )}
        </button>
      ) : null}
    </div>
  );
}
