import {
  AutoRotate,
  Gyro,
  PanoViewer,
  Sphere,
  Tile,
  type PanoViewerHandle,
  type GyroHandle,
} from "@ericchen1990/pano-view";
import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../../cn";
import { Metric } from "../Metric";
import { INITIAL_VIEW } from "../../constants";
import {
  segmentedButtonClassName,
  segmentedControlClassName,
  segmentedControlOptionClassName,
  toggleControlClassName,
  toggleThumbClassName,
  toggleThumbOnClassName,
  toggleTrackClassName,
  toggleTrackOnClassName,
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

function ToolbarSwitch({
  checked,
  label,
  onClick,
}: {
  checked: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-checked={checked}
      className={toggleControlClassName}
      onClick={onClick}
      role="switch"
      type="button"
    >
      {label}
      <span
        aria-hidden="true"
        className={cn(toggleTrackClassName, checked && toggleTrackOnClassName)}
      >
        <span className={cn(toggleThumbClassName, checked && toggleThumbOnClassName)} />
      </span>
    </button>
  );
}

export function CanvasPanel() {
  const viewerRef = useRef<PanoViewerHandle>(null);
  const gyroRef = useRef<GyroHandle>(null);
  const [gyroEnabled, setGyroEnabled] = useState(false);
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
    <section aria-label="Panorama canvas" className="min-w-0 bg-[#071316]/80">
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
          <ToolbarSwitch
            checked={autoRotate}
            label="Auto rotate"
            onClick={toggleAutoRotate}
          />
          <ToolbarSwitch
            checked={gyroEnabled}
            label="Gyro"
            onClick={() => {
              if (gyroEnabled) {
                setGyroEnabled(false);
                return;
              }
              if (!window.isSecureContext) {
                window.alert(
                  "Gyro requires HTTPS. Open this playground over a secure connection and try again.",
                );
                return;
              }
              void gyroRef.current
                ?.requestPermission()
                .then((granted) => setGyroEnabled(granted));
            }}
          />
          <button
            className={segmentedButtonClassName}
            onClick={() => viewerRef.current?.reset()}
            type="button"
          >
            Reset view
          </button>
          <button
            className={segmentedButtonClassName}
            onClick={() => void viewerRef.current?.toggleFullscreen()}
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
            <button className={segmentedButtonClassName} onClick={cancelPolygonDraft} type="button">
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
          ref={viewerRef}
          aria-label={`${mode} panorama hotspot editor`}
          className={cn("h-full w-full", (placementTool || drawingPath) && "cursor-crosshair")}
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
          <Gyro
            ref={gyroRef}
            enabled={gyroEnabled && !placementTool && !drawingPath}
            onDenied={() => setGyroEnabled(false)}
          />
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
              onLevelChange={setLevel}
              onLoadProgress={setProgress}
              onTileError={incrementTileErrors}
            />
          )}
          <HotspotLayer />
        </PanoViewer>
        <div className="reticle" aria-hidden="true" />
        <p
          className="pointer-events-none absolute bottom-[15px] left-[15px] m-0 max-w-[calc(100%-30px)] border border-[rgb(117_203_211_/_0.42)] bg-[rgb(2_6_7_/_0.74)] px-[9px] py-2 font-mono text-[0.62rem] tracking-[0.04em] text-[#dbeef0] max-[760px]:text-[0.56rem]"
          role="status"
        >
          {lastAction}
        </p>
      </div>

      <dl
        aria-label="Viewer state"
        className="m-0 grid grid-cols-7 border-t border-[#27454d] max-[760px]:grid-cols-4"
      >
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
