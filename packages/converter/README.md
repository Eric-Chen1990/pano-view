# @ericchen1990/pano-converter · [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![npm version](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-converter.svg?style=flat)](https://www.npmjs.com/package/@ericchen1990/pano-converter) [![Converter](https://github.com/Eric-Chen1990/pano-view/actions/workflows/converter.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/converter.yml) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Eric-Chen1990/pano-view/pulls)

Generate panorama/image tile pyramids and reconstruct local tiles in Node.js or the CLI. Cloud uploads, database writes, IDs, and URLs belong to your application.

[中文说明](./README.zh-CN.md)

## Contents

- [pano-view](#pano-view)
- [Install](#install)
- [Node.js](#nodejs)
- [Output and options](#output-and-options)
- [viewer.json and static projects](#viewerjson-and-static-projects)
- [JSON examples](#json-examples)
- [API return values](#api-return-values)
- [Reconstruction](#reconstruction)
- [CLI](#cli)
- [Error codes and troubleshooting](#error-codes-and-troubleshooting)
- [Existing CMS data](#existing-cms-data)
- [Development and release](#development-and-release)

## pano-view

[@ericchen1990/pano-view](../react/README.md) is the other package in this
repository. It is the React viewer for the `viewerConfig` returned by
[`convertImage`](#nodejs). Cubemap output maps to `Tile` (`type: "tile"`);
equirectangular output maps to `SphereTile` (`type: "sphereTile"`). Pass that
config, plus your application's `id` and `baseUrl`, to `Scenes`. See
[Frontend integration](#frontend-integration).

Prefer the default `cubemap` projection for new pano-view assets. Use
`equirectangular` when retaining an equirectangular tile format is required;
the viewer's current spherical renderer may still show visible pole artifacts.

## Install

<details name="pano-converter-install" open>
<summary>npm</summary>

```sh
npm install @ericchen1990/pano-converter
```

</details>
<details name="pano-converter-install">
<summary>pnpm</summary>

```sh
pnpm add @ericchen1990/pano-converter
```

</details>
<details name="pano-converter-install">
<summary>yarn</summary>

```sh
yarn add @ericchen1990/pano-converter
```

</details>
<details name="pano-converter-install">
<summary>bun</summary>

```sh
bun add @ericchen1990/pano-converter
```

</details>

Requires Node.js >=20.19. Cubemap conversion and cubemap-to-equirectangular reconstruction additionally require an external FFmpeg executable with the `v360` filter. Install it with your OS package manager; set `ffmpegPath` or `FFMPEG_PATH` if it is not on `PATH`. Equirectangular and planar operations do not use FFmpeg.

Sharp is a normal runtime dependency, external to the JS bundle. Its optional packages select the native binary for the installation OS/CPU/libc. Install dependencies on the deployment target or configure your package manager for cross-target installation; do not copy macOS/Windows `node_modules` into Linux. Both Linux glibc and musl require their matching binaries. See [Sharp installation](https://sharp.pixelplumbing.com/install/). This package does not bundle FFmpeg or native binaries.

## Node.js

```ts
import { convertImage, restoreImage } from "@ericchen1990/pano-converter";

const result = await convertImage("./room.jpg", {
  projection: "cubemap",
  outputDir: "./output/room",
});

console.log(result.manifest); // Full, versioned archive/reconstruction description
console.log(result.viewerConfig); // Compact serializable pano-view props

await restoreImage("./output/room/manifest.json", {
  outputDir: "./restored",
  exportCubeFaces: true,
});
```

CommonJS is also supported: `const { convertImage } = require("@ericchen1990/pano-converter")`.

Inputs are a local path or a nonempty `Buffer`. Only static, single-frame raster images decoded by Sharp are accepted; supported codecs include JPEG, PNG, WebP, TIFF, AVIF/HEIF and single-frame GIF where available in your Sharp build. EXIF orientation is applied, pixels are converted to sRGB, and EXIF/private metadata is stripped. Panoramas must be full 2:1 images (1% input tolerance, normalized to exact 2:1). Cubemaps flatten transparency onto white; other PNG/WebP outputs preserve alpha.

### Upload and persistence

```ts
const prefix = `panoramas/${panoramaId}/${conversionId}/`;
const result = await convertImage(localInputPath, {
  outputDir: localOutputDir,
  onAsset: async (asset, signal) => {
    await storage.uploadFile({
      localPath: asset.absolutePath,
      key: prefix + asset.relativePath,
      contentType: asset.contentType,
      signal,
    });
  },
});

// onAsset has finished for all images and DZI descriptors before this resolves.
await storage.uploadJson(prefix + "manifest.json", result.manifest);
await db.savePanorama({
  id: panoramaId,
  assetPrefix: prefix,
  manifestKey: prefix + "manifest.json",
  schemaVersion: result.manifest.schemaVersion,
  viewerConfig: result.viewerConfig,
  thumbnailPath: result.manifest.thumbnail.path,
});
```

`storage`, `db`, IDs and paths above are application-owned examples. `onAsset` is awaited with bounded concurrency and includes tiles, previews, thumbnails, DZI descriptors and frontend `viewer.json`. It excludes `manifest.json`: upload the final manifest after conversion succeeds. The same small preview can serve as the thumbnail and is emitted once. Callback paths refer to job staging files and are valid during the awaited callback; return only after reading/uploading finishes. After success, `result.assets` contains final absolute paths. Do not delete or mutate callback files. Native Deep Zoom emits file callbacks after the native pyramid completes; custom output emits each tile after its encode.

A failed callback fails the conversion. Uploads are not rolled back; use a unique conversion prefix and let your application clean failed uploads, set business status, and remove successful local output when finished. Cancellation/deadlines stop new work, interrupt FFmpeg, and wait for active native work/callbacks before cleaning staging. Pass the supplied signal into your upload client and set upload timeouts; a callback that never settles cannot be safely cleaned up by the library.

### Frontend integration

Persist the compact configuration and return a batch of scenes in the project API:

```ts
const scenes = records.map((record) => ({
  ...record.viewerConfig,
  id: record.id,
  baseUrl: getAssetBaseUrl(record.assetPrefix),
}));
```

```tsx
import { PanoViewer, Scenes } from "@ericchen1990/pano-view";

<PanoViewer>
  <Scenes scenes={project.scenes} />
</PanoViewer>;
```

Cubemaps produce `type: "tile"`; equirectangular output produces `type: "sphereTile"`, including explicit `indexBase: 1`. Planar images return `viewerConfig: null` and need a planar viewer. Rendering is done by [@ericchen1990/pano-view](../react/README.md); this package does not fetch or store application data. The browser need not request every full manifest. Both configs use explicit URL templates; cube filenames are row-before-column, differing from pano-view's default template.

## viewer.json and static projects

Panorama conversion in both CLI and Node.js writes two JSON files:

| File | Contents and purpose |
| --- | --- |
| `manifest.json` | Complete archive/reconstruction metadata, including source dimensions, tile layout, and preview references |
| `viewer.json` | `{ schemaVersion: 1, ...viewerConfig }`, rendering fields only |

Asset references are relative, without local directories, cloud hosts or application IDs. Planar output keeps `viewerConfig: null` and does not create `viewer.json`.

```sh
pano-convert ./entrance.jpg --output ./public/tour/panoramas/entrance
pano-convert ./hall.jpg --output ./public/tour/panoramas/hall
```

Upload the directory while preserving its internal layout. Rendering needs tiles, preview and `viewer.json`; retain `manifest.json` and its referenced assets separately for reconstruction. `viewer.json` appears in `result.assets` as `descriptor`, with `application/json`, and is emitted through the awaited `onAsset` callback. The final archive `manifest.json` remains excluded from that callback.

```tsx
import { PanoViewer, Scenes, loadSceneFromJson } from "@ericchen1990/pano-view";

const scene = await loadSceneFromJson(
  "https://cdn.example.com/tour/panoramas/entrance/viewer.json",
  { id: "entrance" },
);
// Render after your application's loading flow completes:
<PanoViewer style={{ height: 600 }}><Scenes scenes={[scene]} /></PanoViewer>;
```

For multiple scenes and hotspots, author a separate `project.json` referencing each `viewer.json`, then use `loadPanoProject` and `ProjectScenes`. Projects can also inline the existing `result.viewerConfig`, without a database. Set `baseUrl` when the config API and assets are hosted separately, or use synchronous URL mapping for renamed files.

See the [viewer static project guide](../react/README.md#static-projects-and-json-data) for project JSON, React loading/cancellation and URL rules, and the [FAQ](../react/README.md#faq-and-troubleshooting) for CORS, 404, signatures and playback. Node.js server consumers can import pure data methods from `@ericchen1990/pano-view/data`. The converter also returns `viewerConfig`; frontend loaders do not consume the full `manifest.json`.

## Output and options

| Option                            | Default / behavior                                                              |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `projection`                      | `cubemap`; also `equirectangular`, `planar`                                     |
| `layout`                          | `custom` for panoramas, standard `deepzoom` for planar                          |
| `outputDir`                       | Required; nonexistent or empty, exclusive per running job                       |
| `tileSize`                        | 512; integer 1–8192                                                             |
| `format`                          | WebP for custom; JPEG for Deep Zoom; also PNG                                   |
| `quality`                         | 95; 1–100, JPEG/WebP only; previews use 90                                      |
| `levels`                          | Exact ascending cube edges (`number[]`) or sizes (`{width,height}[]`)           |
| `pyramidDownscale`                | 2; finite >1, mutually exclusive with `levels`                                  |
| `tilePathTemplate`                | Cube: `tiles/%s/l%l/%v/l%l_%s_%v_%h.%e`; others: `tiles/%l/%h_%v.%e`            |
| `faceSize`                        | Even cube edge approximately source width /4, capped at 12288 and FFmpeg limits |
| `concurrency`                     | 4, range 1–32; bounds active image tasks, no global Sharp changes               |
| `limitInputPixels`                | 268402689; positive override also bounds reconstruction canvases                |
| `timeoutMs`                       | 600000; positive milliseconds                                                   |
| `signal`, `onAsset`, `onProgress` | Cancellation, awaited file callback, synchronous progress                       |

Custom levels do not upscale beyond processed source dimensions, use 1-based indices, zero overlap, and preserve the source aspect ratio. Automatic pyramids divide by `pyramidDownscale` (default 2), round upward, and normally stop when the image fits one tile. Sphere pyramids keep both dimensions strictly changing between levels, so a minimal-height base level may still span multiple tiles. Output is limited to 64 levels and 100000 tiles. Path placeholders support `%s`, `%l`, `%h`, `%v`, `%e` and `%0h`/`%00v` padding. Extensions must match the selected format; JPEG also accepts `.jpg`. Unsafe, duplicate, case-colliding and reserved output paths fail explicitly.

```ts
await convertImage("./large.png", {
  projection: "planar",
  layout: "custom",
  outputDir: "./custom",
  format: "png",
  levels: [
    { width: 1024, height: 512 },
    { width: 4096, height: 2048 },
  ],
  tilePathTemplate: "tiles/%l/%0v_%0h.%e",
});
```

Standard Deep Zoom uses Sharp's `tile({layout:"dz",depth:"onepixel",overlap:0,skipBlanks:-1})`, writes `image.dzi`/`image_files/`, and retains the complete grid including blank tiles. It rejects custom levels, scale factors and templates; select `layout: "custom"` for those. Standard Deep Zoom uses a planar layout and cannot be passed directly to `SphereTile` as panorama configuration.

Default WebP panorama previews retain `previews/200.webp`, `400.webp`, `800.webp`; their actual dimensions are recorded and small sources are not enlarged. Cubemap previews additionally include `previews/cube-vertical.webp` with top-to-bottom order `l,f,r,b,u,d`. Panorama `thumbnail.path` references the 200-height preview. Planar thumbnails fit within 400×400. Choosing another format changes extensions and requires consuming the recorded paths.

The full manifest includes `schemaVersion: 1`, projection, EXIF-oriented source dimensions, actual level sizes/grids, encoding format, template, index base, previews and thumbnail. Paths are relative POSIX paths, with no cloud hosts or local source filenames. `toViewerConfig(manifest)` derives the compact viewer DTO; `validateManifest(unknown)` validates supported JSON before use. Unknown schema versions fail rather than falling back to guessed layouts.

## JSON examples

The following `manifest.json` describes a 4096×2048 input using default cubemap conversion. A URL template and grid dimensions identify the tiles without listing each tile URL.

```json
{
  "schemaVersion": 1,
  "projection": "cubemap",
  "source": {
    "width": 4096,
    "height": 2048
  },
  "tiles": {
    "layout": "custom",
    "format": "webp",
    "tileSize": 512,
    "overlap": 0,
    "indexBase": 1,
    "urlTemplate": "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
    "levels": [
      {
        "width": 512,
        "height": 512,
        "level": 1,
        "columns": 1,
        "rows": 1
      },
      {
        "width": 1024,
        "height": 1024,
        "level": 2,
        "columns": 2,
        "rows": 2
      }
    ],
    "faces": ["f", "r", "b", "l", "u", "d"]
  },
  "previews": [
    {
      "role": "viewer",
      "projection": "cubemap",
      "layout": "vertical-strip",
      "path": "previews/cube-vertical.webp",
      "width": 256,
      "height": 1536,
      "faceOrder": ["l", "f", "r", "b", "u", "d"]
    },
    {
      "path": "previews/200.webp",
      "width": 400,
      "height": 200,
      "role": "image",
      "projection": "equirectangular"
    },
    {
      "path": "previews/400.webp",
      "width": 800,
      "height": 400,
      "role": "image",
      "projection": "equirectangular"
    },
    {
      "path": "previews/800.webp",
      "width": 1600,
      "height": 800,
      "role": "image",
      "projection": "equirectangular"
    }
  ],
  "thumbnail": {
    "path": "previews/200.webp",
    "width": 400,
    "height": 200
  }
}
```

`source` records EXIF-oriented input dimensions. Cube level `width`/`height` describe one face; equirectangular/planar levels describe the complete image at that level. `columns`/`rows` are calculated by dividing by `tileSize` and rounding up, so edge tiles can be partial. Previews with `role: "viewer"` provide the viewer background; `role: "image"` is for ordinary image presentation. `thumbnail` may reference an existing small preview.

The `viewerConfig` returned by that cubemap conversion:

```json
{
  "type": "tile",
  "multires": {
    "tileSize": 512,
    "levels": [512, 1024]
  },
  "urlTemplate": "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
  "previewUrl": "previews/cube-vertical.webp",
  "previewFaceOrder": ["l", "f", "r", "b", "u", "d"]
}
```

For the same input dimensions with `projection: "equirectangular"`, the `viewerConfig` is:

```json
{
  "type": "sphereTile",
  "multires": {
    "tileSize": 512,
    "levels": [
      {
        "width": 512,
        "height": 256
      },
      {
        "width": 1024,
        "height": 512
      },
      {
        "width": 2048,
        "height": 1024
      },
      {
        "width": 4096,
        "height": 2048
      }
    ]
  },
  "urlTemplate": "tiles/%l/%h_%v.webp",
  "previewUrl": "previews/400.webp",
  "indexBase": 1
}
```

The application adds `id` and `baseUrl` before passing `viewerConfig` to `Scenes`. A full manifest is not a scene configuration. Planar output returns `viewerConfig: null`.

Manifest differences for other modes:

| Mode               | Differences from the full example                                                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom sphere      | `projection: "equirectangular"`; no `tiles.faces`; explicit width/height levels, `tiles/%l/%h_%v.webp` and an equirectangular viewer preview.                                                                                     |
| Custom planar      | `projection: "planar"`; no `tiles.faces`; levels describe the planar image; `thumbnail` references its separate thumbnail file.                                                                                                    |
| Standard Deep Zoom | `projection: "planar"`, `tiles.layout: "deepzoom"`, `indexBase: 0`, `tiles.descriptor: "image.dzi"`, template `image_files/%l/%h_%v.jpeg`, and a complete standard pyramid starting at 1×1. PNG/WebP change the extension accordingly. |

## API return values

`convertImage(input, options): Promise<ConversionResult>`

| Field        | Type                 | Meaning                                                                                                   |
| ------------ | -------------------- | --------------------------------------------------------------------------------------------------------- |
| `outputDir`    | string               | Final absolute output directory after successful conversion.                                                  |
| `manifest`     | ConversionManifest   | Full description, matching manifest.json in the output directory.                                         |
| `viewerConfig` | ViewerConfig \| null | Compact panorama viewer props; null for planar images.                                                    |
| `assets`       | OutputAsset[]        | Metadata for generated files, including manifest.json. Concurrent array order is not a business contract. |

`restoreImage(descriptionPath, options): Promise<RestorationResult>`

| Field          | Type                          | Meaning                                                                                             |
| -------------- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| `outputDir`      | string                        | Final absolute reconstruction directory.                                                            |
| `width / height` | number                        | Actual main-image size, determined by the selected level and cubemap outputWidth.                   |
| `projection`     | "equirectangular" \| "planar" | Main-image projection; a cubemap restores to equirectangular, with optional faces listed in assets. |
| `assets`         | OutputAsset[]                 | Main image and optional face files. RestorationResult has no manifest or viewerConfig.              |

### Asset and progress metadata

`assets[]` and `onAsset(asset, signal)` use the same `OutputAsset` fields:

| Field                | Meaning                                                                                       |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `kind`                 | tile, preview, thumbnail, descriptor, manifest, image or cube-face.                           |
| `absolutePath`         | Local absolute path: staging during the callback, final in the successful result.             |
| `relativePath`         | POSIX path relative to the output root, suitable for joining to a cloud key prefix; no host.  |
| `contentType / bytes`  | MIME type and actual encoded byte count.                                                      |
| `width / height`       | Optional actual image dimensions; typically absent on descriptors/manifests.                  |
| `face`                 | Optional f/r/b/l/u/d identifier for cube tiles or exported faces.                             |
| `level / row / column` | Optional stored tile coordinates, following the manifest indexBase rather than array offsets. |

`assets` includes the final manifest, but `onAsset` does not emit `manifest.json`. A shared thumbnail/preview is one file event; organize uploads by `relativePath` and manifest references.

`onProgress` receives `{ stage, completedAssets }`. Stages are `decode / project / tiles / previews / restore / complete`. `completedAssets` counts registered written files, potentially including files with pending application callbacks; it is not an upload-success count or a percentage. A stage notification does not replace awaiting the conversion/restoration promise for final success.

### Manifest helpers

| Method                               | Return value and boundary                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `validateManifest(value, pixelLimit?)` | Accepts unknown and returns a validated ConversionManifest. Default pixel limit is 268402689. Does not read files or verify tile presence. |
| `toViewerConfig(manifest)`             | Extracts ViewerConfig from a known valid manifest; null for planar. Parse and validate external JSON before calling it.                    |

## Reconstruction

`restoreImage(descriptionPath, options)` accepts a local `manifest.json` generated by this package or a complete standard DZI file, reads tiles relative to the description, and defaults to the highest stored level and PNG. It handles partial edge tiles and standard DZI overlap. Remote downloads and legacy converter metadata are caller responsibilities. DTD/entity declarations and sparse DZI pyramids are rejected; paths and symlinks cannot escape the input directory. Missing, corrupt or incorrectly-sized tiles fail explicitly.

Restore-specific options: `level` is the stored number; `format`/`quality` select encoding; cubemap-only `exportCubeFaces` writes six full faces alongside the panorama, and `outputWidth` sets an even 2:1 panorama width (default four times the selected face edge). Outputs are `image.png` for planar or `panorama.png` for panoramas, optionally `faces/{face}.png`. Shared job options/callbacks work on reconstruction too.

Lossless PNG tiling can preserve normalized pixels. Lossy encoding, downsizing, alpha flattening and cubemap reprojection cannot recover discarded original information. Restored dimensions follow the chosen level, not necessarily the original upload. Encoder/FFmpeg dimension limits are checked before reconstruction. Reconstruction uses a full RGBA canvas plus bounded tile decodes; lower the level/pixel limit for limited-memory environments.

## CLI

After a project install, run it with your package manager:

<details name="pano-converter-run" open>
<summary>npm</summary>

```sh
npx pano-convert --help
```

</details>
<details name="pano-converter-run">
<summary>pnpm</summary>

```sh
pnpm exec pano-convert --help
```

</details>
<details name="pano-converter-run">
<summary>yarn</summary>

```sh
yarn pano-convert --help
```

</details>
<details name="pano-converter-run">
<summary>bun</summary>

```sh
bunx pano-convert --help
```

</details>

To use the bare `pano-convert` command below, install it globally:

<details name="pano-converter-global" open>
<summary>npm</summary>

```sh
npm install -g @ericchen1990/pano-converter
```

</details>
<details name="pano-converter-global">
<summary>pnpm</summary>

```sh
pnpm add -g @ericchen1990/pano-converter
```

</details>
<details name="pano-converter-global">
<summary>yarn</summary>

```sh
yarn global add @ericchen1990/pano-converter
```

Yarn Berry has no global install. Use `yarn dlx @ericchen1990/pano-converter`, or `yarn pano-convert` after a project install.

</details>
<details name="pano-converter-global">
<summary>bun</summary>

```sh
bun add -g @ericchen1990/pano-converter
```

</details>

### Usage and prerequisites

```text
pano-convert <image> --output <directory> [options]
pano-convert restore <manifest.json|image.dzi> --output <directory> [options]
```

Each invocation processes one local file. URLs, stdin and directory/batch inputs are not supported; use a shell loop for multiple files with a separate output directory for each. Relative paths resolve from the current working directory. Quote paths containing spaces and tile templates. For a project installation, prefix the examples below with your package manager's runner, such as `pnpm exec pano-convert`.

Use Node.js >=20.19 with Sharp installed for your platform. Cubemap conversion and restoration require an external FFmpeg build containing `v360`. Check it before running:

```sh
node --version
ffmpeg -version
ffmpeg -filters
```

Look for `v360` in the filter list. If FFmpeg is outside `PATH`, use `--ffmpeg-path /absolute/path/to/ffmpeg` or set `FFMPEG_PATH`; the CLI option takes precedence. Equirectangular and planar operations do not need FFmpeg.

Input images must be static, single-frame raster files supported by Sharp. `cubemap` and `equirectangular` both take a complete 2:1 equirectangular panorama (1% input tolerance); `cubemap` generates six tiled faces, while `equirectangular` tiles the panorama without cube projection. Use `planar` for ordinary photographs, scans and other aspect ratios.

`--output` is required for both operations and must be nonexistent or empty. Existing nonempty directories are rejected rather than overwritten. Use a new directory when rerunning a command. Jobs use staging and commit their output after success; the output directory is not an incremental progress feed.

### Conversion examples

```sh
# Default cubemap: WebP tiles, 512px tiles, automatic levels, quality 95.
pano-convert ./room.jpg --output ./output/room

# Preserve equirectangular tiles; no FFmpeg required.
pano-convert ./sphere.jpg --projection equirectangular --output ./output/sphere

# Ordinary image: standard Deep Zoom, JPEG tiles and image.dzi.
pano-convert ./scan.png --projection planar --output ./output/scan

# Cube face size 2048px; store exactly three levels, smallest first.
pano-convert ./room.jpg --face-size 2048 --levels 512,1024,2048 \
  --format jpeg --quality 90 --output ./output/room-custom

# For a 4096x2048 source: explicit equirectangular level dimensions.
pano-convert ./sphere.jpg --projection equirectangular \
  --levels 1024x512,2048x1024,4096x2048 --output ./output/sphere-custom

# For a 4096x2048 planar source: custom levels/paths require --layout custom.
pano-convert ./scan.png --projection planar --layout custom --format png \
  --levels 1024x512,4096x2048 --tile-template 'tiles/%l/%0v_%0h.%e' \
  --output ./output/scan-custom

# Automatic custom pyramid with a different reduction factor; do not add --levels.
pano-convert ./room.jpg --pyramid-downscale 3 --output ./output/room-factor3
```

### Conversion options

These flags are rejected by `restore`.

| Flag | Default and rules |
| --- | --- |
| `--projection <name>` | `cubemap`; also `equirectangular` or `planar`. |
| `--layout <name>` | `custom` for panoramas, `deepzoom` for planar. `deepzoom` is planar only. |
| `--tile-size <pixels>` | Integer 1–8192; default 512. Edge tiles may be smaller. |
| `--levels <list>` | Custom layout only. Comma-separated cube face edges (`512,1024,2048`) or lowercase `widthxheight` pairs (`1024x512,2048x1024`) for other projections. Use 1–64 ascending sizes without duplicates; preserve the source aspect ratio and do not exceed the processed source/face size. Quote the list if adding spaces. |
| `--pyramid-downscale <factor>` | Custom layout only; finite number >1, default 2. Automatically generates levels by dividing and rounding upward. Cannot be combined with `--levels`. |
| `--tile-template <template>` | Custom layout only. Cube default: `tiles/%s/l%l/%v/l%l_%s_%v_%h.%e`; other custom modes: `tiles/%l/%h_%v.%e`. See placeholders below. |
| `--face-size <pixels>` | Cubemap only; even integer 2–12288. Default approximately input width / 4, rounded to an even edge and capped at 12288. Custom cube levels cannot exceed this edge. |

Deep Zoom fixes its levels, scale and tile paths: do not pass `--levels`, `--pyramid-downscale` or `--tile-template`, even with their usual defaults. Choose `--projection planar --layout custom` to customize them. Custom output uses 1-based level/row/column indices; standard Deep Zoom uses 0-based indices. Read the actual layout from `manifest.json`.

Tile templates use relative paths inside the output directory:

| Placeholder | Meaning |
| --- | --- |
| `%s` | Cube face: `f`, `r`, `b`, `l`, `u`, `d`; cubemap only. |
| `%l` | Stored level number, ordered smallest to largest. |
| `%h` / `%v` | Column / row respectively. The default cube filename places row before column. |
| `%e` | Selected encoding extension: `webp`, `jpeg` or `png`. |
| `%0h` / `%00v` | Zero-padded column / row, with minimum widths of 2 / 3 digits. |

The extension must match `--format` (`.jpg` also works for JPEG). Templates must produce unique, safe paths for every tile. For example, keep `%s` for multiple cube faces and `%l` for multiple levels. Quote templates as shown above; in Windows `.bat` files, escape literal `%` as `%%`.

### Restore examples and options

Keep the manifest/DZI and its referenced tiles in their original relative layout. Restore reads local files; it does not download missing tiles. `viewer.json` contains rendering fields and cannot replace `manifest.json` as restore input.

```sh
# Highest stored level; writes panorama.png and six faces/*.png.
pano-convert restore ./output/room/manifest.json \
  --output ./restored/room --export-faces

# Cube only: use stored level 1 and request a 2048x1024 JPEG panorama.
pano-convert restore ./output/room/manifest.json --level 1 \
  --output-width 2048 --format jpeg --quality 90 --output ./restored/room-small

# Restore a standard DZI at its actual stored level 10.
pano-convert restore ./output/scan/image.dzi --level 10 --output ./restored/scan
```

| Flag | Default and rules |
| --- | --- |
| `--level <number>` | Highest stored level by default. This is the actual `tiles.levels[].level`, not an array offset or requested width. DZI uses its standard level numbers; the requested level must exist. |
| `--output-width <pixels>` | Cubemap only. Positive even panorama width; height is half the width. Default 4 × selected face edge. A larger width cannot recover missing detail. |
| `--export-faces` | Cubemap only. Also writes `faces/{f,r,b,l,u,d}.<format>` at the selected level's face size. The panorama is still generated. |

Restored planar images are named `image.<format>`; both cube and equirectangular panoramas are named `panorama.<format>`. Restoration defaults to PNG, regardless of the tile format. Lossy tiles, resizing and cube reprojection cannot recover the original pixels. See [Reconstruction](#reconstruction) for memory and encoder limits.

### Shared options

| Flag | Default and rules |
| --- | --- |
| `-o, --output <directory>` | Required, nonexistent or empty output directory. |
| `--format <name>` | `webp`, `jpeg` or `png`. Default: WebP for custom conversion, JPEG for Deep Zoom conversion, PNG for restore. Use `jpeg`, not `jpg`, as the flag value. |
| `--quality <number>` | Integer 1–100; default 95. Affects JPEG/WebP output, not PNG; generated previews use quality 90. |
| `--ffmpeg-path <path>` | Executable path, with precedence over `FFMPEG_PATH`, then `ffmpeg` on `PATH`. Only cube operations invoke it. |
| `--concurrency <number>` | Integer 1–32; default 4. Bounds active image tasks; it is not a total memory limit. |
| `--timeout <milliseconds>` | Integer 1–2147483647; default 600000 (10 minutes). Sets the job deadline; in-flight native work must settle before cleanup. |
| `--limit-input-pixels <number>` | Positive integer; default 268402689. Also bounds restore canvases. Choose a lower restore level when memory is limited; raising this does not allocate more memory. |
| `--quiet` | Suppresses TTY progress on stderr. Success JSON and errors are still written. |
| `--json-errors` | Writes errors as JSON on stderr with public fields `{name,code,stage,message}`. |
| `-h, --help` | Prints usage, options and examples; no conversion. Also works with `restore --help`. |
| `-v, --version` | Prints the package version; no conversion. |

### Output files and script integration

| Operation | Files inside `--output` |
| --- | --- |
| Cubemap conversion | Face tiles, panorama previews, cube strip preview, `manifest.json`, `viewer.json`. |
| Equirectangular conversion | Panorama tiles, previews, `manifest.json`, `viewer.json`. |
| Planar conversion | Tiles, thumbnail, `manifest.json`; standard Deep Zoom also has `image.dzi` and `image_files/`. No `viewer.json`. |
| Restore | `image.<format>` or `panorama.<format>`, plus cube faces when requested. No new conversion manifest. |

Success writes one JSON result followed by a newline to stdout. Conversion returns `{outputDir, manifest, viewerConfig, assets}`; restore returns `{outputDir, width, height, projection, assets}`. `outputDir` and asset `absolutePath` values are local absolute paths; use `relativePath` and manifest references when copying assets to storage. See [API return values](#api-return-values).

Progress is written to stderr only when it is a TTY. For scripts, use `--quiet --json-errors` and redirect the streams separately. Keep redirected files **outside** the output directory: the shell opens them before the CLI runs, which would otherwise make the output directory nonempty.

```sh
pano-convert ./room.jpg --output ./output/room-script \
  --quiet --json-errors >result.json 2>error.json
status=$?
# Inspect status before parsing result.json; error.json is empty on success.
echo "Exit code: $status"
```

| Exit code | Meaning |
| --- | --- |
| `0` | Success, or help/version printed. |
| `1` | Processing, filesystem, dependency or timeout failure. |
| `2` | Invalid arguments or incompatible options (`INVALID_OPTIONS`). |
| `130` | Cancellation (`ABORTED`). Ctrl+C/SIGINT or SIGTERM requests cancellation; cleanup may wait for active native work. |

Use the error `code` to distinguish failures sharing an exit code. See [Error codes and troubleshooting](#error-codes-and-troubleshooting) for actions such as resolving `OUTPUT_CONFLICT`, missing FFmpeg or missing tiles.

## Error codes and troubleshooting

Branch on the stable `code`, use `stage` to locate the operation, and read `message` for diagnostics. `cause` retains the original error for local debugging. `toJSON()` and CLI `--json-errors` emit only the following public fields, excluding `cause`:

```json
{
  "name": "ConverterError",
  "code": "OUTPUT_CONFLICT",
  "stage": "output",
  "message": "outputDir must not exist or must be an empty directory."
}
```

| Code                         | Meaning and action                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_OPTIONS`            | Invalid options, incompatible mode/settings, dimensions or template. Check the options table; select `layout: "custom"` for custom rules.           |
| `INPUT_NOT_FOUND`            | Input image/description is missing, not a regular file or unreadable. Check paths/permissions; descriptions must be smaller than 8 MiB.             |
| `INVALID_IMAGE`              | Image header cannot be identified/decoded. Check file integrity and codec support; inspect `cause`.                                                 |
| `UNSUPPORTED_IMAGE`          | Unsupported format or animated/multipage input. Convert to a supported single-frame raster image first.                                             |
| `INVALID_PROJECTION`         | Panorama is outside the full 2:1 aspect tolerance. Supply an equirectangular panorama; use `planar` for ordinary images.                            |
| `PIXEL_LIMIT_EXCEEDED`       | Input/reconstruction canvas exceeds the pixel limit. Downsize, select a lower restore level, or explicitly raise the limit within available memory. |
| `SHARP_UNAVAILABLE`          | Sharp or its native binary cannot load. Reinstall for the target OS/CPU/libc with optional dependencies; do not copy node_modules across platforms. |
| `FFMPEG_UNAVAILABLE`         | FFmpeg cannot start. Install an executable with v360 and check ffmpegPath / FFMPEG_PATH.                                                            |
| `FFMPEG_FAILED`              | FFmpeg started but failed. Inspect the exit status and bounded diagnostics in message; check filters and dimensions.                                |
| `OUTPUT_CONFLICT`            | Output is nonempty/locked or generated paths collide. Use a fresh empty directory and a unique tile template.                                       |
| `IO_ERROR`                   | Filesystem, encoding or another processing operation failed. Use stage/cause to check parent paths, permissions, disk space and codec limits.       |
| `CALLBACK_FAILED`            | onAsset/onProgress threw. Check application callback logic, upload credentials and client timeouts.                                                 |
| `ABORTED`                    | The abort signal fired. Treat as cancellation; start a new job if needed.                                                                           |
| `TIMEOUT`                    | Job deadline exceeded. Identify the slow stage and adjust resources/deadline; upload callbacks must still honor cancellation and their own timeout. |
| `INVALID_MANIFEST`           | JSON syntax, schema, grid or preview data is invalid. Validate the original manifest instead of guessing fields.                                    |
| `UNSUPPORTED_SCHEMA_VERSION` | Unsupported schemaVersion. Use a compatible reader; do not bypass validation by editing the version number.                                         |
| `INVALID_DZI`                | Invalid DZI XML or unsupported DTD/entities/sparse structure. Supply a complete regular standard DZI.                                               |
| `LEVEL_NOT_FOUND`            | Requested stored level does not exist. Choose tiles.levels[].level or the actual standard DZI level number.                                         |
| `TILE_MISSING`               | Tile is missing/unreadable or escapes the input directory. Check complete downloads, relative layout, permissions and symlinks.                     |
| `INVALID_TILE`               | Tile is corrupt or has dimensions inconsistent with the grid/overlap. Re-download/regenerate it and check the description.                          |

```ts
import { convertImage, ConverterError } from "@ericchen1990/pano-converter";

try {
  await convertImage("./room.jpg", { outputDir: "./output/room" });
} catch (error) {
  if (error instanceof ConverterError) {
    console.error(error.toJSON());
    // Update application failure/cancellation status and clean this upload prefix by error.code.
  }
  throw error;
}
```

Common integration symptoms:

| Symptom                            | Check first                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Misaligned tiles or frontend 404s  | Use viewerConfig and check row/column order, sphere indexBase and relative cloud layout. Do not pass the full manifest to Scenes.           |
| Missing CMS thumbnail              | Default WebP retains legacy preview paths. Custom paths/formats require CMS to consume thumbnail.path instead of hardcoded legacy paths.    |
| High reconstruction memory         | Choose a lower level or smaller cubemap outputWidth. Concurrency bounds active work, not the full RGBA canvas allocation.                   |
| Job does not finish                | Check that upload callbacks settle; forward the signal and set client timeouts. The library waits for active callbacks before safe cleanup. |
| Reconstruction dimensions rejected | WebP limits each side to 16383, JPEG to 65535, and FFmpeg v360 output to 32767. Select PNG, a lower level or smaller projection dimensions. |
| Shell cannot find the command      | Open the command for your package manager in the command-line section, or install the CLI globally. |

## Existing CMS data

When integrating an existing CMS, retain its reader for legacy resources and store the configuration version, actual URL template, index base, and preview paths for new conversions. The host application maps converter projection types and job results to its own data model. Confirm that the application reads explicit configurations before enabling custom paths or formats, and validate compatibility with real stored assets before rollout. Database migrations and legacy-file rewrites belong to the application; this package handles conversion and reconstruction.

## Development and release

```sh
pnpm --filter @ericchen1990/pano-converter typecheck
pnpm --filter @ericchen1990/pano-converter test
node packages/converter/test/pack-smoke.mjs
```

FFmpeg is required to run cube regression tests; CI sets `PANO_REQUIRE_FFMPEG=1` to disallow skips. Releases use the repository's Changesets flow. MIT licensed; Sharp/libvips retain their own licenses, and external FFmpeg is not distributed by this package.
