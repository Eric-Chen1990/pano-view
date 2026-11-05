export const SITE_URL = "https://pano-view-playground.vercel.app";

export const PAGE_META = {
  "/": {
    title: "Pano View — Open-Source React 360° Panorama Viewer",
    description: "Build immersive web experiences with Pano View: open-source React components for 360° panoramas, video, hotspots, scene menus, and multiresolution tiles.",
  },
  "/editor": {
    title: "Tour editor · Pano View",
    description: "Try the open-source Pano View tour editor. Build 360° scenes, place hotspots, edit shared popups and floor plans, and export a portable JSON project.",
  },
  "/project": {
    title: "Static 360° Tour Demo | Pano View",
    description: "Explore a React panorama tour built from static JSON, with linked scenes, interactive hotspots, view actions, and reusable popup content.",
  },
  "/scene-transitions": {
    title: "Panorama Scene Transitions Demo | Pano View",
    description: "Try panorama scene transitions in React. Move between equirectangular images and multiresolution cube tiles with configurable visual effects.",
  },
  "/scene-menu": {
    title: "Panorama Scene Menu Demo | Pano View",
    description: "Explore the Pano View thumbnail scene menu. Switch 360° scenes, adjust menu placement, and try collapsible controls and scrollable thumbnails.",
  },
  "/map": {
    title: "360° Tour Floor Plan Map Demo | Pano View",
    description: "Navigate a 360° panorama tour with an interactive floor plan, scene markers, and a view-direction indicator using Pano View React components.",
  },
  "/hotspots": {
    title: "Interactive Panorama Hotspots Demo | Pano View",
    description: "Create interactive hotspots in a React panorama: images, text, video, audio, polygons, and polylines. Explore the Pano View hotspot authoring demo.",
  },
  "/overlays": {
    title: "Panorama Dialogs and Overlays Demo | Pano View",
    description: "Explore viewer-local dialogs and overlays for React panoramas, including image, video, gallery, and iframe content with fullscreen support.",
  },
  "/context-menu": {
    title: "Panorama Context Menu Demo | Pano View",
    description: "Try a customizable context menu in a React panorama viewer, with reset view, fullscreen controls, and host-defined menu actions.",
  },
  "/video": {
    title: "React 360° Video Player Demo | Pano View",
    description: "Play 360° video in a React panorama viewer. Explore playback controls, captions, and immersive viewing options in the Pano View video demo.",
  },
  "/webvr": {
    title: "Immersive Panorama and WebXR Demo | Pano View",
    description: "Explore immersive panorama viewing with Pano View. Try WebXR and mobile viewing options on supported browsers and devices.",
  },
  "/filters": {
    title: "Panorama Image Filters Demo | Pano View",
    description: "Try visual filters on 360° panorama images and multiresolution cube tiles. Adjust the appearance live with Pano View React components.",
  },
} as const;

export type PlaygroundPath = keyof typeof PAGE_META;
