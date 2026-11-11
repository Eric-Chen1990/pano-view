import type { PanoSpatialControlAdapter } from "./host";

/** Footer controls belong to the surface, independently of the current pointer hit. */
export function resolveSurfaceModelAdapter(
  surface: Pick<HTMLElement, "contains">,
  controls: ReadonlyMap<HTMLElement, PanoSpatialControlAdapter>,
  hovered: PanoSpatialControlAdapter | null,
  previous: PanoSpatialControlAdapter | null,
): PanoSpatialControlAdapter | null {
  let first: PanoSpatialControlAdapter | null = null;
  let retained: PanoSpatialControlAdapter | null = null;
  for (const [node, adapter] of controls) {
    if (!surface.contains(node)) continue;
    first ??= adapter;
    if (adapter === hovered) return adapter;
    if (adapter === previous) retained = adapter;
  }
  return retained ?? first;
}
