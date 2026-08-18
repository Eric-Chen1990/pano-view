import type { ComponentType } from "react";
import { ContextMenuPage } from "./components/context-menu/ContextMenuPage";
import { HotspotBenchPage } from "./components/hotspot-bench/HotspotBenchPage";
import { SceneTransitionPage } from "./components/scene-transitions/SceneTransitionPage";
import { VideoPage } from "./components/video/VideoPage";
import { WebVRPage } from "./components/webvr/WebVRPage";

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
  {
    path: "/context-menu",
    navLabel: "Context menu",
    stageLabel: "CONTEXT MENU · STAGE 07",
    Component: ContextMenuPage,
  },
  {
    path: "/video",
    navLabel: "360 video",
    stageLabel: "360 VIDEO · STAGE 08",
    Component: VideoPage,
  },
  {
    path: "/webvr",
    navLabel: "WebVR",
    stageLabel: "IMMERSIVE VR · STAGE 09",
    Component: WebVRPage,
  },
];

export const DEFAULT_PLAYGROUND_ROUTE = PLAYGROUND_ROUTES[0]!;

export function matchPlaygroundRoute(pathname: string): PlaygroundRoute {
  const normalized = pathname === "/" || pathname === "" ? DEFAULT_PLAYGROUND_ROUTE.path : pathname;
  return (
    PLAYGROUND_ROUTES.find((route) => route.path === normalized) ?? DEFAULT_PLAYGROUND_ROUTE
  );
}
