import { usePanoUiTranslation } from "../ui-translation";
import { normalizeScaleLimit } from "./geometry";
import { ZOOM_STEP, type PlanarControls } from "./runtime";

export function PlanarZoomControls({ controls, ready, minScale, maxScale }: {
  controls: Pick<PlanarControls, "zoom" | "reset"> | null;
  ready: boolean;
  minScale?: number;
  maxScale?: number;
}) {
  const t = usePanoUiTranslation();
  const max = normalizeScaleLimit(maxScale) ?? Infinity;
  const min = Math.min(normalizeScaleLimit(minScale) ?? 1, max);
  const zoomDisabled = !ready || min === max;
  const resetLabel = min > 1 ? t("Reset view") : t("Fit image");
  return (
    <div className="pano-planar-controls" role="group" aria-label={t("Image controls")}>
      <button type="button" aria-label={t("Zoom out")} disabled={zoomDisabled} onClick={() => controls?.zoom(1 / ZOOM_STEP)}>−</button>
      <button type="button" aria-label={resetLabel} disabled={!ready} onClick={() => controls?.reset()}>
        {min > 1 ? resetLabel : t("Fit")}
      </button>
      <button type="button" aria-label={t("Zoom in")} disabled={zoomDisabled} onClick={() => controls?.zoom(ZOOM_STEP)}>+</button>
    </div>
  );
}
