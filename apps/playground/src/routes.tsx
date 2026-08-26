import type { ComponentType } from "react";
import { ContextMenuPage } from "./components/context-menu/ContextMenuPage";
import { FilterPage } from "./components/filters/FilterPage";
import { HotspotBenchPage } from "./components/hotspot-bench/HotspotBenchPage";
import { LandingPage } from "./components/landing/LandingPage";
import { SceneTransitionPage } from "./components/scene-transitions/SceneTransitionPage";
import { VideoPage } from "./components/video/VideoPage";
import { WebVRPage } from "./components/webvr/WebVRPage";

export type PlaygroundRoute = {
  path: string;
  navLabel: string;
  Component: ComponentType;
};

export const HOME_ROUTE: PlaygroundRoute = {
  path: "/",
  navLabel: "Home",
  Component: LandingPage,
};

/**
 * Add interactive examples here. The landing page is intentionally excluded from
 * this list so the demo navigation remains focused on runnable feature examples.
 */
export const PLAYGROUND_ROUTES: readonly PlaygroundRoute[] = [
  {
    path: "/hotspots",
    navLabel: "Hotspot bench",
    Component: HotspotBenchPage,
  },
  {
    path: "/scene-transitions",
    navLabel: "Scene transitions",
    Component: SceneTransitionPage,
  },
  {
    path: "/context-menu",
    navLabel: "Context menu",
    Component: ContextMenuPage,
  },
  {
    path: "/video",
    navLabel: "360 video",
    Component: VideoPage,
  },
  {
    path: "/webvr",
    navLabel: "WebVR",
    Component: WebVRPage,
  },
  {
    path: "/filters",
    navLabel: "Filters",
    Component: FilterPage,
  },
];

const ALL_PLAYGROUND_ROUTES: readonly PlaygroundRoute[] = [HOME_ROUTE, ...PLAYGROUND_ROUTES];

export function isKnownPlaygroundRoute(pathname: string): boolean {
  return ALL_PLAYGROUND_ROUTES.some((route) => route.path === pathname);
}

export function matchPlaygroundRoute(pathname: string): PlaygroundRoute {
  const normalized = pathname === "" ? HOME_ROUTE.path : pathname;
  return ALL_PLAYGROUND_ROUTES.find((route) => route.path === normalized) ?? HOME_ROUTE;
}
