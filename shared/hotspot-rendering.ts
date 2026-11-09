/** Effective rules shared by the viewer and authoring interfaces. */
export function hotspotScaleMode(
  mode: "billboard" | "surface" = "billboard",
  scaleMode?: "fixed" | "fov",
): "fixed" | "fov" {
  return mode === "surface" ? "fov" : (scaleMode ?? "fixed");
}

export function tooltipScaleMode(
  mode: "billboard" | "surface",
  scaleMode: "inherit" | "fixed" | "fov" | undefined,
  hotspotScale: "fixed" | "fov",
): "fixed" | "fov" {
  return mode === "surface"
    ? "fov"
    : !scaleMode || scaleMode === "inherit"
      ? hotspotScale
      : scaleMode;
}
