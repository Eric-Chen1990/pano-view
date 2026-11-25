# React viewer quickstart

Install `@ericchen1990/pano-view` in the host project and satisfy the peer ranges declared by that version. Serve the example files over HTTP from `/panoramas/` in the host. Supply a full 2:1 equirectangular image and a smaller 2:1 preview.

```tsx
"use client";

import { PanoViewer, Sphere } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function RoomPanorama() {
  return (
    <PanoViewer style={{ height: 480 }}>
      <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
    </PanoViewer>
  );
}
```

Here `preview.webp` resolves relative to `src`, at `/panoramas/preview.webp`. In Next.js App Router, keep viewer rendering under a client boundary and import global styles at the host's supported entry point. For server-side data loading and validation use `@ericchen1990/pano-view/data`. Hosts using the optional default dialog UI also import `@ericchen1990/pano-view/ui/styles.css`.

| Input | Public integration |
| --- | --- |
| Single 2:1 equirectangular image | `Sphere` inside `PanoViewer`, with `src` and `previewUrl`. |
| Multiresolution cube or equirectangular tiles | `Tile` or `SphereTile` inside `PanoViewer`. For a converter `viewer.json`, use `loadSceneFromJson(url, { id })`, then give the resulting scene to `Scenes` inside `PanoViewer`. |
| 2:1 equirectangular video | `PanoVideo` inside `PanoViewer`, with `src`. Start muted if requesting autoplay and verify browser playback and activation. |
| Tiled flat image | Standalone `PlanarTileViewer` with `manifestUrl` pointing to the planar converter's `manifest.json`. |
| Persisted multi-scene tour | `loadPanoProject` and `ProjectScenes`. See the static project guide below. |

Prefer tiled assets for panoramas that exceed practical device texture or memory limits. When a preview works but detail is missing, inspect a failing tile request and compare its face, level, row, column and extension with the stored files. Check the actual rendering backend through the viewer handle when investigating a backend-specific issue. For fullscreen DOM overlays use the viewer's `PanoOverlay` and shared portal container so the overlay stays within the fullscreen element.

For advanced controls, hotspots, overlays, renderer options and troubleshooting, see the [React API guide](https://github.com/Eric-Chen1990/pano-view/blob/main/packages/react/README.md), the [static project guide](https://github.com/Eric-Chen1990/pano-view/blob/main/packages/react/README.md#static-projects-and-json-data) and the [360 video guide](https://github.com/Eric-Chen1990/pano-view/blob/main/docs/react-360-video.md).
