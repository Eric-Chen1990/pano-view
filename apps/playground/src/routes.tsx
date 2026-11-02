import { lazy, type ComponentType } from "react";
import { ContextMenuPage } from "./components/context-menu/ContextMenuPage";
import { FilterPage } from "./components/filters/FilterPage";
import { HotspotBenchPage } from "./components/hotspot-bench/HotspotBenchPage";
import { LandingPage } from "./components/landing/LandingPage";
import { SceneMenuPage } from "./components/scene-menu/SceneMenuPage";
import { SceneTransitionPage } from "./components/scene-transitions/SceneTransitionPage";
import { VideoPage } from "./components/video/VideoPage";
import { WebVRPage } from "./components/webvr/WebVRPage";
import { ProjectPage } from "./components/project/ProjectPage";
import { MapPage } from "./components/map/MapPage";

const EditorPage = lazy(() =>
  import("./components/editor/EditorPage").then((module) => ({
    default: module.EditorPage,
  })),
);
const OverlayPage = lazy(() => import("./components/overlays/OverlayPage").then((module) => ({ default: module.OverlayPage })));

export const PLAYGROUND_NAV_GROUPS = [
  { id: "project", label: "Project" },
  { id: "scenes", label: "Scenes" },
  { id: "interaction", label: "Interaction" },
  { id: "media", label: "Media" },
] as const;

export type PlaygroundNavGroupId = (typeof PLAYGROUND_NAV_GROUPS)[number]["id"];

export type PlaygroundRoute = {
  path: string;
  navLabel: string;
  group?: PlaygroundNavGroupId;
  Component: ComponentType;
};

export type PlaygroundExampleRoute = PlaygroundRoute & {
  group: PlaygroundNavGroupId;
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
  { path: "/editor", navLabel: "Editor", group: "project", Component: EditorPage },
  {
    path: "/project",
    navLabel: "Static project",
    group: "project",
    Component: ProjectPage,
  },
  {
    path: "/scene-transitions",
    navLabel: "Scene transitions",
    group: "scenes",
    Component: SceneTransitionPage,
  },
  {
    path: "/scene-menu",
    navLabel: "Scene menu",
    group: "scenes",
    Component: SceneMenuPage,
  },
  { path: "/map", navLabel: "Floor plan map", group: "scenes", Component: MapPage },
  {
    path: "/hotspots",
    navLabel: "Hotspot bench",
    group: "interaction",
    Component: HotspotBenchPage,
  },
  { path: "/overlays", navLabel: "Overlays", group: "interaction", Component: OverlayPage },
  {
    path: "/context-menu",
    navLabel: "Context menu",
    group: "interaction",
    Component: ContextMenuPage,
  },
  { path: "/video", navLabel: "360 video", group: "media", Component: VideoPage },
  { path: "/webvr", navLabel: "WebVR", group: "media", Component: WebVRPage },
  { path: "/filters", navLabel: "Filters", group: "media", Component: FilterPage },
];

export function playgroundNavSections() {
  return PLAYGROUND_NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    routes: PLAYGROUND_ROUTES.filter((route) => route.group === group.id),
  })).filter((section) => section.routes.length > 0);
}

const ALL_PLAYGROUND_ROUTES: readonly PlaygroundRoute[] = [HOME_ROUTE, ...PLAYGROUND_ROUTES];

export function isKnownPlaygroundRoute(pathname: string): boolean {
  return ALL_PLAYGROUND_ROUTES.some((route) => route.path === pathname);
}

export function matchPlaygroundRoute(pathname: string): PlaygroundRoute {
  const normalized = pathname === "" ? HOME_ROUTE.path : pathname;
  return ALL_PLAYGROUND_ROUTES.find((route) => route.path === normalized) ?? HOME_ROUTE;
}
