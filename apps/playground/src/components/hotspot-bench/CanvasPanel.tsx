import { usePlaygroundLanguage } from "../../i18n/language";
import {
  PanoViewer,
  Tile,
  usePanoViewer,
} from "@ericchen1990/pano-view";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../../cn";
import { cubeTileProps, INITIAL_VIEW } from "../../constants";
import { segmentedButtonClassName } from "../../ui";
import { HotspotLayer } from "./HotspotLayer";
import {
  selectDrawingPath,
  selectDrawingPolygon,
  selectDrawingPolyline,
  selectPlacementTool,
  useHotspotBenchStore,
} from "./store";

const VIEWER_CONTROLS = { inertia: true, keyboard: true };
const PLACING_CURSORS = {
  default: "crosshair",
  dragging: "crosshair",
} as const;

export function CanvasPanel() {
  const { t } = usePlaygroundLanguage();
  const viewer = usePanoViewer();
  const selectPreset = useHotspotBenchStore((state) => state.selectPreset);
  const {
    placementTool,
    drawingPath,
    drawingPolygon,
    drawingPolyline,
    draftVertices,
    draftPolygonFilled,
    lastAction,
    addHotspot,
    finishPolygonDraft,
    cancelPolygonDraft,
    toggleDraftFill,
  } = useHotspotBenchStore(
    useShallow((state) => ({
      placementTool: selectPlacementTool(state),
      drawingPath: selectDrawingPath(state),
      drawingPolygon: selectDrawingPolygon(state),
      drawingPolyline: selectDrawingPolyline(state),
      draftVertices: state.draftVertices,
      draftPolygonFilled: state.draftPolygonFilled,
      lastAction: state.lastAction,
      addHotspot: state.addHotspot,
      finishPolygonDraft: state.finishPolygonDraft,
      cancelPolygonDraft: state.cancelPolygonDraft,
      toggleDraftFill: state.toggleDraftFill,
    })),
  );

  return (
    <section aria-label={t("Panorama canvas")} className="min-w-0 bg-[#071316]/80">
      <div
        className="flex flex-wrap gap-2 border-b border-line p-4"
        role="group"
        aria-label={t("Hotspot presets")}
      >
        {(
          [
            "image",
            "graphic",
            "sequence",
            "video",
            "audio",
            "text",
            "iframe",
            "polygon",
            "polyline",
          ] as const
        ).map((type) => (
          <button
            type="button"
            className={segmentedButtonClassName}
            key={type}
            onClick={() => {
              const id = selectPreset(type);
              if (!id) return;
              const state = useHotspotBenchStore.getState();
              const point = state.hotspots.find((entry) => entry.id === id);
              const path =
                state.polygons.find((entry) => entry.id === id) ??
                state.polylines.find((entry) => entry.id === id);
              const position = point?.position ?? path?.vertices[0];
              if (position) void viewer.lookTo(position, { fov: 75 });
            }}
          >
            {t(type.charAt(0).toUpperCase() + type.slice(1))}{" " + t("preset")}</button>
        ))}
      </div>
      <div className="flex items-center gap-4 border-b border-[#27454d] px-[17px] py-[15px] max-[760px]:flex-col max-[760px]:items-stretch">
        <div
          aria-label={t("Viewer controls")}
          className="flex items-center gap-2 max-[760px]:grid max-[760px]:grid-cols-2"
          role="group"
        >
          <button
            className={segmentedButtonClassName}
            onClick={() => void viewer.toggleFullscreen()}
            type="button"
          >{t("Fullscreen")}</button>
        </div>
        {drawingPath ? (
          <div className="ml-auto flex items-center gap-2 max-[760px]:ml-0 max-[760px]:w-full max-[760px]:flex-wrap">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[#88a6ac]">
              {draftVertices.length}{" " + t("vertices")}</span>
            {drawingPolygon ? (
              <button
                aria-pressed={draftPolygonFilled}
                className={segmentedButtonClassName}
                onClick={toggleDraftFill}
                type="button"
              >
                {draftPolygonFilled ? t("Fill on") : t("Outline only")}
              </button>
            ) : null}
            <button
              className={segmentedButtonClassName}
              disabled={draftVertices.length < (drawingPolyline ? 2 : 3)}
              onClick={finishPolygonDraft}
              type="button"
            >
              {drawingPolyline ? t("Finish polyline") : t("Finish polygon")}
            </button>
            <button
              className={segmentedButtonClassName}
              onClick={cancelPolygonDraft}
              type="button"
            >{t("Cancel")}</button>
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "relative min-h-[500px] overflow-hidden bg-[#020607] max-[760px]:min-h-[440px]",
          "h-[min(60vw,720px)] max-[760px]:h-[62vh]",
          (placementTool || drawingPath) && "cursor-crosshair",
        )}
      >
        <PanoViewer
          ref={viewer.ref}
          aria-label={t("Panorama hotspot editor")}
          className={cn(
            "h-full w-full",
            (placementTool || drawingPath) && "cursor-crosshair",
          )}
          controls={placementTool || drawingPath ? false : VIEWER_CONTROLS}
          cursors={placementTool || drawingPath ? PLACING_CURSORS : undefined}
          initialView={INITIAL_VIEW}
          onPanoramaClick={({ position }) => addHotspot(position)}
          onPanoramaDoubleClick={() => {
            if (drawingPath) finishPolygonDraft();
          }}
        >
          <Tile {...cubeTileProps()} />
          <HotspotLayer />
        </PanoViewer>
        <p
          className="pointer-events-none absolute bottom-[15px] left-[15px] m-0 max-w-[calc(100%-30px)] border border-[rgb(117_203_211_/_0.42)] bg-[rgb(2_6_7_/_0.74)] px-[9px] py-2 font-mono text-[0.62rem] tracking-[0.04em] text-[#dbeef0] max-[760px]:text-[0.56rem]"
          role="status"
        >
          {t(lastAction)}
        </p>
      </div>
    </section>
  );
}
