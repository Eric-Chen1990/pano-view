import { useRequiresWebGL } from "../pano-renderer";
import { useContext, useLayoutEffect, useMemo } from "react";
import type { PanoColorAdjustments } from "./adjustments";
import { PanoClarityPass } from "./clarity-pass";
import {
  claimPanoFilter,
  PanoFilterHostContext,
  releasePanoFilter,
  setPanoFilterSnapshot,
} from "./host";
import {
  isPanoFilterActive,
  resolvePanoFilterSnapshot,
  type PanoFilterPreset,
  type PanoColorMatrix,
} from "./presets";

export type PanoFilterProps = {
  /** Built-in look. Defaults to `none` (identity). */
  preset?: PanoFilterPreset;
  /** Mix each preset and matrix with its input, 0–1. Defaults to 1. */
  intensity?: number;
  /** Display-space RGBA matrix applied after the artistic preset. */
  colorMatrix?: PanoColorMatrix | null;
  /** `all` also filters hotspot textures. HTML tooltips/chrome remain host-styled. */
  colorMatrixScope?: "panorama" | "all";
  /** Source-only SDR color adjustments, independent of preset intensity. */
  adjustments?: PanoColorAdjustments;
  /** When false, the panorama renders without a filter. Defaults to true. */
  enabled?: boolean;
};

/**
 * Applies a color or artistic filter to the panorama source of the nearest
 * PanoViewer. Render one instance as a child of PanoViewer. colorMatrixScope
 * can include hotspot textures; HTML chrome remains host-styled.
 */
export function PanoFilter({
  preset = "none",
  intensity,
  enabled = true,
  colorMatrix,
  colorMatrixScope,
  adjustments,
}: PanoFilterProps) {
  const host = useContext(PanoFilterHostContext);
  if (!host) {
    throw new Error("<PanoFilter> must be rendered inside <PanoViewer>.");
  }

  const snapshot = useMemo(
    () =>
      resolvePanoFilterSnapshot({
        preset,
        intensity,
        enabled,
        colorMatrix,
        colorMatrixScope,
        adjustments,
      }),
    [enabled, intensity, preset, colorMatrix, colorMatrixScope, adjustments],
  );

  const waitingForWebGL = useRequiresWebGL(isPanoFilterActive(snapshot));

  useLayoutEffect(() => {
    claimPanoFilter(host);
    return () => {
      releasePanoFilter(host);
    };
  }, [host]);

  useLayoutEffect(() => {
    if (!waitingForWebGL) setPanoFilterSnapshot(host, snapshot);
  }, [host, snapshot, waitingForWebGL]);

  return !waitingForWebGL && snapshot.enabled && snapshot.adjustments?.clarity
    ? <PanoClarityPass views={host.clarityViews} />
    : null;
}
