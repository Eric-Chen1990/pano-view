import {
  AutoRotate,
  PanoViewer,
  Sphere,
  Tile,
  type PanoViewerHandle,
} from "@ericchen1990/pano-view";
import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { Metric } from "../Metric";
import { INITIAL_VIEW } from "../../constants";
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
  const viewerRef = useRef<PanoViewerHandle>(null);
  const {
    mode,
    view,
    level,
    progress,
    tileErrors,
    autoRotate,
    placementTool,
    drawingPath,
    drawingPolygon,
    drawingPolyline,
    draftVertices,
    draftPolygonFilled,
    lastAction,
    selectMode,
    toggleAutoRotate,
    setView,
    setLevel,
    setProgress,
    incrementTileErrors,
    addHotspot,
    finishPolygonDraft,
    cancelPolygonDraft,
    toggleDraftFill,
  } = useHotspotBenchStore(
    useShallow((state) => ({
      mode: state.mode,
      view: state.view,
      level: state.level,
      progress: state.progress,
      tileErrors: state.tileErrors,
      autoRotate: state.autoRotate,
      placementTool: selectPlacementTool(state),
      drawingPath: selectDrawingPath(state),
      drawingPolygon: selectDrawingPolygon(state),
      drawingPolyline: selectDrawingPolyline(state),
      draftVertices: state.draftVertices,
      draftPolygonFilled: state.draftPolygonFilled,
      lastAction: state.lastAction,
      selectMode: state.selectMode,
      toggleAutoRotate: state.toggleAutoRotate,
      setView: state.setView,
      setLevel: state.setLevel,
      setProgress: state.setProgress,
      incrementTileErrors: state.incrementTileErrors,
      addHotspot: state.addHotspot,
      finishPolygonDraft: state.finishPolygonDraft,
      cancelPolygonDraft: state.cancelPolygonDraft,
      toggleDraftFill: state.toggleDraftFill,
    })),
  );

  return (
    <section className="canvas-panel" aria-label="Panorama canvas">
      <div className="canvas-toolbar">
        <div className="mode-switch" aria-label="Panorama source" role="group">
          <button
            className={mode === "sphere" ? "active" : ""}
            onClick={() => selectMode("sphere")}
            type="button"
          >
            Sphere
          </button>
          <button
            className={mode === "tile" ? "active" : ""}
            onClick={() => selectMode("tile")}
            type="button"
          >
            Cube Tile
          </button>
        </div>
        <div className="viewer-actions">
          <button onClick={toggleAutoRotate} type="button">
            {autoRotate ? "Stop rotation" : "Auto rotate"}
          </button>
          <button onClick={() => viewerRef.current?.reset()} type="button">
            Reset view
          </button>
          <button
            onClick={() => void viewerRef.current?.toggleFullscreen()}
            type="button"
          >
            Fullscreen
          </button>
        </div>
        {drawingPath ? (
          <div className="polygon-draft-actions">
            <span>{draftVertices.length} vertices</span>
            {drawingPolygon ? (
              <button
                aria-pressed={draftPolygonFilled}
                onClick={toggleDraftFill}
                type="button"
              >
                {draftPolygonFilled ? "Fill on" : "Outline only"}
              </button>
            ) : null}
            <button
              disabled={draftVertices.length < (drawingPolyline ? 2 : 3)}
              onClick={finishPolygonDraft}
              type="button"
            >
              {drawingPolyline ? "Finish polyline" : "Finish polygon"}
            </button>
            <button onClick={cancelPolygonDraft} type="button">Cancel</button>
          </div>
        ) : null}
      </div>

      <div className={placementTool || drawingPath ? "viewer-frame placing" : "viewer-frame"}>
        <PanoViewer
          key={mode}
          ref={viewerRef}
          aria-label={`${mode} panorama hotspot editor`}
          className="pano-view"
          controls={placementTool || drawingPath ? false : VIEWER_CONTROLS}
          cursors={placementTool || drawingPath ? PLACING_CURSORS : undefined}
          initialView={INITIAL_VIEW}
          onPanoramaClick={({ position }) => addHotspot(position)}
          onPanoramaDoubleClick={() => {
            if (drawingPath) finishPolygonDraft();
          }}
          onViewChange={setView}
        >
          <AutoRotate
            enabled={autoRotate && !placementTool && !drawingPath}
            speed={18}
            acceleration={18}
            startDelay={1_000}
          />
          {mode === "sphere" ? (
            <Sphere src="/fixtures/panorama/panos/1.jpg" />
          ) : (
            <Tile
              baseUrl="/fixtures/panorama/cube-tiles/4"
              multires="512,1000,2000"
              urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.webp"
              onLevelChange={setLevel}
              onLoadProgress={setProgress}
              onTileError={incrementTileErrors}
            />
          )}
          <HotspotLayer />
        </PanoViewer>
        <div className="reticle" aria-hidden="true" />
        <p className="canvas-status" role="status">{lastAction}</p>
      </div>

      <dl className="metrics" aria-label="Viewer state">
        <Metric label="SOURCE" value={mode === "sphere" ? "2:1 SPHERE" : "CUBE TILE"} />
        <Metric label="YAW" value={`${view.yaw.toFixed(1)}°`} />
        <Metric label="PITCH" value={`${view.pitch.toFixed(1)}°`} />
        <Metric label="FOV" value={`${view.fov.toFixed(1)}°`} />
        <Metric label="LOD" value={mode === "tile" ? `L${level}` : "—"} />
        <Metric
          label="TILES"
          value={mode === "tile" ? `${progress.loaded}/${progress.requested}` : "—"}
        />
        <Metric label="ERRORS" value={mode === "tile" ? String(tileErrors) : "—"} />
      </dl>
    </section>
  );
}
