export const SITE_URL = "https://pano-view-playground.vercel.app";

export const PAGE_META = {
  "/": {
    title: "Pano View — Open-Source React 360° Panorama Viewer",
    description:
      "Build immersive web experiences with Pano View: open-source React components for 360° panoramas, video, hotspots, scene menus, and multiresolution tiles.",
  },
  "/basics": {
    title: "Panorama Basics Demo | Pano View",
    description:
      "Start with a single React panorama. Compare Sphere images and Tile cube sources, resource paths, previews and loading diagnostics.",
  },
  "/planar-image": {
    title: "Tiled Flat Image Demo | Pano View",
    description:
      "Pan and zoom a high-resolution flat image. The React viewer loads visible image tiles as you zoom into the floor plan.",
  },
  "/controls": {
    title: "Panorama View Controls Demo | Pano View",
    description:
      "Learn mouse, touch, keyboard, imperative view navigation, automatic rotation, gyro permissions and fullscreen in a React panorama.",
  },
  "/background-audio": {
    title: "Panorama Background Audio Demo | Pano View",
    description:
      "Play and pause shared or per-scene background music. Keep audio outside scene lifecycles and observe playback while navigating a panorama tour.",
  },
  "/directional-3d-sound": {
    title: "Directional 3D Sound Demo | Pano View",
    description:
      "Listen to two positional sound sources as you look around a panorama or move with positional tracking in WebXR.",
  },
  "/vr-scene-menu": {
    title: "VR Scene Menu Demo | Pano View",
    description:
      "Configure a spatial panorama scene menu with compact, flat and arc layouts, pagination, appearance, titles and gaze navigation.",
  },
  "/spatial-controls": {
    title: "VR Spatial Controls Demo | Pano View",
    description:
      "Learn spatial icon controls for scene video, 360 video, host-rendered models and scrolling content in separate interactive examples.",
  },
  "/immersive-tour": {
    title: "Immersive Tour Integration Demo | Pano View",
    description:
      "Combine scene navigation, shared dialogs, rich content, video, models and VR in a complete React panorama integration example.",
  },
  "/editor": {
    title: "Tour editor · Pano View",
    description:
      "Try the open-source Pano View tour editor. Build 360° scenes, place hotspots, edit shared popups and floor plans, and export a portable JSON project.",
  },
  "/project": {
    title: "Static 360° Tour Demo | Pano View",
    description:
      "Explore a React panorama tour built from static JSON, with linked scenes, interactive hotspots, view actions, and reusable popup content.",
  },
  "/compare": {
    title: "Panorama Comparison Demo | Pano View",
    description: "Compare synchronized 360° panoramas with a draggable wipe or two complete views, arranged side by side or stacked.",
  },
  "/planar-compare": {
    title: "Flat Image Comparison Demo | Pano View",
    description: "Compare multiresolution flat images with synchronized pan and zoom, a draggable wipe, or equal panes.",
  },
  "/scene-transitions": {
    title: "Panorama Scene Transitions Demo | Pano View",
    description:
      "Try panorama scene transitions in React. Move between equirectangular images and multiresolution cube tiles with configurable visual effects.",
  },
  "/portals": {
    title: "Panorama Portals Demo | Pano View",
    description:
      "Look through live 360° portals to different panoramas. Click a doorway or look directly at it and zoom in to travel.",
  },
  "/weather": {
    title: "360° Rain and Snow Demo | Pano View",
    description:
      "Try nine spatial rain and snow effects in a panoramic viewer with adjustable intensity and wind.",
  },
  "/sun": {
    title: "Panorama Sunlight Demo | Pano View",
    description:
      "Add sunlight to a 360° panorama or enhance an existing sun with adjustable glow, rays, and lens flare.",
  },
  "/scene-menu": {
    title: "Panorama Scene Menu Demo | Pano View",
    description:
      "Explore the Pano View thumbnail scene menu. Switch 360° scenes, adjust menu placement, and try collapsible controls and scrollable thumbnails.",
  },
  "/geo-map": {
    title: "Online Scene Map Demo | Pano View",
    description: "Navigate a panorama tour through a live basemap, with scene markers and a real-time direction indicator.",
  },
  "/map": {
    title: "360° Tour Floor Plan Map Demo | Pano View",
    description:
      "Navigate a 360° panorama tour with an interactive floor plan, scene markers, and a view-direction indicator using Pano View React components.",
  },
  "/hotspots": {
    title: "Interactive Panorama Hotspots Demo | Pano View",
    description:
      "Create interactive hotspots in a React panorama: images, text, video, audio, polygons, and polylines. Explore the Pano View hotspot authoring demo.",
  },
  "/overlays": {
    title: "Panorama Dialogs and Overlays Demo | Pano View",
    description:
      "Explore viewer-local dialogs and overlays for React panoramas, comparing default, composed and third-party dialogs with shared story content, nested portals and fullscreen support.",
  },
  "/context-menu": {
    title: "Panorama Context Menu Demo | Pano View",
    description:
      "Try a customizable context menu in a React panorama viewer, with reset view, fullscreen controls, and host-defined menu actions.",
  },
  "/chroma-key": {
    title: "Chroma Key Hotspot Demo | Pano View",
    description: "Remove a green or blue background from image and video hotspots with live color sampling and edge controls.",
  },
  "/video": {
    title: "React 360° Video Player Demo | Pano View",
    description:
      "Play 360° video in a React panorama viewer. Explore playback controls, quality selection, and captions in the Pano View video demo.",
  },
  "/webvr": {
    title: "VR Basics and WebXR Demo | Pano View",
    description:
      "Explore immersive panorama viewing with Pano View. Try WebXR and mobile viewing options on supported browsers and devices.",
  },
  "/filters": {
    title: "Panorama Color Adjustments Demo | Pano View",
    description:
      "Adjust exposure, saturation, contrast, and clarity on 360° images, tiles, and video with Pano View.",
  },
} as const;

export type PlaygroundPath = keyof typeof PAGE_META;
