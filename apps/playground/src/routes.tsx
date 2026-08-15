import type { ComponentType } from "react";
import { HotspotBenchPage } from "./components/hotspot-bench/HotspotBenchPage";
import { SceneTransitionPage } from "./components/scene-transitions/SceneTransitionPage";

export type PlaygroundRoute = {
  path: string;
  navLabel: string;
  stageLabel: string;
  Component: ComponentType;
};

/**
 * Add playground pages here. App matching and SiteHeader nav both read from this list.
 */
export const PLAYGROUND_ROUTES: readonly PlaygroundRoute[] = [
  {
    path: "/hotspots",
    navLabel: "Hotspot bench",
    stageLabel: "HOTSPOT AUTHORING · STAGE 06",
    Component: HotspotBenchPage,
  },
  {
    path: "/scene-transitions",
    navLabel: "Scene transitions",
    stageLabel: "SCENE TRANSITIONS · STAGE 06",
    Component: SceneTransitionPage,
  },
];

export const DEFAULT_PLAYGROUND_ROUTE = PLAYGROUND_ROUTES[0]!;

export function matchPlaygroundRoute(pathname: string): PlaygroundRoute {
  const normalized = pathname === "/" || pathname === "" ? DEFAULT_PLAYGROUND_ROUTE.path : pathname;
  return (
    PLAYGROUND_ROUTES.find((route) => route.path === normalized) ?? DEFAULT_PLAYGROUND_ROUTE
  );
}
