import { useContext, useEffect, useMemo } from "react";
import {
  claimPanoFilter,
  PanoFilterHostContext,
  releasePanoFilter,
  setPanoFilterSnapshot,
} from "./host";
import {
  resolvePanoFilterSnapshot,
  type PanoFilterPreset,
  type PanoColorMatrix,
} from "./presets";

export type PanoFilterProps = {
  /** Built-in look. Defaults to `none` (identity). */
  preset?: PanoFilterPreset;
  /** Mix with the original panorama, 0–1. Defaults to 1. */
  intensity?: number;
  /** Display-space RGBA matrix applied after the artistic preset. */
  colorMatrix?: PanoColorMatrix | null;
  /** `all` also filters hotspot textures. HTML tooltips/chrome remain host-styled. */
  colorMatrixScope?: "panorama" | "all";
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
      }),
    [enabled, intensity, preset, colorMatrix, colorMatrixScope],
  );

  useEffect(() => {
    claimPanoFilter(host);
    return () => {
      releasePanoFilter(host);
    };
  }, [host]);

  useEffect(() => {
    setPanoFilterSnapshot(host, snapshot);
  }, [host, snapshot]);

  return null;
}
