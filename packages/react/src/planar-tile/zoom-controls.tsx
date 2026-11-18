import { normalizeMaxScale } from "./geometry";
import { ZOOM_STEP, type PlanarControls } from "./runtime";

export function PlanarZoomControls({ controls, ready, maxScale }: {
  controls: Pick<PlanarControls, "zoom" | "reset"> | null;
  ready: boolean;
  maxScale?: number;
}) {
  const zoomDisabled = !ready || normalizeMaxScale(maxScale) === 1;
  return (
    <div className="pano-planar-controls" role="group" aria-label="Image controls">
      <button type="button" aria-label="Zoom out" disabled={zoomDisabled} onClick={() => controls?.zoom(1 / ZOOM_STEP)}>−</button>
      <button type="button" aria-label="Fit image" disabled={!ready} onClick={() => controls?.reset()}>Fit</button>
      <button type="button" aria-label="Zoom in" disabled={zoomDisabled} onClick={() => controls?.zoom(ZOOM_STEP)}>+</button>
    </div>
  );
}
