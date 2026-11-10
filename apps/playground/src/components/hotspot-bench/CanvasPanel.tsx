import {
  PanoViewer,
  Sphere,
  Tile,
  usePanoViewer,
} from "@ericchen1990/pano-view";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../../cn";
import { INITIAL_VIEW } from "../../constants";
import {
  segmentedButtonClassName,
  segmentedControlClassName,
  segmentedControlOptionClassName,
} from "../../ui";
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
  const viewer = usePanoViewer();
  const selectPreset = useHotspotBenchStore((state) => state.selectPreset);
  const {
    mode,
    placementTool,
    drawingPath,
    drawingPolygon,
    drawingPolyline,
    draftVertices,
    draftPolygonFilled,
    lastAction,
    selectMode,
    addHotspot,
    finishPolygonDraft,
    cancelPolygonDraft,
    toggleDraftFill,
  } = useHotspotBenchStore(
    useShallow((state) => ({
      mode: state.mode,
      placementTool: selectPlacementTool(state),
      drawingPath: selectDrawingPath(state),
      drawingPolygon: selectDrawingPolygon(state),
      drawingPolyline: selectDrawingPolyline(state),
      draftVertices: state.draftVertices,
      draftPolygonFilled: state.draftPolygonFilled,
      lastAction: state.lastAction,
      selectMode: state.selectMode,
      addHotspot: state.addHotspot,
      finishPolygonDraft: state.finishPolygonDraft,
      cancelPolygonDraft: state.cancelPolygonDraft,
      toggleDraftFill: state.toggleDraftFill,
    })),
  );

  return (
    <section aria-label="Panorama canvas" className="min-w-0 bg-[#071316]/80">
      <div
        className="flex flex-wrap gap-2 border-b border-line p-4"
        role="group"
        aria-label="Hotspot presets"
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
            {type.charAt(0).toUpperCase() + type.slice(1)} preset
          </button>
        ))}
      </div>
      <div className="flex items-center gap-4 border-b border-[#27454d] px-[17px] py-[15px] max-[760px]:flex-col max-[760px]:items-stretch">
        <div
          aria-label="Panorama source"
          className={segmentedControlClassName}
          role="radiogroup"
        >
          <button
            aria-checked={mode === "sphere"}
            className={cn(
              segmentedControlOptionClassName,
              mode === "sphere"
                ? "bg-[#df6b42] text-white"
                : "text-[#f5fbfc] hover:bg-[#102b31]",
            )}
            onClick={() => selectMode("sphere")}
            role="radio"
            type="button"
          >
            Sphere
          </button>
          <button
            aria-checked={mode === "tile"}
            className={cn(
              segmentedControlOptionClassName,
              mode === "tile"
                ? "bg-[#df6b42] text-white"
                : "text-[#f5fbfc] hover:bg-[#102b31]",
            )}
            onClick={() => selectMode("tile")}
            role="radio"
            type="button"
          >
            Cube Tile
          </button>
        </div>
        <div
          aria-hidden="true"
          className="h-6 w-px shrink-0 bg-[#3e6c73] max-[760px]:hidden"
        />
        <div
          aria-label="Viewer controls"
          className="flex items-center gap-2 max-[760px]:grid max-[760px]:grid-cols-2"
          role="group"
        >
          <button
            className={segmentedButtonClassName}
            onClick={() => void viewer.toggleFullscreen()}
            type="button"
          >
            Fullscreen
          </button>
        </div>
        {drawingPath ? (
          <div className="ml-auto flex items-center gap-2 max-[760px]:ml-0 max-[760px]:w-full max-[760px]:flex-wrap">
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.08em] text-[#88a6ac]">
              {draftVertices.length} vertices
            </span>
            {drawingPolygon ? (
              <button
                aria-pressed={draftPolygonFilled}
                className={segmentedButtonClassName}
                onClick={toggleDraftFill}
                type="button"
              >
                {draftPolygonFilled ? "Fill on" : "Outline only"}
              </button>
            ) : null}
            <button
              className={segmentedButtonClassName}
              disabled={draftVertices.length < (drawingPolyline ? 2 : 3)}
              onClick={finishPolygonDraft}
              type="button"
            >
              {drawingPolyline ? "Finish polyline" : "Finish polygon"}
            </button>
            <button
              className={segmentedButtonClassName}
              onClick={cancelPolygonDraft}
              type="button"
            >
              Cancel
            </button>
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
          key={mode}
          ref={viewer.ref}
          aria-label={`${mode} panorama hotspot editor`}
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
          {mode === "sphere" ? (
            <Sphere
              src="/fixtures/panorama/panos/1/sphere.webp"
              previewUrl="preview.webp"
            />
          ) : (
            <Tile
              baseUrl="/fixtures/panorama/cube-tiles/4"
              multires="512,1000,2000"
              urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.webp"
              previewUrl="previews/cube-vertical.webp"
            />
          )}
          <HotspotLayer />
        </PanoViewer>
        <p
          className="pointer-events-none absolute bottom-[15px] left-[15px] m-0 max-w-[calc(100%-30px)] border border-[rgb(117_203_211_/_0.42)] bg-[rgb(2_6_7_/_0.74)] px-[9px] py-2 font-mono text-[0.62rem] tracking-[0.04em] text-[#dbeef0] max-[760px]:text-[0.56rem]"
          role="status"
        >
          {lastAction}
        </p>
      </div>
    </section>
  );
}
