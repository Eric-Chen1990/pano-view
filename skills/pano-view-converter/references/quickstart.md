# Local image conversion quickstart

Install `@ericchen1990/pano-converter` using the host's package manager and check the installed release's prerequisites. Current releases require Node.js 20.19 or later and a Sharp build for the execution platform. Cube conversion and restoration require FFmpeg with `v360`. Check with `ffmpeg -filters` and use `--ffmpeg-path` (CLI), `ffmpegPath` (Node.js), or `FFMPEG_PATH` if needed.

| Projection | Input | Output to render |
| --- | --- | --- |
| `cubemap` (default) | Full 2:1 panorama | `viewer.json`, cube tiles and preview. Use `loadSceneFromJson` or `Tile`. |
| `equirectangular` | Full 2:1 panorama | `viewer.json`, spherical tiles and preview. Use `loadSceneFromJson` or `SphereTile`. |
| `planar` | Flat image, such as a scan | Planar `manifest.json`, tiles and thumbnail. Use `PlanarTileViewer` with `manifestUrl`. The default layout also emits `image.dzi`. |

The CLI accepts a single local, static raster image. Supply an absent or empty output directory for each command. Substitute your host package manager's binary runner for `pnpm exec` where applicable.

```sh
pnpm exec pano-convert ./room.webp --output ./output/cube
pnpm exec pano-convert ./room.webp --projection equirectangular --output ./output/sphere
pnpm exec pano-convert ./scan.png --projection planar --output ./output/scan
pnpm exec pano-convert restore ./output/sphere/manifest.json --output ./output/restored
```

The equivalent sphere conversion and restoration from an ES module use the public Node.js API. Use different empty directories if you already ran the CLI example.

```js
import { convertImage, restoreImage } from "@ericchen1990/pano-converter";

const result = await convertImage("./room.webp", {
  projection: "equirectangular",
  outputDir: "./output/node-sphere",
});
console.log(result.viewerConfig);

await restoreImage("./output/node-sphere/manifest.json", {
  outputDir: "./output/node-restored",
});
```

Cube and sphere conversion emit a full `manifest.json` for restoration and a lightweight `viewer.json` for rendering. Planar conversion returns `viewerConfig: null`. Keep the relative paths from the descriptors, including the exact tile template and index conventions. To debug a CLI failure, check the exit code and stderr. With `--quiet --json-errors`, redirect result and error files outside the output directory so it starts empty.

When using `onAsset`, read or upload its temporary `absolutePath` within the callback, and use `relativePath` in storage. The completed conversion's `assets` contain final paths. For formats, limits, error codes and hosting details, see the [converter guide](https://github.com/Eric-Chen1990/pano-view/blob/main/packages/converter/README.md) and [React API guide](https://github.com/Eric-Chen1990/pano-view/blob/main/packages/react/README.md).
