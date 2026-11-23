import type {
  PanoMapDefinition,
  PanoMapSpotDefinition,
  PanoProjectDefinition,
} from "@ericchen1990/pano-view";
import type { Translate } from "./i18n";
import { LibraryRow, LibrarySection } from "./library-list";
import { InspectorTabs } from "./inspector-tabs";
import { DEFAULT_INSET, MapLayoutFields } from "./map-layout-fields";
import { IconEdit } from "./icons";

export function emptyMap(): PanoMapDefinition {
  return {
    image: "",
    interaction: "zoom",
    presentation: {
      mode: "panel",
      anchor: { align: "bottom-left", inset: DEFAULT_INSET },
      width: 240,
      height: 180,
    },
    controls: { collapse: true, zoom: true },
    iconSize: 28,
    maxScale: 4,
    spots: [],
    sector: {
      angle: 70,
      radius: 56,
      followFov: false,
      color: "#38bdf8",
      opacity: 0.55,
      strokeColor: "#ffffff",
      strokeWidth: 1.5,
      strokeOpacity: 0.9,
    },
  };
}

export function MapLibrary({
  map,
  project,
  selectedSpotId,
  onSelectMap,
  onSelectSpot,
  onEditSpot,
  onDeleteSpot,
  onAdd,
  onClear,
  onAddSpot,
  t,
}: {
  map?: PanoMapDefinition;
  project: PanoProjectDefinition;
  selectedSpotId?: string;
  onSelectMap: () => void;
  onSelectSpot: (id: string) => void;
  onEditSpot: (id: string) => void;
  onDeleteSpot: (id: string) => void;
  onAdd: () => void;
  onClear: () => void;
  onAddSpot: () => void;
  t: Translate;
}) {
  if (!map) {
    return (
      <div className="pne-fields">
        <p className="pne-hint">{t("No floor plan yet.")}</p>
        <button type="button" className="pne-primary" onClick={onAdd}>
          {t("Add floor plan")}
        </button>
      </div>
    );
  }

  return (
    <div className="pne-map-library">
      <LibrarySection
        title={t("Floor plan")}
        count={map.spots.length}
        onDelete={onClear}
        deleteLabel={t("Remove floor plan")}
      >
        <ul className="pne-row-list" aria-label={t("Floor plan")}>
          <li className="pne-row" data-selected={selectedSpotId ? undefined : "true"}>
            <button
              type="button"
              className="pne-row-select"
              aria-pressed={!selectedSpotId}
              onClick={onSelectMap}
            >
              <b>{t("Floor plan settings")}</b>
              <small>
                {map.spots.length} {t("spots")}
              </small>
            </button>
          </li>
        </ul>
      </LibrarySection>
      <LibrarySection
        title={t("Spots")}
        count={map.spots.length}
        onAdd={onAddSpot}
        addLabel={t("Add spot")}
        empty={
          map.spots.length ? undefined : (
            <p className="pne-hint">
              {t("Select a scene, then click the map to place a spot.")}
            </p>
          )
        }
      >
        {map.spots.length ? (
          <ul className="pne-row-list" aria-label={t("Spots")}>
            {map.spots.map((spot) => {
              const title =
                project.scenes.find((scene) => scene.id === spot.sceneId)
                  ?.title ?? spot.sceneId;
              return (
                <LibraryRow
                  key={spot.id}
                  selected={selectedSpotId === spot.id}
                  label={title}
                  onSelect={() => onSelectSpot(spot.id)}
                  onEdit={() => onEditSpot(spot.id)}
                  editLabel={`${t("Edit spot")}: ${title}`}
                  onDelete={() => onDeleteSpot(spot.id)}
                  deleteLabel={`${t("Delete spot")}: ${title}`}
                />
              );
            })}
          </ul>
        ) : null}
      </LibrarySection>
    </div>
  );
}

export function MapInspector({
  map,
  project,
  selectedSpotId,
  placementSceneId,
  onChange,
  onBegin,
  onEnd,
  onPickImage,
  onPickIcon,
  onSelectedSpotIdChange,
  onPlacementSceneIdChange,
  t,
}: {
  map: PanoMapDefinition;
  project: PanoProjectDefinition;
  selectedSpotId?: string;
  placementSceneId?: string;
  onChange: (map: PanoMapDefinition) => void;
  onBegin: () => void;
  onEnd: () => void;
  onPickImage: () => void;
  onPickIcon: () => void;
  onSelectedSpotIdChange: (id: string | undefined) => void;
  onPlacementSceneIdChange: (id: string | undefined) => void;
  t: Translate;
}) {
  const selected = map.spots.find((spot) => spot.id === selectedSpotId);
  const presentation = map.presentation ?? {
    mode: "panel" as const,
    anchor: { align: "bottom-left" as const, inset: DEFAULT_INSET },
    width: 240,
    height: 180,
  };
  const sector = map.sector;
  const patch = (next: PanoMapDefinition) => {
    onBegin();
    onChange(next);
    onEnd();
  };
  const updateSpot = (spot: PanoMapSpotDefinition) => {
    patch({
      ...map,
      spots: map.spots.map((item) => (item.id === spot.id ? spot : item)),
    });
  };
  const sizeSemantics =
    presentation.mode === "dialog" ? "launcher" : "panel";

  return (
    <InspectorTabs
      tabs={[
        {
          id: "layout",
          label: t("Layout"),
          content: (
            <div className="pne-fields">
              <label>
                <span>{t("Floor image")}</span>
                <div className="pne-button-grid">
                  <button type="button" onClick={onPickImage}>
                    {map.image ? t("Replace image") : t("Choose image")}
                  </button>
                </div>
                {map.image ? <code className="pne-mono">{map.image}</code> : null}
              </label>
              <MapLayoutFields
                presentation={presentation}
                collapse={map.controls?.collapse === true}
                sizeSemantics={sizeSemantics}
                widthFallback={presentation.mode === "dialog" ? 48 : 240}
                heightFallback={presentation.mode === "dialog" ? 48 : 180}
                onChange={(next) =>
                  patch({ ...map, presentation: next })
                }
                t={t}
              />
              <label className="pne-checkbox">
                <input
                  type="checkbox"
                  checked={map.controls?.collapse === true}
                  onChange={(event) =>
                    patch({
                      ...map,
                      controls: { ...map.controls, collapse: event.target.checked },
                    })
                  }
                />
                <span>{t("Show expand / collapse")}</span>
              </label>
            </div>
          ),
        },
        {
          id: "interaction",
          label: t("Interaction"),
          content: (
            <div className="pne-fields">
              <label>
                <span>{t("Map interaction")}</span>
                <select
                  value={map.interaction ?? "fixed"}
                  onChange={(event) =>
                    patch({
                      ...map,
                      interaction: event.target.value as "fixed" | "zoom",
                    })
                  }
                >
                  <option value="fixed">{t("Fixed (gestures off)")}</option>
                  <option value="zoom">{t("Zoom and pan")}</option>
                </select>
              </label>
              <p className="pne-field-help">
                {map.interaction === "zoom"
                  ? t("Wheel, drag-pan when zoomed, and optional zoom buttons.")
                  : t("Map stays fit-to-panel. Zoom buttons and gestures are disabled.")}
              </p>
              {map.interaction === "zoom" ? (
                <>
                  <label>
                    <span>{t("Max zoom scale")}</span>
                    <input
                      type="number"
                      min={1}
                      step={0.5}
                      value={map.maxScale ?? 8}
                      onChange={(event) =>
                        patch({
                          ...map,
                          maxScale: Math.max(1, Number(event.target.value) || 1),
                        })
                      }
                    />
                  </label>
                  <label className="pne-checkbox">
                    <input
                      type="checkbox"
                      checked={map.controls?.zoom === true}
                      onChange={(event) =>
                        patch({
                          ...map,
                          controls: { ...map.controls, zoom: event.target.checked },
                        })
                      }
                    />
                    <span>{t("Show zoom buttons")}</span>
                  </label>
                  <label className="pne-checkbox">
                    <input
                      type="checkbox"
                      checked={
                        map.dragMotion !== false && map.dragMotion?.inertia !== false
                      }
                      onChange={(event) => {
                        const bounce =
                          map.dragMotion !== false &&
                          map.dragMotion?.bounce !== false;
                        const inertia = event.target.checked;
                        if (inertia && bounce) {
                          const { dragMotion: _removed, ...rest } = map;
                          patch(rest);
                          return;
                        }
                        patch({
                          ...map,
                          dragMotion: { inertia, bounce },
                        });
                      }}
                    />
                    <span>{t("Pan inertia")}</span>
                  </label>
                  <label className="pne-checkbox">
                    <input
                      type="checkbox"
                      checked={
                        map.dragMotion !== false && map.dragMotion?.bounce !== false
                      }
                      onChange={(event) => {
                        const inertia =
                          map.dragMotion !== false &&
                          map.dragMotion?.inertia !== false;
                        const bounce = event.target.checked;
                        if (inertia && bounce) {
                          const { dragMotion: _removed, ...rest } = map;
                          patch(rest);
                          return;
                        }
                        patch({
                          ...map,
                          dragMotion: { inertia, bounce },
                        });
                      }}
                    />
                    <span>{t("Edge bounce")}</span>
                  </label>
                  <p className="pne-field-help">
                    {t(
                      "After a pan drag, inertia keeps sliding; bounce rubber-bands past the edge.",
                    )}
                  </p>
                </>
              ) : null}
              <label>
                <span>{t("Icon size (px)")}</span>
                <input
                  type="number"
                  min={12}
                  value={map.iconSize ?? 28}
                  onChange={(event) =>
                    patch({ ...map, iconSize: Number(event.target.value) })
                  }
                />
              </label>
            </div>
          ),
        },
        {
          id: "sector",
          label: t("Sector"),
          content: (
            <div className="pne-fields">
              <label className="pne-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(sector)}
                  onChange={(event) =>
                    patch({
                      ...map,
                      sector: event.target.checked ? emptyMap().sector : undefined,
                    })
                  }
                />
                <span>{t("Show sector for active spot")}</span>
              </label>
              {sector ? (
                <>
                  <label>
                    <span>{t("Sector angle (°)")}</span>
                    <input
                      type="number"
                      min={1}
                      max={359}
                      value={sector.angle}
                      onChange={(event) =>
                        patch({
                          ...map,
                          sector: { ...sector, angle: Number(event.target.value) },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>{t("Sector radius (px)")}</span>
                    <input
                      type="number"
                      min={1}
                      value={sector.radius}
                      onChange={(event) =>
                        patch({
                          ...map,
                          sector: { ...sector, radius: Number(event.target.value) },
                        })
                      }
                    />
                  </label>
                  <label className="pne-checkbox">
                    <input
                      type="checkbox"
                      checked={sector.followFov === true}
                      onChange={(event) =>
                        patch({
                          ...map,
                          sector: { ...sector, followFov: event.target.checked },
                        })
                      }
                    />
                    <span>{t("Follow viewer FOV")}</span>
                  </label>
                  <label>
                    <span>{t("Fill style")}</span>
                    <select
                      value={sector.gradient?.type ?? "none"}
                      onChange={(event) => {
                        const type = event.target.value;
                        if (type === "none") {
                          const { gradient: _removed, ...rest } = sector;
                          void _removed;
                          patch({ ...map, sector: rest });
                          return;
                        }
                        const fill = sector.color ?? "#38bdf8";
                        patch({
                          ...map,
                          sector: {
                            ...sector,
                            gradient: {
                              type: type as "radial" | "linear",
                              stops: [
                                { offset: 0, color: fill, opacity: 1 },
                                { offset: 1, color: fill, opacity: 0 },
                              ],
                            },
                          },
                        });
                      }}
                    >
                      <option value="none">{t("Solid color")}</option>
                      <option value="radial">{t("Radial gradient")}</option>
                      <option value="linear">{t("Linear gradient")}</option>
                    </select>
                  </label>
                  <label>
                    <span>{t("Sector color")}</span>
                    <input
                      type="color"
                      value={sector.color ?? "#38bdf8"}
                      onChange={(event) => {
                        const color = event.target.value;
                        patch({
                          ...map,
                          sector: {
                            ...sector,
                            color,
                            ...(sector.gradient
                              ? {
                                  gradient: {
                                    ...sector.gradient,
                                    stops: sector.gradient.stops.map((stop) => ({
                                      ...stop,
                                      color,
                                    })),
                                  },
                                }
                              : {}),
                          },
                        });
                      }}
                    />
                  </label>
                  <label>
                    <span>{t("Sector opacity")}</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={sector.opacity ?? 0.55}
                      onChange={(event) =>
                        patch({
                          ...map,
                          sector: {
                            ...sector,
                            opacity: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>{t("Sector border color")}</span>
                    <input
                      type="color"
                      value={sector.strokeColor ?? sector.color ?? "#ffffff"}
                      onChange={(event) =>
                        patch({
                          ...map,
                          sector: {
                            ...sector,
                            strokeColor: event.target.value,
                            strokeWidth: sector.strokeWidth ?? 1.5,
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>{t("Sector border width (px)")}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={sector.strokeWidth ?? 0}
                      onChange={(event) =>
                        patch({
                          ...map,
                          sector: {
                            ...sector,
                            strokeWidth: Number(event.target.value),
                            ...(Number(event.target.value) > 0 && !sector.strokeColor
                              ? { strokeColor: sector.color ?? "#ffffff" }
                              : {}),
                          },
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>{t("Sector border opacity")}</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={sector.strokeOpacity ?? 1}
                      onChange={(event) =>
                        patch({
                          ...map,
                          sector: {
                            ...sector,
                            strokeOpacity: Number(event.target.value),
                          },
                        })
                      }
                    />
                  </label>
                </>
              ) : null}
            </div>
          ),
        },
        {
          id: "spot",
          label: t("Spot"),
          content: (
            <div className="pne-fields">
              <p className="pne-edit-hint">
                {t(
                  "Choose a floor image, then place scene spots on the map. Drag a spot to move it; drag the sector to set heading.",
                )}
              </p>
              <label>
                <span>{t("Scene for next click")}</span>
                <select
                  value={placementSceneId ?? ""}
                  onChange={(event) =>
                    onPlacementSceneIdChange(event.target.value || undefined)
                  }
                >
                  <option value="">{t("Select a scene")}</option>
                  {project.scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.title ?? scene.id}
                    </option>
                  ))}
                </select>
              </label>
              {selected ? (
                <>
                  <label>
                    <span>{t("Scene")}</span>
                    <select
                      value={selected.sceneId}
                      onChange={(event) =>
                        updateSpot({ ...selected, sceneId: event.target.value })
                      }
                    >
                      {project.scenes.map((scene) => (
                        <option key={scene.id} value={scene.id}>
                          {scene.title ?? scene.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>X</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.001}
                      value={selected.x}
                      onChange={(event) =>
                        updateSpot({
                          ...selected,
                          x: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>Y</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.001}
                      value={selected.y}
                      onChange={(event) =>
                        updateSpot({
                          ...selected,
                          y: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>{t("Heading (°)")}</span>
                    <input
                      type="number"
                      value={selected.heading}
                      onChange={(event) =>
                        updateSpot({
                          ...selected,
                          heading: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <div className="pne-button-grid">
                    <button type="button" onClick={onPickIcon}>
                      {selected.icon ? t("Replace icon") : t("Choose icon")}
                    </button>
                  </div>
                  {selected.icon ? (
                    <code className="pne-mono">{selected.icon}</code>
                  ) : null}
                  <button
                    type="button"
                    className="pne-subtle"
                    onClick={() => onSelectedSpotIdChange(undefined)}
                  >
                    <IconEdit width={12} height={12} />
                    {t("Back to map settings")}
                  </button>
                </>
              ) : (
                <p className="pne-hint">{t("Select a spot to edit its properties.")}</p>
              )}
            </div>
          ),
        },
      ]}
    />
  );
}
