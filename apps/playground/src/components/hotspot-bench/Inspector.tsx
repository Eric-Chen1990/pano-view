import { validatePolygonVertices, type GraphicDefinition, type HotspotMode } from "@ericchen1990/pano-view";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../../cn";
import type { EditorHotspot } from "../../types";
import { formatPosition, hotspotTypeCode, numberValue, polygonIssueSummary } from "../../utils";
import {
  checkboxLabelClassName,
  deleteButtonClassName,
  fieldClassName,
  fieldGridClassName,
  fieldInputClassName,
  fieldLabelClassName,
  fieldWideClassName,
  listRowActiveClassName,
  listRowClassName,
  panelLabelClassName,
} from "../../ui";
import { GraphicFields } from "./fields/GraphicFields";
import { IframeFields } from "./fields/IframeFields";
import { PolygonDraftFields } from "./fields/PolygonDraftFields";
import { PolygonFields } from "./fields/PolygonFields";
import { PolylineFields } from "./fields/PolylineFields";
import { SequenceFields } from "./fields/SequenceFields";
import { TextFields } from "./fields/TextFields";
import { TooltipFields } from "./fields/TooltipFields";
import { VideoFields } from "./fields/VideoFields";
import {
  selectDrawingPath,
  selectDrawingPolygon,
  selectDrawingPolyline,
  selectSelected,
  selectSelectedPolygon,
  selectSelectedPolyline,
  useHotspotBenchStore,
  type HotspotPatch,
  type SequencePatch,
  type TextPatch,
  type IframePatch,
  type VideoPatch,
} from "./store";

export function Inspector() {
  const {
    selected,
    selectedPolygon,
    selectedPolyline,
    selectedId,
    drawingPath,
    drawingPolygon,
    drawingPolyline,
    draftVertices,
    hotspots,
    polygons,
    polylines,
    updateHotspot,
    updateGraphic,
    updateImageSource,
    updateSequence,
    updateVideo,
    updateText,
    updateIframe,
    updatePolygon,
    updatePolyline,
    deleteSelected,
    resetDemo,
    selectItem,
  } = useHotspotBenchStore(
    useShallow((state) => ({
      selected: selectSelected(state),
      selectedPolygon: selectSelectedPolygon(state),
      selectedPolyline: selectSelectedPolyline(state),
      selectedId: state.selectedId,
      drawingPath: selectDrawingPath(state),
      drawingPolygon: selectDrawingPolygon(state),
      drawingPolyline: selectDrawingPolyline(state),
      draftVertices: state.draftVertices,
      hotspots: state.hotspots,
      polygons: state.polygons,
      polylines: state.polylines,
      updateHotspot: state.updateHotspot,
      updateGraphic: state.updateGraphic,
      updateImageSource: state.updateImageSource,
      updateSequence: state.updateSequence,
      updateVideo: state.updateVideo,
      updateText: state.updateText,
      updateIframe: state.updateIframe,
      updatePolygon: state.updatePolygon,
      updatePolyline: state.updatePolyline,
      deleteSelected: state.deleteSelected,
      resetDemo: state.resetDemo,
      selectItem: state.selectItem,
    })),
  );
  const draftIssues = useMemo(
    () =>
      draftVertices.length > 0 ? validatePolygonVertices(draftVertices) : [],
    [draftVertices],
  );

  return (
    <aside
      aria-label="Hotspot inspector"
      className="min-w-0 border-l border-[#27454d] bg-[#071316]/70 max-[1180px]:col-span-full max-[1180px]:border-t max-[1180px]:border-l-0"
    >
      <div className="flex min-h-[92px] items-center justify-between gap-3 border-b border-[#27454d] p-[17px]">
        <div>
          <p className={panelLabelClassName}>INSPECTOR</p>
          <h2 className="mt-[7px] max-w-[210px] overflow-hidden text-ellipsis whitespace-nowrap text-[0.93rem] leading-[1.2] text-[#f1f8fa]">
            {selected?.label ?? selectedPolygon?.label ?? selectedPolyline?.label ?? (
              drawingPath
                ? drawingPolyline ? "Drawing polyline" : "Drawing polygon"
                : "No hotspot selected"
            )}
          </h2>
        </div>
        {selected ? (
          <span className="border border-[#3e6c73] px-1.5 py-[5px] font-mono text-[0.57rem] uppercase tracking-[0.08em] text-[#df6b42]">
            {selected.type}
          </span>
        ) : null}
        {selectedPolygon ? (
          <span className="border border-[#3e6c73] px-1.5 py-[5px] font-mono text-[0.57rem] uppercase tracking-[0.08em] text-[#df6b42]">
            polygon
          </span>
        ) : null}
        {selectedPolyline ? (
          <span className="border border-[#3e6c73] px-1.5 py-[5px] font-mono text-[0.57rem] uppercase tracking-[0.08em] text-[#df6b42]">
            polyline
          </span>
        ) : null}
      </div>

      {selected ? (
        <SelectedHotspotFields
          selected={selected}
          onUpdateHotspot={updateHotspot}
          onUpdateGraphic={updateGraphic}
          onUpdateImageSource={updateImageSource}
          onUpdateSequence={updateSequence}
          onUpdateVideo={updateVideo}
          onUpdateText={updateText}
          onUpdateIframe={updateIframe}
          onDelete={deleteSelected}
        />
      ) : selectedPolygon ? (
        <PolygonFields
          polygon={selectedPolygon}
          onChange={(patch) => updatePolygon(selectedPolygon.id, patch)}
          onDelete={deleteSelected}
        />
      ) : selectedPolyline ? (
        <PolylineFields
          polyline={selectedPolyline}
          onChange={(patch) => updatePolyline(selectedPolyline.id, patch)}
          onDelete={deleteSelected}
        />
      ) : drawingPath ? (
        <PolygonDraftFields
          kind={drawingPolyline ? "polyline" : "polygon"}
          issueSummary={drawingPolygon && draftIssues.length ? polygonIssueSummary(draftIssues) : null}
          vertexCount={draftVertices.length}
        />
      ) : (
        <p className="m-0 p-[18px] text-[0.78rem] leading-[1.55] text-[#88a6ac]">
          Choose a hotspot tool, then click the panorama to place it.
        </p>
      )}

      <div className="mt-1 border-t border-[#27454d] max-[1180px]:grid max-[1180px]:grid-cols-2 max-[1180px]:gap-0 max-[1180px]:max-[760px]:block">
        <div className="flex items-center justify-between px-[17px] py-[13px] max-[1180px]:col-span-full">
          <p className={panelLabelClassName}>IN THIS VIEW</p>
          <button
            className="border border-transparent px-0 py-0 text-[0.7rem] text-[#75cbd3]"
            onClick={resetDemo}
            type="button"
          >
            Restore demo
          </button>
        </div>
        {hotspots.map((hotspot) => (
          <button
            className={cn(listRowClassName, selectedId === hotspot.id && listRowActiveClassName)}
            key={hotspot.id}
            onClick={() => selectItem(hotspot.id, `${hotspot.label} selected.`)}
            type="button"
          >
            <span className="row-span-2 pt-0.5 font-mono text-[0.57rem] text-[#df6b42]">
              {hotspotTypeCode(hotspot.type)}
            </span>
            <b className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.73rem] text-[#dcecef]">
              {hotspot.label}
            </b>
            <small className="font-mono text-[0.57rem] text-[#739097]">
              {formatPosition(hotspot.position)}
            </small>
          </button>
        ))}
        {polygons.map((polygon) => (
          <button
            className={cn(listRowClassName, selectedId === polygon.id && listRowActiveClassName)}
            key={polygon.id}
            onClick={() => selectItem(
              polygon.id,
              `${polygon.label} selected. Drag the polygon or a vertex handle.`,
            )}
            type="button"
          >
            <span className="row-span-2 pt-0.5 font-mono text-[0.57rem] text-[#df6b42]">POLY</span>
            <b className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.73rem] text-[#dcecef]">
              {polygon.label}
            </b>
            <small className="font-mono text-[0.57rem] text-[#739097]">
              {polygon.vertices.length} vertices
            </small>
          </button>
        ))}
        {polylines.map((polyline) => (
          <button
            className={cn(listRowClassName, selectedId === polyline.id && listRowActiveClassName)}
            key={polyline.id}
            onClick={() => selectItem(
              polyline.id,
              `${polyline.label} selected. Drag the path or a vertex handle.`,
            )}
            type="button"
          >
            <span className="row-span-2 pt-0.5 font-mono text-[0.57rem] text-[#df6b42]">LINE</span>
            <b className="overflow-hidden text-ellipsis whitespace-nowrap text-[0.73rem] text-[#dcecef]">
              {polyline.label}
            </b>
            <small className="font-mono text-[0.57rem] text-[#739097]">
              {polyline.vertices.length} vertices
            </small>
          </button>
        ))}
      </div>
    </aside>
  );
}

function SelectedHotspotFields({
  selected,
  onUpdateHotspot,
  onUpdateGraphic,
  onUpdateImageSource,
  onUpdateSequence,
  onUpdateVideo,
  onUpdateText,
  onUpdateIframe,
  onDelete,
}: {
  selected: EditorHotspot;
  onUpdateHotspot: (id: string, patch: HotspotPatch) => void;
  onUpdateGraphic: (id: string, graphic: GraphicDefinition) => void;
  onUpdateImageSource: (id: string, src: string) => void;
  onUpdateSequence: (id: string, patch: SequencePatch) => void;
  onUpdateVideo: (id: string, patch: VideoPatch) => void;
  onUpdateText: (id: string, patch: TextPatch) => void;
  onUpdateIframe: (id: string, patch: IframePatch) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid gap-[14px] p-[17px] max-[1180px]:grid-cols-2 max-[760px]:block">
      <label className={fieldWideClassName}>
        <span className={fieldLabelClassName}>Accessible label</span>
        <input
          className={fieldInputClassName}
          onChange={(event) => onUpdateHotspot(selected.id, { label: event.currentTarget.value })}
          value={selected.label}
        />
      </label>

      <div className={fieldGridClassName}>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Yaw</span>
          <input
            className={fieldInputClassName}
            disabled={Math.abs(selected.position.pitch) >= 90}
            onChange={(event) => onUpdateHotspot(selected.id, {
              position: { ...selected.position, yaw: numberValue(event.currentTarget.value, selected.position.yaw) },
            })}
            step="0.1"
            type="number"
            value={selected.position.yaw}
          />
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Pitch</span>
          <input
            className={fieldInputClassName}
            onChange={(event) => onUpdateHotspot(selected.id, {
              position: { ...selected.position, pitch: numberValue(event.currentTarget.value, selected.position.pitch) },
            })}
            step="0.1"
            type="number"
            value={selected.position.pitch}
          />
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Width</span>
          <input
            className={fieldInputClassName}
            min="0.1"
            onChange={(event) => onUpdateHotspot(selected.id, { width: numberValue(event.currentTarget.value, selected.width) })}
            step="0.1"
            type="number"
            value={selected.width}
          />
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Height</span>
          <input
            className={fieldInputClassName}
            min="0.1"
            onChange={(event) => onUpdateHotspot(selected.id, { height: numberValue(event.currentTarget.value, selected.height) })}
            step="0.1"
            type="number"
            value={selected.height}
          />
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Rotation</span>
          <input
            className={fieldInputClassName}
            onChange={(event) => onUpdateHotspot(selected.id, { rotation: numberValue(event.currentTarget.value, selected.rotation) })}
            step="1"
            type="number"
            value={selected.rotation}
          />
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Scale</span>
          <input
            className={fieldInputClassName}
            min="0.01"
            onChange={(event) => onUpdateHotspot(selected.id, { scale: numberValue(event.currentTarget.value, selected.scale) })}
            step="0.1"
            type="number"
            value={selected.scale}
          />
        </label>
      </div>

      <div className={fieldGridClassName}>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Hotspot mode</span>
          <select
            className={fieldInputClassName}
            onChange={(event) => onUpdateHotspot(selected.id, {
              mode: event.currentTarget.value as HotspotMode,
            })}
            value={selected.mode}
          >
            <option value="surface">Attach to panorama</option>
            <option value="billboard">Float facing viewer</option>
          </select>
        </label>
        <label className={fieldClassName}>
          <span className={fieldLabelClassName}>Size on zoom</span>
          <select
            className={fieldInputClassName}
            onChange={(event) => onUpdateHotspot(selected.id, {
              scaleMode: event.currentTarget.value as EditorHotspot["scaleMode"],
            })}
            value={selected.scaleMode}
          >
            <option value="fov">Follow FOV</option>
            <option value="fixed">Keep screen size</option>
          </select>
        </label>
      </div>

      {selected.mode === "billboard" ? (
        <label className={fieldWideClassName}>
          <span className={`${fieldLabelClassName} flex justify-between`}>
            Floating distance
            <b className="font-mono text-[0.61rem] font-normal text-[#dcecef]">
              {selected.distance.toFixed(1)}
            </b>
          </span>
          <input
            className="accent-[#df6b42]"
            max="49.5"
            min="0.5"
            onChange={(event) => onUpdateHotspot(selected.id, {
              distance: numberValue(event.currentTarget.value, selected.distance),
            })}
            step="0.5"
            type="range"
            value={selected.distance}
          />
        </label>
      ) : null}

      <label className={fieldWideClassName}>
        <span className={`${fieldLabelClassName} flex justify-between`}>
          Opacity
          <b className="font-mono text-[0.61rem] font-normal text-[#dcecef]">
            {Math.round(selected.opacity * 100)}%
          </b>
        </span>
        <input
          className="accent-[#df6b42]"
          max="1"
          min="0"
          onChange={(event) => onUpdateHotspot(selected.id, { opacity: numberValue(event.currentTarget.value, selected.opacity) })}
          step="0.05"
          type="range"
          value={selected.opacity}
        />
      </label>

      <label className={checkboxLabelClassName}>
        <input
          className="accent-[#df6b42]"
          checked={selected.visible}
          onChange={(event) => onUpdateHotspot(selected.id, { visible: event.currentTarget.checked })}
          type="checkbox"
        />
        <span>Visible in panorama</span>
      </label>
      <label className={checkboxLabelClassName}>
        <input
          className="accent-[#df6b42]"
          checked={selected.pointerEvents !== "none"}
          onChange={(event) => onUpdateHotspot(selected.id, {
            pointerEvents: event.currentTarget.checked ? "auto" : "none",
          })}
          type="checkbox"
        />
        <span>Respond to mouse</span>
      </label>

      <TooltipFields
        onChange={(patch) => onUpdateHotspot(selected.id, patch)}
        tooltip={selected.tooltip ?? {}}
        tooltipOffset={selected.tooltipOffset ?? 12}
        tooltipPlacement={selected.tooltipPlacement ?? "top"}
        tooltipTrigger={selected.tooltipTrigger ?? "always"}
      />

      {selected.type === "image" ? (
        <label className={fieldWideClassName}>
          <span className={fieldLabelClassName}>Image URL</span>
          <input
            className={fieldInputClassName}
            onChange={(event) => onUpdateImageSource(selected.id, event.currentTarget.value)}
            value={selected.src}
          />
        </label>
      ) : selected.type === "graphic" ? (
        <GraphicFields
          hotspot={selected}
          onChange={(graphic) => onUpdateGraphic(selected.id, graphic)}
        />
      ) : selected.type === "sequence" ? (
        <SequenceFields
          hotspot={selected}
          onChange={(patch) => onUpdateSequence(selected.id, patch)}
        />
      ) : selected.type === "video" ? (
        <VideoFields
          hotspot={selected}
          onChange={(patch) => onUpdateVideo(selected.id, patch)}
        />
      ) : selected.type === "text" ? (
        <TextFields
          hotspot={selected}
          onChange={(patch) => onUpdateText(selected.id, patch)}
        />
      ) : selected.type === "iframe" ? (
        <IframeFields
          hotspot={selected}
          onChange={(patch) => onUpdateIframe(selected.id, patch)}
        />
      ) : (
        (() => {
          const exhaustive: never = selected;
          return exhaustive;
        })()
      )}

      <button className={`${deleteButtonClassName} col-span-full`} onClick={onDelete} type="button">
        Delete selected hotspot
      </button>
    </div>
  );
}
