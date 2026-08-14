import { StrictMode, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AutoRotate,
  GraphicHotspot,
  ImageHotspot,
  PanoView,
  Sphere,
  Tile,
  type GraphicDefinition,
  type HotspotPosition,
  type PanoViewHandle,
  type PanoViewState,
  type TileLoadProgress,
} from "@pano-view/react";
import "./styles.css";

type ViewerMode = "sphere" | "tile";
type EditorTool = "navigate" | "select" | "image" | "graphic";

type EditorHotspot =
  | {
      id: string;
      type: "image";
      label: string;
      position: HotspotPosition;
      width: number;
      height: number;
      orientation: "billboard" | "surface";
      opacity: number;
      visible: boolean;
      src: string;
    }
  | {
      id: string;
      type: "graphic";
      label: string;
      position: HotspotPosition;
      width: number;
      height: number;
      orientation: "billboard" | "surface";
      opacity: number;
      visible: boolean;
      graphic: GraphicDefinition;
    };

const INITIAL_VIEW: PanoViewState = { yaw: 0, pitch: 0, fov: 75 };
const INITIAL_PROGRESS: TileLoadProgress = {
  requested: 0,
  loaded: 0,
  failed: 0,
  active: 0,
  queued: 0,
};

const DEMO_HOTSPOTS: EditorHotspot[] = [
  {
    id: "gallery-card",
    type: "image",
    label: "Open gallery card",
    position: { yaw: 24, pitch: -5 },
    width: 18,
    height: 10,
    orientation: "surface",
    opacity: 1,
    visible: true,
    src: "/fixtures/hotspots/gallery-card.svg",
  },
  {
    id: "signal-marker",
    type: "graphic",
    label: "Explore signal point",
    position: { yaw: -18, pitch: 9 },
    width: 8,
    height: 8,
    orientation: "billboard",
    opacity: 1,
    visible: true,
    graphic: {
      kind: "ring",
      fill: "#df6b42",
      stroke: "#f5fbfc",
      strokeWidth: 10,
      innerRadius: 0.66,
    },
  },
];

function cloneDemoHotspots(): EditorHotspot[] {
  return DEMO_HOTSPOTS.map((hotspot) => ({
    ...hotspot,
    position: { ...hotspot.position },
    ...(hotspot.type === "graphic" ? { graphic: { ...hotspot.graphic } } : {}),
  }));
}

function createId(type: EditorHotspot["type"]): string {
  return `${type}-${crypto.randomUUID().slice(0, 8)}`;
}

function createGraphic(
  kind: "circle" | "rectangle" | "ring" | "svg",
): GraphicDefinition {
  switch (kind) {
    case "rectangle":
      return {
        kind,
        fill: "#df6b42",
        stroke: "#f5fbfc",
        strokeWidth: 8,
        cornerRadius: 48,
      };
    case "ring":
      return {
        kind,
        fill: "#df6b42",
        stroke: "#f5fbfc",
        strokeWidth: 8,
        innerRadius: 0.62,
      };
    case "svg":
      return { kind, src: "/fixtures/hotspots/signal.svg" };
    case "circle":
      return { kind, fill: "#df6b42", stroke: "#f5fbfc", strokeWidth: 8 };
  }
}

function formatPosition(position: HotspotPosition): string {
  return `${position.yaw.toFixed(1)}° / ${position.pitch.toFixed(1)}°`;
}

function numberValue(value: string, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ToolButton({
  active,
  label,
  detail,
  onClick,
}: {
  active: boolean;
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "tool-button active" : "tool-button"}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <small>{detail}</small>
    </button>
  );
}

function App() {
  const viewerRef = useRef<PanoViewHandle>(null);
  const [mode, setMode] = useState<ViewerMode>("sphere");
  const [tool, setTool] = useState<EditorTool>("navigate");
  const [view, setView] = useState(INITIAL_VIEW);
  const [level, setLevel] = useState(1);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const [autoRotate, setAutoRotate] = useState(false);
  const [tileErrors, setTileErrors] = useState(0);
  const [hotspots, setHotspots] = useState<EditorHotspot[]>(cloneDemoHotspots);
  const [selectedId, setSelectedId] = useState<string | null>(
    DEMO_HOTSPOTS[0]!.id,
  );
  const [lastAction, setLastAction] = useState("Select a tool to begin.");
  const selected = useMemo(
    () => hotspots.find((hotspot) => hotspot.id === selectedId) ?? null,
    [hotspots, selectedId],
  );
  const controls = { inertia: true, keyboard: true };
  const placementTool = tool === "image" || tool === "graphic";

  const selectMode = (nextMode: ViewerMode) => {
    setMode(nextMode);
    setLevel(1);
    setProgress(INITIAL_PROGRESS);
    setTileErrors(0);
  };

  const updateHotspot = (
    id: string,
    patch: Partial<Omit<EditorHotspot, "id" | "type" | "graphic">>,
  ) => {
    setHotspots((current) =>
      current.map((hotspot) =>
        hotspot.id === id ? ({ ...hotspot, ...patch } as EditorHotspot) : hotspot,
      ),
    );
  };

  const updateGraphic = (id: string, graphic: GraphicDefinition) => {
    setHotspots((current) =>
      current.map((hotspot) =>
        hotspot.id === id && hotspot.type === "graphic"
          ? { ...hotspot, graphic }
          : hotspot,
      ),
    );
  };

  const updateImageSource = (id: string, src: string) => {
    setHotspots((current) =>
      current.map((hotspot) =>
        hotspot.id === id && hotspot.type === "image"
          ? { ...hotspot, src }
          : hotspot,
      ),
    );
  };

  const addHotspot = (position: HotspotPosition) => {
    if (tool === "image") {
      const hotspot: EditorHotspot = {
        id: createId("image"),
        type: "image",
        label: "Open image hotspot",
        position,
        width: 16,
        height: 9,
        orientation: "billboard",
        opacity: 1,
        visible: true,
        src: "/fixtures/hotspots/gallery-card.svg",
      };
      setHotspots((current) => [...current, hotspot]);
      setSelectedId(hotspot.id);
      setTool("select");
      setLastAction(`Image placed at ${formatPosition(position)}.`);
      return;
    }
    if (tool === "graphic") {
      const hotspot: EditorHotspot = {
        id: createId("graphic"),
        type: "graphic",
        label: "Explore graphic hotspot",
        position,
        width: 9,
        height: 9,
        orientation: "billboard",
        opacity: 1,
        visible: true,
        graphic: createGraphic("circle"),
      };
      setHotspots((current) => [...current, hotspot]);
      setSelectedId(hotspot.id);
      setTool("select");
      setLastAction(`Graphic placed at ${formatPosition(position)}.`);
    }
  };

  const deleteSelected = () => {
    if (!selected) {
      return;
    }
    setHotspots((current) => current.filter((hotspot) => hotspot.id !== selected.id));
    setSelectedId(null);
    setLastAction(`${selected.type === "image" ? "Image" : "Graphic"} removed.`);
  };

  const resetDemo = () => {
    const next = cloneDemoHotspots();
    setHotspots(next);
    setSelectedId(next[0]!.id);
    setTool("navigate");
    setLastAction("Demo hotspots restored.");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#workspace" aria-label="Pano View home">
          PANO<span>/</span>VIEW
        </a>
        <p>HOTSPOT AUTHORING · STAGE 02</p>
      </header>

      <section className="authoring-intro" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Panorama hotspot bench</p>
          <h1 id="page-title">Place it<br />where it lives.</h1>
        </div>
        <p className="lede">
          Choose an image or graphic tool, click the panorama, then tune the
          selected hotspot without leaving the view.
        </p>
      </section>

      <section
        className="authoring-workspace"
        id="workspace"
        aria-label="Hotspot authoring workspace"
      >
        <aside className="tool-rail" aria-label="Hotspot tools">
          <p className="panel-label">MODE</p>
          <ToolButton
            active={tool === "navigate"}
            detail="Orbit"
            label="Navigate"
            onClick={() => {
              setTool("navigate");
              setLastAction("Navigation restored.");
            }}
          />
          <ToolButton
            active={tool === "select"}
            detail="Drag"
            label="Select"
            onClick={() => {
              setTool("select");
              setLastAction("Select a hotspot, then drag it in the panorama.");
            }}
          />
          <p className="panel-label">ADD</p>
          <ToolButton
            active={tool === "image"}
            detail="Bitmap"
            label="Image"
            onClick={() => {
              setTool("image");
              setLastAction("Click the panorama to place an image hotspot.");
            }}
          />
          <ToolButton
            active={tool === "graphic"}
            detail="Vector"
            label="Graphic"
            onClick={() => {
              setTool("graphic");
              setLastAction("Click the panorama to place a graphic hotspot.");
            }}
          />
          <div className="tool-rail-footer">
            <span>{hotspots.length}</span>
            <small>HOTSPOTS</small>
          </div>
        </aside>

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
              <button
                onClick={() => setAutoRotate((current) => !current)}
                type="button"
              >
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
          </div>

          <div className={placementTool ? "viewer-frame placing" : "viewer-frame"}>
            <PanoView
              key={mode}
              ref={viewerRef}
              aria-label={`${mode} panorama hotspot editor`}
              className="pano-view"
              controls={placementTool ? false : controls}
              initialView={INITIAL_VIEW}
              onPanoramaClick={({ position }) => addHotspot(position)}
              onViewChange={setView}
            >
              <AutoRotate
                enabled={autoRotate && !placementTool}
                speed={18}
                acceleration={18}
                startDelay={1_000}
              />
              {mode === "sphere" ? (
                <Sphere src="/fixtures/panorama/panos/1.jpg" />
              ) : (
                <Tile
                  baseUrl="/fixtures/panorama"
                  multires="512,500,1000,2000"
                  onLevelChange={setLevel}
                  onLoadProgress={setProgress}
                  onTileError={() => setTileErrors((count) => count + 1)}
                />
              )}
              {hotspots.map((hotspot) => {
                const sharedProps = {
                  ariaLabel: hotspot.label,
                  draggable: tool === "select" && selectedId === hotspot.id,
                  id: hotspot.id,
                  opacity: hotspot.opacity,
                  orientation: hotspot.orientation,
                  position: hotspot.position,
                  visible: hotspot.visible,
                  width: hotspot.width,
                  height: hotspot.height,
                  onClick: () => {
                    setSelectedId(hotspot.id);
                    setTool("select");
                    setLastAction(`${hotspot.label} selected.`);
                  },
                  onPositionChange: ({ position }: { position: HotspotPosition }) => {
                    updateHotspot(hotspot.id, { position });
                  },
                };

                return hotspot.type === "image" ? (
                  <ImageHotspot key={hotspot.id} {...sharedProps} src={hotspot.src} />
                ) : (
                  <GraphicHotspot
                    key={hotspot.id}
                    {...sharedProps}
                    graphic={hotspot.graphic}
                  />
                );
              })}
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

        <aside className="inspector" aria-label="Hotspot inspector">
          <div className="inspector-heading">
            <div>
              <p className="panel-label">INSPECTOR</p>
              <h2>{selected ? selected.label : "No hotspot selected"}</h2>
            </div>
            {selected ? <span className={`type-chip ${selected.type}`}>{selected.type}</span> : null}
          </div>

          {selected ? (
            <div className="inspector-content">
              <label className="field wide">
                <span>Accessible label</span>
                <input
                  onChange={(event) => updateHotspot(selected.id, { label: event.currentTarget.value })}
                  value={selected.label}
                />
              </label>

              <div className="field-grid">
                <label className="field">
                  <span>Yaw</span>
                  <input
                    onChange={(event) => updateHotspot(selected.id, {
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
                    onChange={(event) => updateHotspot(selected.id, {
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
                    onChange={(event) => updateHotspot(selected.id, { width: numberValue(event.currentTarget.value, selected.width) })}
                    step="0.1"
                    type="number"
                    value={selected.width}
                  />
                </label>
                <label className="field">
                  <span>Height</span>
                  <input
                    min="0.1"
                    onChange={(event) => updateHotspot(selected.id, { height: numberValue(event.currentTarget.value, selected.height) })}
                    step="0.1"
                    type="number"
                    value={selected.height}
                  />
                </label>
              </div>

              <label className="field wide">
                <span>Orientation</span>
                <select
                  onChange={(event) => updateHotspot(selected.id, {
                    orientation: event.currentTarget.value as EditorHotspot["orientation"],
                  })}
                  value={selected.orientation}
                >
                  <option value="billboard">Billboard</option>
                  <option value="surface">Surface</option>
                </select>
              </label>

              <label className="field wide range-field">
                <span>Opacity <b>{Math.round(selected.opacity * 100)}%</b></span>
                <input
                  max="1"
                  min="0"
                  onChange={(event) => updateHotspot(selected.id, { opacity: numberValue(event.currentTarget.value, selected.opacity) })}
                  step="0.05"
                  type="range"
                  value={selected.opacity}
                />
              </label>

              <label className="check-field">
                <input
                  checked={selected.visible}
                  onChange={(event) => updateHotspot(selected.id, { visible: event.currentTarget.checked })}
                  type="checkbox"
                />
                <span>Visible in panorama</span>
              </label>

              {selected.type === "image" ? (
                <label className="field wide">
                  <span>Image URL</span>
                  <input
                    onChange={(event) => updateImageSource(selected.id, event.currentTarget.value)}
                    value={selected.src}
                  />
                </label>
              ) : (
                <GraphicFields
                  hotspot={selected}
                  onChange={(graphic) => updateGraphic(selected.id, graphic)}
                />
              )}

              <button className="delete-button" onClick={deleteSelected} type="button">
                Delete selected hotspot
              </button>
            </div>
          ) : (
            <p className="empty-inspector">Choose Image or Graphic, then click the panorama to place it.</p>
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
                onClick={() => {
                  setSelectedId(hotspot.id);
                  setTool("select");
                  setLastAction(`${hotspot.label} selected.`);
                }}
                type="button"
              >
                <span>{hotspot.type === "image" ? "IMG" : "GFX"}</span>
                <b>{hotspot.label}</b>
                <small>{formatPosition(hotspot.position)}</small>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <footer>
        <span>@pano-view/react · image + graphic hotspots</span>
        <span>Stage 2 of 6</span>
      </footer>
    </main>
  );
}

function GraphicFields({
  hotspot,
  onChange,
}: {
  hotspot: Extract<EditorHotspot, { type: "graphic" }>;
  onChange: (graphic: GraphicDefinition) => void;
}) {
  const graphic = hotspot.graphic;
  const selectableKind = graphic.kind === "path" ? "circle" : graphic.kind;

  return (
    <div className="graphic-fields">
      <label className="field wide">
        <span>Graphic type</span>
        <select
          onChange={(event) => onChange(createGraphic(event.currentTarget.value as "circle" | "rectangle" | "ring" | "svg"))}
          value={selectableKind}
        >
          <option value="circle">Circle</option>
          <option value="rectangle">Rounded rectangle</option>
          <option value="ring">Ring</option>
          <option value="svg">SVG asset</option>
        </select>
      </label>

      {graphic.kind === "svg" ? (
        <label className="field wide">
          <span>SVG URL</span>
          <input onChange={(event) => onChange({ ...graphic, src: event.currentTarget.value })} value={graphic.src} />
        </label>
      ) : (
        <div className="field-grid">
          <label className="field">
            <span>Fill</span>
            <input onChange={(event) => onChange({ ...graphic, fill: event.currentTarget.value })} type="color" value={graphic.fill ?? "#df6b42"} />
          </label>
          <label className="field">
            <span>Stroke</span>
            <input onChange={(event) => onChange({ ...graphic, stroke: event.currentTarget.value })} type="color" value={graphic.stroke ?? "#f5fbfc"} />
          </label>
          <label className="field">
            <span>Stroke width</span>
            <input
              min="0"
              onChange={(event) => onChange({ ...graphic, strokeWidth: numberValue(event.currentTarget.value, graphic.strokeWidth ?? 8) })}
              type="number"
              value={graphic.strokeWidth ?? 8}
            />
          </label>
          {graphic.kind === "rectangle" ? (
            <label className="field">
              <span>Corner radius</span>
              <input
                min="0"
                onChange={(event) => onChange({ ...graphic, cornerRadius: numberValue(event.currentTarget.value, graphic.cornerRadius ?? 0) })}
                type="number"
                value={graphic.cornerRadius ?? 0}
              />
            </label>
          ) : null}
          {graphic.kind === "ring" ? (
            <label className="field">
              <span>Inner radius</span>
              <input
                max="0.95"
                min="0.05"
                onChange={(event) => onChange({ ...graphic, innerRadius: numberValue(event.currentTarget.value, graphic.innerRadius ?? 0.58) })}
                step="0.01"
                type="number"
                value={graphic.innerRadius ?? 0.58}
              />
            </label>
          ) : null}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
