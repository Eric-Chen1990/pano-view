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
    spots: [],
    sector: {
      angle: 70,
      radius: 56,
      followFov: false,
      color: "#ffffff",
      opacity: 0.55,
      gradient: {
        type: "radial",
        stops: [
          { offset: 0, color: "#ffffff", opacity: 0.7 },
          { offset: 1, color: "#ffffff", opacity: 0 },
        ],
      },
    },
  };
}

export function MapLibrary({
  map,
  selectedSpotId,
  onSelectMap,
  onSelectSpot,
  onAdd,
  onClear,
  t,
}: {
  map?: PanoMapDefinition;
  selectedSpotId?: string;
  onSelectMap: () => void;
  onSelectSpot: (id: string) => void;
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
            <ul className="pne-hotspot-list">
              {map.spots.map((spot) => (
                <li key={spot.id}>
                  <button
                    type="button"
                    aria-pressed={selectedSpotId === spot.id}
                    onClick={() => onSelectSpot(spot.id)}
                  >
                    {spot.sceneId}
                  </button>
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
        {t("Choose a floor image, then place scene spots on the map. Drag a spot to move it; drag the blue handle to set sector heading.")}
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
            <span>{t("Sector color")}</span>
            <input
              type="color"
              value={sector.color ?? "#ffffff"}
              onChange={(event) =>
                patch({
                  ...map,
                  sector: { ...sector, color: event.target.value },
                })
              }
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
            <span>{t("Gradient")}</span>
            <select
              value={sector.gradient?.type ?? "none"}
              onChange={(event) => {
                const type = event.target.value;
                if (type === "none") {
                  const next = { ...sector };
                  delete next.gradient;
                  patch({ ...map, sector: next });
                  return;
                }
                patch({
                  ...map,
                  sector: {
                    ...sector,
                    gradient: {
                      type: type as "radial" | "linear",
                      stops: sector.gradient?.stops ?? [
                        { offset: 0, color: sector.color ?? "#ffffff", opacity: 0.7 },
                        { offset: 1, color: sector.color ?? "#ffffff", opacity: 0 },
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
