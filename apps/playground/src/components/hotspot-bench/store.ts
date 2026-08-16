import {
  normalizePanoPosition,
  validatePolygonVertices,
  type GraphicDefinition,
  type HotspotPosition,
  type PanoViewState,
  type TileLoadProgress,
} from "@ericchen1990/pano-view";
import { create } from "zustand";
import {
  DEMO_HOTSPOTS,
  INITIAL_PROGRESS,
  INITIAL_VIEW,
  SEQUENCE_SPRITE,
} from "../../constants";
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

export type HotspotPatch = Partial<Omit<EditorHotspot, "id" | "type" | "graphic">>;
export type SequencePatch = Partial<
  Omit<Extract<EditorHotspot, { type: "sequence" }>, "id" | "type">
>;
export type VideoPatch = Partial<
  Omit<Extract<EditorHotspot, { type: "video" }>, "id" | "type">
>;

type HotspotBenchState = {
  mode: ViewerMode;
  tool: EditorTool;
  view: PanoViewState;
  level: number;
  progress: TileLoadProgress;
  autoRotate: boolean;
  tileErrors: number;
  hotspots: EditorHotspot[];
  polygons: EditorPolygon[];
  polylines: EditorPolyline[];
  draftVertices: HotspotPosition[];
  draftPolygonFilled: boolean;
  selectedId: string | null;
  lastAction: string;
};

type HotspotBenchActions = {
  setView: (view: PanoViewState) => void;
  setLevel: (level: number) => void;
  setProgress: (progress: TileLoadProgress) => void;
  toggleAutoRotate: () => void;
  incrementTileErrors: () => void;
  setLastAction: (message: string) => void;
  toggleDraftFill: () => void;
  selectMode: (mode: ViewerMode) => void;
  selectTool: (tool: EditorTool, message: string) => void;
  selectItem: (id: string, message?: string) => void;
  startPolygon: () => void;
  startPolyline: () => void;
  updateHotspot: (id: string, patch: HotspotPatch) => void;
  updateGraphic: (id: string, graphic: GraphicDefinition) => void;
  updateImageSource: (id: string, src: string) => void;
  updateSequence: (id: string, patch: SequencePatch) => void;
  updateVideo: (id: string, patch: VideoPatch) => void;
  updatePolygon: (id: string, patch: Partial<Omit<EditorPolygon, "id">>) => void;
  updatePolyline: (id: string, patch: Partial<Omit<EditorPolyline, "id">>) => void;
  cancelPolygonDraft: () => void;
  finishPolygonDraft: () => void;
  addHotspot: (position: HotspotPosition) => void;
  deleteSelected: () => void;
  resetDemo: () => void;
};

export type HotspotBenchStore = HotspotBenchState & HotspotBenchActions;

function isPlacementTool(tool: EditorTool): boolean {
  return (
    tool === "image" ||
    tool === "graphic" ||
    tool === "sequence" ||
    tool === "video"
  );
}

function isDrawingPolygon(tool: EditorTool): boolean {
  return tool === "polygon";
}

function isDrawingPolyline(tool: EditorTool): boolean {
  return tool === "polyline";
}

function isDrawingPath(tool: EditorTool): boolean {
  return isDrawingPolygon(tool) || isDrawingPolyline(tool);
}

export const useHotspotBenchStore = create<HotspotBenchStore>((set, get) => ({
  mode: "sphere",
  tool: "navigate",
  view: INITIAL_VIEW,
  level: 1,
  progress: INITIAL_PROGRESS,
  autoRotate: false,
  tileErrors: 0,
  hotspots: cloneDemoHotspots(),
  polygons: cloneDemoPolygons(),
  polylines: cloneDemoPolylines(),
  draftVertices: [],
  draftPolygonFilled: true,
  selectedId: DEMO_HOTSPOTS[0]!.id,
  lastAction: "Select a tool to begin.",

  setView: (view) => set({ view }),
  setLevel: (level) => set({ level }),
  setProgress: (progress) => set({ progress }),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  incrementTileErrors: () => set((state) => ({ tileErrors: state.tileErrors + 1 })),
  setLastAction: (lastAction) => set({ lastAction }),
  toggleDraftFill: () =>
    set((state) => ({ draftPolygonFilled: !state.draftPolygonFilled })),

  selectMode: (mode) =>
    set({
      mode,
      level: 1,
      progress: INITIAL_PROGRESS,
      tileErrors: 0,
    }),

  selectTool: (tool, lastAction) => set({ tool, lastAction }),

  selectItem: (id, message) =>
    set({
      selectedId: id,
      tool: "select",
      ...(message ? { lastAction: message } : {}),
    }),

  startPolygon: () => {
    const { draftVertices } = get();
    set({
      selectedId: null,
      tool: "polygon",
      lastAction: draftVertices.length
        ? `Continue polygon: ${draftVertices.length} vertices.`
        : "Click the panorama to add polygon vertices.",
    });
  },

  startPolyline: () => {
    const { draftVertices } = get();
    set({
      selectedId: null,
      tool: "polyline",
      lastAction: draftVertices.length
        ? `Continue polyline: ${draftVertices.length} vertices.`
        : "Click the panorama to add polyline vertices.",
    });
  },

  updateHotspot: (id, patch) =>
    set((state) => ({
      hotspots: state.hotspots.map((hotspot) =>
        hotspot.id === id
          ? ({
              ...hotspot,
              ...patch,
              ...(patch.position
                ? { position: normalizePanoPosition(patch.position) }
                : {}),
            } as EditorHotspot)
          : hotspot,
      ),
    })),

  updateGraphic: (id, graphic) =>
    set((state) => ({
      hotspots: state.hotspots.map((hotspot) =>
        hotspot.id === id && hotspot.type === "graphic"
          ? { ...hotspot, graphic }
          : hotspot,
      ),
    })),

  updateImageSource: (id, src) =>
    set((state) => ({
      hotspots: state.hotspots.map((hotspot) =>
        hotspot.id === id && hotspot.type === "image"
          ? { ...hotspot, src }
          : hotspot,
      ),
    })),

  updateSequence: (id, patch) =>
    set((state) => ({
      hotspots: state.hotspots.map((hotspot) =>
        hotspot.id === id && hotspot.type === "sequence"
          ? { ...hotspot, ...patch }
          : hotspot,
      ),
    })),

  updateVideo: (id, patch) =>
    set((state) => ({
      hotspots: state.hotspots.map((hotspot) =>
        hotspot.id === id && hotspot.type === "video"
          ? { ...hotspot, ...patch }
          : hotspot,
      ),
    })),

  updatePolygon: (id, patch) =>
    set((state) => ({
      polygons: state.polygons.map((polygon) =>
        polygon.id === id ? { ...polygon, ...patch } : polygon,
      ),
    })),

  updatePolyline: (id, patch) =>
    set((state) => ({
      polylines: state.polylines.map((polyline) =>
        polyline.id === id ? { ...polyline, ...patch } : polyline,
      ),
    })),

  cancelPolygonDraft: () =>
    set({
      draftVertices: [],
      tool: "navigate",
      lastAction: "Polygon draft cancelled.",
    }),

  finishPolygonDraft: () => {
    const { tool, draftVertices, draftPolygonFilled } = get();
    if (isDrawingPolyline(tool)) {
      if (draftVertices.length < 2) {
        set({ lastAction: "A polyline needs at least two vertices." });
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
      set((state) => ({
        polylines: [...state.polylines, polyline],
        draftVertices: [],
        selectedId: polyline.id,
        tool: "select",
        lastAction: `Polyline created with ${polyline.vertices.length} vertices.`,
      }));
      return;
    }
    const vertices = withoutTrailingDuplicate(draftVertices);
    const issues = validatePolygonVertices(vertices);
    if (issues.length > 0) {
      set({
        draftVertices: vertices,
        lastAction: `Polygon cannot be completed: ${polygonIssueSummary(issues)}`,
      });
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
    set((state) => ({
      polygons: [...state.polygons, polygon],
      draftVertices: [],
      selectedId: polygon.id,
      tool: "select",
      lastAction: `Polygon created with ${vertices.length} vertices.`,
    }));
  },

  addHotspot: (position) => {
    const normalizedPosition = normalizePanoPosition(position);
    const { tool, draftVertices } = get();
    if (isDrawingPath(tool)) {
      set({
        draftVertices: [...draftVertices, normalizedPosition],
        lastAction: `${isDrawingPolyline(tool) ? "Polyline" : "Polygon"} vertex ${draftVertices.length + 1} added at ${formatPosition(normalizedPosition)}.`,
      });
      return;
    }
    if (tool === "image") {
      const hotspot: EditorHotspot = {
        id: createId("image"),
        type: "image",
        label: "Open image hotspot",
        position: normalizedPosition,
        width: 16,
        height: 9,
        rotation: 0,
        scale: 1,
        mode: "billboard",
        distance: 10,
        scaleMode: "fov",
        opacity: 1,
        visible: true,
        src: "/fixtures/hotspots/gallery-card.svg",
      };
      set((state) => ({
        hotspots: [...state.hotspots, hotspot],
        selectedId: hotspot.id,
        tool: "select",
        lastAction: `Image placed at ${formatPosition(position)}.`,
      }));
      return;
    }
    if (tool === "graphic") {
      const hotspot: EditorHotspot = {
        id: createId("graphic"),
        type: "graphic",
        label: "Explore graphic hotspot",
        position: normalizedPosition,
        width: 9,
        height: 9,
        rotation: 0,
        scale: 1,
        mode: "billboard",
        distance: 10,
        scaleMode: "fixed",
        opacity: 1,
        visible: true,
        graphic: createGraphic("circle"),
      };
      set((state) => ({
        hotspots: [...state.hotspots, hotspot],
        selectedId: hotspot.id,
        tool: "select",
        lastAction: `Graphic placed at ${formatPosition(position)}.`,
      }));
      return;
    }
    if (tool === "sequence") {
      const hotspot: EditorHotspot = {
        id: createId("sequence"),
        type: "sequence",
        label: "Play sequence marker",
        position: normalizedPosition,
        width: 13,
        height: 7.3,
        rotation: 0,
        scale: 1,
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
      set((state) => ({
        hotspots: [...state.hotspots, hotspot],
        selectedId: hotspot.id,
        tool: "select",
        lastAction: `Sequence placed at ${formatPosition(position)}.`,
      }));
      return;
    }
    if (tool === "video") {
      const hotspot: EditorHotspot = {
        id: createId("video"),
        type: "video",
        label: "Play video window",
        position: normalizedPosition,
        width: 18,
        height: 10.1,
        rotation: 0,
        scale: 1,
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
      set((state) => ({
        hotspots: [...state.hotspots, hotspot],
        selectedId: hotspot.id,
        tool: "select",
        lastAction: `Video placed at ${formatPosition(position)}.`,
      }));
    }
  },

  deleteSelected: () => {
    const { selectedId, hotspots, polygons, polylines } = get();
    const selected = hotspots.find((hotspot) => hotspot.id === selectedId) ?? null;
    if (selected) {
      set({
        hotspots: hotspots.filter((hotspot) => hotspot.id !== selected.id),
        selectedId: null,
        lastAction: `${selected.type[0]!.toUpperCase()}${selected.type.slice(1)} removed.`,
      });
      return;
    }
    const selectedPolygon = polygons.find((polygon) => polygon.id === selectedId) ?? null;
    if (selectedPolygon) {
      set({
        polygons: polygons.filter((polygon) => polygon.id !== selectedPolygon.id),
        selectedId: null,
        lastAction: "Polygon removed.",
      });
      return;
    }
    const selectedPolyline = polylines.find((polyline) => polyline.id === selectedId) ?? null;
    if (selectedPolyline) {
      set({
        polylines: polylines.filter((polyline) => polyline.id !== selectedPolyline.id),
        selectedId: null,
        lastAction: "Polyline removed.",
      });
    }
  },

  resetDemo: () => {
    const next = cloneDemoHotspots();
    set({
      hotspots: next,
      polygons: cloneDemoPolygons(),
      polylines: cloneDemoPolylines(),
      draftVertices: [],
      selectedId: next[0]!.id,
      tool: "navigate",
      lastAction: "Demo hotspots restored.",
    });
  },
}));

export const selectPlacementTool = (state: HotspotBenchStore): boolean =>
  isPlacementTool(state.tool);

export const selectDrawingPolygon = (state: HotspotBenchStore): boolean =>
  isDrawingPolygon(state.tool);

export const selectDrawingPolyline = (state: HotspotBenchStore): boolean =>
  isDrawingPolyline(state.tool);

export const selectDrawingPath = (state: HotspotBenchStore): boolean =>
  isDrawingPath(state.tool);

export const selectSelected = (state: HotspotBenchStore): EditorHotspot | null =>
  state.hotspots.find((hotspot) => hotspot.id === state.selectedId) ?? null;

export const selectSelectedPolygon = (state: HotspotBenchStore): EditorPolygon | null =>
  state.polygons.find((polygon) => polygon.id === state.selectedId) ?? null;

export const selectSelectedPolyline = (state: HotspotBenchStore): EditorPolyline | null =>
  state.polylines.find((polyline) => polyline.id === state.selectedId) ?? null;

export const selectHotspotCount = (state: HotspotBenchStore): number =>
  state.hotspots.length + state.polygons.length + state.polylines.length;
