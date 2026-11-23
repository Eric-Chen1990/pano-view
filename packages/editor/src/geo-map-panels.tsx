import { useState, type FormEvent } from "react";
import {
  PANO_GEO_COORDINATE_SYSTEMS,
  type PanoGeoCoordinateSystem,
  type PanoGeoMapDefinition,
  type PanoGeoMapSpot,
  type PanoProjectSceneDefinition,
} from "@ericchen1990/pano-view/data";
import type { PanoGeoMapEdit, PanoGeoMapSource } from "@ericchen1990/pano-view";
import {
  EDITOR_BASEMAP_PROVIDERS,
  basemapBlockReason,
  type EditorBasemapSession,
} from "./editor-basemap";
import type { Translate } from "./i18n";
import { LibraryRow, LibrarySection } from "./library-list";
import { InspectorTabs } from "./inspector-tabs";
import { DEFAULT_INSET, MapLayoutFields } from "./map-layout-fields";

type GeoPanelProps = {
  map: PanoGeoMapDefinition;
  scenes: readonly PanoProjectSceneDefinition[];
  sources?: readonly PanoGeoMapSource[];
  /** Basemap currently shown on the online map surface. */
  activeSource?: PanoGeoMapSource;
  /** Editor-only provider and credentials. Not part of the project document. */
  basemapSession: EditorBasemapSession;
  /** `apply` loads the map. Credential fields pass false while typing and true on blur. */
  onBasemapSession: (session: EditorBasemapSession, apply?: boolean) => void;
  spot?: PanoGeoMapSpot;
  placement?: { sceneId: string } | { spotId: string };
  onPlacement: (next?: { sceneId: string } | { spotId: string }) => void;
  onChange: (map: PanoGeoMapDefinition) => void;
  onEdit: (edit: PanoGeoMapEdit) => void;
  onIcon: () => void;
  t: Translate;
};

const names = { wgs84: "WGS84", gcj02: "GCJ-02", bd09: "BD-09" };
const providerNames = {
  osm: "OpenStreetMap",
  google: "Google Maps",
  amap: "AMap",
  baidu: "Baidu Maps",
} as const;

function sourceCoordinateSystem(source: PanoGeoMapSource): PanoGeoCoordinateSystem {
  if (source.kind === "amap") return "gcj02";
  if (source.kind === "baidu") return "bd09";
  return source.kind === "google" ? source.coordinateSystem ?? "wgs84" : "wgs84";
}

function sourceStyleLabel(source: PanoGeoMapSource, t: Translate): string {
  if (source.kind === "xyz") return t("Road map tiles");
  return source.mapType === "satellite" ? t("Satellite") : t("Road map");
}

function sourceTitle(source: PanoGeoMapSource, t: Translate): string {
  if (source.kind === "amap") return t("AMap");
  if (source.kind === "baidu") return t("Baidu Maps");
  if (source.kind === "google") return t("Google Maps");
  return source.label;
}

function describeSource(source: PanoGeoMapSource, t: Translate): string {
  return `${sourceTitle(source, t)} · ${sourceStyleLabel(source, t)} · ${names[sourceCoordinateSystem(source)]}`;
}

function readZoomField(input: HTMLInputElement): number | undefined | "invalid" {
  if (!input.value.trim()) return undefined;
  const value = input.valueAsNumber;
  if (!Number.isFinite(value) || value < 0 || value > 24) return "invalid";
  return value;
}

export function GeoMapLibrary({
  map,
  scenes,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
  onClear,
  t,
}: {
  map?: PanoGeoMapDefinition;
  scenes: readonly PanoProjectSceneDefinition[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onClear: () => void;
  t: Translate;
}) {
  if (!map) {
    return (
      <div className="pne-fields">
        <p className="pne-hint">{t("No online map yet.")}</p>
        <button type="button" className="pne-primary" onClick={onAdd}>
          {t("Add online map")}
        </button>
      </div>
    );
  }

  return (
    <LibrarySection
      title={t("Online map")}
      count={map.spots.length}
      onAdd={onAdd}
      addLabel={t("New point")}
      onDelete={onClear}
      deleteLabel={t("Remove online map")}
      empty={
        map.spots.length ? undefined : (
          <p className="pne-hint">{t("Add a point on the map or by coordinates.")}</p>
        )
      }
    >
      {map.spots.length ? (
        <ul className="pne-row-list" aria-label={t("Online map")}>
          {map.spots.map((spot) => {
            const label =
              spot.label ??
              scenes.find((scene) => scene.id === spot.sceneId)?.title ??
              spot.sceneId;
            return (
              <LibraryRow
                key={spot.id}
                selected={selectedId === spot.id}
                label={label}
                onSelect={() => onSelect(spot.id)}
                onEdit={() => onEdit(spot.id)}
                editLabel={`${t("Edit point")}: ${label}`}
                onDelete={() => onDelete(spot.id)}
                deleteLabel={`${t("Delete point")}: ${label}`}
              />
            );
          })}
        </ul>
      ) : null}
    </LibrarySection>
  );
}

export function GeoMapInspector({
  map,
  scenes,
  sources,
  activeSource,
  basemapSession,
  onBasemapSession,
  spot,
  placement,
  onPlacement,
  onChange,
  onEdit,
  onIcon,
  t,
}: GeoPanelProps) {
  const [sceneId, setSceneId] = useState("");
  const [system, setSystem] = useState<PanoGeoCoordinateSystem>("wgs84");
  const [name, setName] = useState<{ id: string; text: string }>();
  const scene = scenes.find((entry) => entry.id === sceneId) ?? scenes[0];
  const sourceList = sources ?? [];
  const firstSource = sourceList[0];
  const viewing = activeSource ?? firstSource;
  const viewingSystem = viewing ? sourceCoordinateSystem(viewing) : undefined;
  const updateSpot = (patch: Partial<PanoGeoMapSpot>) => {
    if (!spot) return;
    onChange({
      ...map,
      spots: map.spots.map((item) =>
        item.id === spot.id ? { ...item, ...patch } : item,
      ),
    });
  };
  const coordinates = spot?.positions[system];
  const viewingPosition =
    spot && viewingSystem ? spot.positions[viewingSystem] : undefined;
  const calibrated =
    spot &&
    scenes.some(
      (entry) => entry.id === spot.sceneId && entry.northYaw !== undefined,
    );
  const savePosition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const position = {
      lat: Number(data.get("lat")),
      lng: Number(data.get("lng")),
    };
    if (spot)
      onEdit({
        type: "move",
        spotId: spot.id,
        coordinateSystem: system,
        position,
      });
    else if (scene)
      onEdit({
        type: "place",
        sceneId: scene.id,
        coordinateSystem: system,
        position,
      });
  };
  const presentation = map.presentation ?? {
    mode: "panel" as const,
    anchor: { align: "bottom-left" as const, inset: DEFAULT_INSET },
    width: 320,
    height: 230,
  };
  const sizeSemantics = presentation.mode === "dialog" ? "dialog" : "panel";
  const commitZoom = (
    field: "minZoom" | "maxZoom" | "initialZoom",
    value: number | undefined,
  ) => {
    const minZoom = field === "minZoom" ? value : map.minZoom;
    const maxZoom = field === "maxZoom" ? value : map.maxZoom;
    const initialZoom = field === "initialZoom" ? value : map.initialZoom;
    if (minZoom !== undefined && maxZoom !== undefined && minZoom > maxZoom) return;
    if (initialZoom !== undefined) {
      if (minZoom !== undefined && initialZoom < minZoom) return;
      if (maxZoom !== undefined && initialZoom > maxZoom) return;
    }
    const next: PanoGeoMapDefinition = { ...map };
    if (minZoom === undefined) delete next.minZoom;
    else next.minZoom = minZoom;
    if (maxZoom === undefined) delete next.maxZoom;
    else next.maxZoom = maxZoom;
    if (initialZoom === undefined) delete next.initialZoom;
    else next.initialZoom = initialZoom;
    if (
      next.minZoom === map.minZoom &&
      next.maxZoom === map.maxZoom &&
      next.initialZoom === map.initialZoom
    )
      return;
    onChange(next);
  };

  return (
    <InspectorTabs
      tabs={[
        {
          id: "point",
          label: t("Point"),
          content: (
            <div className="pne-fields">
              <label>
                {t("Scene for next point")}
                <select
                  value={scene?.id ?? ""}
                  onChange={(event) => setSceneId(event.target.value)}
                >
                  {!scene ? (
                    <option value="">{t("No scenes yet.")}</option>
                  ) : null}
                  {scenes.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title ?? entry.id}
                    </option>
                  ))}
                </select>
              </label>
              <p className="pne-field-help">
                {t("Use + in the Online map list to place a point by clicking the map.")}
              </p>
              {viewing ? (
                <p className="pne-field-help">
                  {t("Viewing basemap")}: {describeSource(viewing, t)}
                  {spot
                    ? viewingPosition
                      ? ` · ${t("This point has a position for this coordinate system.")}`
                      : ` · ${t("This point has no position for this coordinate system yet.")}`
                    : null}
                </p>
              ) : (
                <p className="pne-field-help">{t(basemapBlockReason(basemapSession) ?? "No basemap configured")}</p>
              )}
              {spot ? (
                <button
                  type="button"
                  disabled={!sourceList.length}
                  onClick={() => onPlacement({ spotId: spot.id })}
                >
                  {t("Set point on this basemap")}
                </button>
              ) : null}
              {placement ? (
                <div role="status">
                  {t("Click the online map to set the position.")}
                  <button type="button" onClick={() => onPlacement()}>
                    {t("Cancel")}
                  </button>
                </div>
              ) : null}
              {spot ? (
                <>
                  <label>
                    {t("Point name")}
                    <input
                      value={name?.id === spot.id ? name.text : spot.label ?? ""}
                      onChange={(event) =>
                        setName({ id: spot.id, text: event.target.value })
                      }
                      onBlur={() => {
                        if (name?.id === spot.id)
                          updateSpot({
                            label: name.text.trim() || undefined,
                          });
                        setName(undefined);
                      }}
                    />
                  </label>
                  {calibrated ? (
                    <p className="pne-hint">
                      {t(
                        "The radar uses this scene's virtual north. Drag it to adjust the scene calibration.",
                      )}
                    </p>
                  ) : (
                    <>
                      <label>
                        {t("Heading at yaw zero (°)")}
                        <input
                          key={`heading-${spot.id}-${spot.heading}`}
                          type="number"
                          step="any"
                          defaultValue={spot.heading ?? ""}
                          onBlur={(event) => {
                            if (!event.currentTarget.validity.valid) return;
                            const angle = event.currentTarget.valueAsNumber;
                            const heading = Number.isFinite(angle)
                              ? ((angle % 360) + 360) % 360
                              : undefined;
                            if (heading !== spot.heading)
                              updateSpot({ heading });
                          }}
                        />
                      </label>
                      <p className="pne-hint">
                        {t("Drag the radar to align it with a visible landmark.")}
                      </p>
                    </>
                  )}
                  <div className="pne-button-grid">
                    <button type="button" onClick={onIcon}>
                      {t("Choose icon")}
                    </button>
                    {spot.icon ? (
                      <button
                        type="button"
                        onClick={() => updateSpot({ icon: undefined })}
                      >
                        {t("Use default icon")}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
              <form className="pne-fields" onSubmit={savePosition}>
                <label>
                  {t("Coordinate system")}
                  <select
                    value={system}
                    onChange={(event) =>
                      setSystem(event.target.value as PanoGeoCoordinateSystem)
                    }
                  >
                    {PANO_GEO_COORDINATE_SYSTEMS.map((entry) => (
                      <option key={entry} value={entry}>
                        {names[entry]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("Latitude")}
                  <input
                    name="lat"
                    type="number"
                    required
                    min={-90}
                    max={90}
                    step="any"
                    key={`lat-${spot?.id}-${system}-${coordinates?.lat}`}
                    defaultValue={coordinates?.lat}
                  />
                </label>
                <label>
                  {t("Longitude")}
                  <input
                    name="lng"
                    type="number"
                    required
                    min={-180}
                    max={180}
                    step="any"
                    key={`lng-${spot?.id}-${system}-${coordinates?.lng}`}
                    defaultValue={coordinates?.lng}
                  />
                </label>
                <button type="submit" disabled={!spot && !scene}>
                  {t(spot ? "Save position" : "Add point by coordinates")}
                </button>
              </form>
            </div>
          ),
        },
        {
          id: "layout",
          label: t("Layout"),
          content: (
            <div className="pne-fields">
              <MapLayoutFields
                presentation={presentation}
                sizeSemantics={sizeSemantics}
                widthFallback={presentation.mode === "dialog" ? 720 : 320}
                heightFallback={presentation.mode === "dialog" ? 520 : 230}
                onChange={(next) => onChange({ ...map, presentation: next })}
                t={t}
              />
              <label>
                {t("Icon size")}
                <input
                  key={map.iconSize}
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={map.iconSize ?? 28}
                  onBlur={(event) => {
                    const iconSize = event.currentTarget.valueAsNumber;
                    if (
                      event.currentTarget.validity.valid &&
                      iconSize > 0 &&
                      iconSize !== (map.iconSize ?? 28)
                    )
                      onChange({ ...map, iconSize });
                  }}
                />
              </label>
              <label>
                {t("Minimum zoom")}
                <input
                  type="number"
                  min={0}
                  max={24}
                  step="any"
                  placeholder={t("Basemap default")}
                  value={map.minZoom ?? ""}
                  onChange={(event) => {
                    const value = readZoomField(event.currentTarget);
                    if (value === "invalid") return;
                    commitZoom("minZoom", value);
                  }}
                />
              </label>
              <label>
                {t("Maximum zoom")}
                <input
                  type="number"
                  min={0}
                  max={24}
                  step="any"
                  placeholder={t("Basemap default")}
                  value={map.maxZoom ?? ""}
                  onChange={(event) => {
                    const value = readZoomField(event.currentTarget);
                    if (value === "invalid") return;
                    commitZoom("maxZoom", value);
                  }}
                />
              </label>
              <label>
                {t("Initial zoom")}
                <input
                  type="number"
                  min={0}
                  max={24}
                  step="any"
                  placeholder={t("Fit spots")}
                  value={map.initialZoom ?? ""}
                  onChange={(event) => {
                    const value = readZoomField(event.currentTarget);
                    if (value === "invalid") return;
                    commitZoom("initialZoom", value);
                  }}
                />
              </label>
              <p className="pne-field-help">
                {t(
                  "Zoom levels are Web Mercator values from 0 to 24. Leave blank for the basemap default; initial zoom skips auto-fit on first open.",
                )}
              </p>
              <label>
                {t("Map control layout")}
                <select
                  value={map.controlsLayout ?? "horizontal"}
                  onChange={(event) =>
                    onChange({
                      ...map,
                      controlsLayout:
                        event.target.value === "vertical"
                          ? "vertical"
                          : "horizontal",
                    })
                  }
                >
                  <option value="horizontal">{t("Horizontal")}</option>
                  <option value="vertical">{t("Vertical")}</option>
                </select>
              </label>
            </div>
          ),
        },
        {
          id: "basemap",
          label: t("Basemap"),
          content: (
            <div className="pne-fields">
              <label>
                {t("Map source")}
                <select
                  value={basemapSession.provider}
                  onChange={(event) =>
                    onBasemapSession({
                      ...basemapSession,
                      provider: event.target.value as EditorBasemapSession["provider"],
                    }, true)
                  }
                >
                  {EDITOR_BASEMAP_PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {t(providerNames[provider])}
                    </option>
                  ))}
                </select>
              </label>
              {basemapSession.provider === "osm" ? null : (
                <label>
                  {t("Basemap style")}
                  <select
                    value={basemapSession.mapType}
                    onChange={(event) =>
                      onBasemapSession({
                        ...basemapSession,
                        mapType: event.target.value === "satellite" ? "satellite" : "road",
                      }, true)
                    }
                  >
                    <option value="road">{t("Road map")}</option>
                    <option value="satellite">{t("Satellite")}</option>
                  </select>
                </label>
              )}
              {basemapSession.provider === "google" ? (
                <label>
                  {t("Google Maps browser API key")}
                  <input
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={basemapSession.googleApiKey}
                    onChange={(event) =>
                      onBasemapSession({ ...basemapSession, googleApiKey: event.target.value })
                    }
                    onBlur={(event) =>
                      onBasemapSession({ ...basemapSession, googleApiKey: event.currentTarget.value }, true)
                    }
                  />
                </label>
              ) : null}
              {basemapSession.provider === "amap" ? (
                <>
                  <label>
                    {t("AMap key")}
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      value={basemapSession.amapApiKey}
                      onChange={(event) =>
                        onBasemapSession({ ...basemapSession, amapApiKey: event.target.value })
                      }
                      onBlur={(event) =>
                        onBasemapSession({ ...basemapSession, amapApiKey: event.currentTarget.value }, true)
                      }
                    />
                  </label>
                  <label>
                    {t("AMap security service host")}
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="https://example.com/_AMapService"
                      value={basemapSession.amapServiceHost}
                      onChange={(event) =>
                        onBasemapSession({ ...basemapSession, amapServiceHost: event.target.value })
                      }
                      onBlur={(event) =>
                        onBasemapSession({ ...basemapSession, amapServiceHost: event.currentTarget.value }, true)
                      }
                    />
                  </label>
                </>
              ) : null}
              {basemapSession.provider === "baidu" ? (
                <label>
                  {t("Baidu Maps browser AK")}
                  <input
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    value={basemapSession.baiduAk}
                    onChange={(event) =>
                      onBasemapSession({ ...basemapSession, baiduAk: event.target.value })
                    }
                    onBlur={(event) =>
                      onBasemapSession({ ...basemapSession, baiduAk: event.currentTarget.value }, true)
                    }
                  />
                </label>
              ) : null}
              {viewing ? (
                <p className="pne-field-help">
                  {t("Current basemap")}: {describeSource(viewing, t)}
                </p>
              ) : (
                <p className="pne-field-help">
                  {basemapSession.provider === "amap"
                    ? t("Enter the AMap key and a security service host ending in /_AMapService to load this basemap.")
                    : t("Enter this provider's browser key to load the basemap.")}
                </p>
              )}
              <p className="pne-field-help">
                {t("Keys stay in this editor session and are not written to project.json. Published playback still receives basemaps from the host app.")}
              </p>
            </div>
          ),
        },
      ]}
    />
  );
}
