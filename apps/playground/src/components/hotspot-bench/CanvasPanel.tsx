import {
  AutoRotate,
  PanoView,
  Sphere,
  Tile,
  type HotspotPosition,
  type PanoViewHandle,
  type PanoViewState,
  type PolygonValidationIssue,
  type TileLoadProgress,
} from "@pano-view/react";
import type { RefObject } from "react";
import { Metric } from "../Metric";
import type {
  EditorHotspot,
  EditorPolygon,
  EditorPolyline,
  EditorTool,
  ViewerMode,
} from "../../types";
import { INITIAL_VIEW } from "../../constants";
import { HotspotLayer } from "./HotspotLayer";

type CanvasPanelProps = {
  viewerRef: RefObject<PanoViewHandle | null>;
  mode: ViewerMode;
  tool: EditorTool;
  view: PanoViewState;
  level: number;
  progress: TileLoadProgress;
  tileErrors: number;
  autoRotate: boolean;
  placementTool: boolean;
  drawingPath: boolean;
  drawingPolygon: boolean;
  drawingPolyline: boolean;
  draftVertices: HotspotPosition[];
  draftIssues: PolygonValidationIssue[];
  draftPolygonFilled: boolean;
  lastAction: string;
  controls: { inertia: boolean; keyboard: boolean };
  hotspots: EditorHotspot[];
  polygons: EditorPolygon[];
  polylines: EditorPolyline[];
  selectedPolygon: EditorPolygon | null;
  selectedPolyline: EditorPolyline | null;
  onSelectMode: (mode: ViewerMode) => void;
  onToggleAutoRotate: () => void;
  onViewChange: (view: PanoViewState) => void;
  onLevelChange: (level: number) => void;
  onLoadProgress: (progress: TileLoadProgress) => void;
  onTileError: () => void;
  onPanoramaClick: (position: HotspotPosition) => void;
  onFinishDraft: () => void;
  onCancelDraft: () => void;
  onToggleDraftFill: () => void;
  onSelectItem: (id: string) => void;
  onUpdateHotspot: (
    id: string,
    patch: Partial<Omit<EditorHotspot, "id" | "type" | "graphic">>,
  ) => void;
  onUpdateSequence: (
    id: string,
    patch: Partial<Omit<Extract<EditorHotspot, { type: "sequence" }>, "id" | "type">>,
  ) => void;
  onUpdateVideo: (
    id: string,
    patch: Partial<Omit<Extract<EditorHotspot, { type: "video" }>, "id" | "type">>,
  ) => void;
  onUpdatePolygon: (id: string, patch: Partial<Omit<EditorPolygon, "id">>) => void;
  onUpdatePolyline: (id: string, patch: Partial<Omit<EditorPolyline, "id">>) => void;
  onStatus: (message: string) => void;
};

export function CanvasPanel({
  viewerRef,
  mode,
  tool,
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
  draftIssues,
  draftPolygonFilled,
  lastAction,
  controls,
  hotspots,
  polygons,
  polylines,
  selectedPolygon,
  selectedPolyline,
  onSelectMode,
  onToggleAutoRotate,
  onViewChange,
  onLevelChange,
  onLoadProgress,
  onTileError,
  onPanoramaClick,
  onFinishDraft,
  onCancelDraft,
  onToggleDraftFill,
  onSelectItem,
  onUpdateHotspot,
  onUpdateSequence,
  onUpdateVideo,
  onUpdatePolygon,
  onUpdatePolyline,
  onStatus,
}: CanvasPanelProps) {
  return (
    <section className="canvas-panel" aria-label="Panorama canvas">
      <div className="canvas-toolbar">
        <div className="mode-switch" aria-label="Panorama source" role="group">
          <button
            className={mode === "sphere" ? "active" : ""}
            onClick={() => onSelectMode("sphere")}
            type="button"
          >
            Sphere
          </button>
          <button
            className={mode === "tile" ? "active" : ""}
            onClick={() => onSelectMode("tile")}
            type="button"
          >
            Cube Tile
          </button>
        </div>
        <div className="viewer-actions">
          <button onClick={onToggleAutoRotate} type="button">
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
                onClick={onToggleDraftFill}
                type="button"
              >
                {draftPolygonFilled ? "Fill on" : "Outline only"}
              </button>
            ) : null}
            <button
              disabled={draftVertices.length < (drawingPolyline ? 2 : 3)}
              onClick={onFinishDraft}
              type="button"
            >
              {drawingPolyline ? "Finish polyline" : "Finish polygon"}
            </button>
            <button onClick={onCancelDraft} type="button">Cancel</button>
          </div>
        ) : null}
      </div>

      <div className={placementTool || drawingPath ? "viewer-frame placing" : "viewer-frame"}>
        <PanoView
          key={mode}
          ref={viewerRef}
          aria-label={`${mode} panorama hotspot editor`}
          className="pano-view"
          controls={placementTool || drawingPath ? false : controls}
          initialView={INITIAL_VIEW}
          onPanoramaClick={({ position }) => onPanoramaClick(position)}
          onPanoramaDoubleClick={() => {
            if (drawingPath) onFinishDraft();
          }}
          onViewChange={onViewChange}
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
              onLevelChange={onLevelChange}
              onLoadProgress={onLoadProgress}
              onTileError={onTileError}
            />
          )}
          <HotspotLayer
            tool={tool}
            drawingPath={drawingPath}
            drawingPolygon={drawingPolygon}
            draftVertices={draftVertices}
            draftIssues={draftIssues}
            draftPolygonFilled={draftPolygonFilled}
            hotspots={hotspots}
            polygons={polygons}
            polylines={polylines}
            selectedPolygon={selectedPolygon}
            selectedPolyline={selectedPolyline}
            onSelectItem={onSelectItem}
            onUpdateHotspot={onUpdateHotspot}
            onUpdateSequence={onUpdateSequence}
            onUpdateVideo={onUpdateVideo}
            onUpdatePolygon={onUpdatePolygon}
            onUpdatePolyline={onUpdatePolyline}
            onStatus={onStatus}
          />
        </PanoView>
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
