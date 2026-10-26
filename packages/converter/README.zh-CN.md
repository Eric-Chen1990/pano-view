# @ericchen1990/pano-converter

在 Node.js 或命令行中生成全景/普通大图瓦片，并将本地瓦片还原成图片。云存储上传、数据库、业务 ID 和访问地址由调用方管理。

[English](./README.md)

## 安装

```sh
pnpm add @ericchen1990/pano-converter
```

需要 Node.js >=20.19。立方体转换和立方体还原为球面需要外部 FFmpeg，且必须包含 `v360` 滤镜。通过系统包管理器安装；可用 `ffmpegPath` 或 `FFMPEG_PATH` 指定程序路径。球面和平面操作无需 FFmpeg。

Sharp 是运行时依赖，不打进 JS bundle。包管理器根据安装目标的操作系统、CPU、Linux libc 选择可选原生包。请在部署目标安装依赖，或正确配置跨平台安装；不要将 macOS/Windows 的 `node_modules` 复制到 Linux。glibc 和 musl 需要各自的二进制。详见 [Sharp 安装说明](https://sharp.pixelplumbing.com/install/)。本包不分发 FFmpeg 或原生二进制。

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

`storage`、`db`、ID 和存储前缀均为业务代码示例。`onAsset` 以受限并发执行，库会等待它完成；回调包含瓦片、预览、缩略图、DZI 描述文件，不包含最终 `manifest.json`。一个小预览兼作缩略图时，只回调一次。转换成功后再上传完整清单。

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

立方体配置为 `type: "tile"`；球面为 `type: "sphereTile"`，明确带有 `indexBase: 1`。普通大图的 `viewerConfig` 为 `null`，应交给平面查看器。转换库不依赖 React/pano-view，不抓取或保存业务数据；浏览器无需逐个请求完整清单。两种全景都显式提供实际模板，立方体文件名为先行后列，与 pano-view 的默认模板不同。

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

自定义层级保持投影比例，不超过处理后的源尺寸；编号从 1 开始，无重叠。自动金字塔每次除以 2 向上取整，直至完整图片可放入一块瓦片。最多 64 层、100000 块瓦片。模板支持 `%s` 面、`%l` 层、`%h` 列、`%v` 行、`%e` 扩展名及 `%0h` / `%00v` 补零；扩展名须与格式匹配，JPEG 也接受 `.jpg`。不安全路径、重复路径、大小写冲突和保留名会报错。

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

标准 Deep Zoom 使用原生 `tile({layout:"dz",depth:"onepixel",overlap:0,skipBlanks:-1})`，输出 `image.dzi` 和 `image_files/`，包含空白瓦片的完整网格。此模式不接受自定义层级、比例或模板，需要时请改用 `layout: "custom"`。普通大图的标准 DZI 不等同于完整球面瓦片。

默认 WebP 全景保留 CMS 路径 `previews/200.webp`、`400.webp`、`800.webp`，记录实际尺寸，小图不放大。立方体额外提供 `previews/cube-vertical.webp`，从上到下面顺序为 `l,f,r,b,u,d`。全景的 `thumbnail.path` 直接引用 200 高度预览；普通大图的独立缩略图限制在 400×400 内。选择其他格式后扩展名会改变，应按清单路径读取。

完整清单包含 `schemaVersion: 1`、投影、校正方向后的源尺寸、各级实际尺寸和网格、编码格式、模板、编号起点、预览和缩略图。所有路径为相对 POSIX 路径，不含云地址和本机源文件名。`toViewerConfig(manifest)` 提取精简配置，`validateManifest(unknown)` 校验新清单；未知版本明确失败，不猜测旧布局。

## 还原图片

`restoreImage(descriptionPath, options)` 接受新库 JSON 或本地完整标准 DZI，按描述文件所在目录读取瓦片，默认选最高层级并输出 PNG。支持不足一块的边缘瓦片和标准 DZI 重叠裁切。远程下载及旧 converter 参数由调用方处理。拒绝 DTD/实体和稀疏 DZI；路径和符号链接不可逃出输入目录。缺块、损坏或尺寸错误均明确报错。

还原专用参数：`level` 是实际存储层号；`format` / `quality` 控制编码；立方体可用 `exportCubeFaces` 同时导出六个完整面，`outputWidth` 指定偶数的 2:1 全景宽度，默认所选面边长的四倍。输出为普通大图 `image.png` 或全景 `panorama.png`，可额外生成 `faces/{face}.png`。共享任务参数和回调同样适用。

PNG 无损切图可以保留规范化后的像素。有损编码、缩放、透明合成和立方体重投影不能恢复已丢失的信息；输出尺寸依所选层级决定，不保证与原始上传文件一致。编码器和 FFmpeg 的尺寸上限会预检。还原需要完整 RGBA 画布，瓦片解码并发受限；内存紧张时应选择较低层级或像素上限。

## 命令行

在项目中安装后使用 `pnpm exec pano-convert`。如果需要直接运行下面的命令，先通过 `pnpm add -g @ericchen1990/pano-converter` 全局安装。

```sh
pano-convert room.jpg --projection cubemap --output ./room
pano-convert sphere.jpg --projection equirectangular --output ./sphere
pano-convert scan.png --projection planar --output ./scan
pano-convert room.jpg --levels 512,1024,2048 --output ./custom
pano-convert restore ./room/manifest.json --output ./restored --export-faces
pano-convert restore ./scan/image.dzi --output ./scan-restored --level 10
pano-convert --help
```

成功时 stdout 输出结果 JSON；TTY 进度写入 stderr，`--quiet` 关闭进度。`--json-errors` 将 `{name,code,stage,message}` 写入 stderr。退出码：0 成功、1 处理或依赖错误、2 参数错误、130 取消。错误类型为 `ConverterError`，包含稳定 `code`、阶段、可读信息和内部原始 `cause`。

## CMS 新旧资源兼容

接入目标是 Learnmersive CMS 的 `refactor/replace-krpano` 分支。旧记录继续走原字段适配；新配置采用可空、带版本的记录，明确提供模板、编号、预览路径。CMS 将通用 `equirectangular` 映射为已有 `equirect`，完成状态使用 `completed`。必须先让 CMS 读取新配置，再启用自定义路径或格式。本库不执行数据库迁移、不重写旧文件、不增加 krpano 渲染器；上线前仍需真实存量资源验收。

## 开发与发布

```sh
pnpm --filter @ericchen1990/pano-converter typecheck
pnpm --filter @ericchen1990/pano-converter test
node packages/converter/test/pack-smoke.mjs
```

立方体回归测试需要 FFmpeg；CI 设置 `PANO_REQUIRE_FFMPEG=1`，缺依赖时不允许跳过。发布遵循仓库 Changesets 流程。MIT 许可；Sharp/libvips 保留其自身许可，外部 FFmpeg 不随本包分发。
