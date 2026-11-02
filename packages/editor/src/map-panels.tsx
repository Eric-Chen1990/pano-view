import type {
  PanoMapCorner,
  PanoMapDefinition,
  PanoMapSpotDefinition,
  PanoProjectDefinition,
} from "@ericchen1990/pano-view";
import type { Translate } from "./i18n";

const CORNERS: PanoMapCorner[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

export function emptyMap(): PanoMapDefinition {
  return {
    image: "",
    interaction: "zoom",
    presentation: {
      mode: "docked",
      corner: "bottom-left",
      width: 240,
      height: 180,
      offsetX: 16,
      offsetY: 16,
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
  selectedSpotId,
  onSelectMap,
  onSelectSpot,
  onDeleteSpot,
  onAdd,
  onClear,
  t,
}: {
  map?: PanoMapDefinition;
  selectedSpotId?: string;
  onSelectMap: () => void;
  onSelectSpot: (id: string) => void;
  onDeleteSpot: (id: string) => void;
  onAdd: () => void;
  onClear: () => void;
  t: Translate;
}) {
  return (
    <div className="pne-map-library">
      {!map ? (
        <div className="pne-fields">
          <p className="pne-hint">{t("No floor plan yet.")}</p>
          <button type="button" className="pne-primary" onClick={onAdd}>
            {t("Add floor plan")}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="pne-scene-card"
            aria-pressed="true"
            onClick={onSelectMap}
          >
            <strong>{t("Floor plan")}</strong>
            <span>{map.spots.length} {t("spots")}</span>
          </button>
          <div className="pne-fields pne-button-grid">
            <button type="button" onClick={onClear}>
              {t("Remove floor plan")}
            </button>
          </div>
          <div className="pne-panel-title">{t("Spots")}</div>
          {map.spots.length ? (
            <ul className="pne-hotspot-list" aria-label={t("Spots")}>
              {map.spots.map((spot) => (
                <li
                  key={spot.id}
                  className="pne-hotspot-item"
                  data-selected={selectedSpotId === spot.id}
                >
                  <button
                    type="button"
                    className="pne-hotspot-row"
                    aria-pressed={selectedSpotId === spot.id}
                    onClick={() => onSelectSpot(spot.id)}
                  >
                    <b>{spot.sceneId}</b>
                  </button>
                  <div className="pne-hotspot-actions">
                    <button
                      type="button"
                      title={t("Delete spot")}
                      aria-label={`${t("Delete spot")}: ${spot.sceneId}`}
                      onClick={() => onDeleteSpot(spot.id)}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pne-hint">{t("Select a scene, then click the map to place a spot.")}</p>
          )}
        </>
      )}
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
  onDeleteSpot,
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
  onDeleteSpot: (id: string) => void;
  t: Translate;
}) {
  const selected = map.spots.find((spot) => spot.id === selectedSpotId);
  const presentation = map.presentation ?? {
    mode: "docked" as const,
    corner: "bottom-left" as const,
    width: 240,
    height: 180,
    offsetX: 16,
    offsetY: 16,
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

  return (
    <div className="pne-fields">
      <p className="pne-edit-hint">
        {t("Choose a floor image, then place scene spots on the map. Drag a spot to move it; drag the sector to set heading.")}
      </p>
      <label>
        <span>{t("Floor image")}</span>
        <div className="pne-button-grid">
          <button type="button" onClick={onPickImage}>
            {map.image ? t("Replace image") : t("Choose image")}
          </button>
        </div>
        {map.image ? <code className="pne-mono">{map.image}</code> : null}
      </label>
      <label>
        <span>{t("Presentation")}</span>
        <select
          value={presentation.mode}
          onChange={(event) =>
            patch({
              ...map,
              presentation: {
                ...presentation,
                mode: event.target.value as "docked" | "dialog",
              },
            })
          }
        >
          <option value="docked">{t("Docked panel")}</option>
          <option value="dialog">{t("Dialog button")}</option>
        </select>
      </label>
      <label>
        <span>{t("Corner")}</span>
        <select
          value={presentation.corner ?? "bottom-left"}
          onChange={(event) =>
            patch({
              ...map,
              presentation: {
                ...presentation,
                corner: event.target.value as PanoMapCorner,
              },
            })
          }
        >
          {CORNERS.map((corner) => (
            <option key={corner} value={corner}>
              {t(corner)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{t("Width (px)")}</span>
        <input
          type="number"
          min={48}
          value={presentation.width ?? 240}
          onChange={(event) =>
            patch({
              ...map,
              presentation: { ...presentation, width: Number(event.target.value) },
            })
          }
        />
      </label>
      <label>
        <span>{t("Height (px)")}</span>
        <input
          type="number"
          min={48}
          value={presentation.height ?? 180}
          onChange={(event) =>
            patch({
              ...map,
              presentation: { ...presentation, height: Number(event.target.value) },
            })
          }
        />
      </label>
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
              checked={map.dragMotion !== false && map.dragMotion?.inertia !== false}
              onChange={(event) => {
                const bounce =
                  map.dragMotion !== false && map.dragMotion?.bounce !== false;
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
              checked={map.dragMotion !== false && map.dragMotion?.bounce !== false}
              onChange={(event) => {
                const inertia =
                  map.dragMotion !== false && map.dragMotion?.inertia !== false;
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
            {t("After a pan drag, inertia keeps sliding; bounce rubber-bands past the edge.")}
          </p>
        </>
      ) : null}
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
      <div className="pne-panel-title">{t("Sector")}</div>
      <label className="pne-checkbox">
        <input
          type="checkbox"
          checked={Boolean(sector)}
          onChange={(event) =>
            patch({
              ...map,
              sector: event.target.checked
                ? emptyMap().sector
                : undefined,
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
                      // Relative fade shape; overall strength comes from sector.opacity.
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
                  sector: { ...sector, opacity: Number(event.target.value) },
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
                  sector: { ...sector, strokeOpacity: Number(event.target.value) },
                })
              }
            />
          </label>
        </>
      ) : null}
      <div className="pne-panel-title">{t("Place spot")}</div>
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
          <div className="pne-panel-title">{t("Selected spot")}</div>
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
                updateSpot({ ...selected, x: Number(event.target.value) })
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
                updateSpot({ ...selected, y: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>{t("Heading (°)")}</span>
            <input
              type="number"
              value={selected.heading}
              onChange={(event) =>
                updateSpot({ ...selected, heading: Number(event.target.value) })
              }
            />
          </label>
          <div className="pne-button-grid">
            <button type="button" onClick={onPickIcon}>
              {selected.icon ? t("Replace icon") : t("Choose icon")}
            </button>
            <button
              type="button"
              onClick={() => {
                onDeleteSpot(selected.id);
                onSelectedSpotIdChange(undefined);
              }}
            >
              {t("Delete spot")}
            </button>
          </div>
          {selected.icon ? <code className="pne-mono">{selected.icon}</code> : null}
        </>
      ) : null}
    </div>
  );
}
