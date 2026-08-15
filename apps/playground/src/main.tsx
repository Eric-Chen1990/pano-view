import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AutoRotate,
  GraphicHotspot,
  ImageHotspot,
  PanoView,
  PolygonHotspot,
  PolylineHotspot,
  SequenceHotspot,
  Sphere,
  Tile,
  VideoHotspot,
  type GraphicDefinition,
  type HotspotPosition,
  type PanoViewHandle,
  type PanoViewState,
  type PolygonValidationIssue,
  type TileLoadProgress,
  validatePolygonVertices,
} from "@pano-view/react";
import "./styles.css";

type ViewerMode = "sphere" | "tile";
type EditorTool =
  | "navigate"
  | "select"
  | "image"
  | "graphic"
  | "sequence"
  | "video"
  | "polygon"
  | "polyline";

type EditorHotspot =
  | {
      id: string;
      type: "image";
      label: string;
      position: HotspotPosition;
      width: number;
      height: number;
      orientation: "billboard" | "surface";
      placement: "surface" | "floating";
      distance: number;
      scaleMode: "fov" | "fixed";
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
      placement: "surface" | "floating";
      distance: number;
      scaleMode: "fov" | "fixed";
      opacity: number;
      visible: boolean;
      graphic: GraphicDefinition;
    }
  | {
      id: string;
      type: "sequence";
      label: string;
      position: HotspotPosition;
      width: number;
      height: number;
      orientation: "billboard" | "surface";
      placement: "surface" | "floating";
      distance: number;
      scaleMode: "fov" | "fixed";
      opacity: number;
      visible: boolean;
      src: string;
      frameCount: number;
      frameDirection: "horizontal" | "vertical";
      playing: boolean;
      fps: number;
      loop: boolean;
    }
  | {
      id: string;
      type: "video";
      label: string;
      position: HotspotPosition;
      width: number;
      height: number;
      orientation: "billboard" | "surface";
      placement: "surface" | "floating";
      distance: number;
      scaleMode: "fov" | "fixed";
      opacity: number;
      visible: boolean;
      src: string;
      poster: string;
      playing: boolean;
      loop: boolean;
      muted: boolean;
      volume: number;
    };

type EditorPolygon = {
  id: string;
  label: string;
  vertices: HotspotPosition[];
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  visible: boolean;
};

type EditorPolyline = {
  id: string;
  label: string;
  vertices: HotspotPosition[];
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  visible: boolean;
};

const INITIAL_VIEW: PanoViewState = { yaw: 0, pitch: 0, fov: 75 };
const INITIAL_PROGRESS: TileLoadProgress = {
  requested: 0,
  loaded: 0,
  failed: 0,
  active: 0,
  queued: 0,
};

const SEQUENCE_SPRITE = "/fixtures/hotspots/sequence-sprite.svg";
const DEMO_POLYGON: EditorPolygon = {
  id: "runtime-polygon-example",
  label: "Courtyard canopy",
  vertices: [
  { yaw: -18, pitch: 16 },
  { yaw: -2, pitch: 13 },
  { yaw: 8, pitch: 23 },
  { yaw: -6, pitch: 31 },
  { yaw: -13, pitch: 24 },
  ],
  fill: "#df6b42",
  fillOpacity: 0.28,
  stroke: "#f5fbfc",
  strokeWidth: 2,
  strokeOpacity: 0.88,
  visible: true,
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
    placement: "surface",
    distance: 10,
    scaleMode: "fov",
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
    placement: "floating",
    distance: 10,
    scaleMode: "fixed",
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
  {
    id: "sequence-marker",
    type: "sequence",
    label: "Play sequence marker",
    position: { yaw: -44, pitch: -7 },
    width: 13,
    height: 7.3,
    orientation: "billboard",
    placement: "floating",
    distance: 10,
    scaleMode: "fixed",
    opacity: 1,
    visible: true,
    src: SEQUENCE_SPRITE,
    frameCount: 4,
    frameDirection: "vertical",
    playing: true,
    fps: 3,
    loop: true,
  },
  {
    id: "video-window",
    type: "video",
    label: "Play video window",
    position: { yaw: 52, pitch: 6 },
    width: 18,
    height: 10.1,
    orientation: "surface",
    placement: "surface",
    distance: 10,
    scaleMode: "fov",
    opacity: 1,
    visible: true,
    src: "/fixtures/hotspots/loop.webm",
    poster: "/fixtures/hotspots/gallery-card.svg",
    playing: false,
    loop: true,
    muted: true,
    volume: 1,
  },
];

function cloneDemoHotspots(): EditorHotspot[] {
  return DEMO_HOTSPOTS.map((hotspot) => ({
    ...hotspot,
    position: { ...hotspot.position },
    ...(hotspot.type === "graphic" ? { graphic: { ...hotspot.graphic } } : {}),
  }));
}

function cloneDemoPolygons(): EditorPolygon[] {
  return [{
    ...DEMO_POLYGON,
    vertices: DEMO_POLYGON.vertices.map((vertex) => ({ ...vertex })),
  }];
}

function cloneDemoPolylines(): EditorPolyline[] {
  return [];
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

function withoutTrailingDuplicate(vertices: HotspotPosition[]): HotspotPosition[] {
  if (vertices.length < 2) return vertices;
  const previous = vertices[vertices.length - 2]!;
  const last = vertices[vertices.length - 1]!;
  const yawDifference = Math.abs(((last.yaw - previous.yaw + 540) % 360) - 180);
  return yawDifference < 0.001 && Math.abs(last.pitch - previous.pitch) < 0.001
    ? vertices.slice(0, -1)
    : vertices;
}

function polygonIssueSummary(issues: PolygonValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(" ");
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
  const [polygons, setPolygons] = useState<EditorPolygon[]>(cloneDemoPolygons);
  const [polylines, setPolylines] = useState<EditorPolyline[]>(cloneDemoPolylines);
  const [draftVertices, setDraftVertices] = useState<HotspotPosition[]>([]);
  const [draftPolygonFilled, setDraftPolygonFilled] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(
    DEMO_HOTSPOTS[0]!.id,
  );
  const [lastAction, setLastAction] = useState("Select a tool to begin.");
  const selected = useMemo(
    () => hotspots.find((hotspot) => hotspot.id === selectedId) ?? null,
    [hotspots, selectedId],
  );
  const selectedPolygon = useMemo(
    () => polygons.find((polygon) => polygon.id === selectedId) ?? null,
    [polygons, selectedId],
  );
  const selectedPolyline = useMemo(
    () => polylines.find((polyline) => polyline.id === selectedId) ?? null,
    [polylines, selectedId],
  );
  const draftIssues = useMemo(
    () => draftVertices.length > 0 ? validatePolygonVertices(draftVertices) : [],
    [draftVertices],
  );
  const controls = { inertia: true, keyboard: true };
  const placementTool =
    tool === "image" ||
    tool === "graphic" ||
    tool === "sequence" ||
    tool === "video";
  const drawingPolygon = tool === "polygon";
  const drawingPolyline = tool === "polyline";
  const drawingPath = drawingPolygon || drawingPolyline;

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

  const updateSequence = (
    id: string,
    patch: Partial<Omit<Extract<EditorHotspot, { type: "sequence" }>, "id" | "type">>,
  ) => {
    setHotspots((current) =>
      current.map((hotspot) =>
        hotspot.id === id && hotspot.type === "sequence"
          ? { ...hotspot, ...patch }
          : hotspot,
      ),
    );
  };

  const updateVideo = (
    id: string,
    patch: Partial<Omit<Extract<EditorHotspot, { type: "video" }>, "id" | "type">>,
  ) => {
    setHotspots((current) =>
      current.map((hotspot) =>
        hotspot.id === id && hotspot.type === "video" ? { ...hotspot, ...patch } : hotspot,
      ),
    );
  };

  const updatePolygon = (id: string, patch: Partial<Omit<EditorPolygon, "id">>) => {
    setPolygons((current) =>
      current.map((polygon) =>
        polygon.id === id ? { ...polygon, ...patch } : polygon,
      ),
    );
  };

  const updatePolygonVertex = (
    id: string,
    vertexIndex: number,
    position: HotspotPosition,
  ) => {
    setPolygons((current) =>
      current.map((polygon) =>
        polygon.id === id
          ? {
              ...polygon,
              vertices: polygon.vertices.map((vertex, index) =>
                index === vertexIndex ? position : vertex,
              ),
            }
          : polygon,
      ),
    );
  };

  const updatePolyline = (id: string, patch: Partial<Omit<EditorPolyline, "id">>) => {
    setPolylines((current) =>
      current.map((polyline) =>
        polyline.id === id ? { ...polyline, ...patch } : polyline,
      ),
    );
  };

  const cancelPolygonDraft = () => {
    setDraftVertices([]);
    setTool("navigate");
    setLastAction("Polygon draft cancelled.");
  };

  const finishPolygonDraft = () => {
    if (drawingPolyline) {
      if (draftVertices.length < 2) {
        setLastAction("A polyline needs at least two vertices.");
        return;
      }
      const polyline: EditorPolyline = {
        id: `polyline-${crypto.randomUUID().slice(0, 8)}`,
        label: "Drawn polyline",
        vertices: withoutTrailingDuplicate(draftVertices),
        stroke: "#f5fbfc",
        strokeWidth: 2,
        strokeOpacity: 0.88,
        visible: true,
      };
      setPolylines((current) => [...current, polyline]);
      setDraftVertices([]);
      setSelectedId(polyline.id);
      setTool("select");
      setLastAction(`Polyline created with ${polyline.vertices.length} vertices.`);
      return;
    }
    const vertices = withoutTrailingDuplicate(draftVertices);
    const issues = validatePolygonVertices(vertices);
    if (issues.length > 0) {
      setDraftVertices(vertices);
      setLastAction(`Polygon cannot be completed: ${polygonIssueSummary(issues)}`);
      return;
    }
    const polygon: EditorPolygon = {
      id: `polygon-${crypto.randomUUID().slice(0, 8)}`,
      label: "Drawn polygon",
      vertices,
      fill: "#df6b42",
      fillOpacity: draftPolygonFilled ? 0.28 : 0,
      stroke: "#f5fbfc",
      strokeWidth: 2,
      strokeOpacity: 0.88,
      visible: true,
    };
    setPolygons((current) => [...current, polygon]);
    setDraftVertices([]);
    setSelectedId(polygon.id);
    setTool("select");
    setLastAction(`Polygon created with ${vertices.length} vertices.`);
  };

  const addHotspot = (position: HotspotPosition) => {
    if (drawingPath) {
      setDraftVertices((current) => [...current, position]);
      setLastAction(`${drawingPolyline ? "Polyline" : "Polygon"} vertex ${draftVertices.length + 1} added at ${formatPosition(position)}.`);
      return;
    }
    if (tool === "image") {
      const hotspot: EditorHotspot = {
        id: createId("image"),
        type: "image",
        label: "Open image hotspot",
        position,
        width: 16,
        height: 9,
        orientation: "billboard",
        placement: "floating",
        distance: 10,
        scaleMode: "fov",
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
        placement: "floating",
        distance: 10,
        scaleMode: "fixed",
        opacity: 1,
        visible: true,
        graphic: createGraphic("circle"),
      };
      setHotspots((current) => [...current, hotspot]);
      setSelectedId(hotspot.id);
      setTool("select");
      setLastAction(`Graphic placed at ${formatPosition(position)}.`);
      return;
    }
    if (tool === "sequence") {
      const hotspot: EditorHotspot = {
        id: createId("sequence"),
        type: "sequence",
        label: "Play sequence marker",
        position,
        width: 13,
        height: 7.3,
        orientation: "billboard",
        placement: "floating",
        distance: 10,
        scaleMode: "fixed",
        opacity: 1,
        visible: true,
        src: SEQUENCE_SPRITE,
        frameCount: 4,
        frameDirection: "vertical",
        playing: true,
        fps: 12,
        loop: true,
      };
      setHotspots((current) => [...current, hotspot]);
      setSelectedId(hotspot.id);
      setTool("select");
      setLastAction(`Sequence placed at ${formatPosition(position)}.`);
      return;
    }
    if (tool === "video") {
      const hotspot: EditorHotspot = {
        id: createId("video"),
        type: "video",
        label: "Play video window",
        position,
        width: 18,
        height: 10.1,
        orientation: "surface",
        placement: "surface",
        distance: 10,
        scaleMode: "fov",
        opacity: 1,
        visible: true,
        src: "/fixtures/hotspots/loop.webm",
        poster: "/fixtures/hotspots/gallery-card.svg",
        playing: false,
        loop: true,
        muted: true,
        volume: 1,
      };
      setHotspots((current) => [...current, hotspot]);
      setSelectedId(hotspot.id);
      setTool("select");
      setLastAction(`Video placed at ${formatPosition(position)}.`);
    }
  };

  const deleteSelected = () => {
    if (selected) {
      setHotspots((current) => current.filter((hotspot) => hotspot.id !== selected.id));
      setSelectedId(null);
      setLastAction(`${selected.type[0]!.toUpperCase()}${selected.type.slice(1)} removed.`);
      return;
    }
    if (selectedPolygon) {
      setPolygons((current) => current.filter((polygon) => polygon.id !== selectedPolygon.id));
      setSelectedId(null);
      setLastAction("Polygon removed.");
      return;
    }
    if (selectedPolyline) {
      setPolylines((current) => current.filter((polyline) => polyline.id !== selectedPolyline.id));
      setSelectedId(null);
      setLastAction("Polyline removed.");
    }
  };

  const resetDemo = () => {
    const next = cloneDemoHotspots();
    setHotspots(next);
    setPolygons(cloneDemoPolygons());
    setPolylines(cloneDemoPolylines());
    setDraftVertices([]);
    setSelectedId(next[0]!.id);
    setTool("navigate");
    setLastAction("Demo hotspots restored.");
  };

  useEffect(() => {
    if (!drawingPath) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDraftVertices([]);
        setTool("navigate");
        setLastAction(`${drawingPolyline ? "Polyline" : "Polygon"} draft cancelled.`);
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        setDraftVertices((current) => current.slice(0, -1));
        setLastAction(`Last ${drawingPolyline ? "polyline" : "polygon"} vertex removed.`);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawingPath]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="#workspace" aria-label="Pano View home">
          PANO<span>/</span>VIEW
        </a>
        <p>HOTSPOT AUTHORING · STAGE 06</p>
      </header>

      <section className="authoring-intro" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Panorama hotspot bench</p>
          <h1 id="page-title">Place it<br />where it lives.</h1>
        </div>
        <p className="lede">
          Place media, draw local regions or open paths, then adjust every hotspot
          directly in its panoramic context.
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
          <ToolButton
            active={tool === "sequence"}
            detail="Sprite sheet"
            label="Sequence"
            onClick={() => {
              setTool("sequence");
              setLastAction("Click the panorama to place a sprite-sheet sequence.");
            }}
          />
          <ToolButton
            active={tool === "video"}
            detail="WebM"
            label="Video"
            onClick={() => {
              setTool("video");
              setLastAction("Click the panorama to place a video hotspot.");
            }}
          />
          <ToolButton
            active={drawingPolygon}
            detail="Draw + edit"
            label="Polygon"
            onClick={() => {
              setSelectedId(null);
              setTool("polygon");
              setLastAction(
                draftVertices.length
                  ? `Continue polygon: ${draftVertices.length} vertices.`
                  : "Click the panorama to add polygon vertices.",
              );
            }}
          />
          <ToolButton
            active={drawingPolyline}
            detail="Draw + edit"
            label="Polyline"
            onClick={() => {
              setSelectedId(null);
              setTool("polyline");
              setLastAction(
                draftVertices.length
                  ? `Continue polyline: ${draftVertices.length} vertices.`
                  : "Click the panorama to add polyline vertices.",
              );
            }}
          />
          <div className="tool-rail-footer">
            <span>{hotspots.length + polygons.length + polylines.length}</span>
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
            {drawingPath ? (
              <div className="polygon-draft-actions">
                <span>{draftVertices.length} vertices</span>
                {drawingPolygon ? (
                  <button
                    aria-pressed={draftPolygonFilled}
                    onClick={() => setDraftPolygonFilled((current) => !current)}
                    type="button"
                  >
                    {draftPolygonFilled ? "Fill on" : "Outline only"}
                  </button>
                ) : null}
                <button
                  disabled={draftVertices.length < (drawingPolyline ? 2 : 3)}
                  onClick={finishPolygonDraft}
                  type="button"
                >
                  {drawingPolyline ? "Finish polyline" : "Finish polygon"}
                </button>
                <button onClick={cancelPolygonDraft} type="button">Cancel</button>
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
              {mode === "sphere" ? (
                <Sphere src="/fixtures/panorama/panos/1.jpg" />
              ) : (
                <Tile
                  baseUrl="/fixtures/panorama/cube-tiles/4"
                  multires="512,1000,2000"
                  urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.webp"
                  onLevelChange={setLevel}
                  onLoadProgress={setProgress}
                  onTileError={() => setTileErrors((count) => count + 1)}
                />
              )}
              {hotspots.map((hotspot) => {
                const sharedProps = {
                  ariaLabel: hotspot.label,
                  draggable: tool === "select",
                  id: hotspot.id,
                  opacity: hotspot.opacity,
                  orientation: hotspot.orientation,
                  placement: hotspot.placement,
                  distance: hotspot.distance,
                  interactive: !drawingPath,
                  position: hotspot.position,
                  scaleMode: hotspot.scaleMode,
                  visible: hotspot.visible,
                  width: hotspot.width,
                  height: hotspot.height,
                  onClick: () => {
                    setSelectedId(hotspot.id);
                    setTool("select");
                    if (hotspot.type === "sequence") {
                      updateSequence(hotspot.id, { playing: !hotspot.playing });
                    }
                    if (hotspot.type === "video") {
                      updateVideo(hotspot.id, { playing: !hotspot.playing });
                    }
                    setLastAction(`${hotspot.label} selected.`);
                  },
                  onDragStart: () => {
                    setSelectedId(hotspot.id);
                    setLastAction(`Dragging ${hotspot.label}.`);
                  },
                  onPositionChange: ({ position }: { position: HotspotPosition }) => {
                    updateHotspot(hotspot.id, { position });
                  },
                  onDragEnd: ({ position }: { position: HotspotPosition }) => {
                    setLastAction(`${hotspot.label} moved to ${formatPosition(position)}.`);
                  },
                };

                if (hotspot.type === "image") {
                  return <ImageHotspot key={hotspot.id} {...sharedProps} src={hotspot.src} />;
                }
                if (hotspot.type === "graphic") {
                  return (
                  <GraphicHotspot
                    key={hotspot.id}
                    {...sharedProps}
                    graphic={hotspot.graphic}
                  />
                  );
                }
                if (hotspot.type === "sequence") {
                  return (
                    <SequenceHotspot
                      key={hotspot.id}
                      {...sharedProps}
                      frameCount={hotspot.frameCount}
                      frameDirection={hotspot.frameDirection}
                      fps={hotspot.fps}
                      loop={hotspot.loop}
                      playing={hotspot.playing}
                      src={hotspot.src}
                      onEnded={() => updateSequence(hotspot.id, { playing: false })}
                    />
                  );
                }
                return (
                  <VideoHotspot
                    key={hotspot.id}
                    {...sharedProps}
                    loop={hotspot.loop}
                    muted={hotspot.muted}
                    onEnded={() => updateVideo(hotspot.id, { playing: false })}
                    playing={hotspot.playing}
                    poster={hotspot.poster}
                    src={hotspot.src}
                    volume={hotspot.volume}
                  />
                );
              })}
              {polygons.map((polygon) => (
                <PolygonHotspot
                  key={polygon.id}
                  ariaLabel={polygon.label}
                  draggable={tool === "select"}
                  fill={polygon.fill}
                  fillOpacity={polygon.fillOpacity}
                  id={polygon.id}
                  interactive={!drawingPath}
                  onClick={() => {
                    setSelectedId(polygon.id);
                    setTool("select");
                    setLastAction(`${polygon.label} selected.`);
                  }}
                  onDragEnd={({ vertices }) => {
                    const issues = validatePolygonVertices(vertices);
                    if (issues.length === 0) {
                      updatePolygon(polygon.id, { vertices });
                      setLastAction(`${polygon.label} moved.`);
                    } else {
                      setLastAction(`Polygon move rejected: ${polygonIssueSummary(issues)}`);
                    }
                  }}
                  onDragStart={() => {
                    setSelectedId(polygon.id);
                    setLastAction(`Dragging ${polygon.label}.`);
                  }}
                  onVerticesChange={({ vertices }) => {
                    if (validatePolygonVertices(vertices).length === 0) {
                      updatePolygon(polygon.id, { vertices });
                    }
                  }}
                  stroke={polygon.stroke}
                  strokeOpacity={polygon.strokeOpacity}
                  strokeWidth={polygon.strokeWidth}
                  vertices={polygon.vertices}
                  visible={polygon.visible}
                />
              ))}
              {polylines.map((polyline) => (
                <PolylineHotspot
                  key={polyline.id}
                  ariaLabel={polyline.label}
                  draggable={tool === "select"}
                  id={polyline.id}
                  interactive={!drawingPath}
                  onClick={() => {
                    setSelectedId(polyline.id);
                    setTool("select");
                    setLastAction(`${polyline.label} selected.`);
                  }}
                  onDragEnd={({ vertices }) => {
                    updatePolyline(polyline.id, { vertices });
                    setLastAction(`${polyline.label} moved.`);
                  }}
                  onDragStart={() => {
                    setSelectedId(polyline.id);
                    setLastAction(`Dragging ${polyline.label}.`);
                  }}
                  onVerticesChange={({ vertices }) => updatePolyline(polyline.id, { vertices })}
                  stroke={polyline.stroke}
                  strokeOpacity={polyline.strokeOpacity}
                  strokeWidth={polyline.strokeWidth}
                  vertices={polyline.vertices}
                  visible={polyline.visible}
                />
              ))}
              {drawingPath && draftVertices.length >= 2 ? (
                <PolylineHotspot
                  id="path-draft"
                  interactive={false}
                  stroke="#75cbd3"
                  strokeOpacity={1}
                  strokeWidth={2}
                  vertices={draftVertices}
                />
              ) : null}
              {drawingPolygon && draftVertices.length >= 3 && draftIssues.length === 0 ? (
                <PolygonHotspot
                  fill="#df6b42"
                  fillOpacity={draftPolygonFilled ? 0.2 : 0}
                  id="polygon-draft"
                  interactive={false}
                  stroke="#75cbd3"
                  strokeOpacity={1}
                  strokeWidth={2}
                  vertices={draftVertices}
                />
              ) : null}
              {selectedPolygon && tool === "select" ? selectedPolygon.vertices.map((vertex, index) => (
                <GraphicHotspot
                  key={`${selectedPolygon.id}-vertex-${index}`}
                  ariaLabel={`${selectedPolygon.label}, vertex ${index + 1}`}
                  distance={8}
                  draggable
                  graphic={{
                    kind: "circle",
                    fill: "#f5fbfc",
                    stroke: "#df6b42",
                    strokeWidth: 14,
                  }}
                  height={2.2}
                  id={`${selectedPolygon.id}-vertex-${index}`}
                  onDragEnd={({ position }) => {
                    const vertices = selectedPolygon.vertices.map((current, currentIndex) =>
                      currentIndex === index ? position : current,
                    );
                    const issues = validatePolygonVertices(vertices);
                    if (issues.length === 0) {
                      updatePolygon(selectedPolygon.id, { vertices });
                      setLastAction(`Vertex ${index + 1} moved to ${formatPosition(position)}.`);
                    } else {
                      setLastAction(`Vertex move rejected: ${polygonIssueSummary(issues)}`);
                    }
                  }}
                  onDragStart={() => setLastAction(`Dragging vertex ${index + 1}.`)}
                  onPositionChange={({ position }) => {
                    const vertices = selectedPolygon.vertices.map((current, currentIndex) =>
                      currentIndex === index ? position : current,
                    );
                    if (validatePolygonVertices(vertices).length === 0) {
                      updatePolygon(selectedPolygon.id, { vertices });
                    }
                  }}
                  orientation="billboard"
                  placement="floating"
                  position={vertex}
                  scaleMode="fixed"
                  width={2.2}
                />
              )) : null}
              {selectedPolyline && tool === "select" ? selectedPolyline.vertices.map((vertex, index) => (
                <GraphicHotspot
                  key={`${selectedPolyline.id}-vertex-${index}`}
                  ariaLabel={`${selectedPolyline.label}, vertex ${index + 1}`}
                  distance={8}
                  draggable
                  graphic={{
                    kind: "circle",
                    fill: "#f5fbfc",
                    stroke: "#df6b42",
                    strokeWidth: 14,
                  }}
                  height={2.2}
                  id={`${selectedPolyline.id}-vertex-${index}`}
                  onDragEnd={({ position }) => {
                    const vertices = selectedPolyline.vertices.map((current, currentIndex) =>
                      currentIndex === index ? position : current,
                    );
                    updatePolyline(selectedPolyline.id, { vertices });
                    setLastAction(`Vertex ${index + 1} moved to ${formatPosition(position)}.`);
                  }}
                  onDragStart={() => setLastAction(`Dragging vertex ${index + 1}.`)}
                  onPositionChange={({ position }) => {
                    const vertices = selectedPolyline.vertices.map((current, currentIndex) =>
                      currentIndex === index ? position : current,
                    );
                    updatePolyline(selectedPolyline.id, { vertices });
                  }}
                  orientation="billboard"
                  placement="floating"
                  position={vertex}
                  scaleMode="fixed"
                  width={2.2}
                />
              )) : null}
              {drawingPath ? draftVertices.map((vertex, index) => (
                <GraphicHotspot
                  key={`polygon-draft-vertex-${index}`}
                  ariaLabel={`Draft vertex ${index + 1}`}
                  distance={8}
                  graphic={{
                    kind: "circle",
                    fill: "#75cbd3",
                    stroke: "#071316",
                    strokeWidth: 12,
                  }}
                  height={1.8}
                  id={`polygon-draft-vertex-${index}`}
                  interactive={false}
                  orientation="billboard"
                  placement="floating"
                  position={vertex}
                  scaleMode="fixed"
                  width={1.8}
                />
              )) : null}
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

              <div className="field-grid">
                <label className="field">
                  <span>Placement</span>
                  <select
                    onChange={(event) => updateHotspot(selected.id, {
                      placement: event.currentTarget.value as EditorHotspot["placement"],
                    })}
                    value={selected.placement}
                  >
                    <option value="surface">Panorama surface</option>
                    <option value="floating">Floating</option>
                  </select>
                </label>
                <label className="field">
                  <span>Size on zoom</span>
                  <select
                    onChange={(event) => updateHotspot(selected.id, {
                      scaleMode: event.currentTarget.value as EditorHotspot["scaleMode"],
                    })}
                    value={selected.scaleMode}
                  >
                    <option value="fov">Follow FOV</option>
                    <option value="fixed">Keep screen size</option>
                  </select>
                </label>
              </div>

              <label className="field wide range-field">
                <span>
                  Floating distance
                  <b>{selected.placement === "surface" ? "surface" : selected.distance.toFixed(1)}</b>
                </span>
                <input
                  disabled={selected.placement === "surface"}
                  max="49.5"
                  min="0.5"
                  onChange={(event) => updateHotspot(selected.id, {
                    distance: numberValue(event.currentTarget.value, selected.distance),
                  })}
                  step="0.5"
                  type="range"
                  value={selected.distance}
                />
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
              ) : selected.type === "graphic" ? (
                <GraphicFields
                  hotspot={selected}
                  onChange={(graphic) => updateGraphic(selected.id, graphic)}
                />
              ) : selected.type === "sequence" ? (
                <SequenceFields
                  hotspot={selected}
                  onChange={(patch) => updateSequence(selected.id, patch)}
                />
              ) : (
                <VideoFields
                  hotspot={selected}
                  onChange={(patch) => updateVideo(selected.id, patch)}
                />
              )}

              <button className="delete-button" onClick={deleteSelected} type="button">
                Delete selected hotspot
              </button>
            </div>
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
                onClick={() => {
                  setSelectedId(hotspot.id);
                  setTool("select");
                  setLastAction(`${hotspot.label} selected.`);
                }}
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
                onClick={() => {
                  setSelectedId(polygon.id);
                  setTool("select");
                  setLastAction(`${polygon.label} selected. Drag the polygon or a vertex handle.`);
                }}
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
                onClick={() => {
                  setSelectedId(polyline.id);
                  setTool("select");
                  setLastAction(`${polyline.label} selected. Drag the path or a vertex handle.`);
                }}
                type="button"
              >
                <span>LINE</span>
                <b>{polyline.label}</b>
                <small>{polyline.vertices.length} vertices</small>
              </button>
            ))}
          </div>
        </aside>
      </section>

      <footer>
        <span>@pano-view/react · point, polygon + polyline hotspots</span>
        <span>Stage 6 of 6</span>
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

function PolygonDraftFields({
  kind,
  issueSummary,
  vertexCount,
}: {
  kind: "polygon" | "polyline";
  issueSummary: string | null;
  vertexCount: number;
}) {
  const minimumVertices = kind === "polygon" ? 3 : 2;
  const label = kind === "polygon" ? "Polygon" : "Polyline";
  return (
    <div className="inspector-content polygon-draft-fields">
      <p className="polygon-draft-count">{vertexCount} / {minimumVertices} minimum vertices</p>
      {issueSummary ? (
        <p className="polygon-validation invalid">{issueSummary}</p>
      ) : vertexCount >= minimumVertices ? (
        <p className="polygon-validation valid">{label} is ready. Finish it when ready.</p>
      ) : (
        <p className="polygon-validation">Click the panorama to add the next vertex.</p>
      )}
      <p className="polygon-keyboard-help">
        {kind === "polygon"
          ? "The third point closes the preview. Set fill opacity to 0% for an outline-only polygon."
          : "The path stays open: the final vertex never reconnects to the first."}
        {" "}Double-click or use Finish to complete. Esc cancels; Backspace removes the last point.
      </p>
    </div>
  );
}

function PolygonFields({
  polygon,
  onChange,
  onDelete,
}: {
  polygon: EditorPolygon;
  onChange: (patch: Partial<Omit<EditorPolygon, "id">>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="inspector-content">
      <label className="field wide">
        <span>Accessible label</span>
        <input onChange={(event) => onChange({ label: event.currentTarget.value })} value={polygon.label} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Fill</span>
          <input onChange={(event) => onChange({ fill: event.currentTarget.value })} type="color" value={polygon.fill} />
        </label>
        <label className="field">
          <span>Stroke</span>
          <input onChange={(event) => onChange({ stroke: event.currentTarget.value })} type="color" value={polygon.stroke} />
        </label>
        <label className="field">
          <span>Stroke width (px)</span>
          <input
            min="0.5"
            onChange={(event) => onChange({ strokeWidth: numberValue(event.currentTarget.value, polygon.strokeWidth) })}
            step="0.5"
            type="number"
            value={polygon.strokeWidth}
          />
        </label>
        <label className="field">
          <span>Vertices</span>
          <output className="field-output">{polygon.vertices.length}</output>
        </label>
      </div>
      <label className="field wide range-field">
        <span>Fill opacity <b>{Math.round(polygon.fillOpacity * 100)}%</b></span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ fillOpacity: numberValue(event.currentTarget.value, polygon.fillOpacity) })}
          step="0.05"
          type="range"
          value={polygon.fillOpacity}
        />
      </label>
      <label className="field wide range-field">
        <span>Stroke opacity <b>{Math.round(polygon.strokeOpacity * 100)}%</b></span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ strokeOpacity: numberValue(event.currentTarget.value, polygon.strokeOpacity) })}
          step="0.05"
          type="range"
          value={polygon.strokeOpacity}
        />
      </label>
      <label className="check-field">
        <input
          checked={polygon.fillOpacity > 0}
          onChange={(event) => onChange({ fillOpacity: event.currentTarget.checked ? 0.28 : 0 })}
          type="checkbox"
        />
        <span>Fill closed polygon</span>
      </label>
      <label className="check-field">
        <input
          checked={polygon.visible}
          onChange={(event) => onChange({ visible: event.currentTarget.checked })}
          type="checkbox"
        />
        <span>Visible in panorama</span>
      </label>
      <div className="polygon-vertices" aria-label="Polygon vertices">
        {polygon.vertices.map((vertex, index) => (
          <span key={`${polygon.id}-position-${index}`}>V{index + 1} · {formatPosition(vertex)}</span>
        ))}
      </div>
      <button className="delete-button" onClick={onDelete} type="button">
        Delete polygon
      </button>
    </div>
  );
}

function PolylineFields({
  polyline,
  onChange,
  onDelete,
}: {
  polyline: EditorPolyline;
  onChange: (patch: Partial<Omit<EditorPolyline, "id">>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="inspector-content">
      <label className="field wide">
        <span>Accessible label</span>
        <input onChange={(event) => onChange({ label: event.currentTarget.value })} value={polyline.label} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Stroke</span>
          <input onChange={(event) => onChange({ stroke: event.currentTarget.value })} type="color" value={polyline.stroke} />
        </label>
        <label className="field">
          <span>Stroke width (px)</span>
          <input
            min="0.5"
            onChange={(event) => onChange({ strokeWidth: numberValue(event.currentTarget.value, polyline.strokeWidth) })}
            step="0.5"
            type="number"
            value={polyline.strokeWidth}
          />
        </label>
      </div>
      <label className="field wide range-field">
        <span>Stroke opacity <b>{Math.round(polyline.strokeOpacity * 100)}%</b></span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ strokeOpacity: numberValue(event.currentTarget.value, polyline.strokeOpacity) })}
          step="0.05"
          type="range"
          value={polyline.strokeOpacity}
        />
      </label>
      <label className="check-field">
        <input
          checked={polyline.visible}
          onChange={(event) => onChange({ visible: event.currentTarget.checked })}
          type="checkbox"
        />
        <span>Visible in panorama</span>
      </label>
      <div className="polygon-vertices" aria-label="Polyline vertices">
        {polyline.vertices.map((vertex, index) => (
          <span key={`${polyline.id}-position-${index}`}>V{index + 1} · {formatPosition(vertex)}</span>
        ))}
      </div>
      <button className="delete-button" onClick={onDelete} type="button">
        Delete polyline
      </button>
    </div>
  );
}

function SequenceFields({
  hotspot,
  onChange,
}: {
  hotspot: Extract<EditorHotspot, { type: "sequence" }>;
  onChange: (
    patch: Partial<Omit<Extract<EditorHotspot, { type: "sequence" }>, "id" | "type">>,
  ) => void;
}) {
  return (
    <div className="graphic-fields">
      <button
        className="media-action"
        onClick={() => onChange({ playing: !hotspot.playing })}
        type="button"
      >
        {hotspot.playing ? "Pause sequence" : "Play sequence"}
      </button>
      <label className="field wide">
        <span>Sprite sheet URL</span>
        <input onChange={(event) => onChange({ src: event.currentTarget.value })} value={hotspot.src} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Frame count</span>
          <input
            min="1"
            onChange={(event) => onChange({ frameCount: numberValue(event.currentTarget.value, hotspot.frameCount) })}
            step="1"
            type="number"
            value={hotspot.frameCount}
          />
        </label>
        <label className="field">
          <span>Frames per second</span>
          <input
            min="0.1"
            onChange={(event) => onChange({ fps: numberValue(event.currentTarget.value, hotspot.fps) })}
            step="0.1"
            type="number"
            value={hotspot.fps}
          />
        </label>
      </div>
      <label className="field wide">
        <span>Frame direction</span>
        <select
          onChange={(event) => onChange({ frameDirection: event.currentTarget.value as "horizontal" | "vertical" })}
          value={hotspot.frameDirection}
        >
          <option value="vertical">Top to bottom</option>
          <option value="horizontal">Left to right</option>
        </select>
      </label>
      <label className="check-field">
        <input checked={hotspot.loop} onChange={(event) => onChange({ loop: event.currentTarget.checked })} type="checkbox" />
        <span>Loop sequence</span>
      </label>
    </div>
  );
}

function VideoFields({
  hotspot,
  onChange,
}: {
  hotspot: Extract<EditorHotspot, { type: "video" }>;
  onChange: (
    patch: Partial<Omit<Extract<EditorHotspot, { type: "video" }>, "id" | "type">>,
  ) => void;
}) {
  return (
    <div className="graphic-fields">
      <button
        className="media-action"
        onClick={() => onChange({ playing: !hotspot.playing })}
        type="button"
      >
        {hotspot.playing ? "Pause video" : "Play video"}
      </button>
      <label className="field wide">
        <span>Video URL</span>
        <input onChange={(event) => onChange({ src: event.currentTarget.value })} value={hotspot.src} />
      </label>
      <label className="field wide">
        <span>Poster URL</span>
        <input onChange={(event) => onChange({ poster: event.currentTarget.value })} value={hotspot.poster} />
      </label>
      <label className="field wide range-field">
        <span>Volume <b>{Math.round(hotspot.volume * 100)}%</b></span>
        <input
          max="1"
          min="0"
          onChange={(event) => onChange({ volume: numberValue(event.currentTarget.value, hotspot.volume) })}
          step="0.05"
          type="range"
          value={hotspot.volume}
        />
      </label>
      <div className="media-checks">
        <label className="check-field">
          <input checked={hotspot.loop} onChange={(event) => onChange({ loop: event.currentTarget.checked })} type="checkbox" />
          <span>Loop video</span>
        </label>
        <label className="check-field">
          <input checked={hotspot.muted} onChange={(event) => onChange({ muted: event.currentTarget.checked })} type="checkbox" />
          <span>Muted</span>
        </label>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
