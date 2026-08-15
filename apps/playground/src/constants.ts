import type {
  PanoramaScene,
  PanoramaTransitionPreset,
  PanoViewState,
  TileLoadProgress,
} from "@pano-view/react";
import type { EditorHotspot, EditorPolygon } from "./types";

export const INITIAL_VIEW: PanoViewState = { yaw: 0, pitch: 0, fov: 75 };

export const INITIAL_PROGRESS: TileLoadProgress = {
  requested: 0,
  loaded: 0,
  failed: 0,
  active: 0,
  queued: 0,
};

export const SEQUENCE_SPRITE = "/fixtures/hotspots/sequence-sprite.svg";

export const TRANSITION_SCENES = [
  { id: "sphere-1", type: "sphere", src: "/fixtures/panorama/panos/1.jpg" },
  { id: "sphere-2", type: "sphere", src: "/fixtures/panorama/panos/2.jpg", yawOffset: 12 },
  {
    id: "tile-3",
    type: "tile",
    baseUrl: "/fixtures/panorama/cube-tiles/3",
    multires: "512,1000,2000",
    urlTemplate: "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
  },
  {
    id: "tile-4",
    type: "tile",
    baseUrl: "/fixtures/panorama/cube-tiles/4",
    multires: "512,1000,2000",
    urlTemplate: "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
  },
] satisfies readonly PanoramaScene[];

export const TRANSITION_PRESETS: Array<{ value: PanoramaTransitionPreset; label: string }> = [
  { value: "none", label: "No blend" },
  { value: "crossfade", label: "Crossfade" },
  { value: "zoom", label: "Zoom blend" },
  { value: "blackout", label: "Black-out" },
  { value: "whiteFlash", label: "White flash" },
  { value: "slideRightToLeft", label: "Right to left" },
  { value: "slideTopToBottom", label: "Top to bottom" },
  { value: "slideDiagonal", label: "Diagonal slide" },
  { value: "circleOpen", label: "Circle open" },
  { value: "verticalOpen", label: "Vertical open" },
  { value: "horizontalOpen", label: "Horizontal open" },
  { value: "ellipticZoomOpen", label: "Elliptic + zoom" },
];

export const DEMO_POLYGON: EditorPolygon = {
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

export const DEMO_HOTSPOTS: EditorHotspot[] = [
  {
    id: "gallery-card",
    type: "image",
    label: "Open gallery card",
    position: { yaw: 24, pitch: -5 },
    width: 18,
    height: 10,
    mode: "surface",
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
    mode: "billboard",
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
    mode: "billboard",
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
  },
];
