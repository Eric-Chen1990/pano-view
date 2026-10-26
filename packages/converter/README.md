# @ericchen1990/pano-converter

Generate panorama/image tile pyramids and reconstruct local tiles in Node.js or the CLI. Cloud uploads, database writes, IDs, and URLs belong to your application.

[中文说明](./README.zh-CN.md)

## Install

```sh
pnpm add @ericchen1990/pano-converter
```

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

`storage`, `db`, IDs and paths above are application-owned examples. `onAsset` is awaited with bounded concurrency and includes tiles, previews, thumbnails and DZI descriptors. It excludes `manifest.json`: upload the final manifest after conversion succeeds. The same small preview can serve as the thumbnail and is emitted once. Callback paths refer to job staging files and are valid during the awaited callback; return only after reading/uploading finishes. After success, `result.assets` contains final absolute paths. Do not delete or mutate callback files. Native Deep Zoom emits file callbacks after the native pyramid completes; custom output emits each tile after its encode.

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

Cubemaps produce `type: "tile"`; equirectangular output produces `type: "sphereTile"`, including explicit `indexBase: 1`. Planar images return `viewerConfig: null` and need a planar viewer. The converter does not require React/pano-view or fetch/store business data. The browser need not request every full manifest. Both configs use explicit URL templates; cube filenames are row-before-column, differing from pano-view's default template.

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

Custom levels do not upscale beyond processed source dimensions, use 1-based indices, zero overlap, and preserve the source aspect ratio. Automatic pyramids halve dimensions with upward rounding until the image fits one tile. Output is limited to 64 levels and 100000 tiles. Path placeholders support `%s`, `%l`, `%h`, `%v`, `%e` and `%0h`/`%00v` padding. Extensions must match the selected format; JPEG also accepts `.jpg`. Unsafe, duplicate, case-colliding and reserved output paths fail explicitly.

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

Standard Deep Zoom uses Sharp's `tile({layout:"dz",depth:"onepixel",overlap:0,skipBlanks:-1})`, writes `image.dzi`/`image_files/`, and retains the complete grid including blank tiles. It rejects custom levels, scale factors and templates; select `layout: "custom"` for those. Native Deep Zoom output is not a custom full-panorama pyramid.

Default WebP panorama previews retain `previews/200.webp`, `400.webp`, `800.webp`; their actual dimensions are recorded and small sources are not enlarged. Cubemap previews additionally include `previews/cube-vertical.webp` with top-to-bottom order `l,f,r,b,u,d`. Panorama `thumbnail.path` references the 200-height preview. Planar thumbnails fit within 400×400. Choosing another format changes extensions and requires consuming the recorded paths.

The full manifest includes `schemaVersion: 1`, projection, EXIF-oriented source dimensions, actual level sizes/grids, encoding format, template, index base, previews and thumbnail. Paths are relative POSIX paths, with no cloud hosts or local source filenames. `toViewerConfig(manifest)` derives the compact viewer DTO; `validateManifest(unknown)` validates supported JSON before use. Unknown schema versions fail rather than falling back to guessed layouts.

## Reconstruction

`restoreImage(descriptionPath, options)` accepts local new-converter JSON or a complete standard DZI, reads tiles relative to the description, and defaults to the highest stored level and PNG. It handles partial edge tiles and standard DZI overlap. Remote downloads and legacy converter metadata are caller responsibilities. DTD/entity declarations and sparse DZI pyramids are rejected; paths and symlinks cannot escape the input directory. Missing, corrupt or incorrectly-sized tiles fail explicitly.

Restore-specific options: `level` is the stored number; `format`/`quality` select encoding; cubemap-only `exportCubeFaces` writes six full faces alongside the panorama, and `outputWidth` sets an even 2:1 panorama width (default four times the selected face edge). Outputs are `image.png` for planar or `panorama.png` for panoramas, optionally `faces/{face}.png`. Shared job options/callbacks work on reconstruction too.

Lossless PNG tiling can preserve normalized pixels. Lossy encoding, downsizing, alpha flattening and cubemap reprojection cannot recover discarded original information. Restored dimensions follow the chosen level, not necessarily the original upload. Encoder/FFmpeg dimension limits are checked before reconstruction. Reconstruction uses a full RGBA canvas plus bounded tile decodes; lower the level/pixel limit for limited-memory environments.

## CLI

After a local install, use `pnpm exec pano-convert`. To use the bare command below, install globally with `pnpm add -g @ericchen1990/pano-converter`.

```sh
pano-convert room.jpg --projection cubemap --output ./room
pano-convert sphere.jpg --projection equirectangular --output ./sphere
pano-convert scan.png --projection planar --output ./scan
pano-convert room.jpg --levels 512,1024,2048 --output ./custom
pano-convert restore ./room/manifest.json --output ./restored --export-faces
pano-convert restore ./scan/image.dzi --output ./scan-restored --level 10
pano-convert --help
```

Success prints the result JSON to stdout. TTY progress is on stderr; `--quiet` disables progress. `--json-errors` serializes `{name,code,stage,message}` to stderr. Exit codes: 0 success, 1 processing/dependency failure, 2 invalid arguments, 130 cancellation. Errors are `ConverterError` instances with stable `code`, `stage`, readable `message` and an internal `cause`.

## Existing CMS data

The target integration is Learnmersive CMS's `refactor/replace-krpano` branch. Existing records continue through its legacy field adapter; new configurations should use a nullable, versioned record with explicit template/index/preview paths. CMS maps generic `equirectangular` to its existing `equirect` value and uses `completed` status. Enable custom paths/formats only after CMS reads the explicit configuration. The package does not migrate databases, rewrite old resources, or add a krpano renderer. Real stored resources still require integration acceptance before rollout.

## Development and release

```sh
pnpm --filter @ericchen1990/pano-converter typecheck
pnpm --filter @ericchen1990/pano-converter test
node packages/converter/test/pack-smoke.mjs
```

FFmpeg is required to run cube regression tests; CI sets `PANO_REQUIRE_FFMPEG=1` to disallow skips. Releases use the repository's Changesets flow. MIT licensed; Sharp/libvips retain their own licenses, and external FFmpeg is not distributed by this package.
