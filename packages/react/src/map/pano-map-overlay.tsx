import { useMemo, useState, type CSSProperties } from "react";
import type { PanoMapDefinition, PanoMapSpotDefinition } from "../data/map";
import { usePanoOverlay } from "../overlay/pano-overlay";
import type { PanoViewerState } from "../types";
import { PanoDialog } from "../ui/dialog";
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

function dockedBox(
  corner: "top-left" | "top-right" | "bottom-left" | "bottom-right",
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  visibleRect: { left: number; top: number; width: number; height: number },
): CSSProperties {
  const left =
    corner === "top-right" || corner === "bottom-right"
      ? visibleRect.left + visibleRect.width - offsetX - width
      : visibleRect.left + offsetX;
  const top =
    corner === "bottom-left" || corner === "bottom-right"
      ? visibleRect.top + visibleRect.height - offsetY - height
      : visibleRect.top + offsetY;
  return { left, top, width, height };
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
  const { visibleRect } = usePanoOverlay();
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
    const panelWidth = Math.min(420, Math.max(240, visibleRect.width * 0.45));
    const panelHeight = Math.min(320, Math.max(180, visibleRect.height * 0.45));
    return {
      left: visibleRect.left + 16,
      top: visibleRect.top + visibleRect.height - panelHeight - 16,
      width: panelWidth,
      height: panelHeight,
    };
  }, [visibleRect]);

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
    const launcherBox = dockedBox(corner, offsetX, offsetY, width, height, visibleRect);
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
        <PanoDialog
          open={open}
          onOpenChange={setOpen}
          title={title}
          closeLabel={closeLabel}
          style={{
            width: "min(720px, var(--pano-dialog-available-width))",
            height: "min(520px, var(--pano-dialog-available-height))",
            ["--pano-dialog-width" as string]: "720px",
          }}
        >
          <div style={{ height: "min(420px, calc(var(--pano-dialog-available-height) - 72px))" }}>
            <PanoMap {...mapProps} showCollapseControl={false} />
          </div>
        </PanoDialog>
      </div>
    );
  }

  const panelWidth = collapsed ? Math.max(44, Math.min(width, 56)) : width;
  const panelHeight = collapsed ? Math.max(44, Math.min(height, 56)) : height;
  const box = dockedBox(corner, offsetX, offsetY, panelWidth, panelHeight, visibleRect);

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
