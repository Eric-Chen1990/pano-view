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
} from "./presets";

export type PanoFilterProps = {
  /** Built-in look. Defaults to `none` (identity). */
  preset?: PanoFilterPreset;
  /** Mix with the original panorama, 0–1. Defaults to 1. */
  intensity?: number;
  /** When false, the panorama renders without a filter. Defaults to true. */
  enabled?: boolean;
};

/**
 * Applies a color or artistic filter to the panorama source of the nearest
 * PanoViewer. Render one instance as a child of PanoViewer. Hotspots and HTML
 * chrome are not filtered.
 */
export function PanoFilter({
  preset = "none",
  intensity,
  enabled = true,
}: PanoFilterProps) {
  const host = useContext(PanoFilterHostContext);
  if (!host) {
    throw new Error("<PanoFilter> must be rendered inside <PanoViewer>.");
  }

  const snapshot = useMemo(
    () => resolvePanoFilterSnapshot({ preset, intensity, enabled }),
    [enabled, intensity, preset],
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
