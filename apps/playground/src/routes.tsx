import type { ExampleJsonFormat } from "./components/ExampleCode";
import { ChromaKeyPage } from "./components/chroma-key/ChromaKeyPage";
import { lazy, type ComponentType } from "react";
import type { PlaygroundPath } from "./page-meta";
import { ContextMenuPage } from "./components/context-menu/ContextMenuPage";
import { FilterPage } from "./components/filters/FilterPage";
import { HotspotBenchPage } from "./components/hotspot-bench/HotspotBenchPage";
import { LandingPage } from "./components/landing/LandingPage";
import { SceneMenuPage } from "./components/scene-menu/SceneMenuPage";
import { SceneTransitionPage } from "./components/scene-transitions/SceneTransitionPage";
import { VideoPage } from "./components/video/VideoPage";
import { WeatherPage } from "./components/weather/WeatherPage";
import { SunPage } from "./components/sun/SunPage";
import { WebVRPage } from "./components/webvr/WebVRPage";
import { ProjectPage } from "./components/project/ProjectPage";
import { BasicsPage } from "./components/basics/BasicsPage";
import { ScreenshotPage } from "./components/screenshot/ScreenshotPage";
import { ControlsPage } from "./components/controls/ControlsPage";
import { BackgroundAudioPage } from "./components/background-audio/BackgroundAudioPage";
import { DirectionalSoundPage } from "./components/directional-sound/DirectionalSoundPage";
import { GeoMapPage } from "./components/geo-map/GeoMapPage";
import { MapPage } from "./components/map/MapPage";
import { ComparePage } from "./components/compare/ComparePage";
import { PlanarComparePage } from "./components/planar-tile/PlanarComparePage";
import { PlanarTilePage } from "./components/planar-tile/PlanarTilePage";
import { PortalPage } from "./components/portals/PortalPage";

const EditorPage = lazy(() =>
  import("./components/editor/EditorPage").then((module) => ({
    default: module.EditorPage,
  })),
);
const OverlayPage = lazy(() =>
  import("./components/overlays/OverlayPage").then((module) => ({
    default: module.OverlayPage,
  })),
);

const VRSceneMenuPage = lazy(() =>
  import("./components/webvr/VRSceneMenuPage").then((module) => ({
    default: module.VRSceneMenuPage,
  })),
);
const SpatialControlsPage = lazy(() =>
  import("./components/spatial-controls/SpatialControlsPage").then(
    (module) => ({ default: module.SpatialControlsPage }),
  ),
);
const ImmersiveTourPage = lazy(() =>
  import("./components/immersive-tour/ImmersiveTourPage").then((module) => ({
    default: module.ImmersiveTourPage,
  })),
);

export const PLAYGROUND_NAV_GROUPS = [
  { id: "start", label: "Start" },
  { id: "scenes", label: "Scenes" },
  { id: "interaction", label: "Interaction" },
  { id: "media", label: "Media" },
  { id: "immersive", label: "Immersive" },
  { id: "project", label: "Projects & tools" },
] as const;

export type PlaygroundNavGroupId = (typeof PLAYGROUND_NAV_GROUPS)[number]["id"];

export type PlaygroundRoute = {
  path: PlaygroundPath;
  navLabel: string;
  group?: PlaygroundNavGroupId;
  Component: ComponentType;
};

export type PlaygroundExampleRoute = PlaygroundRoute & {
  group: PlaygroundNavGroupId;
  jsonExample: ExampleJsonFormat;
};

export const HOME_ROUTE: PlaygroundRoute = {
  path: "/",
  navLabel: "Home",
  Component: LandingPage,
};

/**
 * Add interactive examples here. The landing page is intentionally excluded from
 * this list so the header can group runnable demos instead of listing each one.
 * Item order within a group is the order shown in that group's menu.
 */
export const PLAYGROUND_ROUTES: readonly PlaygroundExampleRoute[] = [
  {
    path: "/basics",
    jsonExample: "viewer",
    navLabel: "Panorama basics",
    group: "start",
    Component: BasicsPage,
  },
  {
    path: "/planar-image",
    jsonExample: "manifest",
    navLabel: "Tiled flat image",
    group: "start",
    Component: PlanarTilePage,
  },
  {
    path: "/controls",
    jsonExample: "none",
    navLabel: "View controls",
    group: "start",
    Component: ControlsPage,
  },
  {
    path: "/project",
    jsonExample: "project",
    navLabel: "Static JSON tour",
    group: "project",
    Component: ProjectPage,
  },
  {
    path: "/compare",
    jsonExample: "none",
    navLabel: "Panorama comparison",
    group: "scenes",
    Component: ComparePage,
  },
  {
    path: "/planar-compare",
    jsonExample: "manifest",
    navLabel: "Flat image comparison",
    group: "scenes",
    Component: PlanarComparePage,
  },
  {
    path: "/scene-transitions",
    jsonExample: "none",
    navLabel: "Scene transitions",
    group: "scenes",
    Component: SceneTransitionPage,
  },
  {
    path: "/portals",
    jsonExample: "project",
    navLabel: "Panorama portals",
    group: "scenes",
    Component: PortalPage,
  },
  {
    path: "/weather",
    jsonExample: "none",
    navLabel: "360° weather",
    group: "scenes",
    Component: WeatherPage,
  },
  {
    path: "/sun",
    jsonExample: "none",
    navLabel: "Panorama sunlight",
    group: "scenes",
    Component: SunPage,
  },
  {
    path: "/scene-menu",
    jsonExample: "none",
    navLabel: "Scene menu",
    group: "scenes",
    Component: SceneMenuPage,
  },
  {
    path: "/geo-map",
    jsonExample: "project",
    navLabel: "Online scene map",
    group: "scenes",
    Component: GeoMapPage,
  },
  {
    path: "/map",
    jsonExample: "project",
    navLabel: "Floor plan map",
    group: "scenes",
    Component: MapPage,
  },
  {
    path: "/hotspots",
    jsonExample: "project",
    navLabel: "Hotspot bench",
    group: "interaction",
    Component: HotspotBenchPage,
  },
  {
    path: "/overlays",
    jsonExample: "none",
    navLabel: "Dialogs & overlays",
    group: "interaction",
    Component: OverlayPage,
  },
  {
    path: "/screenshot",
    jsonExample: "none",
    navLabel: "Panorama screenshot",
    group: "interaction",
    Component: ScreenshotPage,
  },
  {
    path: "/context-menu",
    jsonExample: "none",
    navLabel: "Context menu",
    group: "interaction",
    Component: ContextMenuPage,
  },
  {
    path: "/video",
    jsonExample: "none",
    navLabel: "360 video",
    group: "media",
    Component: VideoPage,
  },
  {
    path: "/chroma-key",
    jsonExample: "project",
    navLabel: "Chroma key",
    group: "media",
    Component: ChromaKeyPage,
  },
  {
    path: "/background-audio",
    jsonExample: "none",
    navLabel: "Background audio",
    group: "media",
    Component: BackgroundAudioPage,
  },
  {
    path: "/directional-3d-sound",
    jsonExample: "project",
    navLabel: "Directional 3D Sound",
    group: "media",
    Component: DirectionalSoundPage,
  },
  {
    path: "/webvr",
    jsonExample: "none",
    navLabel: "VR basics",
    group: "immersive",
    Component: WebVRPage,
  },
  {
    path: "/vr-scene-menu",
    jsonExample: "none",
    navLabel: "VR scene menu",
    group: "immersive",
    Component: VRSceneMenuPage,
  },
  {
    path: "/spatial-controls",
    jsonExample: "none",
    navLabel: "Spatial controls",
    group: "immersive",
    Component: SpatialControlsPage,
  },
  {
    path: "/immersive-tour",
    jsonExample: "project",
    navLabel: "Immersive tour",
    group: "project",
    Component: ImmersiveTourPage,
  },
  {
    path: "/editor",
    jsonExample: "project",
    navLabel: "Tour editor",
    group: "project",
    Component: EditorPage,
  },
  {
    path: "/filters",
    jsonExample: "none",
    navLabel: "Filters",
    group: "media",
    Component: FilterPage,
  },
];

export function playgroundNavSections() {
  return PLAYGROUND_NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    routes: PLAYGROUND_ROUTES.filter((route) => route.group === group.id),
  })).filter((section) => section.routes.length > 0);
}

const ALL_PLAYGROUND_ROUTES: readonly PlaygroundRoute[] = [
  HOME_ROUTE,
  ...PLAYGROUND_ROUTES,
];

export function isKnownPlaygroundRoute(pathname: string): boolean {
  return ALL_PLAYGROUND_ROUTES.some((route) => route.path === pathname);
}

export function matchPlaygroundRoute(pathname: string): PlaygroundRoute {
  const normalized = pathname === "" ? HOME_ROUTE.path : pathname;
  return (
    ALL_PLAYGROUND_ROUTES.find((route) => route.path === normalized) ??
    HOME_ROUTE
  );
}
