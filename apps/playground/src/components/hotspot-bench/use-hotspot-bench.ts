import type { GraphicDefinition, HotspotPosition, PanoViewHandle } from "@pano-view/react";
import { validatePolygonVertices } from "@pano-view/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_HOTSPOTS, INITIAL_PROGRESS, INITIAL_VIEW, SEQUENCE_SPRITE } from "../../constants";
import type {
  EditorHotspot,
  EditorPolygon,
  EditorPolyline,
  EditorTool,
  ViewerMode,
} from "../../types";
import {
  cloneDemoHotspots,
  cloneDemoPolygons,
  cloneDemoPolylines,
  createGraphic,
  createId,
  formatPosition,
  polygonIssueSummary,
  withoutTrailingDuplicate,
} from "../../utils";

export function useHotspotBench() {
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
        mode: "billboard",
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
        mode: "billboard",
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
        mode: "billboard",
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
        mode: "surface",
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

  const selectTool = (nextTool: EditorTool, message: string) => {
    setTool(nextTool);
    setLastAction(message);
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
  }, [drawingPath, drawingPolyline]);

  return {
    viewerRef,
    mode,
    tool,
    view,
    level,
    progress,
    autoRotate,
    tileErrors,
    hotspots,
    polygons,
    polylines,
    draftVertices,
    draftPolygonFilled,
    selectedId,
    lastAction,
    selected,
    selectedPolygon,
    selectedPolyline,
    draftIssues,
    controls,
    placementTool,
    drawingPolygon,
    drawingPolyline,
    drawingPath,
    setView,
    setLevel,
    setProgress,
    setAutoRotate,
    setTileErrors,
    setSelectedId,
    setTool,
    setLastAction,
    setDraftPolygonFilled,
    selectMode,
    selectTool,
    updateHotspot,
    updateGraphic,
    updateImageSource,
    updateSequence,
    updateVideo,
    updatePolygon,
    updatePolyline,
    cancelPolygonDraft,
    finishPolygonDraft,
    addHotspot,
    deleteSelected,
    resetDemo,
  };
}

export type HotspotBenchState = ReturnType<typeof useHotspotBench>;
