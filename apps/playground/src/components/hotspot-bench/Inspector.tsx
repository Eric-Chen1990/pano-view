import { validatePolygonVertices, type GraphicDefinition, type HotspotMode } from "@ericchen1990/pano-view";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { EditorHotspot } from "../../types";
import { formatPosition, numberValue, polygonIssueSummary } from "../../utils";
import { GraphicFields } from "./fields/GraphicFields";
import { PolygonDraftFields } from "./fields/PolygonDraftFields";
import { PolygonFields } from "./fields/PolygonFields";
import { PolylineFields } from "./fields/PolylineFields";
import { SequenceFields } from "./fields/SequenceFields";
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
    <aside className="inspector" aria-label="Hotspot inspector">
      <div className="inspector-heading">
        <div>
          <p className="panel-label">INSPECTOR</p>
          <h2>
            {selected?.label ?? selectedPolygon?.label ?? selectedPolyline?.label ?? (
              drawingPath
                ? drawingPolyline ? "Drawing polyline" : "Drawing polygon"
                : "No hotspot selected"
            )}
          </h2>
        </div>
        {selected ? <span className={`type-chip ${selected.type}`}>{selected.type}</span> : null}
        {selectedPolygon ? <span className="type-chip polygon">polygon</span> : null}
        {selectedPolyline ? <span className="type-chip polyline">polyline</span> : null}
      </div>

      {selected ? (
        <SelectedHotspotFields
          selected={selected}
          onUpdateHotspot={updateHotspot}
          onUpdateGraphic={updateGraphic}
          onUpdateImageSource={updateImageSource}
          onUpdateSequence={updateSequence}
          onUpdateVideo={updateVideo}
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
        <p className="empty-inspector">Choose a hotspot tool, then click the panorama to place it.</p>
      )}

      <div className="hotspot-list">
        <div className="list-heading">
          <p className="panel-label">IN THIS VIEW</p>
          <button onClick={resetDemo} type="button">Restore demo</button>
        </div>
        {hotspots.map((hotspot) => (
          <button
            className={selectedId === hotspot.id ? "hotspot-row active" : "hotspot-row"}
            key={hotspot.id}
            onClick={() => selectItem(hotspot.id, `${hotspot.label} selected.`)}
            type="button"
          >
            <span>{({ image: "IMG", graphic: "GFX", sequence: "SEQ", video: "VID" })[hotspot.type]}</span>
            <b>{hotspot.label}</b>
            <small>{formatPosition(hotspot.position)}</small>
          </button>
        ))}
        {polygons.map((polygon) => (
          <button
            className={selectedId === polygon.id ? "hotspot-row active" : "hotspot-row"}
            key={polygon.id}
            onClick={() => selectItem(
              polygon.id,
              `${polygon.label} selected. Drag the polygon or a vertex handle.`,
            )}
            type="button"
          >
            <span>POLY</span>
            <b>{polygon.label}</b>
            <small>{polygon.vertices.length} vertices</small>
          </button>
        ))}
        {polylines.map((polyline) => (
          <button
            className={selectedId === polyline.id ? "hotspot-row active" : "hotspot-row"}
            key={polyline.id}
            onClick={() => selectItem(
              polyline.id,
              `${polyline.label} selected. Drag the path or a vertex handle.`,
            )}
            type="button"
          >
            <span>LINE</span>
            <b>{polyline.label}</b>
            <small>{polyline.vertices.length} vertices</small>
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
  onDelete,
}: {
  selected: EditorHotspot;
  onUpdateHotspot: (id: string, patch: HotspotPatch) => void;
  onUpdateGraphic: (id: string, graphic: GraphicDefinition) => void;
  onUpdateImageSource: (id: string, src: string) => void;
  onUpdateSequence: (id: string, patch: SequencePatch) => void;
  onUpdateVideo: (id: string, patch: VideoPatch) => void;
  onDelete: () => void;
}) {
  return (
    <div className="inspector-content">
      <label className="field wide">
        <span>Accessible label</span>
        <input
          onChange={(event) => onUpdateHotspot(selected.id, { label: event.currentTarget.value })}
          value={selected.label}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Yaw</span>
          <input
            disabled={Math.abs(selected.position.pitch) >= 90}
            onChange={(event) => onUpdateHotspot(selected.id, {
              position: { ...selected.position, yaw: numberValue(event.currentTarget.value, selected.position.yaw) },
            })}
            step="0.1"
            type="number"
            value={selected.position.yaw}
          />
        </label>
        <label className="field">
          <span>Pitch</span>
          <input
            onChange={(event) => onUpdateHotspot(selected.id, {
              position: { ...selected.position, pitch: numberValue(event.currentTarget.value, selected.position.pitch) },
            })}
            step="0.1"
            type="number"
            value={selected.position.pitch}
          />
        </label>
        <label className="field">
          <span>Width</span>
          <input
            min="0.1"
            onChange={(event) => onUpdateHotspot(selected.id, { width: numberValue(event.currentTarget.value, selected.width) })}
            step="0.1"
            type="number"
            value={selected.width}
          />
        </label>
        <label className="field">
          <span>Height</span>
          <input
            min="0.1"
            onChange={(event) => onUpdateHotspot(selected.id, { height: numberValue(event.currentTarget.value, selected.height) })}
            step="0.1"
            type="number"
            value={selected.height}
          />
        </label>
        <label className="field">
          <span>Rotation</span>
          <input
            onChange={(event) => onUpdateHotspot(selected.id, { rotation: numberValue(event.currentTarget.value, selected.rotation) })}
            step="1"
            type="number"
            value={selected.rotation}
          />
        </label>
        <label className="field">
          <span>Scale</span>
          <input
            min="0.01"
            onChange={(event) => onUpdateHotspot(selected.id, { scale: numberValue(event.currentTarget.value, selected.scale) })}
            step="0.1"
            type="number"
            value={selected.scale}
          />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Hotspot mode</span>
          <select
            onChange={(event) => onUpdateHotspot(selected.id, {
              mode: event.currentTarget.value as HotspotMode,
            })}
            value={selected.mode}
          >
            <option value="surface">Attach to panorama</option>
            <option value="billboard">Float facing viewer</option>
          </select>
        </label>
        <label className="field">
          <span>Size on zoom</span>
          <select
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
        <label className="field wide range-field">
          <span>Floating distance <b>{selected.distance.toFixed(1)}</b></span>
          <input
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

      <label className="field wide range-field">
        <span>Opacity <b>{Math.round(selected.opacity * 100)}%</b></span>
        <input
          max="1"
          min="0"
          onChange={(event) => onUpdateHotspot(selected.id, { opacity: numberValue(event.currentTarget.value, selected.opacity) })}
          step="0.05"
          type="range"
          value={selected.opacity}
        />
      </label>

      <label className="check-field">
        <input
          checked={selected.visible}
          onChange={(event) => onUpdateHotspot(selected.id, { visible: event.currentTarget.checked })}
          type="checkbox"
        />
        <span>Visible in panorama</span>
      </label>

      {selected.type === "image" ? (
        <label className="field wide">
          <span>Image URL</span>
          <input
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
      ) : (
        <VideoFields
          hotspot={selected}
          onChange={(patch) => onUpdateVideo(selected.id, patch)}
        />
      )}

      <button className="delete-button" onClick={onDelete} type="button">
        Delete selected hotspot
      </button>
    </div>
  );
}
