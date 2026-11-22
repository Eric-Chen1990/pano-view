import { useId, useState, type ReactNode } from "react";
import { PanoMapDialogShell } from "../map/pano-map-overlay";
import { overlayBoxStyle, resolveOverlayAnchor, type PanoOverlayAnchor } from "../overlay/align";
import { usePanoOverlay } from "../overlay/pano-overlay";
import { PanoGeoMap, type PanoGeoMapProps } from "./pano-geo-map";

export type PanoGeoMapOverlayProps = PanoGeoMapProps & {
  presentation?: "panel" | "dialog";
  anchor?: PanoOverlayAnchor;
  width?: number;
  height?: number;
  openLabel?: string;
  title?: ReactNode;
  closeLabel?: string;
  /** Replace the dialog launcher button contents. Defaults to `openLabel` or "Online map". */
  launcher?: ReactNode;
  /** Replace the dialog close button contents. Defaults to the built-in X icon. */
  close?: ReactNode;
  /** Show a larger surface for editing inside the viewer. */
  editorSurface?: boolean;
};

export function PanoGeoMapOverlay({
  geoMap, presentation, anchor, width, height, openLabel, title, closeLabel, launcher, close,
  className, style, editorSurface, ...props
}: PanoGeoMapOverlayProps) {
  const { size } = usePanoOverlay();
  const [open, setOpen] = useState(false);
  const id = useId();
  const t = props.translate ?? ((value: string) => value);
  const saved = geoMap.presentation;
  const mode = editorSurface ? "panel" : presentation ?? saved?.mode ?? "panel";
  const align = resolveOverlayAnchor({ ...saved?.anchor, ...anchor }, {
    align: "bottom-left", inset: 16,
  });
  const panelWidth = width ?? (editorSurface ? Math.max(220, size.width * 0.57) : saved?.width) ?? 320;
  const panelHeight = height ?? (editorSurface ? Math.max(200, size.height * 0.62) : saved?.height) ?? 230;
  const resolvedOpenLabel = openLabel ?? t("Online map");
  const map = <PanoGeoMap {...props} geoMap={geoMap} viewSize={props.viewSize ?? size}
    onSelectScene={(sceneId, spot) => {
      props.onSelectScene?.(sceneId, spot);
      if (mode === "dialog" && !props.onEdit) setOpen(false);
    }} />;
  if (mode === "dialog") {
    return <>
      <button type="button" className={`pano-map-launcher ${className ?? ""}`}
        id={id} aria-haspopup="dialog" aria-expanded={open} aria-label={resolvedOpenLabel}
        style={{ ...overlayBoxStyle(align.align, align.inset, 106, 44), position: "absolute", pointerEvents: "auto", ...style }}
        onClick={() => setOpen(true)}>
        {launcher === undefined ? resolvedOpenLabel : launcher}
      </button>
      <PanoMapDialogShell open={open} onOpenChange={setOpen} title={title ?? t("Online map")}
        closeLabel={closeLabel ?? t("Close")} close={close}
        dialogWidth={width ?? saved?.width ?? 720} dialogHeight={height ?? saved?.height ?? 520}>
        {map}
      </PanoMapDialogShell>
    </>;
  }
  return <div className={`pano-geo-map-overlay ${className ?? ""}`}
    style={{ ...overlayBoxStyle(align.align, align.inset, panelWidth, panelHeight),
      maxWidth: Math.max(0, size.width - 32), maxHeight: Math.max(0, size.height - 32),
      position: "absolute", pointerEvents: "auto", ...style }}>
    {map}
  </div>;
}
