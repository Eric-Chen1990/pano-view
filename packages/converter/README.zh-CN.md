# @ericchen1990/pano-converter · [![许可证](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![npm 版本](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-converter.svg?style=flat)](https://www.npmjs.com/package/@ericchen1990/pano-converter) [![Converter](https://github.com/Eric-Chen1990/pano-view/actions/workflows/converter.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/converter.yml) [![欢迎 PR](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Eric-Chen1990/pano-view/pulls)

在 Node.js 或命令行中生成全景/普通大图瓦片，并将本地瓦片还原成图片。云存储上传、数据库、业务 ID 和访问地址由调用方管理。

[English](./README.md)

## 目录

- [pano-view](#pano-view)
- [安装](#安装)
- [Node.js](#nodejs)
- [上传和保存数据](#上传和保存数据)
- [前端使用](#前端使用)
- [配置和输出](#配置和输出)
- [viewer.json 与静态项目](#viewerjson-与静态项目)
- [JSON 清单示例](#json-清单示例)
- [API 返回值](#api-返回值)
- [还原图片](#还原图片)
- [命令行](#命令行)
- [错误码与故障排查](#错误码与故障排查)
- [CMS 新旧资源兼容](#cms-新旧资源兼容)
- [开发与发布](#开发与发布)

## pano-view

[@ericchen1990/pano-view](../react/README.zh-CN.md) 是本仓库中的另一个包，用于渲染 [`convertImage`](#nodejs) 所返回 `viewerConfig` 的 React 查看器。立方体输出对应 `Tile`（`type: "tile"`）；等距圆柱输出对应 `SphereTile`（`type: "sphereTile"`）。把该配置加上应用自己的 `id` 与 `baseUrl` 后传给 `Scenes`。详见[前端使用](#前端使用)。

为 pano-view 生成新的全景资源时，优先使用默认的 `cubemap` 投影。`equirectangular` 适用于需要保留等距圆柱瓦片格式的场景；当前查看器的球面渲染在极点附近仍可能出现可见瑕疵。

## 安装

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

需要 Node.js >=20.19。立方体转换和立方体还原为球面需要外部 FFmpeg，且必须包含 `v360` 滤镜。通过系统包管理器安装；可用 `ffmpegPath` 或 `FFMPEG_PATH` 指定程序路径。球面和平面操作无需 FFmpeg。

Sharp 是运行时依赖，不内联到 JavaScript 构建产物中。包管理器根据安装目标的操作系统、CPU、Linux libc 选择可选原生包。请在部署目标安装依赖，或正确配置跨平台安装；不要将 macOS/Windows 的 `node_modules` 复制到 Linux。glibc 和 musl 需要各自的二进制。详见 [Sharp 安装说明](https://sharp.pixelplumbing.com/install/)。本包不分发 FFmpeg 或原生二进制。

## Node.js

```ts
import { convertImage, restoreImage } from "@ericchen1990/pano-converter";

const result = await convertImage("./room.jpg", {
  projection: "cubemap",
  outputDir: "./output/room",
});

console.log(result.manifest); // 完整归档及还原清单
console.log(result.viewerConfig); // 精简的 pano-view 配置

await restoreImage("./output/room/manifest.json", {
  outputDir: "./restored",
  exportCubeFaces: true,
});
```

也支持 CommonJS：`const { convertImage } = require("@ericchen1990/pano-converter")`。

输入为本地路径或非空 `Buffer`。仅接受当前 Sharp 可解码的单帧栅格图，包括相应构建支持的 JPEG、PNG、WebP、TIFF、AVIF/HEIF、单帧 GIF。自动校正 EXIF 方向、转为 sRGB，并去除 EXIF 等私有元数据。全景必须为完整 2:1 图像，允许输入比例有 1% 误差，处理时规范为精确 2:1。立方体投影将透明区域合成为白色；其他 PNG/WebP 输出保留透明度。

## 上传和保存数据

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

// 所有图片和 DZI 描述文件的回调完成后，才上传清单并更新数据库。
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

`storage`、`db`、ID 和存储前缀均为业务代码示例。`onAsset` 以受限并发执行，库会等待它完成；回调包含瓦片、预览、缩略图、DZI 描述文件和前端 `viewer.json`，不包含最终 `manifest.json`。一个小预览兼作缩略图时，只回调一次。转换成功后再上传完整清单。

回调中的绝对路径指向临时工作目录，仅保证在该次异步回调期间有效；必须等待上传/读取完成再返回，不要删除或修改这些文件。成功返回的 `result.assets` 使用最终绝对路径。标准 Deep Zoom 在原生金字塔完成后逐文件回调；自定义模式在各瓦片编码完成后回调。

回调报错会使任务失败。库不回滚已上传的云文件；请使用独立转换前缀，由业务清理失败上传、更新状态，并在不再需要时删除成功的本地输出。取消或超时会停止调度、终止 FFmpeg，等待活跃原生任务和回调后清理工作目录。上传客户端应使用回调提供的信号及自身超时；永不结束的回调无法由库安全地强制清理。

## 前端使用

数据库保存精简配置，项目接口批量组装：

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

立方体配置为 `type: "tile"`；球面为 `type: "sphereTile"`，明确带有 `indexBase: 1`。普通大图的 `viewerConfig` 为 `null`，应交给平面查看器。渲染由 [@ericchen1990/pano-view](../react/README.zh-CN.md) 完成；本包不抓取或保存业务数据。浏览器无需逐个请求完整清单。两种全景都显式提供实际模板，立方体文件名为先行后列，与 pano-view 的默认模板不同。

## viewer.json 与静态项目

全景转换（CLI 与 Node.js）默认同时输出两份不同用途的 JSON：

| 文件 | 内容与用途 |
| --- | --- |
| `manifest.json` | 完整归档与还原信息，包含源尺寸、瓦片布局和预览引用 |
| `viewer.json` | `{ schemaVersion: 1, ...viewerConfig }`，仅包含前端渲染字段 |

两份文件中的资源引用都是相对路径，不含本地目录、云域名或业务 ID。平面图的 `viewerConfig` 为 `null`，不生成 `viewer.json`。

```sh
pano-convert ./entrance.jpg --output ./public/tour/panoramas/entrance
pano-convert ./hall.jpg --output ./public/tour/panoramas/hall
```

保留输出目录内部结构上传到云存储即可。前端只展示时需要瓦片、预览和 `viewer.json`；还原图片时应另行保留 `manifest.json` 及其引用的资源。`viewer.json` 使用 `descriptor` 类型和 `application/json`，加入 `result.assets` 并通过 `onAsset` 回调，库会等待上传完成；最终归档 `manifest.json` 仍不触发该回调。

```tsx
import { PanoViewer, Scenes, loadSceneFromJson } from "@ericchen1990/pano-view";

const scene = await loadSceneFromJson(
  "https://cdn.example.com/tour/panoramas/entrance/viewer.json",
  { id: "entrance" },
);
// 在应用加载流程完成后渲染：
<PanoViewer style={{ height: 600 }}><Scenes scenes={[scene]} /></PanoViewer>;
```

多个场景和热点由应用编写独立 `project.json`，引用各 `viewer.json`，再用 `loadPanoProject` 和 `ProjectScenes` 展示。项目配置也支持直接内嵌现有 `result.viewerConfig`，无须数据库。清单 API 与资源分离时传 `baseUrl`；重命名资源时提供同步 URL 映射。

完整的项目 JSON、React 加载/取消示例和路径规则见 [viewer 静态项目说明](../react/README.zh-CN.md#静态项目与-json-数据)，跨域、404、签名和媒体问题见 [FAQ](../react/README.zh-CN.md#常见问题与故障排查)。Node.js 服务端可从 `@ericchen1990/pano-view/data` 导入纯数据方法，无须渲染组件。转换器同时返回 `viewerConfig`；完整 `manifest.json` 不直接交给前端加载器。

## 配置和输出

| 参数                            | 默认值或规则                                                           |
| ------------------------------- | ---------------------------------------------------------------------- |
| `projection`                    | `cubemap`，也支持 `equirectangular`、`planar`                          |
| `layout`                        | 全景默认 `custom`，普通大图默认标准 `deepzoom`                         |
| `outputDir`                     | 必填，只允许不存在或空目录；同目录只允许一个任务                       |
| `tileSize`                      | 512，整数 1–8192                                                       |
| `format`                        | 自定义模式默认 WebP，Deep Zoom 默认 JPEG，也支持 PNG                   |
| `quality`                       | 95，范围 1–100，仅 JPEG/WebP 生效；预览质量固定为 90                   |
| `levels`                        | 精确递增的立方体面边长 `number[]`；其他自定义模式为 `{width,height}[]` |
| `pyramidDownscale`              | 2，有限且 >1，与精确 `levels` 互斥                                     |
| `tilePathTemplate`              | 立方体 `tiles/%s/l%l/%v/l%l_%s_%v_%h.%e`；其他模式 `tiles/%l/%h_%v.%e` |
| `faceSize`                      | 偶数面边长，默认约输入宽度 /4，上限 12288，同时受 FFmpeg 尺寸约束      |
| `concurrency`                   | 4，范围 1–32，限制活跃图片任务，不修改全局 Sharp 设置                  |
| `limitInputPixels`              | 268402689，可显式提高，也限制还原画布                                  |
| `timeoutMs`                     | 600000，正整数毫秒                                                     |
| `signal / onAsset / onProgress` | 取消、异步文件回调、同步进度回调                                       |

自定义层级保持投影比例，不超过处理后的源尺寸；编号从 1 开始，无重叠。自动金字塔按 `pyramidDownscale`（默认 2）递减并向上取整，通常到完整图片可放入一块瓦片时停止。球面要求相邻层级的宽高均严格变化，因此高度极小时最小层可能仍跨多块瓦片。最多 64 层、100000 块瓦片。模板支持 `%s` 面、`%l` 层、`%h` 列、`%v` 行、`%e` 扩展名及 `%0h` / `%00v` 补零；扩展名须与格式匹配，JPEG 也接受 `.jpg`。不安全路径、重复路径、大小写冲突和保留名会报错。

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

标准 Deep Zoom 使用原生 `tile({layout:"dz",depth:"onepixel",overlap:0,skipBlanks:-1})`，输出 `image.dzi` 和 `image_files/`，包含空白瓦片的完整网格。此模式不接受自定义层级、比例或模板，需要时请改用 `layout: "custom"`。标准 DZI 使用平面图像布局，不能直接作为 `SphereTile` 的全景配置。

默认 WebP 全景生成预览路径 `previews/200.webp`、`400.webp`、`800.webp`，记录实际尺寸，小图不放大。立方体额外提供 `previews/cube-vertical.webp`，从上到下面顺序为 `l,f,r,b,u,d`。全景的 `thumbnail.path` 直接引用 200 高度预览；普通大图的独立缩略图限制在 400×400 内。选择其他格式后扩展名会改变，应按清单路径读取。

完整清单包含 `schemaVersion: 1`、投影、校正方向后的源尺寸、各级实际尺寸和网格、编码格式、模板、编号起点、预览和缩略图。所有路径为相对 POSIX 路径，不含云地址和本机源文件名。前端优先读取单独的 `viewer.json`。`toViewerConfig(manifest)` 提取精简配置，`validateManifest(unknown)` 校验清单；未知版本明确失败，不猜测旧布局。

## JSON 清单示例

下面是 4096×2048 输入、默认立方体转换的完整 `manifest.json` 示例；没有省略字段，也不包含逐块瓦片地址列表。

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

`source` 是输入经 EXIF 方向校正后的尺寸；立方体 `tiles.levels[].width/height` 是单个面的尺寸，球面或平面模式则是完整图片层级的尺寸。`columns/rows` 按瓦片尺寸向上取整，边缘瓦片可以不足一块。`previews` 的 `role: "viewer"` 指定查看器底图，`role: "image"` 用于普通图片展示；`thumbnail` 可以引用同一张小预览。

同一次立方体转换返回的完整 `viewerConfig`：

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

同尺寸输入改用 `projection: "equirectangular"` 后，完整 `viewerConfig` 为：

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

`viewerConfig` 不含业务 ID 和访问域名，由业务接口添加 `id`、`baseUrl` 后交给 `Scenes`。不要把完整清单直接当作场景配置。普通大图的 `viewerConfig` 为 `null`。

其他模式的清单差异：

| 模式           | 与上述完整清单的差异                                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 球面自定义     | `projection: "equirectangular"`；去掉 `tiles.faces`，使用宽高层级、`tiles/%l/%h_%v.webp` 和球面查看器预览。                                                                                                     |
| 平面自定义     | `projection: "planar"`；去掉 `tiles.faces`，各级宽高按平面图片记录，`thumbnail` 指向独立缩略图。                                                                                                                |
| 标准 Deep Zoom | `projection: "planar"`、`tiles.layout: "deepzoom"`、`indexBase: 0`；增加 `tiles.descriptor: "image.dzi"`，模板为 `image_files/%l/%h_%v.jpeg`，记录从 1×1 开始的完整标准金字塔。选择 PNG/WebP 时扩展名相应改变。 |

## API 返回值

`convertImage(input, options): Promise<ConversionResult>`

| 字段           | 类型                   | 含义                                                                             |
| -------------- | ---------------------- | -------------------------------------------------------------------------------- |
| `outputDir`    | `string`               | 转换成功后的最终绝对输出目录。                                                         |
| `manifest`     | `ConversionManifest`   | 完整清单，与输出目录中的 `manifest.json` 内容一致。                              |
| `viewerConfig` | `ViewerConfig \| null` | 全景的精简查看器参数；普通大图为 `null`。                                        |
| `assets`       | `OutputAsset[]`        | 所有已生成文件的元数据，包含 `manifest.json`。并发产生的数组顺序不作为业务约定。 |

`restoreImage(descriptionPath, options): Promise<RestorationResult>`

| 字段               | 类型                            | 含义                                                                 |
| ------------------ | ------------------------------- | -------------------------------------------------------------------- |
| `outputDir`        | `string`                        | 还原结果的最终绝对目录。                                             |
| `width` / `height` | `number`                        | 实际还原主图尺寸，由所选层级和立方体的 `outputWidth` 决定。          |
| `projection`       | `"equirectangular" \| "planar"` | 主图投影；立方体输入还原后主图为球面，额外导出的六面在 `assets` 中。 |
| `assets`           | `OutputAsset[]`                 | 还原主图和可选六面文件；此返回值没有 `manifest` 或 `viewerConfig`。  |

### 文件与进度元数据

`assets[]` 与 `onAsset(asset, signal)` 使用相同的 `OutputAsset` 字段：

| 字段                       | 含义                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `kind`                     | `tile`、`preview`、`thumbnail`、`descriptor`、`manifest`、`image` 或 `cube-face`。 |
| `absolutePath`             | 本地绝对路径：回调期间为临时文件路径，成功返回后为最终路径。                       |
| `relativePath`             | 相对输出根目录的 POSIX 路径，用于拼接云存储 key；不含域名。                        |
| `contentType` / `bytes`    | MIME 类型和实际编码后字节数。                                                      |
| `width` / `height`         | 可选，图片文件的实际尺寸；描述文件和清单通常没有。                                 |
| `face`                     | 可选，立方体瓦片或导出面的 `f/r/b/l/u/d` 标识。                                    |
| `level` / `row` / `column` | 可选，瓦片文件的实际层级、行、列；编号遵循清单的 `indexBase`，不是数组偏移。           |

注意：`assets` 包含最终清单，但 `onAsset` 不回调 `manifest.json`。共享缩略图与预览只对应一个文件事件，上传逻辑应按 `relativePath` 和清单引用组织。

`onProgress` 提供 `{ stage, completedAssets }`。阶段为 `decode / project / tiles / previews / restore / complete`；`completedAssets` 表示已登记写出的文件数，可以包含仍在等待业务回调的文件，不是上传成功数或进度百分比。阶段通知不替代 `await convertImage(...)` / `await restoreImage(...)` 的最终成功结果。

### 清单辅助方法

| 方法                                   | 返回及边界                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `validateManifest(value, pixelLimit?)` | 接受 `unknown`，校验结构后返回 `ConversionManifest`；默认像素上限为 268402689。不会读取文件或确认瓦片存在。 |
| `toViewerConfig(manifest)`             | 从已知合法的清单提取 `ViewerConfig`，平面为 `null`。外部 JSON 应先经过 `JSON.parse` 和 `validateManifest`。 |

## 还原图片

`restoreImage(descriptionPath, options)` 接受本包生成的本地 `manifest.json` 或完整的标准 DZI 文件，按描述文件所在目录读取瓦片，默认选最高层级并输出 PNG。支持不足一块的边缘瓦片和标准 DZI 重叠裁切。远程下载及旧 converter 参数由调用方处理。拒绝 DTD/实体和稀疏 DZI；路径和符号链接不可逃出输入目录。缺块、损坏或尺寸错误均明确报错。

还原专用参数：`level` 是实际存储层号；`format` / `quality` 控制编码；立方体可用 `exportCubeFaces` 同时导出六个完整面，`outputWidth` 指定偶数的 2:1 全景宽度，默认所选面边长的四倍。输出为普通大图 `image.png` 或全景 `panorama.png`，可额外生成 `faces/{face}.png`。共享任务参数和回调同样适用。

PNG 无损切图可以保留规范化后的像素。有损编码、缩放、透明合成和立方体重投影不能恢复已丢失的信息；输出尺寸依所选层级决定，不保证与原始上传文件一致。编码器和 FFmpeg 的尺寸上限会预检。还原需要完整 RGBA 画布，瓦片解码并发受限；内存紧张时应选择较低层级或像素上限。

## 命令行

在项目中安装后，用你的包管理器运行：

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

如果需要直接运行下面的命令，先全局安装：

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

Yarn Berry 没有全局安装。请用 `yarn dlx @ericchen1990/pano-converter`，或在项目内运行 `yarn pano-convert`。

</details>
<details name="pano-converter-global">
<summary>bun</summary>

```sh
bun add -g @ericchen1990/pano-converter
```

</details>

### 用法与运行条件

```text
pano-convert <image> --output <directory> [options]
pano-convert restore <manifest.json|image.dzi> --output <directory> [options]
```

每次命令处理一个本地文件，不接受 URL、stdin 或目录批量输入。批量处理时由 Shell 循环调用，并为每个文件使用独立输出目录。相对路径以当前工作目录为基准；含空格的路径与瓦片模板需要加引号。项目内安装时，将下文的 `pano-convert` 换成对应包管理器的运行命令，例如 `pnpm exec pano-convert`。

需要 Node.js >=20.19，以及匹配当前平台的 Sharp。立方体转换和立方体还原还需要外部 FFmpeg，且必须带 `v360` 滤镜。运行前可检查：

```sh
node --version
ffmpeg -version
ffmpeg -filters
```

确认滤镜列表包含 `v360`。FFmpeg 不在 `PATH` 时，传入 `--ffmpeg-path /absolute/path/to/ffmpeg` 或设置 `FFMPEG_PATH`；命令行参数优先。等距圆柱和平面操作不使用 FFmpeg。

输入必须是 Sharp 支持的静态单帧栅格图片。`cubemap` 和 `equirectangular` 都接收完整的 2:1 等距圆柱全景图（输入比例容差 1%）：前者投影为六个面再切图，后者直接对全景图切图。普通照片、扫描图及其他比例图片使用 `planar`。

两种操作都必须指定 `--output`，且目录必须不存在或为空；非空目录会报错，不会覆盖。重新运行时请换用新目录。任务在临时目录处理，成功后再提交完整输出；不要通过目标目录中的文件数判断实时进度。

### 转换示例

```sh
# 默认立方体：WebP、512px 瓦片、自动层级、质量 95。
pano-convert ./room.jpg --output ./output/room

# 保持等距圆柱瓦片，不需要 FFmpeg。
pano-convert ./sphere.jpg --projection equirectangular --output ./output/sphere

# 普通图片：标准 Deep Zoom，输出 JPEG 瓦片和 image.dzi。
pano-convert ./scan.png --projection planar --output ./output/scan

# 立方体面边长 2048px；仅存储三个层级，尺寸从小到大。
pano-convert ./room.jpg --face-size 2048 --levels 512,1024,2048 \
  --format jpeg --quality 90 --output ./output/room-custom

# 假设源图为 4096x2048：明确指定等距圆柱的各层宽高。
pano-convert ./sphere.jpg --projection equirectangular \
  --levels 1024x512,2048x1024,4096x2048 --output ./output/sphere-custom

# 假设平面源图为 4096x2048：自定义层级与路径时必须选 --layout custom。
pano-convert ./scan.png --projection planar --layout custom --format png \
  --levels 1024x512,4096x2048 --tile-template 'tiles/%l/%0v_%0h.%e' \
  --output ./output/scan-custom

# 调整自动金字塔的缩小倍率，不要同时传 --levels。
pano-convert ./room.jpg --pyramid-downscale 3 --output ./output/room-factor3
```

### 转换专用参数

`restore` 不接受下列参数。

| 参数 | 默认值与规则 |
| --- | --- |
| `--projection <name>` | 默认 `cubemap`；可选 `equirectangular`、`planar`。 |
| `--layout <name>` | 全景默认 `custom`，平面默认 `deepzoom`；仅平面支持 `deepzoom`。 |
| `--tile-size <pixels>` | 整数 1–8192，默认 512；边缘瓦片可小于此尺寸。 |
| `--levels <list>` | 仅限 custom。逗号分隔的立方体面边长（`512,1024,2048`），或其他投影的宽高对（`1024x512,2048x1024`，使用小写 `x`）。共 1–64 层，尺寸升序、不可重复，保持源图比例，不得超过处理后的源图或立方体面尺寸。列表含空格时需加引号。 |
| `--pyramid-downscale <factor>` | 仅限 custom；有限数值且 >1，默认 2。逐层相除并向上取整，自动生成金字塔。与 `--levels` 互斥。 |
| `--tile-template <template>` | 仅限 custom。立方体默认 `tiles/%s/l%l/%v/l%l_%s_%v_%h.%e`；其他 custom 模式默认 `tiles/%l/%h_%v.%e`。占位符见下表。 |
| `--face-size <pixels>` | 仅限 cubemap；2–12288 的偶数整数。默认约为输入宽度的 1/4，取偶数并限制在 12288 内；自定义立方体层级不能超过此边长。 |

Deep Zoom 固定层级、缩小倍率和瓦片路径，不允许传入 `--levels`、`--pyramid-downscale` 或 `--tile-template`，即使传入的是常用默认值。需要自定义时使用 `--projection planar --layout custom`。Custom 的层、行、列从 1 开始；标准 Deep Zoom 从 0 开始。以 `manifest.json` 记录的实际布局为准。

瓦片模板必须是输出目录内的相对路径：

| 占位符 | 含义 |
| --- | --- |
| `%s` | 立方体面：`f`、`r`、`b`、`l`、`u`、`d`，仅限 cubemap。 |
| `%l` | 实际存储层号，按尺寸从小到大编号。 |
| `%h` / `%v` | 分别为列号 / 行号；立方体默认文件名先行后列。 |
| `%e` | 所选编码扩展名：`webp`、`jpeg` 或 `png`。 |
| `%0h` / `%00v` | 列号 / 行号补前导零，最少分别为 2 / 3 位。 |

扩展名必须匹配 `--format`（JPEG 也支持 `.jpg`）。每块瓦片必须对应唯一且安全的路径，例如多个立方体面需要保留 `%s`，多个层级需要保留 `%l`。模板请按示例加引号；Windows `.bat` 文件中的字面量 `%` 需要写成 `%%`。

### 还原示例与专用参数

保留清单或 DZI 及其引用瓦片的相对目录结构。还原只读取本地文件，不会下载缺失瓦片。`viewer.json` 仅含渲染字段，不能替代 `manifest.json` 作为还原输入。

```sh
# 默认最高存储层级，输出 panorama.png 和六张 faces/*.png。
pano-convert restore ./output/room/manifest.json \
  --output ./restored/room --export-faces

# 仅立方体：选择实际层号 1，输出 2048x1024 的 JPEG 全景图。
pano-convert restore ./output/room/manifest.json --level 1 \
  --output-width 2048 --format jpeg --quality 90 --output ./restored/room-small

# 标准 DZI：选择实际存储层号 10。
pano-convert restore ./output/scan/image.dzi --level 10 --output ./restored/scan
```

| 参数 | 默认值与规则 |
| --- | --- |
| `--level <number>` | 默认最高存储层级；填写实际的 `tiles.levels[].level`，不是数组偏移或目标宽度。DZI 使用标准层号，指定层级必须存在。 |
| `--output-width <pixels>` | 仅限 cubemap；正偶数全景宽度，高度为宽度的一半。默认是所选面边长的 4 倍；提高宽度无法恢复缺失细节。 |
| `--export-faces` | 仅限 cubemap；额外输出 `faces/{f,r,b,l,u,d}.<format>`，尺寸为所选层级的面尺寸，仍然会生成全景图。 |

平面还原文件名为 `image.<format>`；立方体及等距圆柱全景还原为 `panorama.<format>`。默认 PNG，不受原瓦片格式影响。有损瓦片、缩放和立方体重投影无法还原原始像素；内存与编码器限制见[还原图片](#还原图片)。

### 通用参数

| 参数 | 默认值与规则 |
| --- | --- |
| `-o, --output <directory>` | 必填；目录必须不存在或为空。 |
| `--format <name>` | 可选 `webp`、`jpeg`、`png`。Custom 转换默认 WebP，Deep Zoom 转换默认 JPEG，还原默认 PNG。参数值使用 `jpeg`，不是 `jpg`。 |
| `--quality <number>` | 整数 1–100，默认 95；影响 JPEG/WebP，不影响 PNG；生成的预览图使用质量 90。 |
| `--ffmpeg-path <path>` | 可执行程序路径，优先于 `FFMPEG_PATH`，最后使用 `PATH` 中的 `ffmpeg`；仅立方体操作调用。 |
| `--concurrency <number>` | 整数 1–32，默认 4；限制活跃图片任务数，不是总内存上限。 |
| `--timeout <milliseconds>` | 整数 1–2147483647，默认 600000（10 分钟）；设置任务期限，清理仍需等待已开始的原生工作结束。 |
| `--limit-input-pixels <number>` | 正整数，默认 268402689，也约束还原画布。内存不足时优先选择较低还原层级；提高此值不会增加可用内存。 |
| `--quiet` | 关闭 stderr 的 TTY 进度；仍输出成功 JSON 和错误。 |
| `--json-errors` | 在 stderr 输出错误 JSON，公开字段为 `{name,code,stage,message}`。 |
| `-h, --help` | 显示用法、参数和示例，不执行转换；也支持 `restore --help`。 |
| `-v, --version` | 显示包版本，不执行转换。 |

### 输出文件与脚本调用

| 操作 | `--output` 内的文件 |
| --- | --- |
| 立方体转换 | 六面瓦片、全景预览、立方体条带预览、`manifest.json`、`viewer.json`。 |
| 等距圆柱转换 | 全景瓦片、预览、`manifest.json`、`viewer.json`。 |
| 平面转换 | 瓦片、缩略图、`manifest.json`；标准 Deep Zoom 另有 `image.dzi` 和 `image_files/`。不生成 `viewer.json`。 |
| 还原 | `image.<format>` 或 `panorama.<format>`，以及按需导出的立方体面；不生成新的转换清单。 |

成功时 stdout 输出一份结果 JSON，末尾带换行。转换返回 `{outputDir, manifest, viewerConfig, assets}`；还原返回 `{outputDir, width, height, projection, assets}`。`outputDir` 和资源的 `absolutePath` 是本地绝对路径；复制到存储时使用 `relativePath` 和清单引用。字段详解见 [API 返回值](#api-返回值)。

仅当 stderr 为 TTY 时才写入进度。脚本中可使用 `--quiet --json-errors` 分别重定向两个流。重定向文件应放在**输出目录之外**：Shell 会在命令开始前创建文件，放在输出目录内会导致目录非空而被拒绝。

```sh
pano-convert ./room.jpg --output ./output/room-script \
  --quiet --json-errors >result.json 2>error.json
status=$?
# 先检查退出码，再解析 result.json；成功时 error.json 为空。
echo "Exit code: $status"
```

| 退出码 | 含义 |
| --- | --- |
| `0` | 成功，或已显示帮助/版本。 |
| `1` | 处理、文件系统、依赖或超时错误。 |
| `2` | 参数不合法或组合不兼容（`INVALID_OPTIONS`）。 |
| `130` | 取消（`ABORTED`）。Ctrl+C/SIGINT 或 SIGTERM 请求取消，清理可能需要等待活跃原生工作结束。 |

同一退出码下通过错误 `code` 区分原因。`OUTPUT_CONFLICT`、FFmpeg 缺失和瓦片缺失等处理方式见[错误码与故障排查](#错误码与故障排查)。

## 错误码与故障排查

根据稳定的 `code` 分支处理错误，`stage` 定位处理阶段，`message` 提供可读诊断。`cause` 保留原始错误供本地排查；`toJSON()` 和 CLI 的 `--json-errors` 只输出下列公开字段，不序列化原始 `cause`：

```json
{
  "name": "ConverterError",
  "code": "OUTPUT_CONFLICT",
  "stage": "output",
  "message": "outputDir must not exist or must be an empty directory."
}
```

| 错误码                       | 含义与处理方式                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| `INVALID_OPTIONS`            | 参数、模式组合、尺寸或模板不合法；按参数表修正，自定义规则使用 `layout: "custom"`。                    |
| `INPUT_NOT_FOUND`            | 输入图片或描述文件不存在、不是普通文件或无法读取；检查路径和权限，描述文件需小于 8 MiB。               |
| `INVALID_IMAGE`              | 无法识别或解码图片头；检查文件是否完整、格式是否可解码，并查看 `cause`。                               |
| `UNSUPPORTED_IMAGE`          | 格式不受支持，或输入为动画/多页图片；先转换为支持的单帧栅格图。                                        |
| `INVALID_PROJECTION`         | 全景输入不满足完整 2:1 比例及容差；使用正确的等距圆柱全景，普通图片选择 `planar`。                     |
| `PIXEL_LIMIT_EXCEEDED`       | 输入或还原画布超过像素上限；缩小输入、选择较低还原层级，或按可用内存显式提高上限。                     |
| `SHARP_UNAVAILABLE`          | Sharp 包或原生二进制无法加载；在目标 OS/CPU/libc 安装依赖并保留可选依赖，不跨系统复制 `node_modules`。 |
| `FFMPEG_UNAVAILABLE`         | 无法启动 FFmpeg；安装带 `v360` 的可执行程序并检查 `ffmpegPath` / `FFMPEG_PATH`。                       |
| `FFMPEG_FAILED`              | FFmpeg 已启动但转换失败；读取 `message` 中的退出状态和有限长度诊断，检查滤镜及尺寸。                   |
| `OUTPUT_CONFLICT`            | 目录非空、被其他任务占用，或输出路径冲突；使用新的空目录并确保模板能唯一定位瓦片。                     |
| `IO_ERROR`                   | 文件系统、编码或其他处理失败；结合 `stage` 和 `cause` 检查父路径、权限、磁盘空间及编码器限制。         |
| `CALLBACK_FAILED`            | `onAsset` 或 `onProgress` 抛出异常；检查业务回调、上传凭据和上传客户端超时。                           |
| `ABORTED`                    | 取消信号已触发；按业务取消状态处理，需要继续时创建新任务。                                             |
| `TIMEOUT`                    | 任务超过 `timeoutMs`；定位耗时阶段，调整资源或期限；上传回调仍需自身响应取消及超时。                   |
| `INVALID_MANIFEST`           | JSON 语法或结构、网格、预览等信息不合法；保留原始清单，校验后再消费，不手工猜测字段。                  |
| `UNSUPPORTED_SCHEMA_VERSION` | 当前库不支持该 `schemaVersion`；使用兼容版本读取，不手工改版本号绕过校验。                             |
| `INVALID_DZI`                | DZI XML 不合法，或含不支持的 DTD/实体、稀疏结构；提供完整规则的标准 DZI。                              |
| `LEVEL_NOT_FOUND`            | 指定层号不存在；从 `tiles.levels[].level` 选择实际层号，标准 DZI 使用其真实编号。                      |
| `TILE_MISSING`               | 瓦片缺失、不可读取或路径逃出输入目录；检查完整下载、相对布局、权限和符号链接。                         |
| `INVALID_TILE`               | 瓦片损坏或尺寸与网格/重叠参数不符；重新获取或生成正确瓦片，核对描述文件。                              |

```ts
import { convertImage, ConverterError } from "@ericchen1990/pano-converter";

try {
  await convertImage("./room.jpg", { outputDir: "./output/room" });
} catch (error) {
  if (error instanceof ConverterError) {
    console.error(error.toJSON());
    // 由业务代码按 error.code 更新失败/取消状态，并清理本次上传前缀。
  }
  throw error;
}
```

常见接入问题：

| 现象                   | 优先检查                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| 前端瓦片错位、请求 404 | 使用返回的 `viewerConfig`，核对模板的行列顺序、等距圆柱瓦片的 `indexBase` 和云端相对目录；完整 `manifest.json` 不直接传给 `Scenes`。 |
| CMS 缩略图缺失         | 默认 WebP 保留旧预览路径；自定义格式或路径需要 CMS 读取新的 `thumbnail.path`，应避免硬编码旧路径。              |
| 还原内存占用高         | 选择较低 `level`；立方体可减小 `outputWidth`。并发数只限制正在处理的任务，不能消除完整 RGBA 画布的内存。              |
| 任务长时间不结束       | 检查上传回调是否真正结束，并为上传客户端传递信号和设置超时；库需要等待活跃回调后才能安全清理。                  |
| 还原目标尺寸被拒绝     | WebP 每边上限 16383，JPEG 为 65535，FFmpeg v360 输出每边为 32767；选择 PNG、较低层级或更小的投影尺寸。          |
| Shell 找不到命令       | 在命令行章节展开你的包管理器对应的命令，或全局安装。 |

## CMS 新旧资源兼容

接入已有 CMS 时，保留旧资源的读取适配，并保存新转换结果的配置版本、实际模板、编号起点和预览路径。宿主应用负责将转换器的投影类型和任务结果映射到自身的数据模型。先确认应用能读取新配置，再启用自定义路径或格式；上线前应使用真实存量资源验证兼容性。数据库迁移和旧文件重写由应用管理，本库仅负责转换与还原。

## 开发与发布

```sh
pnpm --filter @ericchen1990/pano-converter typecheck
pnpm --filter @ericchen1990/pano-converter test
node packages/converter/test/pack-smoke.mjs
```

立方体回归测试需要 FFmpeg；CI 设置 `PANO_REQUIRE_FFMPEG=1`，缺依赖时不允许跳过。发布遵循仓库 Changesets 流程。MIT 许可；Sharp/libvips 保留其自身许可，外部 FFmpeg 不随本包分发。
