import { useState, type FormEvent } from "react";
import { PANO_GEO_COORDINATE_SYSTEMS, type PanoGeoCoordinateSystem, type PanoGeoMapDefinition, type PanoGeoMapSpot, type PanoProjectSceneDefinition } from "@ericchen1990/pano-view/data";
import type { PanoGeoMapEdit, PanoGeoMapSource } from "@ericchen1990/pano-view";
import type { Translate } from "./i18n";

type GeoPanelProps = {
  map: PanoGeoMapDefinition;
  scenes: readonly PanoProjectSceneDefinition[];
  sources?: readonly PanoGeoMapSource[];
  spot?: PanoGeoMapSpot;
  placement?: { sceneId: string } | { spotId: string };
  onPlacement: (next?: { sceneId: string } | { spotId: string }) => void;
  onChange: (map: PanoGeoMapDefinition) => void;
  onEdit: (edit: PanoGeoMapEdit) => void;
  onIcon: () => void;
  onDelete: (spotId: string) => void;
  t: Translate;
};

const names = { wgs84: "WGS84", gcj02: "GCJ-02", bd09: "BD-09" };

export function GeoMapInspector({
  map, scenes, sources, spot, placement, onPlacement, onChange, onEdit, onIcon, onDelete, t,
}: GeoPanelProps) {
  const [sceneId, setSceneId] = useState("");
  const [system, setSystem] = useState<PanoGeoCoordinateSystem>("wgs84");
  const scene = scenes.find((entry) => entry.id === sceneId) ?? scenes[0];
  const updateSpot = (patch: Partial<PanoGeoMapSpot>) => {
    if (!spot) return;
    onChange({ ...map, spots: map.spots.map((item) => item.id === spot.id ? { ...item, ...patch } : item) });
  };
  const coordinates = spot?.positions[system];
  const savePosition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const position = { lat: Number(data.get("lat")), lng: Number(data.get("lng")) };
    if (spot) onEdit({ type: "move", spotId: spot.id, coordinateSystem: system, position });
    else if (scene) onEdit({ type: "place", sceneId: scene.id, coordinateSystem: system, position });
  };
  const [name, setName] = useState<{ id: string; text: string }>();
  return <div className="pne-fields">
    <label>{t("Scene for next point")}
      <select value={scene?.id ?? ""} onChange={(event) => setSceneId(event.target.value)}>
        {!scene ? <option value="">{t("No scenes yet.")}</option> : null}
        {scenes.map((entry) => <option key={entry.id} value={entry.id}>{entry.title ?? entry.id}</option>)}
      </select>
    </label>
    <div className="pne-button-grid">
      <button type="button" disabled={!scene || !sources?.length}
        onClick={() => onPlacement(scene ? { sceneId: scene.id } : undefined)}>{t("Add point on map")}</button>
      {spot ? <button type="button" disabled={!sources?.length} onClick={() => onPlacement({ spotId: spot.id })}>{t("Set point on this basemap")}</button> : null}
    </div>
    {placement ? <div role="status">
      {t("Click the online map to set the position.")}
      <button type="button" onClick={() => onPlacement()}>{t("Cancel")}</button>
    </div> : null}
    {spot ? <>
      <label>{t("Point name")}<input value={name?.id === spot.id ? name.text : spot.label ?? ""}
        onChange={(event) => setName({ id: spot.id, text: event.target.value })}
        onBlur={() => {
          if (name?.id === spot.id) updateSpot({ label: name.text.trim() || undefined });
          setName(undefined);
        }} /></label>
      <label>{t("Heading at yaw zero (°)")}
        <input key={`heading-${spot.id}-${spot.heading}`} type="number" step="any" defaultValue={spot.heading ?? ""}
          onBlur={(event) => {
            if (!event.currentTarget.validity.valid) return;
            const angle = event.currentTarget.valueAsNumber;
            const heading = Number.isFinite(angle) ? ((angle % 360) + 360) % 360 : undefined;
            if (heading !== spot.heading) updateSpot({ heading });
          }} />
      </label>
      <p className="pne-hint">{t("Drag the radar to align it with a visible landmark.")}</p>
      <div className="pne-button-grid">
        <button type="button" onClick={onIcon}>{t("Choose icon")}</button>
        {spot.icon ? <button type="button" onClick={() => updateSpot({ icon: undefined })}>{t("Use default icon")}</button> : null}
        <button type="button" onClick={() => onDelete(spot.id)}>{t("Delete point")}</button>
      </div>
    </> : null}
    <form className="pne-fields" onSubmit={savePosition}>
      <label>{t("Coordinate system")}
        <select value={system} onChange={(event) => setSystem(event.target.value as PanoGeoCoordinateSystem)}>
          {PANO_GEO_COORDINATE_SYSTEMS.map((entry) => <option key={entry} value={entry}>{names[entry]}</option>)}
        </select>
      </label>
      <label>{t("Latitude")}<input name="lat" type="number" required min={-90} max={90} step="any"
        key={`lat-${spot?.id}-${system}-${coordinates?.lat}`} defaultValue={coordinates?.lat} /></label>
      <label>{t("Longitude")}<input name="lng" type="number" required min={-180} max={180} step="any"
        key={`lng-${spot?.id}-${system}-${coordinates?.lng}`} defaultValue={coordinates?.lng} /></label>
      <button type="submit" disabled={!spot && !scene}>{t(spot ? "Save position" : "Add point by coordinates")}</button>
    </form>
    <label>{t("Icon size")}
      <input key={map.iconSize} type="number" min={1} step={1} defaultValue={map.iconSize ?? 28}
        onBlur={(event) => {
          const iconSize = event.currentTarget.valueAsNumber;
          if (event.currentTarget.validity.valid && iconSize > 0 && iconSize !== (map.iconSize ?? 28)) onChange({ ...map, iconSize });
        }} />
    </label>
    <label>{t("Default basemap")}
      <select value={map.initialSourceId ?? ""} onChange={(event) => onChange({ ...map, initialSourceId: event.target.value || undefined })}>
        <option value="">{t("First available")}</option>
        {map.initialSourceId && !sources?.some(({ id }) => id === map.initialSourceId) ? <option value={map.initialSourceId}>{map.initialSourceId}</option> : null}
        {sources?.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
      </select>
    </label>
    <label>{t("Map control layout")}
      <select value={map.controlsLayout ?? "horizontal"} onChange={(event) => onChange({
        ...map, controlsLayout: event.target.value === "vertical" ? "vertical" : "horizontal",
      })}>
        <option value="horizontal">{t("Horizontal")}</option>
        <option value="vertical">{t("Vertical")}</option>
      </select>
    </label>
    <label>{t("Presentation")}
      <select value={map.presentation?.mode ?? "panel"} onChange={(event) =>
        onChange({ ...map, presentation: { ...map.presentation, mode: event.target.value === "dialog" ? "dialog" : "panel" } })}>
        <option value="panel">{t("Panel")}</option>
        <option value="dialog">{t("Dialog")}</option>
      </select>
    </label>
  </div>;
}
