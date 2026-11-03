# @ericchen1990/pano-view · [![许可证](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![npm 版本](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-view.svg?style=flat)](https://www.npmjs.com/package/@ericchen1990/pano-view) [![CI](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml) [![欢迎 PR](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Eric-Chen1990/pano-view/pulls)

[English](./README.md) | **简体中文**

用于等距圆柱（equirectangular）与 krpano 风格多分辨率全景查看器的可组合 React 组件。

在[在线 playground](https://pano-view-playground.vercel.app/?utm_source=github&utm_medium=readme&utm_campaign=package-readme&utm_content=playground) 中试用这些组件。

## 目录

- [pano-converter](#pano-converter)
- [数据来源与选型](#数据来源与选型)
- [静态项目与 JSON 数据](#静态项目与-json-数据)
- [平面图地图](#平面图地图)
- [常见问题与故障排查](#常见问题与故障排查)
- [兼容 krpano 的瓦片输出](#兼容-krpano-的瓦片输出)
- [安装](#安装)
- [示例](#示例)
- [导出组件](#导出组件)
- [PanoViewer](#panoviewer)
- [DOM Overlay 与弹窗](#dom-overlay-与弹窗)
- [Sphere](#sphere)
- [PanoVideo](#panovideo)
- [Tile](#tile)
- [Scenes](#scenes)
- [PanoSceneMenu](#panoscenemenu)
- [PanoFilter](#panofilter)
- [AutoRotate](#autorotate)
- [BackgroundAudio](#backgroundaudio)
- [Gyro](#gyro)
- [WebVR](#webvr)
- [鼠标、触控与键盘控件](#鼠标触控与键盘控件)
- [全景坐标事件](#全景坐标事件)
- [PanoEvents](#panoevents)
- [PanoContextMenu](#panocontextmenu)
- [共享热点约定与可序列化定义](#共享热点约定与可序列化定义)
- [ImageHotspot](#imagehotspot)
- [GraphicHotspot](#graphichotspot)
- [热点模式与缩放行为](#热点模式与缩放行为)
- [PolygonHotspot](#polygonhotspot)
- [PolylineHotspot](#polylinehotspot)
- [SequenceHotspot](#sequencehotspot)
- [VideoHotspot](#videohotspot)
- [AudioHotspot](#audiohotspot)
- [TextHotspot](#texthotspot)
- [IframeHotspot](#iframehotspot)
- [Next.js 与 SSR](#nextjs-与-ssr)
- [球面多分辨率瓦片](#球面多分辨率瓦片)
- [无障碍颜色矩阵与标签排版](#无障碍颜色矩阵与标签排版)

## pano-converter

[@ericchen1990/pano-converter](../converter/README.zh-CN.md) 是本仓库中的另一个包。它在 Node.js 中，以及通过 `pano-convert` CLI，生成立方体与等距圆柱瓦片金字塔，并返回可供 [`Tile`](#tile)、[`SphereTile`](#球面多分辨率瓦片) 与 [`Scenes`](#scenes) 使用的 `viewerConfig`。转换器不依赖 React。

## 数据来源与选型

查看器接收配置对象，或通过 HTTP 加载 JSON，不直接连接数据库。数据库连接、查询、鉴权和响应映射由宿主后端负责。数据库 API 也可以返回 JSON；这里比较的是静态文件和动态提供的配置，而不是 JSON 格式本身。两种方式的预览图、瓦片和媒体都可以使用对象存储/CDN。

| 维度 | 静态 JSON + CDN | 数据库 + 后端 API |
| --- | --- | --- |
| 配置读取 | 无需查询数据库；仍有存储、请求和流量成本 | 到达后端的请求需要处理，可能查询数据库；缓存可以减少这些开销 |
| 更新 | 生成并发布文件，再管理入口引用和缓存 | 无需发布静态文件；生效时间仍取决于后端和客户端缓存 |
| 权限与个性化 | 公开文件适合公开内容；私有分发需要托管/CDN 访问控制 | 后端可按用户、组织鉴权并返回不同配置 |
| 可用性与维护 | 依赖静态托管/CDN；维护发布及缓存更新流程 | 依赖 API 及其数据库/缓存服务；维护查询、鉴权及缓存失效 |
| 适用场景 | 公开、已发布的漫游；更新较少；读取流量大 | 编辑预览、私有内容、频繁更新和个性化 |

**公开、已发布的漫游优先使用 JSON + CDN；编辑预览、私有和个性化内容优先使用数据库 + API。** 同时需要两者时，以数据库作为编辑来源，发布时生成 JSON 快照。这种混合方式需要应用自己的发布流程；包不会自动生成或同步快照。

两条路径均不会自动轮询或订阅配置变化。更新已打开的页面时，宿主应用需要重新加载配置，并将新数据传给查看器。未命中缓存的 API 读取可以返回当前数据库值，但不会让已有查看器自动更新。

### 数据库配置接入

后端先查询漫游并完成鉴权，再将需要公开给查看器的配置字段映射为项目。下例的 `readAuthorizedTour` 由宿主应用实现，负责数据库读取和访问检查，不是包提供的 API。它返回的场景记录包含转换时保存的精简 `viewerConfig`、资源目录、视角和热点定义：

```ts
import { loadPanoProject } from "@ericchen1990/pano-view/data";
import { readAuthorizedTour } from "./tour-repository";

export async function loadTourFromDatabase(tourId: string) {
  const tour = await readAuthorizedTour(tourId);
  return loadPanoProject({
    schemaVersion: 1,
    initialSceneId: tour.initialSceneId,
    scenes: tour.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title,
      source: {
        viewerConfig: scene.viewerConfig,
        baseUrl: scene.assetBaseUrl,
      },
      initialView: scene.initialView,
      hotspots: scene.hotspots,
    })),
  }, { baseUrl: tour.assetBaseUrl });
}
```

对象入口必须提供 `baseUrl`：这里的 `tour.assetBaseUrl` 是绝对目录 URL，例如 `https://cdn.example.com/tours/123/v12/`。项目中相对的热点地址基于该目录解析；每个场景可用 `source.baseUrl` 覆盖全景瓦片/预览图目录。全部场景内嵌 `source.viewerConfig` 时，该调用不会请求项目或 viewer JSON；渲染时仍会加载预览图、瓦片和媒体。服务端数据工具从 `@ericchen1990/pano-view/data` 导入。

将返回的 `LoadedPanoProject` 传给查看器组件；在 Next.js 中，查看器需位于客户端边界：

```tsx
"use client";

import {
  PanoViewer, ProjectScenes, type LoadedPanoProject,
} from "@ericchen1990/pano-view";

export function DatabaseTour({ project }: { project: LoadedPanoProject }) {
  return <PanoViewer style={{ height: 600 }}>
    <ProjectScenes project={project} transition="dissolve" />
  </PanoViewer>;
}
```

也可以由已鉴权的 JSON 接口返回 `PanoProjectDefinition`，再调用 `loadPanoProject("https://api.example.com/tours/123", { baseUrl: "https://cdn.example.com/tours/123/v12/" })`；地址不必以 `.json` 结尾。单场景可用 `sceneFromViewerConfig` 处理已有配置，或用 `loadSceneFromJson` 加载返回 `schemaVersion: 1` viewer 文档的 API，再通过 `Scenes` 渲染。请求选项与错误处理见 [静态项目与 JSON 数据](#静态项目与-json-数据)。私有图片/媒体需单独保护：JSON 请求的认证信息不会传到纹理请求。

### 缓存与发布更新

`project.json`（场景组织、视角和热点）、各个 `viewer.json`（全景渲染配置）和预览图/瓦片/媒体是分别缓存的资源。只刷新项目文件，不会同步刷新地址不变的场景配置或图片。数据库 API 同样可能被后端、CDN 和客户端缓存，因此两种方式都需要缓存策略。

- **优先使用版本化目录：** 将完整版本发布到新路径，例如 `/tours/123/v12/`，包含 `project.json`、场景配置和资源；全部上传完成后，再切换页面或入口引用。变化的资源也要更新版本，并在旧配置仍可能被使用期间保留旧资源。内容固定的版本化文件可用长期缓存；选择版本的可变页面或入口需要短缓存或重新验证。AWS 也[建议使用版本化文件名或目录](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/UpdatingExistingObjects.html)。
- **覆盖相同 URL 时：** 等待设定的缓存有效期结束、要求重新验证，或上传后对受影响路径执行 CDN 失效。CDN 失效不会清除浏览器已有文件；新配置的响应头也无法追溯替换仍在有效期内的缓存响应。版本化路径可避免依赖这些副本过期。`?v=12` 等查询参数仅在 CDN 将其纳入缓存键时有效；JSON 的查询参数不会自动继承到引用的资源。
- **按资源选择响应头：** `Cache-Control: no-cache` 允许存储，但复用前必须验证；`no-store` 要求缓存不存储响应。可变的公开入口可配合 `ETag` 等验证器重新验证；私有/个性化 API 响应应明确配置策略，例如 `private, no-store`，避免在用户间共享。还需要配置托管/CDN 规则以遵循预期策略。参见 [MDN HTTP 缓存](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)和 [Cache-Control](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)。

这些响应头和 CDN 操作由托管平台/后端配置。loader 的 `requestInit` 仅支持 `headers`、`credentials` 和 `signal`，不提供 Fetch 的 `cache` 选项，也不会使 CDN 缓存失效或自动刷新已加载的项目。

## 静态项目与 JSON 数据

无需数据库。转换器生成的 `manifest.json` 用于归档和还原；`viewer.json` 只保存渲染配置；应用编写 `project.json` 组织场景、视角和热点。不要把完整清单直接传给 `Scenes`。

例如，将下面的 `project.json`、两个转换输出目录和你的 React 应用部署为静态网站：

```json
{
  "schemaVersion": 1,
  "initialSceneId": "entrance",
  "scenes": [
    {
      "id": "entrance",
      "source": { "viewerUrl": "./panoramas/entrance/viewer.json" },
      "initialView": { "yaw": 0, "pitch": 0, "fov": 75 },
      "hotspots": [{
        "id": "to-hall", "type": "graphic", "label": "Enter hall",
        "position": { "yaw": 30, "pitch": -10 },
        "graphic": { "kind": "arrow" },
        "action": { "type": "scene", "sceneId": "hall" }
      }]
    },
    {
      "id": "hall",
      "source": { "viewerUrl": "./panoramas/hall/viewer.json" },
      "hotspots": [{
        "id": "caption", "type": "text",
        "position": { "yaw": 0, "pitch": 5 }, "text": "Welcome"
      }]
    }
  ]
}
```

`source` 必须在 `viewerUrl` 与内嵌 `viewerConfig` 中二选一，可加 `baseUrl` 覆盖该场景的全景资源根目录。`title`、`initialView`、`hotspots` 可省略。未指定 `initialSceneId` 时使用第一项。场景 ID 全项目唯一，热点 ID 在各场景内唯一，跳转目标必须存在。

`loadPanoProject` 读取项目及各场景的轻量配置，以最多四个并发请求加载元数据；任一失败会整体报错，不加载所有纹理。返回的 `LoadedPanoProject` 包含 `initialSceneId` 和 `scenes`；每项保存运行时 `scene`、标题、初始视角和已解析资源地址的热点。可直接传给 `ProjectScenes`：

```tsx
import { useEffect, useState } from "react";
import {
  PanoViewer, ProjectScenes, loadPanoProject, PanoDataError,
  type LoadedPanoProject,
} from "@ericchen1990/pano-view";

export function Tour() {
  const [project, setProject] = useState<LoadedPanoProject>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    loadPanoProject("/tour/project.json", {
      requestInit: { signal: controller.signal },
    }).then((result) => {
      if (!controller.signal.aborted) setProject(result);
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof PanoDataError
          ? `${cause.code}: ${cause.message}` : String(cause));
      }
    });
    return () => controller.abort();
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!project) return <p role="status">Loading tour…</p>;
  return <PanoViewer style={{ height: 600 }}>
    <ProjectScenes project={project} transition="dissolve" />
  </PanoViewer>;
}
```

`ProjectScenes` 放在 `PanoViewer` 内，复用全部九类现有热点。`action: { type: "scene", sceneId }` 点击后切换场景；没有 action 的音频、视频、序列热点点击切换播放。离开场景时卸载媒体，再次进入恢复 JSON 初始播放配置。浏览器仍可能阻止自动播放。

配置了 `initialView` 的场景在 `onSceneReady` 时应用视角，缺省字段为 yaw 0、pitch 0、fov 75；未配置时保持当前视角。过渡期间热点隐藏。使用 `activeSceneId` / `onActiveSceneIdChange` 可控制当前场景。未受控时内部状态从 `project.initialSceneId` 开始；`project` 引用变化会重置该选择。`onHotspotClick(event)` 中调用 `event.preventDefault()` 可取消默认动作；`onHotspotError` 提供 `sceneId`、热点和原始错误；媒体的原始错误可能是带有 `error` 字段的事件。`renderHotspot(hotspot, context)` 返回 `undefined` 使用默认渲染，返回 `null` 隐藏；context 包含 `sceneId`、`playing`、`onClick`、`onHoverChange`、`togglePlayback`、`reportError` 和 `renderDefault`。

`ProjectScenes` 在项目字段之外继承 `Scenes` 的过渡与缓存属性：`transition`、`onSceneReady`、`transitionWaitForDetailMs`、`onTransitionEnd`、`onTransitionError`、`maxTextureMemoryMb`、`maxConcurrentTileLoads`、`snapshotMaxPixels`（默认 `3686400`）。不能传 `scenes`、`defaultActiveSceneId` 或自行的 `renderHotspots`——场景列表来自 `project`，热点由组件渲染。

### 热点动作与共享弹窗内容

`ProjectHotspotAction` 是可辨别联合类型。场景跳转保持 `{ type: "scene", sceneId }`；`{ type: "view", view: { yaw, pitch, fov }, duration?: number }` 调整当前场景视角，默认动画 700 毫秒，0 表示立即应用；`{ type: "popup", popupId }` 请求共享内容。读取 `sceneId` 前先判断 `action.type`。显式动作优先于媒体播放，三种动作均可由 `onHotspotClick(event).preventDefault()` 取消。

项目新增可选 `popups: ProjectPopupDefinition[]`。每项包含唯一 `id`、非空 `title` 和有序 `blocks`；内容块 ID 在弹窗内唯一：

```json
{
  "id": "story",
  "title": "About this place",
  "blocks": [
    { "id": "intro", "type": "text", "text": "Plain text, including line breaks." },
    { "id": "photo", "type": "image", "src": "media/photo.webp", "alt": "The main hall" },
    { "id": "film", "type": "video", "src": "media/movie.mp4", "poster": "media/photo.webp" },
    { "id": "voice", "type": "audio", "src": "media/story.mp3" }
  ]
}
```

内容结构存在 `project.json`，媒体保留为独立文件。弹窗路径相对项目目录解析，不跟随各全景的 `viewer.json`。`loadPanoProject` 返回解析后的 `popups`；新增可选 `resolvePopupAssetUrl(path, context)`，上下文是 `{ defaultUrl, popupId, blockId, field }`，field 为 `src` 或 `poster`；返回绝对 URL 或站点根路径。原有 `resolveAssetUrl` 回调继续只处理场景/热点资源。自定义加载器也可使用 `/data` 导出的 `resolveProjectPopupAssets`。JSON 请求的凭证不会自动保护媒体资源。

`ProjectScenes.onPopupRequest({ sceneId, hotspot, popup })` 将展示交给宿主 Overlay。缺少处理器或目标弹窗时通过 `onHotspotError` 报错。独立 UI 入口提供 `ProjectPopupDialog`，查看器主入口不引入 Dialog 依赖：

```tsx
import { useState } from "react";
import { PanoOverlay, PanoViewer, ProjectScenes, type LoadedPanoProject, type ProjectPopupDefinition } from "@ericchen1990/pano-view";
import { ProjectPopupDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/ui/styles.css";

export function Tour({ project }: { project: LoadedPanoProject }) {
  const [popup, setPopup] = useState<ProjectPopupDefinition | null>(null);
  return <PanoViewer>
    <ProjectScenes project={project} onPopupRequest={({ popup }) => setPopup(popup)}
      onActiveSceneIdChange={() => setPopup(null)} />
    <PanoOverlay>
      <ProjectPopupDialog popup={popup} onOpenChange={(open) => { if (!open) setPopup(null); }} />
    </PanoOverlay>
  </PanoViewer>;
}
```

`ProjectPopupDialog` 接收 `popup`（null 关闭）、`onOpenChange`，以及可选 `closeLabel` 和 `onMediaError(block)`。文字按纯文本展示，音视频使用原生控件且不自动播放；关闭或切换内容时释放媒体。全屏、尺寸和焦点行为复用 `PanoDialog`。需要自定义渲染时可替换成自己的 Overlay。

### 平面图地图

项目可选字段 `map` 把场景点位放在一张平面图上。没有 `map` 的旧项目仍然有效，`schemaVersion` 仍为 1。`loadPanoProject` 返回的地图已按项目目录解析平面图和点位图标。自定义加载器也可使用 `/data` 导出的 `parsePanoMap` 与 `resolvePanoMapAssets`。

```json
"map": {
  "image": "assets/map/floor.webp",
  "interaction": "zoom",
  "maxScale": 4,
  "iconSize": 28,
  "presentation": {
    "mode": "docked",
    "corner": "bottom-left",
    "width": 240,
    "height": 180,
    "offsetX": 16,
    "offsetY": 16
  },
  "controls": { "collapse": true, "zoom": true },
  "sector": {
    "angle": 70,
    "radius": 56,
    "followFov": false,
    "color": "#38bdf8",
    "opacity": 0.55,
    "strokeColor": "#ffffff",
    "strokeWidth": 1.5,
    "strokeOpacity": 0.9
  },
  "spots": [{
    "id": "entrance-spot",
    "sceneId": "entrance",
    "x": 0.31,
    "y": 0.5,
    "heading": 20,
    "icon": "assets/map/pin.webp"
  }]
}
```

`image` 是相对项目目录的路径或绝对 URL。`spots` 必填。点位 `id` 唯一，每个 `sceneId` 必须指向项目中的场景。`x`、`y` 是归一化图像坐标，范围 [0, 1]，原点在左上角。`heading` 是查看器 yaw 为 0 时、从图像向上方向起算的顺时针角度；扇形实际旋转为 `heading + yaw`。多个点位可以指向同一场景，扇形画在第一个 `sceneId` 与当前场景相同的点位上。`icon` 可选；省略时使用内置标记。

`interaction` 为 `"fixed"`（默认）或 `"zoom"`。固定模式把图像适配进面板，忽略滚轮、拖拽平移和缩放按钮。缩放模式允许滚轮缩放，并在比例大于适配尺寸后拖拽平移。地图上的滚轮不会带动页面滚动。`maxScale` 是相对适配尺寸的最大倍数，至少为 1，默认 8。`dragMotion` 控制放大后的平移惯性与边界回弹（默认均开启）。设为 `false` 可同时关闭，或传 `{ inertia?: boolean; bounce?: boolean }` 分别开关。点位与朝向编辑仍是直接拖动。`controls.zoom` 仅在 `"zoom"` 时显示缩放按钮。`controls.collapse` 在停靠面板上显示展开和收起。`iconSize` 是标记边长，单位为 CSS 像素，默认 28。图像缩放时，图标和扇形保持屏幕尺寸。

`sector` 可选。`angle` 是开口角度，大于 0 且小于 360。`radius` 单位为 CSS 像素，不随图像缩放。`followFov` 用查看器视场角和地图面板宽高比换算水平视场，代替 `angle`。没有 `gradient` 时，填充为纯色 `color`（默认 `#ffffff`），不透明度为 `opacity`（默认 0.55）。`gradient.type` 为 `"radial"` 或 `"linear"`，至少两个色标。每个色标包含 [0, 1] 的 `offset`、`color`，以及可选 `opacity`。色标不透明度只描述渐隐形状。`sector.opacity` 在纯色和渐变两种模式下都缩放整块填充。`strokeColor`、`strokeWidth`、`strokeOpacity` 在宽度大于 0 时绘制描边，描边宽度保持 CSS 像素。

`presentation.mode` 为 `"docked"`（默认）或 `"dialog"`。两者都接受 `corner`（`top-left`、`top-right`、`bottom-left`、`bottom-right`，默认 `bottom-left`）、`offsetX` 与 `offsetY`（默认 16），以及 `width` 和 `height`。停靠面板默认 220×160。对话框模式停靠一个打开按钮（未写宽高时为 48×48），并在查看器内部打开同一张地图。选中点位后关闭对话框。地图界面锚定在整个查看器 overlay 上，父页面滚动不会移动或改变它的尺寸。

文档保存默认值（`image`、`spots`、`sector`、`presentation`、`interaction`、`maxScale`、`dragMotion`、`controls`、`iconSize`）。挂载 `PanoMapOverlay` 时可用组件 props 覆盖本次展示的尺寸、位置和缩放，不必克隆整份 `map`。优先级为：内置默认值 → 地图文档 → `presentationOverride`（形状与 `map.presentation` 相同）→ 单独 props。点位几何与扇形样式仍写在文档里。`selectedSpotId` / `onSelectedSpotIdChange` 会向下传给内部 `PanoMap`。停靠模式的收起状态由 overlay 内部管理；对话框模式与 `editorSurface` 会强制关掉收起控件，不能从外面控制 `collapsed`。

#### 挂载 `PanoMapOverlay`

在 `PanoOverlay` 中挂载，并把交给 `ProjectScenes` 的同一个 `activeSceneId` 传进去。内置 `pano-map-*` 类名来自 `@ericchen1990/pano-view/styles.css`。overlay 从查看器读取 yaw 和视场角，不会自己切换场景：在 `onSelectScene` 里设置当前场景。相机状态来自查看器之外时传入 `view`；查看器外又不传 `view` 时，图面停在 yaw `0`、pitch `0`、fov `75`。`PanoMap` 只负责图面，由宿主自己安排外框。

`PanoMap` 还可受控选中与收起：`selectedSpotId` / `onSelectedSpotIdChange`（省略时内部选中，默认 `null`）；`collapsed` / `onCollapsedChange`（非受控初始为展开）；`renderChrome` 在图面之上渲染宿主控件。`showZoomControls` / `showCollapseControl` 与 overlay 相同，也可直接传给 `PanoMap`。`className` / `style` 挂在表面根节点上。

```tsx
import { useState } from "react";
import {
  PanoOverlay, PanoViewer, ProjectScenes, PanoMapOverlay, type LoadedPanoProject,
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function Tour({ project }: { project: LoadedPanoProject }) {
  const [activeSceneId, setActiveSceneId] = useState(project.initialSceneId);
  const map = project.map;
  return <PanoViewer style={{ height: 600 }}>
    <ProjectScenes
      project={project}
      activeSceneId={activeSceneId}
      onActiveSceneIdChange={setActiveSceneId}
    />
    {map ? (
      <PanoOverlay>
        <PanoMapOverlay
          map={map}
          activeSceneId={activeSceneId}
          onSelectScene={setActiveSceneId}
        />
      </PanoOverlay>
    ) : null}
  </PanoViewer>;
}
```

#### 尺寸、角落与边距

- `presentation` — `"docked"` | `"dialog"`（默认取自文档，否则为 `"docked"`）。
- `corner` — `"top-left"` | `"top-right"` | `"bottom-left"` | `"bottom-right"`（默认 `"bottom-left"`）。
- `width` / `height` — 停靠面板尺寸，或对话框打开按钮尺寸，单位为 CSS 像素。停靠默认 220×160；打开按钮默认 48×48。
- `offsetX` / `offsetY` — 相对所选角落的边距，单位为 CSS 像素（默认 16）。

```tsx
<PanoMapOverlay
  map={map}
  activeSceneId={activeSceneId}
  onSelectScene={setActiveSceneId}
  presentation="docked"
  corner="bottom-right"
  width={280}
  height={200}
  offsetX={20}
  offsetY={20}
/>
```

#### 对话框模式

对话框模式停靠一个打开按钮，并在查看器内部打开地图。打开按钮尺寸使用 `width` / `height`（以及 `corner` 与边距）。对话框本体使用另一组尺寸：

- `dialogWidth` / `dialogHeight` — 期望的对话框宽高，单位为 CSS 像素（默认 720×520）。两者都会按查看器可用区域夹紧，四周各留 16 像素边距。
- `openLabel` / `closeLabel` / `title` — 打开按钮无障碍名称、关闭按钮文案与对话框标题（默认分别为 `"Map"`、`"Close"`、`"Map"`）。

选中点位后关闭对话框。

```tsx
<PanoMapOverlay
  map={map}
  activeSceneId={activeSceneId}
  onSelectScene={setActiveSceneId}
  presentation="dialog"
  corner="bottom-left"
  width={52}
  height={52}
  dialogWidth={640}
  dialogHeight={480}
  openLabel="Floor plan"
  title="Floor plan"
  closeLabel="Close"
/>
```

#### 缩放与控件

下列 props 仅覆盖本次挂载，不写回地图文档：

- `interaction` — `"fixed"` | `"zoom"`。
- `maxScale` — 相对适配尺寸的最大倍数；小于 1 时按 1 处理。
- `dragMotion` — `interaction` 为 `"zoom"` 时的平移惯性 / 边界回弹。省略则两者都开；`false` 同时关闭。
- `initialScale` — 打开时的缩放倍数，相对适配尺寸，限制在 `[1, maxScale]`。这是视图状态，不会写回文档。图像测量完成后居中应用。仅在 `initialScale` 或 `interaction` 变化时重置；之后滚轮与拖拽保持用户操作。`maxScale` 变小时只夹紧当前缩放。
- `showZoomControls` / `showCollapseControl` — 强制显示或隐藏缩放、收起控件。
- `iconSize` — 标记边长，单位为 CSS 像素。

```tsx
<PanoMapOverlay
  map={map}
  activeSceneId={activeSceneId}
  onSelectScene={setActiveSceneId}
  interaction="zoom"
  maxScale={4}
  initialScale={1.5}
  showZoomControls
  showCollapseControl
  iconSize={32}
/>
```

#### 编辑模式

`mode="edit"` 用于编辑：设置 `placementSceneId` 后点击地图会新增点位，其 `heading` 取当前 yaw 的相反数，因此在该 yaw 下扇形指向图像上方；拖动点位改变位置，拖动扇形设置 `heading`。`onEditChange` 返回 `{ spots?, selectedSpotId? }`。访客播放保持默认的 `mode="view"`。`editorSurface` 会放大编辑面板；传入 `width` / `height` 可指定尺寸，否则按查看器比例计算。

运行 `pnpm dev` 并打开 `/map` 可查看示例。同一份文档的编辑方式见[编辑器平面图](../editor/README.zh-CN.md#平面图)。

继续使用 schemaVersion 1，旧项目仍可读取。包含新动作或平面图的项目需使用支持它们的查看器。`parsePanoProject(input, { draft: true })` 仅用于编辑草稿，允许空场景列表、未完成的弹窗标题/媒体，以及空的平面图路径；加载、保存和导出仍严格校验。宿主可将同一份文档存入数据库或映射到表，查看器不直接连接数据库。

单图和已有配置可用纯数据入口；Next.js 的查看器组件需位于客户端边界，服务端加载数据则使用 `/data`：

```ts
import {
  sceneFromViewerConfig, loadSceneFromJson, loadPanoProject,
} from "@ericchen1990/pano-view/data";

// A JSON API and a different asset/CDN origin.
const scene = await loadSceneFromJson(
  "https://api.example.com/rooms/123/viewer",
  { id: "room", baseUrl: "https://cdn.example.com/rooms/123/" },
);

// Existing Node.js conversion results need no extra JSON request.
const inlineScene = sceneFromViewerConfig(result.viewerConfig, {
  id: "room", baseUrl: "https://cdn.example.com/rooms/123/",
});

// Use source.viewerConfig instead of source.viewerUrl to inline scene data.
const project = await loadPanoProject({
  schemaVersion: 1,
  scenes: [{ id: "room", source: { viewerConfig: result.viewerConfig } }],
}, { baseUrl: "https://cdn.example.com/rooms/123/" });
```

### 地址与上传映射

| 引用 | 默认基准 |
| --- | --- |
| 项目中的 `viewerUrl`、热点资源、平面图与点位图标，以及 `source.baseUrl` | 项目根目录 |
| 外部 `viewer.json` 的瓦片与预览 | 该 JSON 的目录 |
| 内嵌配置的瓦片与预览 | 项目根目录 |
| 设置 `source.baseUrl` 的场景资源 | 指定目录 |

URL 入口以重定向后最终地址所在目录为默认根目录；对象入口必须提供 `baseUrl`，可用它覆盖项目根目录。目录末尾斜杠自动统一，域名和云前缀无需写回转换 JSON。浏览器接受相对入口地址，Node.js 需要绝对 HTTP(S) 地址。完整资源 URL 不重新拼接，`/` 开头的地址相对资源基准的 origin 解析。

上传时若改名或打散目录，使用同步 `resolveAssetUrl(path, context)`。context 提供 `defaultUrl`、`kind`（`tile`、`preview`、`hotspot` 或 `map`）、`sceneId` 和可选 `hotspotId`。返回最终的完整 URL 或站点根路径；不会再次拼接。`uploadedUrls` 由业务提供：

```ts
const project = await loadPanoProject("/tour/project.json", {
  resolveAssetUrl(path, context) {
    // Map keys must distinguish scenes and, for hotspot assets, hotspot IDs.
    const key = `${context.sceneId}/${context.hotspotId ?? ""}/${path}`;
    return uploadedUrls[key] ?? context.defaultUrl;
  },
});
```

热点映射涵盖图片、SVG 图片、音频数组、视频 poster、播放图标和 tooltip 图片；文本、CSS 和 SVG path 不作为地址处理。平面图和点位图标走同一个回调，`kind` 为 `"map"`。平面图的 `sceneId` 为空字符串，且没有 `hotspotId`；点位图标的 `sceneId` 和 `hotspotId` 都是点位 id。同一路径会被多种 `kind` 使用时，上传键要带上 `kind`。临时签名应由业务预先取得并通过映射返回，不要在每个瓦片请求中异步签名。

`requestInit` 只接受 `headers`、`credentials`、`signal`，仅用于 JSON 请求。它们不会传到纹理请求，JSON 地址的查询参数也不会自动继承。`parsePanoProject(unknown)` 可单独校验并复制配置。`sceneFromViewerConfig` 接受未包装的精简配置；`loadSceneFromJson` 接受带 `schemaVersion: 1` 的 `viewer.json`。

`PanoDataError` 提供稳定 `code`：`INVALID_OPTIONS`、`FETCH_FAILED`、`HTTP_ERROR`、`INVALID_JSON`、`INVALID_CONFIG`、`UNSUPPORTED_SCHEMA_VERSION`、`UNSUPPORTED_PROJECTION`、`INVALID_PROJECT`、`INVALID_REFERENCE`、`ABORTED`；HTTP 错误带 `status`，项目错误尽可能带 `sceneId` 和 `field`。加载成功仅代表配置就绪，纹理就绪仍由 `onSceneReady` 等回调表示。

完整静态示例见 playground 的 `/project` 页面和 `public/fixtures/projects/tour/project.json`。`/map` 在该漫游上展示平面图 overlay。

## 兼容 krpano 的瓦片输出

当你需要围绕等距圆柱图像或现有 krpano 立方体瓦片金字塔构建 React 原生查看器时，请使用本包。将 krpano `<cube>` 的 `url` 与 `multires` 属性复制到 `Tile` 的 `urlTemplate` 与 `multires`，并将 `<preview url>` 复制到 `previewUrl`；krpano 的磁盘命名与本包默认不同，省略这些值会加载错误的瓦片或预览图。渲染、控件、热点与场景过渡仍由你的 React 应用负责。本包兼容该瓦片输出格式，但与 krpano 无隶属关系。

## 安装

### 包

<details name="pano-view-install" open>
<summary>npm</summary>

```bash
npm install @ericchen1990/pano-view
```

</details>
<details name="pano-view-install">
<summary>pnpm</summary>

```bash
pnpm add @ericchen1990/pano-view
```

</details>
<details name="pano-view-install">
<summary>yarn</summary>

```bash
yarn add @ericchen1990/pano-view
```

</details>
<details name="pano-view-install">
<summary>bun</summary>

```bash
bun add @ericchen1990/pano-view
```

</details>

### 对等依赖

**宿主应用**必须提供这些包的兼容版本。对等依赖是否自动安装取决于包管理器及其配置；缺失的依赖应按下列版本范围显式安装。

| 包 | 支持范围 |
| --- | --- |
| `react` | `^19.0.0` |
| `react-dom` | `^19.0.0` |
| `three` | `^0.185.1` |
| `@react-three/fiber` | `^9.7.0` |
| `@react-three/drei` | `^10.0.0` |
| `@react-three/xr` | `^6.6.0` |

在宿主应用中保持 React、Three.js 与 React Three Fiber 相关包的**单一副本**。重复的 `three` 树是空白画布与上下文错误（`R3F: Hooks can only be used within the Canvas component`）的常见原因。若出现该问题，请检查 `npm ls three`、`pnpm why three`、`yarn why three` 或 `bun pm ls` 并去重。

### 样式表（HTML 叠加层）

在宿主应用中导入一次随包样式表。WebGL 全景（`PanoViewer`、`Sphere`、`Tile`、3D 热点）无需该文件即可渲染。内置 **HTML** 叠加层依赖该文件中带 `pano-` 前缀的类名完成布局。

这些叠加层包括视频控件、字幕、默认右键菜单、热点 tooltip、供辅助技术使用的界面元素、WebVR 会话 UI，以及平面图。

```ts
import "@ericchen1990/pano-view/styles.css";
```

或在 CSS 中：

```css
@import "@ericchen1990/pano-view/styles.css";
```

仅当你不使用这些叠加层，或完全通过 `className`、`style` 与外观属性重设样式时，可跳过该导入。若不导入样式表，叠加层仍会挂载，但会无样式显示。

## 示例

为 PanoViewer 提供明确尺寸，并在其内部渲染一个全景源。使用内置 HTML 叠加层
（例如视频控件、字幕、tooltip、右键菜单、WebVR UI 或平面图）时，需导入一次样式表。
下面是每种源的基本用法，完整 props 见对应章节。

### 等距圆柱图像

~~~tsx
import "@ericchen1990/pano-view/styles.css";
import { PanoViewer, Sphere } from "@ericchen1990/pano-view";

export function Panorama() {
  return (
    <PanoViewer style={{ height: 560 }}>
      <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
    </PanoViewer>
  );
}
~~~

`previewUrl` 须为低分辨率 2:1 图像，用于在完整图像加载期间显示预览。详见 [Sphere](#sphere)。

### 立方体瓦片

从 krpano XML 复制 `url`、`multires` 与预览路径。把 Sphere 换成 Tile 之前，请阅读
[迁移指南](../../docs/krpano-migration.zh-CN.md)。

~~~tsx
import { PanoViewer, Tile } from "@ericchen1990/pano-view";

export function TilePanorama() {
  return (
    <PanoViewer style={{ height: 560 }}>
      <Tile
        baseUrl="/panoramas/room"
        urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
        multires="512,1000,2000"
        previewUrl="preview.jpg"
      />
    </PanoViewer>
  );
}
~~~

占位符与预览面顺序见 [Tile](#tile)。

### 360 视频

~~~tsx
import { PanoViewer, PanoVideo } from "@ericchen1990/pano-view";

export function TourVideo() {
  return (
    <PanoViewer style={{ height: 560 }}>
      <PanoVideo autoPlay muted src="/tour.mp4" />
    </PanoViewer>
  );
}
~~~

多档画质、字幕与自定义控件见 [PanoVideo](#panovideo)。

### 多场景

~~~tsx
import { useState } from "react";
import { PanoViewer, Scenes, type Scene } from "@ericchen1990/pano-view";

const scenes: Scene[] = [
  { id: "lobby", type: "sphere", src: "/lobby.webp", previewUrl: "/lobby-preview.webp" },
  { id: "roof", type: "sphere", src: "/roof.webp", previewUrl: "/roof-preview.webp" },
];

export function Tour() {
  const [activeSceneId, setActiveSceneId] = useState("lobby");

  return (
    <PanoViewer style={{ height: 560 }}>
      <Scenes
        activeSceneId={activeSceneId}
        onActiveSceneIdChange={setActiveSceneId}
        scenes={scenes}
        transition="dissolve"
      />
    </PanoViewer>
  );
}
~~~

过渡预设与热点渲染见 [Scenes](#scenes)。

## 导出组件

### 查看器

- [`PanoViewer`](#panoviewer) — 画布容器、相机、默认控件与命令式视图 API
- [`Sphere`](#sphere) — 单张 2:1 等距圆柱图像
- [`SphereTile`](#球面多分辨率瓦片) — 多分辨率等距圆柱瓦片
- [`PanoVideo`](#panovideo) — 全景球面上的 2:1 等距圆柱视频
- [`Tile`](#tile) — krpano 风格多分辨率立方体瓦片
- [`Scenes`](#scenes) — 支持受控与非受控模式的多场景切换
- [`BackgroundAudio`](#backgroundaudio) — 全部场景共用、或按场景切换的背景声
- [`PanoFilter`](#panofilter) — 对全景源应用色彩与艺术滤镜

### 控件

- [`MouseControls`](#mousecontrols) — 拖拽环视与滚轮缩放
- [`TouchControls`](#touchcontrols) — 单指拖拽与双指缩放
- [`KeyboardControls`](#keyboardcontrols) — 方向键环视、FOV 与场景切换
- [`AutoRotate`](#autorotate) — 自动偏航旋转
- [`Gyro`](#gyro) — 可选的设备方向控制
- [`WebVR`](#webvr) — 优先 WebXR 的沉浸式 VR，MobileVR 作为回退

### 事件与界面元素

- [`PanoEvents`](#panoevents) — 查看器级生命周期与交互回调
- [`PanoOverlay`](#dom-overlay-与弹窗) — 查看器平面上的 DOM 包裹，全屏时仍可见
- [`PanoContextMenu`](#panocontextmenu) — 右键重置 / 全屏菜单
- [`PanoSceneMenu`](#panoscenemenu) — 供 `PanoOverlay` 使用的可滚动缩略图场景菜单
- [`PanoVideoControls`](#panovideo) — `PanoVideo` 的播放界面（默认挂载）

### 平面图

- [`PanoMap`](#平面图地图) — 平面图、场景点位，以及随水平角转动的扇形
- [`PanoMapOverlay`](#平面图地图) — 供 `PanoOverlay` 使用的停靠面板或对话框按钮

### 热点

- [`ImageHotspot`](#imagehotspot) — 球面位置上的图像纹理
- [`GraphicHotspot`](#graphichotspot) — 内置形状或 SVG
- [`SequenceHotspot`](#sequencehotspot) — 精灵图动画
- [`VideoHotspot`](#videohotspot) — HTML 视频纹理
- [`AudioHotspot`](#audiohotspot) — 球面位置上的定向声源
- [`TextHotspot`](#texthotspot) — 球面位置上的栅格化纯文本
- [`IframeHotspot`](#iframehotspot) — 球面位置上的嵌入文档叠加层
- [`PolygonHotspot`](#polygonhotspot) — 闭合球面区域
- [`PolylineHotspot`](#polylinehotspot) — 开放球面路径

### Hook 与辅助工具

- `usePanoViewer` — 将 viewer ref 封装成可复用的父组件侧命令
- `usePanoEvents` — 在自定义子组件内订阅查看器事件（[`PanoEvents`](#panoevents)）
- 坐标辅助函数 — `normalizePanoPosition`、`normalizePanoYaw`、`clampPanoPitch`、`panoPositionToVector3`、`vector3ToPanoPosition`（[全景坐标事件](#全景坐标事件)）
- `cycleSceneId` — 循环上一/下一场景 id（[`KeyboardControls`](#keyboardcontrols)）
- 右键菜单辅助 — `createPanoContextMenuPresets`、`composePanoContextMenuItems` 及相关 API（[`PanoContextMenu`](#panocontextmenu)）
- 多边形 / 折线校验 — `validatePolygonVertices`、`validatePolylineVertices`、`unwrapPolygonVertices`

## DOM Overlay 与弹窗

普通 DOM 界面优先使用 `PanoOverlay`，位于 Three.js 渲染树之外，挂在全屏根节点内的查看器平面上，因此全屏时仍可见。把它作为 `PanoViewer` 的直接子节点（或包在其下的 Fragment 里），与场景内容并列。`renderOverlay` 仍可用，适合回调式挂载：

```tsx
<PanoViewer style={{ height: 560 }}>
  <Sphere src="/pano.jpg" />
  <PanoOverlay>
    <PanoSceneMenu items={items} activeId={id} onSelect={setId} />
    <button
      type="button"
      style={{ position: "absolute", right: 16, bottom: 16, pointerEvents: "auto" }}
      onClick={() => void viewer.toggleFullscreen()}
    >
      Fullscreen
    </button>
  </PanoOverlay>
</PanoViewer>
```

该层已是 `position: absolute; inset: 0; pointer-events: none`。子节点自行定位，可点击节点设置 `pointerEvents: "auto"`。同时使用时，`renderOverlay` 先渲染，其后按出现顺序渲染各个 `PanoOverlay`。`usePanoOverlay()` 必须在 `PanoOverlay`（或 `renderOverlay`）子树内调用，返回 `portalContainer`、`size`（viewer 宽高）、`visibleRect`（可见矩形）与 `isFullscreen`。`usePanoModal(open)` 在 `open === true` 时占用该 viewer 的模态锁（暂停输入与自动旋转、背景 inert、关闭右键菜单）；不负责焦点陷阱。`PanoOverlayPortalProvider` 接收必填的 `container` 与 `children`，只替换后代读到的 `portalContainer`；`size` / `visibleRect` 仍是整个 viewer。字段含义、引用计数与第三方 Dialog 接线见独立的 **[弹窗使用与自定义样式指南](./docs/dialogs.zh-CN.md)**。可选 `/ui` 入口提供 `PanoDialog` 与组成组件。指南随 npm 包分发；在本仓库运行 `pnpm dev`，打开 `/overlays` 可体验示例。

### 默认弹窗

从[快速开始](./docs/dialogs.zh-CN.md#quick-start)接入，再[定制默认外观](./docs/dialogs.zh-CN.md#customize-the-default-appearance)。默认外观单独导入 `@ericchen1990/pano-view/ui/styles.css`，也可不导入。

多个热点使用[场景/热点到内容的完整映射示例](./docs/dialogs.zh-CN.md#choose-content-by-hotspot)：五份内容、一个共享弹窗、对应项目 JSON，以及场景内热点 ID 的处理。

### 组成组件与已有 Dialog 接入

自定义标题栏、内容区和底部操作使用[组成组件](./docs/dialogs.zh-CN.md#compose-a-different-layout)；已有 Dialog 使用本地 Portal 容器与 `usePanoModal(open)` [完成接入](./docs/dialogs.zh-CN.md#use-an-existing-dialog)。全屏功能放在 viewer 全局界面，不放入弹窗内容。

## PanoViewer

`PanoViewer` 负责画布、透视相机与控件。为其容器指定明确尺寸，并在内部放置一个全景源。

公开 API 中的角度以度为单位。偏航（yaw）为正表示向右看，俯仰（pitch）为正表示向上看。

```tsx
import "@ericchen1990/pano-view/styles.css";
import {
  PanoViewer,
  Sphere,
  AutoRotate,
  usePanoViewer,
} from "@ericchen1990/pano-view";

export function ControlledExample() {
  const viewer = usePanoViewer();

  return (
    <>
      <button onClick={() => viewer.setView({ yaw: 90, fov: 55 })}>
        Look right
      </button>
      <button onClick={() => void viewer.lookTo({ yaw: -45, pitch: 8 })}>
        Animate left
      </button>
      <PanoViewer
        ref={viewer.ref}
        controls={{
          inertia: true,
          rotateDamping: 14,
          zoomDamping: 16,
        }}
        initialView={{ yaw: 0, pitch: 0, fov: 75 }}
        minFov={30}
        maxFov={100}
        onViewChange={(view) => console.log(view)}
        style={{ height: 560 }}
      >
        <AutoRotate enabled speed={18} acceleration={18} startDelay={1_000} />
        <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
      </PanoViewer>
    </>
  );
}
```

句柄通过单个 `ref` 提供视图、全屏、场景、VR、视频与背景音乐控制，供宿主构建自定义界面：

**视图** — `getView`、`setView`、`reset`、`lookTo`、`moveTo`、`zoomTo`、`lookToHotspot`。

`setView` 与 `reset` 仍立即生效。导航方法返回
`Promise<{ status: "completed" | "cancelled" | "not-found" }>`；新的导航或用户操作会取消前一个导航。默认时长为 700ms，缓动为
`easeInOutCubic`，yaw 默认沿最短路径变化。`lookTo` 与 `lookToHotspot`
未传 `fov` 时保持当前 FOV。

```tsx
const result = await viewer.lookToHotspot("visitor-guide", { fov: 55 });

if (result.status === "not-found") {
  // 该热点尚未挂载在这个 PanoViewer 中。
}

await viewer.moveTo({ yaw: 170, pitch: 0 }, { shortestPath: false });
await viewer.zoomTo(48, { duration: 400, easing: "linear" });
```

所有已挂载热点都可作为目标，包括使用球面中心点的多边形与折线。每个 viewer 内的热点 `id` 必须唯一。

**全屏** — `enterFullscreen`、`exitFullscreen`、`toggleFullscreen`、`isFullscreen`。

**场景**（需 `<Scenes />`）— `setScene(id)`、`nextScene`、`previousScene`、`getActiveSceneId`、`getSceneIds`、`isSceneTransitioning`。`Scenes` 支持 `defaultActiveSceneId`（非受控）或 `activeSceneId`（受控）。受控模式下命令式调用会触发 `onActiveSceneIdChange`。

**WebVR**（需 `<WebVR />`）— `enterVR`、`exitVR`、`toggleVR`、`isVRAvailable`、`isVREnabled`、`getVRMode`、`getVRState`、`subscribeVR`、`requestVRPermission`。用 `subscribeVR` 配合 `useSyncExternalStore` 做响应式进入 / 退出按钮；内置 chrome 不再渲染「进入 VR」。

**视频**（需 `<PanoVideo />`）— `getVideo` 返回 `PanoVideoController`，`subscribeVideo` 订阅视频控制器与播放状态变更，另有快捷方法 `playVideo`、`pauseVideo`、`toggleVideo`、`seekVideo`、`setVideoVolume`、`setVideoMuted`、`toggleVideoMuted`。

**背景音乐**（需 `<BackgroundAudio />`）— `getBackgroundAudio` 返回 `BackgroundAudioController`，`subscribeBackgroundAudio` 订阅背景音频控制器与播放状态变更，另有快捷方法 `playBackgroundAudio`、`pauseBackgroundAudio`、`toggleBackgroundAudio`、`setBackgroundAudioVolume`、`setBackgroundAudioMuted`、`toggleBackgroundAudioMuted`。`BackgroundAudio` 支持 `playing`（受控）或 `defaultPlaying`（非受控）。

### 属性

- `initialView` — 省略时 yaw `0`、pitch `0`、fov `75`。只填部分字段时其余用上述默认值。
- `minFov` / `maxFov` — 默认 `30` / `100`。未单独配置 `viewLimits.fov` 时作为 FOV 上下限。
- `viewLimits` — 相机中心的 yaw / pitch / fov 范围；场景级限制会覆盖对应轴。详见[相机中心范围](#相机中心范围)。
- `dpr` — 画布像素比，默认 `[1, 2]`（按设备像素比夹在 1–2）。也可传单个数字。
- `controls` — `false` 关掉全部用户输入。对象可配置共享项与 `mouse` / `touch` / `keyboard` 通道；通道细节见[鼠标、触控与键盘控件](#鼠标触控与键盘控件)。共享项中：`enabled` 默认 `true`，`inertia` 默认 `true`，`invert` 默认 `false`，`bouncingLimits` 默认 `false`，`frictionStop` 默认 `0.01`，`rotateSpeed` 默认 `0.35`，`zoomSpeed` 默认 `0.08`，`rotateDamping` / `zoomDamping` 默认 `14` / `16`。`fovSpeed` 省略时不额外限速；滚轮按单次位移 `deltaY * zoomSpeed` 夹到 `±fovSpeed`，键盘按键按「度/秒 × 帧时间」再与 `fovSpeed` 比较。
- `cursors` — `true` / 省略使用 grab / grabbing / pointer / move；`false` 不改画布光标；对象可覆盖四个状态。
- `contextMenu` — `true` / 省略挂载「重置视图 + 全屏」；`false` 不挂默认菜单；对象可改外观或 `items` / `prepend` / `append`。详见 [PanoContextMenu](#panocontextmenu)。
- `mediaActivation` — 有播放意图的子组件时默认开启；`false` 关闭自动激活。
- `renderOverlay` — 可选的回调式 DOM UI，在画布外、全屏内渲染；回调收到 `portalContainer`、`size`、`visibleRect`、`isFullscreen`。优先用子组件 `<PanoOverlay>`。
- `onViewChange` — 参数为 `{ yaw, pitch, fov }`（度）。
- `onPanoramaClick` / `onPanoramaDoubleClick` / `onPanoramaPointerMove` — 参数为全景指针事件：`position`（yaw / pitch）、`nativeEvent`、`button`、`buttons`、`clientX`、`clientY`，以及可选的 `pointerId`。
- 其余标准 `div` 属性（如 `className`、`style`、`id`）可原样传入；类型已去掉冲突的 `onChange` 与 `contextMenu`。

### 移动端媒体激活

默认情况下，只要子组件带有初始播放意图（`PanoVideo autoPlay`、播放中的 `BackgroundAudio`、`VideoHotspot` 或 `AudioHotspot`），查看器会在浏览器需要用户手势时于首次交互静默解锁有声播放；若自动播放策略已允许，则立即激活。静音视频仍会内联预览；激活在同一用户手势内恢复 Web Audio，再把播放选择交给宿主，避免视频、BGM 与定点声同时出声。传 `mediaActivation={false}` 可保留 2.x 的无自动激活行为。

```tsx
<PanoViewer
  mediaActivation={{
    onActivate: (media) => {
      // 不要 await；必须在这次点击的同步调用栈内启动有声媒体。
      void media.playVideo({ unmute: true });
    },
  }}
  style={{ height: "min(560px, 68dvh)" }}
>
  <PanoVideo autoPlay src="/tour.mp4" />
</PanoViewer>
```

`onActivate` 的 `media` 提供 `resumeAudio()`、`playVideo({ unmute })` 和 `playBackgroundAudio()`。背景音乐若使用受控 `playing`，仍由宿主在回调内更新该状态；`viewer.activateMedia()` 可供自定义控件复用同一流程。

依赖未挂载子组件的方法（如无 `<WebVR />` 时调 `enterVR`）不会执行相应操作；返回值按方法约定为 `false`、`undefined`、`null` 或对应的 Promise。

### 全屏

```tsx
import { PanoViewer, Sphere, usePanoViewer } from "@ericchen1990/pano-view";

function FullscreenExample() {
  const viewer = usePanoViewer();

  return (
    <>
      <button onClick={() => void viewer.enterFullscreen()}>进入全屏</button>
      <button onClick={() => void viewer.exitFullscreen()}>退出全屏</button>
      <button onClick={() => console.log(viewer.isFullscreen())}>是否全屏？</button>
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
      </PanoViewer>
    </>
  );
}
```

iPhone Safari 不支持 HTML5 Fullscreen API。在 iPhone 上调用 `enterFullscreen()` 或进入 MobileVR 时，查看器会铺满 visual viewport，并在横屏滚动页面，以便收起 Safari 的地址栏和工具栏。若栏仍可见，界面会提示用户滑动。宿主页面应设置：

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

### 命令式切换场景

使用 `usePanoViewer()` 可将父组件侧命令缩短为 `viewer.setScene("roof")`。当宿主 UI 需要响应式显示当前场景 id 时，仍建议继续使用受控 `activeSceneId`。若使用非受控模式，`defaultActiveSceneId` 依然允许命令式调用直接更新内部状态。

```tsx
import { useState } from "react";
import {
  PanoViewer,
  Scenes,
  usePanoViewer,
  type Scene,
} from "@ericchen1990/pano-view";

const scenes: Scene[] = [
  { id: "lobby", type: "sphere", src: "/lobby.webp", previewUrl: "/lobby-preview.webp" },
  { id: "roof",  type: "sphere", src: "/roof.webp",  previewUrl: "/roof-preview.webp" },
];

function SceneExample() {
  const viewer = usePanoViewer();
  const [activeSceneId, setActiveSceneId] = useState("lobby");

  return (
    <>
      <button onClick={() => setActiveSceneId("roof")}>去天台</button>
      <button onClick={() => viewer.nextScene()}>下一场景</button>
      <button onClick={() => viewer.previousScene()}>上一场景</button>
      <button onClick={() => viewer.setScene("roof")}>通过 hook 跳转</button>
      <p>当前: {activeSceneId}</p>
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <Scenes
          activeSceneId={activeSceneId}
          onActiveSceneIdChange={setActiveSceneId}
          scenes={scenes}
          transition="dissolve"
        />
      </PanoViewer>
    </>
  );
}
```

### WebVR

`enterVR` 与 `requestVRPermission` 须在用户手势中调用。通过 `getVRState` /
`subscribeVR` 由宿主 UI 驱动进入；会话 chrome 只显示退出 VR 与 MobileVR 设置
（空闲数秒后淡出）。

```tsx
import { useSyncExternalStore } from "react";
import { PanoViewer, Sphere, WebVR, usePanoViewer } from "@ericchen1990/pano-view";

function VRExample() {
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(
    viewer.subscribeVR,
    viewer.getVRState,
    viewer.getVRState,
  );

  return (
    <>
      <button
        disabled={!vr.available}
        onClick={() => void (vr.enabled ? viewer.exitVR() : viewer.enterVR())}
      >
        {vr.enabled ? "退出 VR" : "进入 VR"}
      </button>
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <WebVR />
        <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
      </PanoViewer>
    </>
  );
}
```

### 自定义视频控件

将 `PanoVideo` 的 `controls` 设为 `false`，通过 `usePanoViewer()` 驱动播放。配合 `useSyncExternalStore` 使用 `subscribeVideo` 获取响应式快照。

```tsx
import { useSyncExternalStore } from "react";
import {
  PanoViewer,
  PanoVideo,
  usePanoViewer,
} from "@ericchen1990/pano-view";

function VideoExample() {
  const viewer = usePanoViewer();

  const snapshot = useSyncExternalStore(
    viewer.subscribeVideo,
    () => viewer.getVideo()?.getSnapshot() ?? null,
    () => null,
  );

  return (
    <>
      <button onClick={() => void viewer.toggleVideo()}>
        {snapshot?.playing ? "暂停" : "播放"}
      </button>
      <button onClick={() => viewer.toggleVideoMuted()}>
        {snapshot?.muted ? "取消静音" : "静音"}
      </button>
      {snapshot && (
        <input
          type="range"
          min={0}
          max={snapshot.duration}
          value={snapshot.currentTime}
          onChange={(e) => viewer.seekVideo(Number(e.target.value))}
        />
      )}
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <PanoVideo controls={false} src="/tour.mp4" />
      </PanoViewer>
    </>
  );
}
```

### 自定义背景音乐控件

`BackgroundAudio` 支持非受控模式 — 省略 `playing`，改用 `defaultPlaying`。通过 `usePanoViewer()` 驱动。

```tsx
import { useSyncExternalStore } from "react";
import {
  PanoViewer,
  Sphere,
  BackgroundAudio,
  usePanoViewer,
} from "@ericchen1990/pano-view";

function BGMExample() {
  const viewer = usePanoViewer();

  const snapshot = useSyncExternalStore(
    viewer.subscribeBackgroundAudio,
    () => viewer.getBackgroundAudio()?.getSnapshot() ?? null,
    () => null,
  );

  return (
    <>
      <button onClick={() => viewer.toggleBackgroundAudio()}>
        {snapshot?.playing ? "暂停 BGM" : "播放 BGM"}
      </button>
      <button onClick={() => viewer.toggleBackgroundAudioMuted()}>
        {snapshot?.muted ? "取消静音" : "静音"}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={snapshot?.volume ?? 1}
        onChange={(e) => viewer.setBackgroundAudioVolume(Number(e.target.value))}
      />
      <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
        <BackgroundAudio defaultPlaying src="/bgm.mp3" />
        <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
      </PanoViewer>
    </>
  );
}
```

### 综合示例

```tsx
import {
  PanoViewer,
  Scenes,
  WebVR,
  PanoVideo,
  BackgroundAudio,
  usePanoViewer,
} from "@ericchen1990/pano-view";

function TourPlayer() {
  const viewer = usePanoViewer();

  return (
    <>
      <nav>
        <button onClick={() => viewer.previousScene()}>← 上一场景</button>
        <button onClick={() => viewer.nextScene()}>下一场景 →</button>
        <button onClick={() => void viewer.toggleFullscreen()}>全屏</button>
        <button onClick={() => void viewer.enterVR()}>进入 VR</button>
        <button onClick={() => viewer.toggleBackgroundAudio()}>BGM</button>
      </nav>
      <PanoViewer ref={viewer.ref} style={{ height: "100vh" }}>
        <WebVR />
        <BackgroundAudio defaultPlaying src="/bgm.mp3" />
        <Scenes defaultActiveSceneId="lobby" scenes={scenes} transition="dissolve" />
      </PanoViewer>
    </>
  );
}
```

两个已废弃的自动旋转方法（`startAutoRotate`、`stopAutoRotate`）继续保留以兼容。鼠标、触控与键盘输入默认启用 — 普通浏览无需再渲染控件组件。仅当需要覆盖属性时渲染 `MouseControls`、`TouchControls` 或 `KeyboardControls`（子组件会替换该通道的默认实例）。通过 `controls` 调节共享行为（`inertia`、`invert`、`bouncingLimits`、`fovSpeed`、`frictionStop`、`rotateDamping`、`zoomDamping`，以及顶层的 `rotateSpeed` / `zoomSpeed`）。将 `controls.mouse` / `touch` / `keyboard` 设为 `false` 可关闭某通道，或传入选项对象（含 `enabled`）在不挂载子组件的情况下覆盖默认值。自动旋转在渲染 `AutoRotate` 之前处于关闭状态。默认右键菜单（重置视图 / 进入全屏）也会挂载 — 见 [`PanoContextMenu`](#panocontextmenu)。

鼠标、笔和单指拖拽会锚定按下的全景点，并在每个渲染帧更新旋转；使用短暂的时间平滑吸收输入采样的波动（匀速移动时约 10ms 跟随延迟）。指针停住并收敛后，按下点会与指针对齐；松手时也会立刻完成这次对齐。甩动惯性只跟随最近一段指针运动，松手前如果已经停住，不会把更早的速度继续带出去。视角边界或极点附近可能限制跟随。`rotateSpeed` 默认 `0.35` 表示 1:1 跟随，其他值按其相对倍率调整指针位移，`0` 禁止旋转；`invert` 反转方向。双指缩放和滚轮继续更新目标 FOV，相机平滑跟随。拖拽释放后保留惯性。`rotateDamping` 与 `zoomDamping` 控制跟随速度（旋转平滑不作用于锚定拖拽期间），单位为秒⁻¹（默认分别为 `14` 与 `16`）；较小的正值使相机更缓慢地接近目标视角，`0` 表示该轴不做平滑。两者必须为非负有限数。命令式 `setView()` 与 `reset()` 仍为即时生效。

画布光标默认为 `grab`，鼠标拖拽时为 `grabbing`，悬停在可交互热点上为 `pointer`，拖拽热点时为 `move`。可通过 `cursors`（`default`、`dragging`、`hotspot`、`hotspotDragging`）覆盖，或传 `cursors={false}` 保持画布光标不变。热点可设置 `cursor`，仅替换该热点的悬停光标。

```tsx
<PanoViewer
  cursors={{ default: "grab", dragging: "grabbing", hotspot: "pointer" }}
  style={{ height: 560 }}
>
  <ImageHotspot
    id="door"
    cursor="zoom-in"
    position={{ yaw: 24, pitch: -6 }}
    src="/hotspots/door.webp"
  />
</PanoViewer>
```

## Sphere

`Sphere` 需要 2:1 等距圆柱图像。当源图像的前向需要水平调整时，使用 `yawOffset`。

`Sphere` 将完整的 `src` 图像加载为单张纹理。高分辨率图像会增加下载、解码和 GPU 纹理内存开销；超出设备纹理尺寸或内存限制时，可能加载失败或导致 WebGL 上下文丢失，内存不足时也可能导致页面崩溃。当前球面渲染在顶部、底部极点附近仍可能出现可见瑕疵。

高分辨率全景优先使用立方体瓦片 [`Tile`](#tile)，通过 [@ericchen1990/pano-converter](../converter/README.zh-CN.md) 生成资源。查看器会按视野加载所需层级的瓦片，避免使用单张超大纹理。已有等距圆柱瓦片可使用 [`SphereTile`](#球面多分辨率瓦片)。

`previewUrl` 为必填项，在 `src` 加载期间显示低分辨率 2:1 图像。应提供尺寸较小的预览图，以减少首次显示的下载、解码和纹理内存开销。相对路径相对于 `src` 所在目录解析；根绝对路径与 `http(s)`、`blob:`、`data:` URL 原样使用。对于 krpano 球面场景，将 [`<preview url>`](https://krpano.com/docu/xml/#preview) 复制到 `previewUrl`。该预览必须是等距圆柱，而非立方体条带。

```tsx
"use client";

import { PanoViewer, Sphere } from "@ericchen1990/pano-view";

export function SphereExample() {
  return (
    <PanoViewer style={{ width: "100%", height: 560 }}>
      <Sphere
        src="/panoramas/room.webp"
        previewUrl="preview.webp"
      />
    </PanoViewer>
  );
}
```

### 属性

- `src` — 必填，完整 2:1 等距圆柱图像。
- `previewUrl` — 必填，加载期间显示的低分辨率 2:1 预览。
- `yawOffset` — 水平旋转，单位为度，默认 `0`。源图前向与查看器 yaw `0` 不一致时设置。
- `visible` — 默认 `true`。`false` 时保持挂载并预加载，但不绘制到球面。
- `onReady` — 首个可绘制纹理（预览或 `src`）就绪时触发一次。
- `onLoad` — `src` 纹理加载完成，参数为 Three.js `Texture`。
- `onError` — `src` 加载失败。
- `onPreviewError` — 预览加载失败；`src` 仍会继续加载。

## PanoVideo

`PanoVideo` 将 2:1 等距圆柱视频映射到与 `Sphere` 相同的内表面球体上。可传单个 `src`，或传含多档质量的 `variants`，以便浏览器选择 mp4 / webm，且控制栏可切换分辨率。切换质量时保留当前时间与播放/暂停状态。

默认播放栏挂载在查看器叠加层上：播放/暂停、进度、时间、音量、倍速、分辨率、字幕与全屏。当浏览器允许 `HTMLMediaElement.volume` 时，音量为悬停（或点击）垂直滑块；iOS Safari 仅暴露静音。倍速菜单列出当前元素接受的速率。字幕菜单还包含字幕字号与背景不透明度的设置面板。查看器较窄时，倍速、画质与字幕会收入「更多」菜单。传 `controls={false}` 可隐藏；传外观对象可重设默认实例样式；或将 `PanoVideoControls` 作为 `PanoViewer` 子组件以替换该实例。

字幕使用 WebVTT `tracks`。视频元素以透明的 1×1 像素节点挂载在查看器内，字幕提示文本（cue）通过屏幕空间叠加层渲染。`captions={false}` 会隐藏叠加层与语言菜单；对象会与默认外观合并（`color`、`background`、`fontSize`、`fontFamily`、`textShadow`、`padding`、`borderRadius`、`maxWidth`、`bottom`）。这些值作为字幕初始外观；观众仍可在运行时通过默认控制栏菜单调整字幕大小与背景。

```tsx
"use client";

import { PanoViewer, PanoVideo } from "@ericchen1990/pano-view";

export function VideoExample() {
  return (
    <PanoViewer style={{ width: "100%", height: 560 }}>
      <PanoVideo
        defaultVariantId="1024"
        variants={[
          {
            id: "1024",
            label: "1024p",
            poster: "/video/1024-poster.jpg",
            sources: [
              { src: "/video/1024.mp4", type: "video/mp4" },
              { src: "/video/1024.webm", type: "video/webm" },
            ],
          },
          {
            id: "1920",
            label: "1920p",
            poster: "/video/1920-poster.jpg",
            sources: [
              { src: "/video/1920.mp4", type: "video/mp4" },
              { src: "/video/1920.webm", type: "video/webm" },
            ],
          },
        ]}
        tracks={[
          { src: "/video/en.vtt", srcLang: "en", label: "English", default: true },
          { src: "/video/zh.vtt", srcLang: "zh", label: "中文" },
        ]}
        captions={{ fontSize: 16, color: "#fff" }}
        muted
      />
    </PanoViewer>
  );
}
```

`muted` 默认为 `true`，以提高自动播放的兼容性；实际播放仍受浏览器策略约束。`playsInline` 也默认开启，并写入 `playsinline`、`webkit-playsinline` 以及 X5 的 `h5-page` 属性，向 iPhone Safari、微信、QQ 和 UC 请求页内播放；实际行为取决于浏览器及其版本。画中画和远程播放保持关闭，以便该元素持续作为球面纹理。元素会以 1×1 像素挂在查看器内。非静音播放可能需要用户手势；`play()` 被拒绝时 `onPlaybackStateChange` 会收到 `"blocked"`。非同源的远程视频与 VTT 文件应设置 `crossOrigin`（通常为 `"anonymous"`）。移动端请提供 H.264 + AAC 的 MP4 备选源、poster、CORS 与 Range 支持。

### 属性

- `src` — 单文件快捷方式；与 `variants` 二选一。
- `poster` — 封面图。多档时也可写在各 `variants[].poster`。
- `variants` / `defaultVariantId` — 多分辨率列表；找不到 `defaultVariantId` 时回退到第一项。切换档位保留当前时间与播放/暂停状态。
- `tracks` — WebVTT 字幕轨。每项可含 `src`、`srcLang`、`label`、`default`、`id`（省略时用 `srcLang`）、`kind`（`"subtitles"` 或 `"captions"`，默认 `"subtitles"`）。
- `captions` — `true` / 省略显示默认字幕层；`false` 隐藏叠加层与语言菜单；对象与默认外观合并。默认外观：`color` `#ffffff`，`background` `rgba(0, 0, 0, 0.55)`，`fontSize` `16`，`fontFamily` Inter / system-ui，`fontWeight` `500`，`textShadow` `0 1px 2px rgba(0, 0, 0, 0.8)`，`padding` `"6px 10px"`，`borderRadius` `6`，`maxWidth` `"72%"`，`bottom` `72`，`lineHeight` `1.35`。
- `controls` — `true` / 省略挂载默认播放栏；`false` 隐藏；对象重设默认实例外观。外观字段：`background`（默认 `rgba(16, 16, 16, 0.88)`）、`color`（`#f4f4f4`）、`accent`（`#75cbd3`）、`borderRadius`（`8`）、`fontSize`（`12`）、`padding`（`"8px 10px"`）。也可将 `PanoVideoControls` 作为 `PanoViewer` 子组件替换默认条（同样接收 `appearance`）。
- `yawOffset` — 水平偏移，单位为度，默认 `0`。
- `loop` — 默认 `false`。
- `muted` — 默认 `true`。
- `volume` — 默认 `1`，范围 0–1。
- `autoPlay` — 默认 `false`。为 `true` 时会作为媒体激活的触发条件。
- `playsInline` — 默认 `true`。
- `preload` — `"none"` | `"metadata"` | `"auto"`，默认 `"metadata"`。
- `crossOrigin` — `""` | `"anonymous"` | `"use-credentials"`；省略则不设。
- `playbackRates` — 倍速菜单列表，默认 `[0.5, 1, 1.25, 1.5, 2]`。
- `visible` — 默认 `true`；`false` 时预加载但不绘制。
- `onLoad` — 视频可播放时。
- `onError` — `{ source: "poster" | "video" | "track", error }`。
- `onPlaybackStateChange` — `"playing" | "paused" | "ended" | "blocked"`。
- `onEnded` — 播放到结尾（未循环时）。
- `onVariantChange` / `onTrackChange` — 当前档位 id，或当前字幕轨 id（无轨时为 `null`）。

## Tile

`Tile` 渲染六个朝内的立方体面，并仅加载当前视野附近的瓦片。省略 `urlTemplate` 时，相对于 `baseUrl` 的路径使用本包默认：

```text
tiles/%s/l%l/%v/l%l_%s_%h_%v.webp
```

展开为 `tiles/{face}/l{level}/{row}/l{level}_{face}_{col}_{row}.webp`。面为 `f`、`r`、`b`、`l`、`u`、`d`；行与列从 1 起计。

```tsx
import { PanoViewer, Tile } from "@ericchen1990/pano-view";

export function TileExample() {
  return (
    <PanoViewer style={{ width: "100%", height: 560 }}>
      <Tile
        baseUrl="https://cdn.example.com/panoramas/room"
        multires="512,500,1000,2000"
        previewUrl="previews/cube-vertical.webp"
      />
    </PanoViewer>
  );
}
```

krpano 立方体瓦片输出不遵循该默认。从 krpano XML 读取 `url`、`multires` 与预览路径（[`<cube>`](https://krpano.com/docu/xml/#image.cube)、[`<preview>`](https://krpano.com/docu/xml/#preview)）并传入。若这些值缺失或与磁盘文件不匹配，瓦片会解析到错误的立方体面、层级或行列，导致画面缺失或错位。

| krpano | `Tile` / `TileScene` 属性 |
|---|---|
| `<cube url>` | `urlTemplate` |
| `<cube multires>` | `multires` |
| `<preview url>` | `previewUrl` |
| `<preview striporder>` | `previewFaceOrder` |

`Sphere` 使用相同的 `<preview url>` → `previewUrl` 映射；该文件必须是 2:1 等距圆柱，而非立方体条带。

krpano 文档中的简写语法：

```xml
<preview url="preview.jpg" />
<image>
  <cube url="pano_%s_%l_%v_%h.jpg"
        multires="512,1024,2048,4096"
  />
</image>
```

对应为：

```tsx
<Tile
  baseUrl="/panoramas/room"
  urlTemplate="pano_%s_%l_%v_%h.jpg"
  multires="512,1024,2048,4096"
  previewUrl="preview.jpg"
/>
```

MAKE PANO (MULTIRES) 文件夹布局常为 `tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg`，场景根目录有 `preview.jpg`。该文件名为 `%v_%h`（先行后列）。本包默认瓦片模板为 `%h_%v`（先列后行）。请复制 XML 中的值，不要假设两种约定一致。

`multires` 的第一个值为瓦片尺寸。其余值按 `l1`、`l2` 及更高层级的顺序，指定递增的立方体面边长。`previewUrl` 为必填。相对路径相对于 `baseUrl` 解析；根绝对路径与 `http(s)` URL 原样使用。典型的 krpano MAKE PANO (MULTIRES) 场景如下：

```tsx
<Tile
  baseUrl="/panoramas/room"
  urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
  multires="512,1000,2000"
  previewUrl="preview.jpg"
  previewFaceOrder={["l", "f", "r", "b", "u", "d"]}
/>
```

`previewFaceOrder` 必须按预览图从上到下的实际顺序列出六个面代码。默认顺序为 `l`、`f`、`r`、`b`、`u`、`d`。预览图为竖向 1×6 立方体条带。krpano 的 `thumb.jpg` 通常是独立缩略图，不能替代该预览条带。

快速旋转或缩放时，已加载瓦片保持可见；新进入视野的瓦片会使用其父级或预览作为局部回退。

对于非 krpano XML 的布局，可用占位符模板或解析器覆盖默认。模板与解析器均可提供相对于 `baseUrl` 的路径或绝对 URL：

```tsx
<Tile
  baseUrl="/panoramas/room"
  multires={{ tileSize: 512, levels: [500, 1000, 2000] }}
  previewUrl="previews/cube-vertical.webp"
  urlTemplate="assets/%s/%l/%v_%h.webp"
  resolveTileUrl={({ face, level, row, col }) =>
    `api/tile/${face}/${level}/${row}/${col}`
  }
/>
```

`resolveTileUrl` 优先于 `urlTemplate`。

对于 krpano 立方体瓦片模板，`%s` 为立方体面，`%l` 为多分辨率层级。水平瓦片索引支持等价的 `%h`、`%x`、`%u`、`%c` 占位符；垂直索引支持 `%v`、`%y`、`%w`、`%r`。在索引占位符前加零可填充：例如 `%0h` 为两位水平索引，`%00v` 为三位垂直索引。立体 `%t` 与帧 `%f` 占位符不适用于表示单一非立体立方体全景的 `Tile`。

### 属性

- `baseUrl` / `multires` / `previewUrl` — 必填。`multires` 可为字符串或 `{ tileSize, levels }`。
- `previewFaceOrder` — 默认 `["l", "f", "r", "b", "u", "d"]`，须恰好六个面。
- `urlTemplate` — 省略时用本包默认路径；`resolveTileUrl` 优先于模板。
- `maxTextureMemoryMb` — 独立 `Tile` 默认 `128`。
- `maxConcurrentLoads` — 独立 `Tile` 默认 `8`（不要与 `SphereTile` / `Scenes` 的 `4` 混淆）。
- `retryCount` — 首次失败后的重试次数，默认 `1`。
- `loadMode` — `"full"`（默认）、`"preview"` 或 `"base"`。
- `visible` — 默认 `true`；`false` 时仅预加载。
- `onReady` — 预览图可绘制时触发（预览失败时仍可能由瓦片就绪触发，见实现）。
- `onPreviewError` — 预览加载失败。
- `onLoadProgress` — `{ requested, loaded, failed, active, queued }`。
- `onTileError` — `{ address, url, error }`。
- `onLevelChange` — 当前立方体层级，**从 1 起计**（`SphereTile` 的逻辑层级从 0 起，不要混用）。

放进 `Scenes` 的 `type: "tile"` 场景后，共享纹理缓存会覆盖场景上的 `maxTextureMemoryMb`、`maxConcurrentLoads`、`retryCount`（共享提供者将 retry 写为 `1`）。可见性、`loadMode` 与上述回调由 `Scenes` 接管，不要写在场景对象上。

## Scenes

`Scenes` 支持单张等距圆柱图像、立方体瓦片与等距圆柱瓦片场景之间的切换，并支持受控与非受控模式。过渡使用 GPU 帧缓冲快照与目标场景进行混合。目标场景在隐藏状态下加载预览；瓦片场景同时加载视野附近的最低分辨率层级。目标场景首次可绘制后，当前帧缓冲成为临时 GPU 纹理，并释放旧场景的源纹理。目标随即进入 `full`：转场期间已经清晰的瓦片立刻盖住预览，尚未就绪的区域继续显示父层瓦片或预览。旧场景释放后，目标场景才开始加载细节瓦片；瓦片选择范围包含当前视野及其周边的少量预留区域。

```tsx
import {
  Scenes,
  PanoViewer,
  type Scene,
} from "@ericchen1990/pano-view";

const scenes: Scene[] = [
  { id: "lobby", type: "sphere", src: "/panoramas/lobby.webp", previewUrl: "preview.webp" },
  {
    id: "terrace",
    type: "tile",
    baseUrl: "/panoramas/terrace",
    multires: "512,1000,2000",
    urlTemplate: "tiles/%s/l%l/%v/l%l_%s_%v_%h.webp",
    previewUrl: "previews/cube-vertical.webp",
  },
];

<PanoViewer style={{ height: 560 }}>
  <Scenes
    scenes={scenes}
    activeSceneId={activeSceneId}
    transition="ellipticZoomOpen"
    renderHotspots={(scene) => <SceneHotspots sceneId={scene.id} />}
    onTransitionError={({ sceneId }) => console.warn("Could not load", sceneId)}
  />
</PanoViewer>;
```

可用的 krpano 风格预设包括 `none`、`crossfade`、`zoom`、`blackout`、`whiteFlash`、`slideRightToLeft`、`slideTopToBottom`、`slideDiagonal`、`circleOpen`、`verticalOpen`、`horizontalOpen`、`ellipticZoomOpen`。网格类预设为 `pixelate`、`gridWipe`、`gridWipeUp`、`gridWipeRight`、`gridWipeDiagonal`、`gridWipeCenter`、`gridWipeChecker`、`hexDissolve`。电影感预设为 `dissolve`、`shatter`、`particles`、`glitch`、`swirl`、`clockWipe`、`ripple`、`zoomBlur`、`filmBurn`。它们均在目标全景之上混合 GPU 帧缓冲快照，不会混合两个完整 360 纹理。传 `{ preset: "crossfade", duration: 0.6 }` 可覆盖预设时长。

`transitionWaitForDetailMs` 默认为 `0`：目标一旦可绘制就开始转场，高分辨率细节在转场期间继续加载。正数（例如 `200`）从旧画面快照完成、目标进入 `full` 之后开始计时；当前视野的目标层级就绪后可提前转场，否则最多再等待指定毫秒。该等待与转场动画时长分开计算。等待期间完整显示旧快照，目标在其下正常绘制并上传纹理。单张图像场景的细节就绪指完整图片可绘制；立方体和球面瓦片指按视口尺寸、设备像素比、FOV 和现有内存预算选出的当前视野目标层级全部可绘制，不要求视野外瓦片。负值或非有限值按 `0` 处理。`transition="none"` 使用同一条件，满足后直接切换。新的目标、中断、卸载或 WebGL 上下文丢失会取消尚未结束的等待，避免过期的就绪通知影响下一个场景。

`onReady` 表示源第一次可绘制。`onSceneReady` 在首个场景可绘制，或旧画面快照完成且新场景接管时触发，并不表示当前视野的完整图像或细节瓦片已加载完成。

细节加载等待或转场进行时，全景拖拽/缩放输入被锁定，`renderHotspots` 被隐藏。新的 `activeSceneId` 会取代仍在准备中的目标。`maxTextureMemoryMb` 与 `maxConcurrentTileLoads` 作用于整个 `Scenes` 查看器，而非每个瓦片场景单独计算。

### 属性

- `scenes` — 必填。支持 `type: "sphere" | "tile" | "sphereTile"`。
- `activeSceneId` — 受控当前场景。
- `defaultActiveSceneId` — 非受控初始场景。两者都省略时使用 `scenes[0].id`。
- `onActiveSceneIdChange` — 受控模式下命令式切换会触发。
- `transition` — 省略时为 `"crossfade"`、时长 `1` 秒。也可传 `{ preset, duration }`。各预设默认秒数：`none` 0，`crossfade` / `whiteFlash` / 多数 slide 与 open / `pixelate` / `dissolve` / `clockWipe` / `zoomBlur` 为 1，`verticalOpen` 0.7，`glitch` 0.8，`hexDissolve` 1.1，六种 `gridWipe*` / `shatter` / `swirl` / `ripple` 为 1.2，`filmBurn` 1.3，`particles` 1.4，`zoom` / `blackout` 为 2。
- `transitionWaitForDetailMs` — 默认 `0`。
- `renderHotspots` — 仅在过渡结束后渲染；过渡中隐藏。
- `onSceneReady` — 首次可绘制，或快照后新场景接管；不等于细节加载完成。
- `onTransitionEnd` — `{ previousSceneId, sceneId, preset }`。
- `onTransitionError` — `{ sceneId, error }`。
- `maxTextureMemoryMb` — 共享预算，默认 `128`。
- `maxConcurrentTileLoads` — 共享并发，默认 `4`。
- `snapshotMaxPixels` — 旧画面 GPU 快照的最大物理像素面积，默认 `3686400`（约 2560×1440）。

场景对象上的 `viewLimits` 见 FAQ；`yawOffset` 语义与对应源组件相同。`TileScene` 上的单场景缓存字段在共享缓存下会被忽略，见 [Tile](#tile)。

## PanoSceneMenu

`PanoSceneMenu` 是可滚动的缩略图场景菜单。通过 `PanoOverlay` 挂载，这样在普通布局和全屏里都会留在 viewer 内。默认布局需导入 `@ericchen1990/pano-view/styles.css`。

菜单由宿主驱动：传入 `items`、`activeId`、`onSelect`。它不读取 `Scenes` 状态，也不使用场景的 `previewUrl`。立方体场景的 `previewUrl` 通常是 1×6 预览条，不适合直接当菜单缩略图；请改用独立缩略图（转换器输出可优先用 `previews/200.webp` 这类小图）。

### 基础接入

与 `Scenes` 共用同一个受控场景 id：

```tsx
import { useState } from "react";
import {
  PanoOverlay,
  PanoSceneMenu,
  PanoViewer,
  Scenes,
  type PanoSceneMenuItem,
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const menuItems: PanoSceneMenuItem[] = [
  {
    id: "lobby",
    title: "大厅",
    thumbnailUrl: "/panoramas/lobby/thumb.webp",
  },
  {
    id: "terrace",
    title: "露台",
    thumbnailUrl: "/panoramas/terrace/previews/200.webp",
  },
];

export function Tour() {
  const [activeSceneId, setActiveSceneId] = useState("lobby");

  return (
    <PanoViewer style={{ height: 560 }}>
      <Scenes
        scenes={scenes}
        activeSceneId={activeSceneId}
        onActiveSceneIdChange={setActiveSceneId}
      />
      <PanoOverlay>
        <PanoSceneMenu
          activeId={activeSceneId}
          items={menuItems}
          onSelect={setActiveSceneId}
        />
      </PanoOverlay>
    </PanoViewer>
  );
}
```

每项需要 `id` 与 `thumbnailUrl`。可选 `title` 显示在缩略图底部标签和控制提示上；省略时用 `id`。当前项带叠在缩略图上的选择边框和 `data-active="true"`。场景名默认叠在缩略图底部的暗色半透明条上，可用 `appearance.labelAlign` 改为居中或右对齐。

### 位置、边距与尺寸

- `placement` — `"top"` | `"bottom"` | `"left"` | `"right"`（默认 `"bottom"`）。上下为横向列表，左右为纵向列表。
- `align` — `"start"` | `"center"` | `"end"`（默认 `"center"`）。菜单主轴尺寸小于可用空间时，沿停靠边对齐；列表内容短于视口时同样对齐。
- `inset` — 与 viewer 边缘的间隙（默认 `12`）。数字按像素；字符串可带单位（如 `"1rem"`）；对象可分别设置 `top` / `right` / `bottom` / `left`。
- `width` / `height` — 菜单宽高。数字按像素；字符串会原样写入 CSS，因此可用 `%`、`rem`、`calc()`、`min()`、`max()`、`clamp()` 等。
- `dragMotion` — 滚动惯性与边界回弹。省略则两者都开（自定义指针滚动，桌面也可拖）。设为 `false` 使用原生 overflow 滚动。可传 `{ inertia?: boolean; bounce?: boolean }` 分别开关。短按仍会选中；拖过数像素后会抑制 click。

```tsx
<PanoSceneMenu
  placement="bottom"
  align="center"
  inset={16}
  width="min(720px, 100%)"
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>

<PanoSceneMenu
  placement="right"
  align="start"
  inset={{ top: 24, right: 12, bottom: 24, left: 12 }}
  height="70%"
  width={160}
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>
```

上下布局若省略 `width`，菜单会在左右 `inset` 之间拉伸；左右布局若省略 `height`，会在上下 `inset` 之间拉伸。组件还会按 `inset` 和安全区设置 `max-width` / `max-height`，所以即使用 `100%` 也不会超出 viewer。

需要临时覆盖停靠位置时，可再叠一层 `style`。

### 展开收起与箭头

默认始终展开。设 `collapsible` 后会出现开关，位于缩略图条朝向画面内侧的正中（底部菜单在条上方，顶部在条下方，左右在朝向画面一侧）。收起时列表沿停靠边滑出屏幕，只把展开按钮留在安全区边缘：

```tsx
<PanoSceneMenu
  collapsible
  defaultExpanded
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>

// 受控
<PanoSceneMenu
  collapsible
  expanded={menuOpen}
  onExpandedChange={setMenuOpen}
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>
```

设 `showArrows` 会在列表两端显示上一场景 / 下一场景按钮。默认到首尾后停住；设 `loop` 后箭头与方向键会在首尾环绕（最后一项的下一项是第一项）。场景少于 2 个时箭头仍禁用。可用 `previousLabel` / `nextLabel` 自定义箭头无障碍名称，用 `expandLabel` / `collapseLabel` 自定义展开收起文案。默认文案为 `"Previous scene"`、`"Next scene"`、`"Show scenes"`、`"Hide scenes"`。单选组标签默认是 `"Scenes"`，可通过 `label` 修改。`defaultExpanded` 在可折叠时默认为 `true`。

```tsx
<PanoSceneMenu
  showArrows
  loop
  collapsible
  placement="bottom"
  width="min(720px, 100%)"
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
  previousLabel="上一房间"
  nextLabel="下一房间"
/>
```

### 外观与样式钩子

常用外观可用 `appearance`，不必手写 CSS。当前项边框叠在缩略图上方，可用 `selectionColor` / `selectionWidth` 调节（`selectionWidth: 0` 隐藏）；场景名默认左对齐，设 `labelAlign: "center"` 或 `"end"` 可改对齐。

```tsx
<PanoSceneMenu
  appearance={{
    background: "rgba(8, 12, 18, 0.88)",
    itemWidth: 144,
    itemHeight: 88,
    gap: 10,
    borderRadius: 10,
    selectionColor: "#7dd3fc",
    selectionWidth: 2,
    labelBackground: "rgba(0, 0, 0, 0.6)",
    labelColor: "#ffffff",
    labelAlign: "center",
    fontSize: 12,
    controlColor: "#f8fafc",
    controlBackground: "rgba(255, 255, 255, 0.14)",
  }}
  items={menuItems}
  activeId={activeSceneId}
  onSelect={setActiveSceneId}
/>
```

默认值见导出的 `DEFAULT_PANO_SCENE_MENU_APPEARANCE`（含 `padding: "8px 10px"`、`labelAlign: "start"`）。更细的样式可用 `className` / `style` 覆盖这些稳定类名：

- `pano-scene-menu` — 根容器
- `pano-scene-menu-body` — 箭头与列表所在行/列（承载条背景）
- `pano-scene-menu-list` — 可滚动列表
- `pano-scene-menu-item` / `pano-scene-menu-thumb` / `pano-scene-menu-label`
- `pano-scene-menu-control` / `pano-scene-menu-arrow` / `pano-scene-menu-toggle`

根节点还带 `data-placement`、`data-align`、`data-orientation`（`horizontal` | `vertical`）、`data-expanded`、`data-collapsible`；当前项带 `data-active="true"`。

## PanoFilter

在 `PanoViewer` 内渲染 `PanoFilter` 可对全景源（`Sphere`、`Tile`、`SphereTile`、`PanoVideo`）调色或风格化。内置预设仅作用于全景材质；`colorMatrix` 默认仅作用于全景，设 `colorMatrixScope="all"` 可同时作用于热点纹理。tooltip、视频控件与 iframe 等 DOM 叠加层不受影响。WebXR / MobileVR 使用相同的全景着色器，因此继承相同的滤镜外观。

`intensity` 在滤镜结果与原图之间混合（`0`–`1`，默认 `1`）。省略组件或设 `enabled={false}` 可关闭全部滤镜；`preset="none"` 仅关闭内置预设，已配置的 `colorMatrix` 仍会生效。

```tsx
<PanoViewer style={{ height: 560 }}>
  <PanoFilter preset="pencil" intensity={0.85} />
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
  <ImageHotspot
    id="door"
    position={{ yaw: 24, pitch: -6 }}
    src="/hotspots/door.webp"
  />
</PanoViewer>
```

| 预设 | 效果 |
|---|---|
| `none` | 恒等（无滤镜） |
| `grayscale` | Rec.709 黑白 |
| `sepia` | 暖棕色复古 |
| `vintage` | 褪色胶片与颗粒 |
| `cool` / `warm` | 冷/暖色温偏移 |
| `pencil` | 纸上石墨素描 |
| `coloredPencil` | 彩色铅笔线条 |
| `crayon` | 海报化蜡笔笔触 |
| `watercolor` | 纸上柔和水彩 |
| `cartoon` | 赛璐珞着色与描边 |
| `crosshatch` | 亮度交叉排线 |

内置艺术效果使用屏幕空间边缘与世界空间颗粒，避免立方体瓦片出现滤镜接缝。启用滤镜时，场景过渡快照会捕获带滤镜的全景。

## AutoRotate

自动旋转默认关闭。在 `PanoViewer` 内渲染 `AutoRotate` 以启用，并将旋转配置与用户输入控件分离。`speed` 为度/秒；负值向左旋转。`acceleration` 为度/秒²，从零平滑加速到 `speed`（默认 `18`，即默认速度约 1 秒达到）。设为 `0` 则立即以固定速度旋转。`startDelay` 为 `enabled` 变为 true 起的毫秒延迟，默认 `2`。用户拖拽中，或拖拽惯性仍在衰减时，旋转暂停并在恢复时从零速度重新开始。组件挂载且 `enabled` 省略时按 `true` 处理；不渲染组件则不旋转。

```tsx
<PanoViewer style={{ height: 560 }}>
  <AutoRotate enabled speed={12} acceleration={6} startDelay={2_000} />
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

## BackgroundAudio

`BackgroundAudio` 在查看器里播放背景音乐或环境声。它不是热点：没有球面位置、没有标记、音量也不随视角变化。必须作为 `PanoViewer` 的子组件，与 `Scenes`、`Sphere` 或 `Tile` **并列**。不要写进 `Scenes` 的 `renderHotspots`：场景过渡时热点会卸载，背景音频也会停止。

传入 `playing` 时，播放状态由宿主控制；省略时使用内部状态，初始值由 `defaultPlaying` 指定（默认 `false`）。`loop` 默认 `true`。浏览器可能阻止自动播放；此时 `onPlaybackStateChange` 收到 `"blocked"`，播放意图仍为 `true` 时会在下一次点击或按键后重试。

可使用以下两种音轨配置方式。

**全部场景共用一条音轨** — 只传 `src`，不要传 `sources`。切换场景时音频继续播放，不会从头播放。

```tsx
import { BackgroundAudio, PanoViewer, Scenes } from "@ericchen1990/pano-view";

<PanoViewer style={{ height: 560 }}>
  <BackgroundAudio src="/bgm/tour.mp3" playing={isBgmPlaying} />
  <Scenes scenes={scenes} activeSceneId={activeSceneId} />
</PanoViewer>;
```

**每个场景一条音轨** — 传 `sources`（键为 `Scene.id`）和当前的 `sceneId`。省略 `sceneId` 会抛错。切换场景时，若文件变了会按 `fadeMs` 交叉淡化（默认 400 毫秒；`0` 表示立即切换）；若两个场景指向同一文件则连续播放，不重新开始。

```tsx
<PanoViewer style={{ height: 560 }}>
  <BackgroundAudio
    sources={{
      lobby: "/bgm/lobby.mp3",
      terrace: "/bgm/terrace.mp3",
    }}
    sceneId={activeSceneId}
    playing={isBgmPlaying}
  />
  <Scenes scenes={scenes} activeSceneId={activeSceneId} />
</PanoViewer>;
```

可选：同时传 `src` 作为未列出场景的默认音轨。某个场景要静音时，把该 id 写成 `""`（会覆盖 `src`，而不是回退到默认轨）。

```tsx
<BackgroundAudio
  src="/bgm/default.mp3"
  sources={{ lobby: "/bgm/courtyard.mp3", terrace: "" }}
  sceneId={activeSceneId}
  playing={isBgmPlaying}
/>;
```

上例中：`lobby` 播放庭院环境声，`terrace` 静音，其余场景播放 `default.mp3`。

需要将声源定位在全景某一点，并使立体声像随视角变化时，使用 `AudioHotspot`。

### 属性

- `src` / `sources` — `src` 为全局轨，或 `sources` 缺项时的回退。二者均可为字符串，或字符串数组（Howler 多格式回退）。`sources` 的键是 `Scene.id`。
- `sceneId` — 使用 `sources` 时必填；省略会抛错。
- `playing` / `defaultPlaying` — 受控播放，或非受控初始值（默认 `false`）。
- `loop` — 默认 `true`。
- `muted` — 默认 `false`。
- `volume` — 默认 `1`，范围 0–1。
- `pauseWhenHidden` — 默认 `true`；页面隐藏时暂停。
- `fadeMs` — 切轨交叉淡化毫秒，默认 `400`；`0` 为硬切。
- `crossOrigin` — `""` | `"anonymous"` | `"use-credentials"`；省略则不设。
- `onPlaybackStateChange` — `"playing" | "paused" | "ended" | "blocked"`。
- `onPlaybackError` — `play()` 等播放失败。
- `onEnded` — 播完；非受控时还会把内部播放设为 `false`。
- `onError` — 资源加载失败，参数 `{ error }`（与 `onPlaybackError` 不同）。

## Gyro

`Gyro` 为可选的设备方向控制，默认关闭。在 `PanoViewer` 内渲染并通过 `enabled` 控制。相对模式（默认）将启用时的视图作为起始方向。设 `absolute` 可跟随罗盘朝向，用 `north` 指定指向北方的全景 yaw。

```tsx
import { useRef, useState } from "react";
import {
  Gyro,
  PanoViewer,
  Sphere,
  type GyroHandle,
} from "@ericchen1990/pano-view";

export function GyroExample() {
  const gyroRef = useRef<GyroHandle>(null);
  const [enabled, setEnabled] = useState(false);

  const toggle = async () => {
    if (enabled) {
      setEnabled(false);
      return;
    }
    // iOS requires this call to run directly inside a user gesture.
    setEnabled((await gyroRef.current?.requestPermission()) ?? false);
  };

  return (
    <>
      <button onClick={() => void toggle()}>
        {enabled ? "Disable gyro" : "Enable gyro"}
      </button>
      <PanoViewer style={{ height: 560 }}>
        <Gyro
          ref={gyroRef}
          enabled={enabled}
          camroll
          friction={0}
          softstart={0.5}
          touchMode="full"
          onDenied={() => setEnabled(false)}
        />
        <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
      </PanoViewer>
    </>
  );
}
```

`camroll`（默认 `true`）根据设备的翻滚角（roll）调整相机倾斜。`friction` 接受 `0` 到 `0.99`；越高越平滑但延迟更大。`softstart` 为启用时的混合时长（秒，默认 `0.5`）。`desktopSupport` 默认为 `false`，因桌面浏览器可能暴露 API 却无物理传感器。

`touchMode` 控制触控拖拽与设备运动的组合方式：

- `off` 忽略触控 yaw/pitch，仍保留双指 FOV。
- `horizontaloffset` 仅加水平偏移。
- `full` 加水平与垂直偏移；设备移动时垂直偏移会回到物理朝向。
- `disablegyro` 在下一次触控时关闭当前陀螺仪会话。

`GyroHandle` 暴露 `resetSensor(yaw?, pitch?)`、`isAvailable()`、`isEnabled()` 与 `requestPermission()`。陀螺仪活动会暂停 `AutoRotate`，并计为查看器交互以用于空闲追踪。传感器 API 通常需要 HTTPS。跨域 iframe 需宿主页允许，例如 `allow="gyroscope; accelerometer"` 与兼容的 `Permissions-Policy` 头。

### 属性

- `enabled` — 默认 `false`。iOS 须在用户手势里先 `requestPermission()` 再设为 `true`。
- `camroll` — 默认 `true`。
- `absolute` — 默认 `false`（相对模式）；`true` 跟随罗盘。
- `north` — 表示正北的全景 yaw，单位为度，默认 `0`。
- `friction` — `0`–`0.99`，默认 `0`。
- `touchMode` — 默认 `"full"`；取值见上文。
- `softstart` — 启用时的混合秒数，默认 `0.5`。
- `desktopSupport` — 默认 `false`。
- `onAvailable` / `onUnavailable` — 传感器能力探测结果变化时。
- `onEnable` / `onDisable` — 会话实际开启 / 关闭时。
- `onDenied` — 权限被拒绝时（示例中常用来把 `enabled` 设回 `false`）。

这些是 `Gyro` 组件自身的回调。`PanoEvents` 上的 `onGyro*` 订阅同一事件总线，供查看器级监听使用。

## WebVR

`WebVR` 为最近的 `PanoViewer` 增加沉浸式观看。支持的头戴设备优先使用 `immersive-vr` WebXR 会话。无 WebXR 的手机使用设备方向的立体分屏；桌面可提供鼠标驱动的模拟 VR 预览。进入 VR 由宿主通过查看器句柄触发；内置 chrome 仅在会话中显示退出 VR 与 MobileVR 设置（空闲后淡出）。

```tsx
import { useRef } from "react";
import {
  PanoViewer,
  Sphere,
  WebVR,
  type WebVRHandle,
} from "@ericchen1990/pano-view";

export function WebVRExample() {
  const webVRRef = useRef<WebVRHandle>(null);

  return (
    <PanoViewer style={{ height: 560 }}>
      <WebVR
        ref={webVRRef}
        chrome
        fakeSupport
        mobileVr
        onEnterVR={(mode) => console.log("Entered", mode)}
      />
      <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
    </PanoViewer>
  );
}
```

句柄暴露 `enterVR()`、`exitVR()`、`toggleVR()`、`isAvailable()`、`isEnabled()`、`getMode()`、`getState()`、`subscribe()`、`requestPermission()` 与 `resetSettings()`。模式为 `"webxr"`、`"mobilevr"`、`"fake"`。`profile` 接受 `"none"`、`"cardboard-v1"`、`"cardboard-v2"`、`"gear-vr"`、`"daydream"`，或自定义 `{ fov, ipdMm, k1, k2, screenToLensMm?, trayDistanceMm? }` 镜头配置。在已知物理屏幕尺寸时，MobileVR 会用瞳距与可选的托盘到镜片高度（`trayDistanceMm`；Cardboard V1 为 `35`）放置每只眼睛的光轴；`0` 或省略则保持垂直方向居中。当 `screensize` 为 `"auto"` 时，MobileVR 会加载 Cardboard Device Parameter Database（`databaseUrl`，默认 Google 公开 DPDB）估算对角线英寸；传 `""` 或 `null` 可跳过请求。无法识别时触发 `onUnknownDevice`，并继续使用镜头预设 FOV（尺寸未知前不做托盘偏移）。MobileVR 设置值会版本化并保存在当前源的 `localStorage` 中；`resetSettings()` 会清除该存储并恢复 props 或内置默认（Setup 面板也有 Reset）。VR 中中心准星显示十字；注视可交互热点时绘制顺时针填充环，经 `cursorDwellMs`（默认 1500）后触发热点点击。设 `cursorDwellMs={0}` 可保留准星但不自动点击。模拟桌面 VR（`fake` 模式）默认请求指针锁定（`mousePointerLock`），隐藏光标并用鼠标环视；若浏览器释放锁定需再次点击视图。回退会话通过 Screen Wake Lock API 或在不支持时的循环隐藏视频保持屏幕常亮（`wakelock`）。

WebXR 需要 HTTPS 与用户手势。移动端传感器访问也需要 HTTPS，iOS 可能需显式权限提示。嵌入查看器需要适当的 `xr-spatial-tracking`、`gyroscope`、`accelerometer` 权限。iframe 热点、tooltip、视频控件等 DOM 叠加层在沉浸式头戴会话中不可见；基于 mesh 的热点仍可通过默认 WebXR 控制器射线交互。

### 属性

- `chrome` — 默认 `true` 挂载会话内退出 / 设置界面（不含进入 VR 按钮）。也可传外观对象：`background`（默认 `rgba(16, 24, 32, 0.78)`）、`color`（`#ffffff`）、`accent`（`#7dd3fc`）、`borderRadius`（`6`）、`fontSize`（`14`）、可选 `setupTitle`。会话按钮约 3 秒无操作后淡出，与查看器的指针 / 滚轮 / 键盘交互后再次显示。
- `mobileVr` — 默认 `true`。
- `desktopSupport` — 默认 `false`（与 `Gyro` 的同名 prop 独立）。
- `fakeSupport` — 默认 `true`，允许鼠标驱动的桌面模拟 VR。
- `screensize` — `"auto"`（出厂 / 省略时的存储默认）或英寸数；数字会被夹到 **3–20** 并保留一位小数。
- `databaseUrl` — `"auto"` 屏幕尺寸时使用的 Cardboard DPDB URL。默认 `https://storage.googleapis.com/cardboard-dpdb/dpdb.json`。传 `""` 或 `null` 可关闭在线查询。
- `profile` — 省略时用已存设置，出厂为 `"cardboard-v1"`。也可传 `"none"`、`"cardboard-v2"`、`"gear-vr"`、`"daydream"`，或自定义 `{ fov, ipdMm, k1, k2, screenToLensMm?, trayDistanceMm?, label?, id? }`。`trayDistanceMm` 为头显托盘底边到镜片中心的毫米距离；`0` / 省略时垂直光轴保持屏幕中心。
- `absolute` — 默认 `false`。MobileVR 使用罗盘绝对朝向（对 WebXR 无效）。
- `north` — 默认 `0`。启用 `absolute` 时，全景中代表北方的 yaw。
- `friction` — 默认 `0`（范围 `0–0.99`）。MobileVR 陀螺仪平滑；正常观看保持 `0`。
- `touchSupport` — 默认 `false`。为 `true` 时允许水平拖动修正 MobileVR 朝向（`horizontaloffset`）。默认关闭，因为镜筒托盘可能误触。
- `oversampling` — 默认 `1`，夹到 **0.5–2**。仅放大 MobileVR 畸变离屏目标（视口不变）。WebXR 则在会话开始前设置 framebuffer 缩放（会话中途不可改）。
- `foveation` — 可选 WebXR 固定注视点渲染，范围 **0–1**。省略则用设备默认；`0` 为全分辨率，`1` 为边缘最大降采样。
- `frameRate` — 可选 WebXR 目标刷新率：`"low" | "mid" | "high"` 或具体 Hz（取最接近的支持值）。省略则保持 store 默认（`"high"`）。
- `cursor` — 默认 `true`；`false` 关闭中心准星。
- `cursorDwellMs` — 默认 `1500`；`0` 不自动点击。
- `wakelock` / `mousePointerLock` — 默认均为 `true`。
- `onAvailable` / `onUnavailable` — VR 能力变化。
- `onEnterVR` / `onExitVR` — 参数为模式 `"webxr" | "mobilevr" | "fake"`。
- `onDenied` — 权限或会话被拒绝，参数为可选 `error`。
- `onUnknownDevice` — `"auto"` 屏幕尺寸无法从 DPDB 解析时（URL 关闭、无匹配或请求失败）。

## 鼠标、触控与键盘控件

`PanoViewer` 默认启用 `MouseControls`、`TouchControls` 与 `KeyboardControls`。通过 `controls` 配置共享选项；仅当需要覆盖某通道属性时渲染对应控件组件。子实例会替换默认实例 — 无需先将通道设为 `false`。将 `controls.mouse` / `touch` / `keyboard` 设为 `false` 可关闭该通道。

```tsx
<PanoViewer
  controls={{
    invert: false,
    bouncingLimits: false,
    mouse: { zoomSpeed: 0.12, wheel: true, buttons: ["left"] },
    touch: { pinchZoom: true },
    keyboard: { enabled: true, rotateSpeed: 90 },
  }}
  style={{ height: 560 }}
>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

**鼠标**（指针类型 `mouse` / `pen`）：拖拽环视与可选滚轮缩放。默认：`rotateSpeed` `0.35`，`zoomSpeed` `0.08`，`wheel` `true`，`buttons` `["left"]`。

### MouseControls

通过 `controls.mouse` 或渲染子组件 `<MouseControls />` 覆盖默认通道。自行渲染子组件时**不会**继承 `controls.fovSpeed`，需要的话请直接传到组件上。

- `enabled` — 默认 `true`。
- `rotateSpeed` — 默认 `0.35`（相对位移缩放；`0` 关闭旋转）。
- `zoomSpeed` — 默认 `0.08`；滚轮实际步进为 `deltaY * zoomSpeed`。
- `wheel` — 默认 `true`。
- `invert` — 默认 `false`；可覆盖共享 `controls.invert`。
- `buttons` — 默认 `["left"]`；取值 `"left" | "middle" | "right"`。
- `fovSpeed` — 省略则不封顶；有值时把单次滚轮步进夹到 `±fovSpeed`（不是按秒限速）。

### TouchControls

单指拖拽与可选双指缩放。通过 `controls.touch` 或渲染 `<TouchControls />` 覆盖。

- `enabled` — 默认 `true`。
- `rotateSpeed` — 默认 `0.35`，语义同鼠标。
- `invert` — 默认 `false`。
- `pinchZoom` — 默认 `true`。捏合按两指距离比改 FOV，不受 `fovSpeed` 限制。

### KeyboardControls

按住方向键（或自定义绑定）连续环视 / FOV。通过 `controls.keyboard` 或渲染 `<KeyboardControls />` 覆盖。自行渲染时同样不会继承 `controls.fovSpeed`。

- `enabled` — 默认 `true`。
- `rotateSpeed` / `zoomSpeed` — 默认 `60` / `30`（度/秒）。
- `shiftMultiplier` — 默认 `3`。
- `invert` — 默认 `false`，仅翻转上下。
- `fovSpeed` — 省略不封顶；有值时按 `min(zoom, fovSpeed * dt)` 限制。
- `keys` — 按动作整组替换；未写出的动作保留默认；空数组等于解绑该动作。匹配时同时比较 `event.key` 与 `event.code`（均转小写）。
- `onPreviousScene` / `onNextScene` — 有绑定时按键仍会 `preventDefault`；无回调则不换场景。

`controls` 上跨模式共享选项：`enabled`、`invert`（鼠标/触控拖拽方向）、`bouncingLimits`、`fovSpeed`、`frictionStop`（默认 `0.01`），以及既有阻尼 / 惯性选项。

### 覆盖某个控件通道

用所需 props 渲染组件。该通道的默认实例会被跳过：

```tsx
import { useState } from "react";
import {
  KeyboardControls,
  Scenes,
  PanoViewer,
  cycleSceneId,
  type Scene,
} from "@ericchen1990/pano-view";

export function KeyboardExample({ scenes }: { scenes: Scene[] }) {
  const [activeSceneId, setActiveSceneId] = useState(scenes[0]!.id);

  return (
    <PanoViewer style={{ height: 560 }}>
      <KeyboardControls
        keys={{
          left: ["ArrowLeft", "a"],
          right: ["ArrowRight", "d"],
          up: ["ArrowUp", "w"],
          down: ["ArrowDown", "s"],
          zoomIn: ["=", "+"],
          zoomOut: ["-", "_"],
          previousScene: ["[", "PageUp"],
          nextScene: ["]", "PageDown"],
        }}
        rotateSpeed={60}
        zoomSpeed={30}
        onPreviousScene={() => {
          const next = cycleSceneId(scenes, activeSceneId, -1);
          if (next) setActiveSceneId(next);
        }}
        onNextScene={() => {
          const next = cycleSceneId(scenes, activeSceneId, 1);
          if (next) setActiveSceneId(next);
        }}
      />
      <Scenes scenes={scenes} activeSceneId={activeSceneId} />
    </PanoViewer>
  );
}
```

按住移动与缩放键以度/秒连续运动（`rotateSpeed` / `zoomSpeed`）。按住 Shift 乘以倍率（`shiftMultiplier`，默认 `3`）。场景与重置绑定每次按键触发一次。画布须获得焦点才能接收按键（先点击查看器）。

默认绑定：方向键与 WASD 环视；放大用 `+` 与 `=`，缩小用 `-` 与 `_`；`0` 重置；`[` / `PageUp` 与 `]` / `PageDown` 为上一/下一场景（无回调时不换场景，但仍可能拦截按键）。`MouseControls` 与 `TouchControls` 同样可用子组件覆盖。仅当需要关闭某通道时使用 `controls.mouse={false}` / `controls.touch={false}` / `controls.keyboard={false}`。

## 全景坐标事件

当创作 UI 需要光标下的球面位置时，使用全景指针回调。事件位置与相机使用相同的对外角度约定：yaw 为正向右，pitch 为正向上。

```tsx
import {
  PanoViewer,
  Sphere,
  panoPositionToVector3,
  type HotspotPosition,
} from "@ericchen1990/pano-view";

export function PlacementExample() {
  const place = (position: HotspotPosition) => {
    const worldPosition = panoPositionToVector3(position, 10);
    console.log(position, worldPosition);
  };

  return (
    <PanoViewer
      onPanoramaClick={({ position }) => place(position)}
      onPanoramaDoubleClick={({ position }) => console.log("double", position)}
      onPanoramaPointerMove={({ position }) => console.log("move", position)}
      style={{ height: 560 }}
    >
      <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
    </PanoViewer>
  );
}
```

`normalizePanoPosition`、`normalizePanoYaw`、`clampPanoPitch` 与 `vector3ToPanoPosition` 也会导出，供受控创作流程使用。Yaw 归一化到 `[-180, 180)`。Pitch 钳制到 `[-90, 90]`；在任一极点，yaw 归一化为 `0`，因为该处 yaw 不唯一确定一点。

## PanoEvents

`PanoEvents` 对应 krpano 全局 `<events>` 元素的 React 版本。在 `PanoViewer` 内渲染一个或多个实例以订阅查看器级生命周期与交互回调。多个实例可并存（类似 krpano 命名 events）；各自维护 `idleTime`。在自定义子组件内组合时使用 `usePanoEvents`。

### usePanoEvents

```tsx
import {
  AutoRotate,
  PanoEvents,
  PanoViewer,
  Sphere,
} from "@ericchen1990/pano-view";

<PanoViewer style={{ height: 560 }}>
  <PanoEvents
    idleTime={3000}
    onIdle={() => console.log("idle")}
    onIdleEnd={() => console.log("active again")}
    onViewSettled={(view) => console.log("settled", view)}
    onViewInteractionStart={({ source }) => console.log("drag", source)}
    onClick={({ position }) => console.log("pano click", position)}
    onEnterFullscreen={() => console.log("fullscreen")}
    onAutoRotateOneRound={() => console.log("full turn")}
  />
  <AutoRotate enabled />
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>;
```

支持的回调（适用处标注 krpano 名称）：

- 视图：`onViewChange`（`onviewchange`）、`onViewSettled` — 参数均为 `{ yaw, pitch, fov }`。视角变化时发 `viewchange`；惯性/补间首次停稳或指令动画结束时发 `viewsettled`。
- `onViewInteractionStart` / `onViewInteractionEnd` — `{ source }`，`source` 为 `"mouse" | "touch" | "keyboard"`。
- 全景外壳上的指针（非热点）：`onClick`、`onDoubleClick`、`onPointerDown`、`onPointerUp`、`onPointerMove`、`onContextMenu` — 参数为 `PanoramaPointerEvent`（`position`、`nativeEvent`、`button`、`buttons`、`clientX`、`clientY`、可选 `pointerId`）。
- `onWheel` — 仅鼠标滚轮；触控捏合不会合成 wheel 事件。参数 `{ delta, nativeEvent }`，`delta` 与 `WheelEvent.deltaY` 同号。
- 空闲：`onIdle` / `onIdleEnd`，每实例 `idleTime`（毫秒，默认 `2000`）
- 全屏：`onEnterFullscreen` / `onExitFullscreen`（无参数）
- `onResize` — `{ width, height }`，来自画布 content-box 的 `ResizeObserver`
- 自动旋转：`onAutoRotateStart` / `onAutoRotateStop` / `onAutoRotateOneRound`（无参数）
- 陀螺仪：`onGyroAvailable` / `onGyroUnavailable` / `onGyroEnable` / `onGyroDisable` / `onGyroDenied`（无参数）
- VR：`onVRAvailable` / `onVRUnavailable` / `onVREnter` / `onVRExit` / `onVRDenied` / `onVRUnknownDevice`。进入与退出携带模式 `"webxr" | "mobilevr" | "fake"`；`onVRDenied` 可带可选 `error`。

`PanoViewer` 现有的 `onViewChange` / `onPanoramaClick` / `onPanoramaDoubleClick` / `onPanoramaPointerMove` props 仍受支持，共用同一事件总线。`usePanoEvents` 与 `<PanoEvents>` 接受同一组 props，hook 无返回值。

资源加载回调由各组件提供：`Sphere` 使用 `onLoad`、`onError` 和 `onPreviewError`；`Tile` / `SphereTile` 使用 `onLoadProgress`、`onTileError` 和 `onPreviewError`。各源通过 `onReady` 报告首次可绘制状态；`Scenes` 通过 `onSceneReady`、`onTransitionEnd` 和 `onTransitionError` 报告场景状态。本包不逐一实现 krpano 的 XML 加载与逐帧渲染事件；VR 生命周期请使用上方的 `onVR*`。

## PanoContextMenu

`PanoViewer` 会始终屏蔽浏览器原生右键菜单（包括画布、内置界面与其他叠加层），并挂载默认右键菜单。默认项：**Reset view** 与 **Enter fullscreen** / **Exit fullscreen**（文案与图标随全屏状态变化），中间有分隔线。

```tsx
<PanoViewer style={{ height: 560 }}>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

关闭默认菜单（浏览器原生菜单仍会被屏蔽；若仍需自定义菜单，请自行挂载 `PanoContextMenu`）：

```tsx
<PanoViewer contextMenu={false}>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

保留默认项的同时调整外观：

```tsx
<PanoViewer contextMenu={{ appearance: { opacity: 0.92, borderRadius: 8 } }}>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

### 在不重建默认项的情况下添加项

使用 `append` 或 `prepend` 保留内置 Reset / Fullscreen 条目，仅添加自定义项：

```tsx
<PanoViewer
  contextMenu={{
    append: [
      "separator",
      {
        id: "copy",
        label: "Copy yaw / pitch",
        onSelect: ({ position }) => {
          void navigator.clipboard.writeText(
            `${position.yaw.toFixed(1)}, ${position.pitch.toFixed(1)}`,
          );
        },
      },
    ],
  }}
  style={{ height: 560 }}
>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

### 内置预设

需要自定义顺序时，按 id 复用内置预设，无需重写全屏进入/退出状态：

- `"resetView"` — 重置视图
- `"fullscreen"` — 进入 / 退出全屏及对应图标
- `"separator"` — 水平分隔线

```tsx
<PanoViewer
  contextMenu={{
    items: [
      "resetView",
      "separator",
      {
        id: "copy",
        label: "Copy yaw / pitch",
        onSelect: ({ position }) => {
          void navigator.clipboard.writeText(
            `${position.yaw.toFixed(1)}, ${position.pitch.toFixed(1)}`,
          );
        },
      },
      "separator",
      "fullscreen",
    ],
  }}
  style={{ height: 560 }}
>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

使用 `{ preset: "fullscreen", label: "…" }` 可覆盖预设菜单项的显示文案；预设还可覆盖 `id`、`className`、`style`、`disabled`、`hidden`。在 prop 外完全手动组装时（例如自定义 `PanoContextMenu` 子组件），调用 `createPanoContextMenuPresets({ reset, toggleFullscreen, isFullscreen })` 并使用 `.resetView` / `.fullscreen` / `.defaults`。

具体项可使用 `icon` React 节点或 `image` URL（可用 `imageAlt`）。条目还可设 `disabled`、`hidden`、`className`、`style`。`onSelect` 上下文含 `position`、`view`、`nativeEvent` 与 `close()`。分隔线始终来自 `"separator"` 预设。

传入 `items` 时会忽略 `prepend` / `append`。`children` 为完全自定义渲染：`(props: { event, view, close }) => ReactNode`，优先于 `items`；打开、关闭与定位仍由组件处理。也可用 `className`、`style`、`itemClassName`、`separatorClassName`。

外观字段与默认值：`background` `#161616`，`color` `#f4f4f4`，`border` `"1px solid #2e2e2e"`，`borderRadius` `8`，`shadow` `"0 8px 24px rgba(0,0,0,0.45)"`，`opacity` `1`（仅背景，钳制到 `[0.4, 1]`；标签与图标保持不透明），`fontSize` `13`，`minWidth` `180`，`padding` `4`，`iconSize` `16`，`itemPadding` `"6px 10px"`，`itemHoverBackground` `#2a2a2a`，`itemDisabledColor` `#777777`，`separatorColor` `#333333`，`separatorMargin` `"4px 6px"`。若需半透明填充而不使用 `opacity`，仍可传 `background: "rgba(...)"`。

完全自定义 DOM 菜单时，设 `contextMenu={false}` 并渲染 `PanoContextMenu` 子组件。不要同时挂载默认菜单与子 `PanoContextMenu`。避免与 `controls.mouse.buttons: ["right"]` 同时使用 — 两者都会占用右键。

## 共享热点约定与可序列化定义

每个热点有 `id`，以及可选的共享字段与语义交互回调。点热点此外还使用受控 `position`、角度 `width`/`height`、热点 `mode` 与下文缩放选项。`interactive={false}` 保持热点可见，同时让绘制工具接收其下方的全景指针事件。`pointerEvents="none"` 忽略鼠标、触控与笔，事件穿透到全景，热点仍可键盘交互。可交互热点悬停时画布光标为 `pointer`；若设置了热点 `cursor` 则使用该值。

共享字段默认与用法：

- `visible` — 默认 `true`。
- `renderOrder` — 点热点默认 `0`；多边形 / 折线默认 `10`。
- `opacity` — 默认 `1`；作用于点热点纹理 / iframe 等。
- `selected` — 默认 `false`；为 `true` 时画出约 3px 选中框（创作态常用）。
- `interactive` — 默认 `true`；`pointerEvents` 默认 `"auto"`。
- `onHoverChange(hovered, event)` — 第一个参数为布尔悬停态，第二个为交互事件。
- `onClick` — 位置与输入源（`"pointer"` 或 `"keyboard"`）。
- 点热点拖拽：`draggable` 开启后，`onDragStart` 在开始拖动时触发，`onPositionChange` 在移动中报告新位置（宿主须写回状态），`onDragEnd` 在释放时触发。多边形 / 折线的同名回调携带顶点集合，见对应组件节。

各点热点省略 `width` / `height` 时的默认角尺寸：`ImageHotspot` / `SequenceHotspot` `12×8`；画布 `GraphicHotspot` `10×10`（`kind: "svg"` 走图像路径时为 `12×8`）；`VideoHotspot` `16×9`；`AudioHotspot` `8×8`；`TextHotspot` `16×6`；`IframeHotspot` `18×12`。

```tsx
<TextHotspot
  id="caption"
  pointerEvents="none"
  position={{ yaw: 12, pitch: -8 }}
  text="Decorative label"
/>
```

点热点可使用 `draggable`、`onDragStart`、`onPositionChange`、`onDragEnd`；宿主须将报告的位置写回状态。多边形与折线热点通过 `onVerticesChange` 报告受控 `vertices`。

每个热点可在锚点显示 DOM tooltip。将字符串或 `{ text?, image?, imageAlt? }` 作为 `tooltip` 传入。默认 `tooltipTrigger` 为 `"always"`：有内容且热点可见时气泡常驻屏幕。点击热点不会切换显示。可选 `tooltipTrigger="hover"` 在指针悬停或键盘焦点时显示；`"click"` 固定显示直至再次点击热点或点击空白全景。hover 与 click 触发需要 `interactive` 且 `pointerEvents` 不为 `"none"`。

`tooltipPlacement` 为 `"top"`（默认）、`"bottom"`、`"left"`、`"right"`。均为屏幕方向：气泡位于热点投影边界该侧之外，避免遮挡旋转后的图形（如箭头）。`tooltipOffset` 为屏幕空间间距（CSS 像素，默认 `12` / `DEFAULT_HOTSPOT_TOOLTIP_OFFSET`）。

可选 `tooltipAppearance` 覆盖气泡绘制。未设字段保留库默认主题（`DEFAULT_HOTSPOT_TOOLTIP_APPEARANCE`）：背景、文字色、边框、圆角、阴影、内边距与字号。

```tsx
<ImageHotspot
  id="gallery"
  ariaLabel="Open gallery"
  position={{ yaw: 28, pitch: -4 }}
  src="/hotspots/gallery.webp"
  tooltip={{ text: "Courtyard gallery", image: "/hotspots/gallery-thumb.webp" }}
  tooltipPlacement="top"
  tooltipOffset={16}
  tooltipAppearance={{
    background: "rgba(12, 28, 36, 0.88)",
    color: "#e7f2f5",
    border: "1px solid rgba(56, 84, 91, 0.9)",
    borderRadius: 10,
    shadow: "0 10px 28px rgba(0, 0, 0, 0.42)",
    padding: 10,
    fontSize: 13,
  }}
/>
```

按悬停触发的提示框示例：

```tsx
<GraphicHotspot
  id="marker"
  ariaLabel="Signal"
  position={{ yaw: -18, pitch: 9 }}
  graphic={{ kind: "ring" }}
  tooltip="Hover for details"
  tooltipTrigger="hover"
  tooltipPlacement="right"
/>
```

持久化或宿主编辑器可使用导出的判别联合类型 `HotspotDefinition`。渲染时按 `type` 区分各变体；使用穷尽检查的 `switch` 时，应覆盖联合类型中的全部热点类别：

```ts
import type { HotspotDefinition } from "@ericchen1990/pano-view";

const hotspots: HotspotDefinition[] = [
  { type: "image", id: "gallery", position: { yaw: 24, pitch: -5 }, src: "/hotspots/card.webp" },
  { type: "graphic", id: "marker", position: { yaw: -18, pitch: 9 }, graphic: { kind: "ring" } },
  { type: "sequence", id: "pulse", position: { yaw: -42, pitch: -7 }, src: "/hotspots/pulse.png", frameCount: 20 },
  { type: "video", id: "clip", position: { yaw: 48, pitch: 6 }, src: "/hotspots/clip.webm" },
  { type: "audio", id: "fountain", position: { yaw: -30, pitch: -8 }, src: "/hotspots/fountain.mp3", range: 90 },
  { type: "text", id: "caption", position: { yaw: 0, pitch: -16 }, text: "Courtyard overlook" },
  { type: "iframe", id: "guide", position: { yaw: -62, pitch: 4 }, src: "/hotspots/embed.html" },
  { type: "polygon", id: "zone", vertices: [{ yaw: 12, pitch: 4 }, { yaw: 22, pitch: 4 }, { yaw: 18, pitch: 14 }] },
  { type: "polyline", id: "route", vertices: [{ yaw: -8, pitch: 1 }, { yaw: 4, pitch: 8 }] },
];
```

定义仅含数据。在宿主中用 switch 渲染，应用特定的点击行为、受控媒体状态与错误报告属于宿主职责。项目 JSON 里的 `label` 不是组件 prop；`ProjectScenes` 会用 `hotspot.label || hotspot.id` 作为无障碍名称（`ariaLabel`）。`selected` 只存在于运行时 props，不会写入定义。

## ImageHotspot

`ImageHotspot` 在受控球面位置渲染图像。尺寸为角度（度），与画布分辨率无关。

```tsx
import { ImageHotspot, PanoViewer, Sphere } from "@ericchen1990/pano-view";

<PanoViewer style={{ height: 560 }}>
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
  <ImageHotspot
    id="gallery"
    ariaLabel="Open gallery"
    position={{ yaw: 28, pitch: -4 }}
    width={18}
    height={10}
    mode="surface"
    src="/hotspots/gallery.webp"
    onClick={({ position }) => console.log("gallery", position)}
  />
</PanoViewer>;
```

设 `draggable` 并在 `onPositionChange` 中更新受控位置以移动选中热点。可点击热点需要 `ariaLabel`：PanoViewer 会创建内部语义控件以支持 Tab、Enter 与 Space，并显示 WebGL 焦点轮廓。

`ImageHotspot` 调用 `onLoad(texture)` 与 `onError(error)`。省略尺寸时默认 `width={12}`、`height={8}`。

## GraphicHotspot

`GraphicHotspot` 接受内置 `circle`、`triangle`、`diamond`、`star`、`arrow`、`rectangle`、`ring` 图形、SVG URL，或带显式 viewBox 的安全 SVG path 数据。内置图形支持 `fill`、`stroke`、`strokeWidth`；矩形支持相对 `cornerRadius`（`0` 到 `0.5`）；环支持 `innerRadius`（相对外半径的比例，默认 `0.58`）。画布图形的 `strokeWidth` 是 **512 纹理**上的线宽（默认 `8`），与多边形屏幕像素线宽不同。`kind: "path"` 需要 `path` 与 `viewBox: [x, y, width, height]` 四元组。

```tsx
import { GraphicHotspot } from "@ericchen1990/pano-view";

<GraphicHotspot
  id="wayfinding"
  ariaLabel="Open wayfinding point"
  position={{ yaw: -18, pitch: 9 }}
  width={8}
  height={8}
  graphic={{
    kind: "ring",
    fill: "#df6b42",
    stroke: "#f5fbfc",
    strokeWidth: 8,
    innerRadius: 0.64,
  }}
  onClick={({ position }) => console.log("wayfinding", position)}
/>
```

三角形、菱形、星形与箭头使用相同绘制属性。三角形与箭头在 `rotation={0}` 时指向上方；用热点 `rotation` 调整方向。

```tsx
<GraphicHotspot
  id="direction"
  ariaLabel="Open next scene"
  position={{ yaw: 8, pitch: 2 }}
  rotation={45}
  width={8}
  height={8}
  graphic={{
    kind: "arrow",
    fill: "#df6b42",
    stroke: "#f5fbfc",
    strokeWidth: 8,
  }}
/>
```

`cornerRadius` 相对于渲染图形较短边：`0` 为直角，`0.5` 为最大圆角。该值为相对比例，不使用纹理像素作为单位。

`GraphicHotspot` 与 `ImageHotspot` 相同，使用 `onLoad(texture)` 与 `onError(error)`。内置 path 本地栅格化；仅接受 SVG URL 或 SVG `path` 加显式 `viewBox`，不接受任意 SVG 标记。画布图形默认角尺寸 `10×10`；`kind: "svg"` 走图像加载时默认 `12×8`。

## 热点模式与缩放行为

点热点通过 `mode` 统一设置朝向与放置方式：

- `mode="surface"` 将平面附着于局部全景表面。
- `mode="billboard"` 使平面始终朝向相机并浮于壳层前方。`distance` 是热点到相机的距离（世界单位，默认 `10`），减小该值可将热点移近相机。内置全景壳层约在 `1000` 单位；距离会自动限制在允许范围内，避免热点角点穿过壳层。
- `scaleMode="fov"`（默认）在用户放大时热点变大。`scaleMode="fixed"` 补偿 FOV 变化，屏幕尺寸接近 `referenceFov`（默认 `75`）时的大小。
- `rotation` 绕自身法线旋转（度）；正值顺时针，负值逆时针。`scale` 为角向 width/height 的整体正倍率，默认 `1`。

```tsx
<ImageHotspot
  id="callout"
  ariaLabel="Open callout"
  position={{ yaw: 18, pitch: 5 }}
  width={10}
  height={6}
  mode="billboard"
  distance={14}
  rotation={-12}
  scale={1.25}
  scaleMode="fixed"
  src="/hotspots/callout.webp"
/>
```

## PolygonHotspot

`PolygonHotspot` 用三个及以上受控 yaw/pitch 顶点渲染局部球面区域。支持凹多边形与 `-180°/180°` 接缝。组件会报告（而非渲染）自相交、包含极点或无法放入单半球的多边形。

```tsx
import { PolygonHotspot } from "@ericchen1990/pano-view";

<PolygonHotspot
  id="exhibit-zone"
  ariaLabel="Open exhibit zone"
  vertices={[
    { yaw: 16, pitch: 8 },
    { yaw: 31, pitch: 7 },
    { yaw: 27, pitch: 19 },
    { yaw: 19, pitch: 16 },
  ]}
  fill="#df6b42"
  fillOpacity={0.32}
  stroke="#f5fbfc"
  strokeWidth={2}
  strokeOpacity={0.8}
  strokeDashSize={8}
  strokeGapSize={4}
  draggable
  onVerticesChange={({ vertices }) => setZoneVertices(vertices)}
  onInvalid={(issues) => console.error(issues)}
/>
```

`strokeWidth` 为屏幕空间 CSS 像素，FOV 变化时视觉一致。`strokeDashSize` 与 `strokeGapSize` 同为 CSS 像素；省略或设 `strokeDashSize` 为 `0` 为实线。拖拽整体平移所有顶点，同时归一化 yaw、钳制 pitch。单顶点编辑由创作工作流提供，非运行时热点组件职责。

默认：`fill` `#df6b42`，`fillOpacity` `0.34`，`stroke` `#f5fbfc`，`strokeWidth` `2`，`strokeOpacity` `1`，`renderOrder` `10`。`onDragStart` / `onDragEnd` / `onVerticesChange` 的载荷是顶点事件（`vertices`、`startVertices`、`position`、`startPosition`），不是点热点的位置拖拽事件。`onInvalid` 的 `code` 为 `too_few_vertices`、`self_intersection`、`contains_pole`、`outside_hemisphere`。

设 `fillOpacity={0}` 可得仅轮廓闭合多边形。填充与轮廓共用相同球面边界采样，使轮廓沿填充区域的边界绘制。

## PolylineHotspot

`PolylineHotspot` 为至少两个 yaw/pitch 顶点的开放路径。与 `PolygonHotspot` 相同，使用 CSS 像素 `strokeWidth`、可选虚线（`strokeDashSize` / `strokeGapSize`）、可见性、语义交互、受控整路径拖拽与顶点变更回调，但不连接末点与首点，且无填充。

```tsx
import { PolylineHotspot } from "@ericchen1990/pano-view";

<PolylineHotspot
  id="guided-route"
  ariaLabel="Guided route"
  vertices={routeVertices}
  stroke="#75cbd3"
  strokeWidth={2}
  strokeOpacity={0.9}
  strokeDashSize={8}
  strokeGapSize={4}
  draggable
  onVerticesChange={({ vertices }) => setRouteVertices(vertices)}
/>;
```

`onInvalid` 仅报告一种无效运行时形状：少于两个顶点（`code: "too_few_vertices"`）。默认 `stroke` `#f5fbfc`、`strokeWidth` `2`、`strokeOpacity` `1`、`renderOrder` `10`。拖拽回调同样携带顶点集合（`PolylineVerticesChangeEvent`）。

## SequenceHotspot

`SequenceHotspot` 动画播放精灵图：等尺寸帧组成的竖向或横向条带。与常见 krpano 动画热点格式一致。`width` 与 `height` 应使用单帧宽高比，而非整条带。`playing` 由宿主受控；`fps` 默认 `12`，`loop` 默认 `true`，`frameDirection` 默认 `"vertical"`。省略尺寸时默认 `12×8`。

```tsx
import { SequenceHotspot } from "@ericchen1990/pano-view";

<SequenceHotspot
  id="pulse"
  ariaLabel="Play marker sequence"
  position={{ yaw: -42, pitch: -7 }}
  width={8}
  height={8}
  src="/hotspots/pulse-strip.png"
  frameCount={20}
  frameDirection="vertical"
  fps={12}
  loop
  playing={isPulsePlaying}
  onEnded={() => setPulsePlaying(false)}
  onError={({ error }) => console.error(error)}
/>;
```

序列加载使用 `onLoadProgress`（`{ id, total, loaded, failed }`）与 `onError`（`{ id, src, error }`）。另有 `onFrameChange`（`{ id, index, src }`）与 `onPlaybackStateChange`（`"playing" | "paused" | "ended"`，无 `"blocked"`）。组件不会自行改变 `playing`：请在 UI、点击处理、`onEnded` 或播放错误中更新该 prop。

## VideoHotspot

`VideoHotspot` 使用 `HTMLVideoElement` 与 `VideoTexture`。其 `playing` prop 同样受控：在点击处理或应用状态中切换。源变更或卸载时元素暂停并释放纹理。`playsInline` 默认 `true`，并使用与 `PanoVideo` 相同的内联播放属性。元素会隐藏挂在查看器内，以便移动端浏览器把它留在页面中。`muted` 默认 `true`，`loop` 默认 `false`，`preload` 默认 `"metadata"`（另可 `"none"` | `"auto"`），`volume` 默认 `1`（0–1）。省略尺寸时默认 `16×9`。非同源资源可设 `crossOrigin`（`""` | `"anonymous"` | `"use-credentials"`）。

```tsx
import { VideoHotspot } from "@ericchen1990/pano-view";

<VideoHotspot
  id="clip"
  ariaLabel="Play room video"
  position={{ yaw: 48, pitch: 6 }}
  width={18}
  height={10.125}
  mode="surface"
  src="/hotspots/room.webm"
  poster="/hotspots/room-poster.webp"
  playing={isClipPlaying}
  muted
  volume={0.8}
  onClick={() => setClipPlaying((playing) => !playing)}
  onEnded={() => setClipPlaying(false)}
  onPlaybackStateChange={(state) => console.log(state)}
  onPlaybackError={(error) => console.error(error)}
/>;
```

浏览器可能拒绝非静音或非手势播放。此时 `onPlaybackStateChange` 收到 `"blocked"`，`onPlaybackError` 收到浏览器错误；宿主仍控制 `playing` 并提供显式用户操作。

视频通过 `onError` 报告媒体与 poster 失败，参数含 `source: "poster" | "video"`。与 `SequenceHotspot` 相同，不会自行改变 `playing`，以保证源变更、卸载与 React StrictMode 生命周期可预测。

## AudioHotspot

`AudioHotspot` 在球面位置播放定向声音。立体声像跟随相机朝向；`range` 指视线偏离声源达到该角度时，音量衰减至静音。默认 `360` 表示不因视角衰减（仅左右声像）。定点声源可使用较小值，例如 `90`。

音频通过 Howler.js 的 Web Audio 模式播放（Howler.js 已包含在本包构建产物中，宿主无需另行安装）。文件需完成解码后才能开始播放，可使用 MP3 格式。`src` 可以是字符串或回退 URL 数组。组件不使用 HTML5 流式音频模式，以保留立体声像控制。

对于 `blob:` 等没有扩展名的音频地址，可传 `format="mp3"`，或按素材顺序传格式数组。`project.json` 中的音频定义也支持可选 `format` 字段。

`playing` 与 `VideoHotspot` 一样受控。`loop` 默认 `false`，`muted` 默认 `false`，`volume` 默认 `1`，`pauseWhenHidden` 默认 `true`（标签页隐藏时暂停，`playing` 仍为 `true` 时，在标签页恢复可见后继续播放）。首次用户手势会解锁音频；若自动播放被阻止，会报告 `"blocked"`，并在 `playing` 仍为 true 时于下一次指针或按键后重试 `play()`。

默认标记在 **停止**（扬声器）与 **播放**（扬声器 + 声波）之间切换。可用 `icon` 自定义停止图标、`playingIcon` 自定义播放图标。只设 `icon` 时两种状态共用该图。`marker={false}` 隐藏标记，仍保留定点声源。整个漫游共用或按场景切换的非空间背景音频请使用 [`BackgroundAudio`](#backgroundaudio)。

```tsx
import { AudioHotspot } from "@ericchen1990/pano-view";

<AudioHotspot
  id="fountain"
  ariaLabel="Fountain"
  position={{ yaw: -30, pitch: -8 }}
  src="/hotspots/fountain.mp3"
  playing={isFountainPlaying}
  loop
  volume={0.8}
  range={90}
  onClick={() => setFountainPlaying((playing) => !playing)}
  onEnded={() => setFountainPlaying(false)}
  onPlaybackStateChange={(state) => console.log(state)}
  onPlaybackError={(error) => console.error(error)}
/>;
```

与其他媒体热点相同，`AudioHotspot` 不会自行改变 `playing`。省略标记尺寸时默认 `8×8`。也可设 `crossOrigin`；加载失败走 `onError({ id, error })`，与 `onPlaybackError` 不同。

## TextHotspot

`TextHotspot` 将纯文本栅格化到 canvas 纹理。不接受 HTML 或 Markdown。`\n` 为硬换行；`whiteSpace="normal"`（默认）在热点角向宽度内自动换行，也可 `"nowrap"`。尺寸与其他点热点一样为度，默认面板 `16×6`。排版使用与 CSS 相同的名称（`fontFamily`、`fontSize`、`fontWeight`、`fontStyle`），但绘制在 canvas 上，非 DOM 样式。`fontSize` 为 canvas 像素（默认 96），不随面板高度缩放。`fontWeight` 默认 `600`，`fontStyle` 默认 `"normal"`。`align` 默认 `"center"`（`left` | `center` | `right`），`verticalAlign` 默认 `"middle"`（`top` | `middle` | `bottom`）。`color` 默认 `#f8fafc`；`background` 默认 `#111827`（空字符串跳过底板）；`backgroundOpacity` 默认 `0.72`。`padding` 默认 `0.08`，`borderRadius` 默认 `0.08`（相对较短边，`0`–`0.5`）。`lineHeight` 默认 `1.25`（相对字号的倍数）。`stroke` / `strokeWidth` 在 `strokeWidth > 0` 时描边（默认宽度 `0`）。

```tsx
import { TextHotspot } from "@ericchen1990/pano-view";

<TextHotspot
  id="caption"
  ariaLabel="Courtyard overlook"
  position={{ yaw: 0, pitch: -16 }}
  width={16}
  height={6}
  mode="billboard"
  scaleMode="fixed"
  text={"Courtyard overlook\nNorth terrace"}
  fontFamily="system-ui, sans-serif"
  fontSize={96}
  fontWeight={600}
  fontStyle="normal"
  align="center"
  verticalAlign="middle"
  color="#f8fafc"
  background="#111827"
  backgroundOpacity={0.72}
/>;
```

在热点绘制前于页面加载自定义 `fontFamily`。存在 `document.fonts.load` 时热点会等待，再用文档已有字体绘制。`onLoad(texture)` 与 `onError(error)` 与 `ImageHotspot` 一致。

## IframeHotspot

`IframeHotspot` 通过 `@react-three/drei` 的 `Html` `transform` 嵌入文档，故与纹理平面相同，遵循热点 mode、rotation 与缩放。iframe 为 DOM 叠加层，不会被全景壳层遮挡。无 `srcdoc` prop。

```tsx
import { IframeHotspot } from "@ericchen1990/pano-view";

<IframeHotspot
  id="guide"
  ariaLabel="Open visitor guide"
  position={{ yaw: -62, pitch: 4 }}
  width={18}
  height={12}
  mode="billboard"
  src="/hotspots/embed.html"
  pointerPolicy="hotspot"
/>;
```

`pointerPolicy="hotspot"`（默认）将 iframe 设为 `pointer-events: none`，点击与拖拽作用于 WebGL 平面。`"content"` 使页面可交互并阻止穿透拖拽。热点 `pointerEvents="none"` 也会强制 iframe 叠加层不捕获指针。`sandbox` 默认为 `allow-scripts allow-popups allow-forms`，不含 `allow-same-origin`。`referrerPolicy` 默认为 `strict-origin-when-cross-origin`。另可设 `title`（省略时用 `ariaLabel`）、`allow`、`loading`（`"eager"` | `"lazy"`）、`background`，以及 `onLoad` / `onError`。省略尺寸时默认 `18×12`。优先同源文档；许多第三方站点发送 `X-Frame-Options` 无法加载。

## Next.js 与 SSR

组件入口标记为客户端模块，应在 Client Component 边界内渲染。服务端加载配置时使用 `@ericchen1990/pano-view/data`。全景资源由浏览器加载；查看器本身无需 API 密钥，资源服务器仍需配置正确的访问权限与 CORS。

在 Client Component 或全局 CSS 中导入一次样式表：

```ts
import "@ericchen1990/pano-view/styles.css";
```

见 [样式表（HTML 叠加层）](#样式表html-叠加层)。

## 球面多分辨率瓦片

`SphereTile` 渲染覆盖完整 2:1 等距圆柱全景的多分辨率瓦片金字塔。组件根据视角、缩放和纹理预算选择瓦片，将每块瓦片作为独立纹理映射到对应的球面区域；尚未加载的区域使用较低分辨率瓦片或预览图显示。

这一方式无需将整个全景加载为单张高分辨率纹理，可降低大图解码和纹理上传的峰值开销；实际内存占用仍取决于瓦片尺寸、可见层级和缓存预算。当前球面渲染在顶部、底部极点附近仍可能出现可见瑕疵。新生成的全景资源优先采用立方体瓦片 [`Tile`](#tile)；已有等距圆柱瓦片可使用 `SphereTile`。

基本用法：

```tsx
import { PanoViewer, SphereTile } from "@ericchen1990/pano-view";

<PanoViewer>
  <SphereTile
    baseUrl="/panoramas/legacy"
    multires="512,257x129,513x257,1025x513,2050x1025,4100x2050"
    urlTemplate="tiles/%l/%h_%v.webp"
    previewUrl="previews/400.webp"
    indexBase={0}
  />
</PanoViewer>;
```

格式对应 Sharp Deep Zoom 的 `size: 512`、`depth: "onetile"`、`layout: "dz"`、
无重叠瓦片。Sharp 原始输出使用 `indexBase={0}`，支持不足一块的边缘瓦片。
默认的 `indexBase={1}` 兼容层级、列、行都从 **1** 开始的存量 krpano 球面资源。
回调与 `resolveTileUrl` 接收的逻辑地址始终从 0 开始，`indexBase` 只作用于 URL 模板。`multires` 也可传 `{ tileSize, levels: [{ width, height }] }`。
应使用资源的真实层级尺寸，奇数尺寸逐级取整，不能简单乘二推导。每级应为完整的
2:1 全景，允许最多两像素的取整误差。

相对路径基于 `baseUrl`，绝对路径与 URL 保持原样。`resolveTileUrl(address)` 优先于
模板。模板支持 `%l`、横向 `%h`/`%x`/`%u`/`%c`、纵向 `%v`/`%y`/`%w`/`%r`，
以及 `%00h` 等补零。`yawOffset` 旋转图像；图像中心为 yaw 0，向右为正 yaw，向上为正 pitch。

`maxTextureMemoryMb`（默认 128）、`maxConcurrentLoads`（4）、`retryCount`（1）
控制单个组件的瓦片缓存。预览图内存单独计算。当可见细节与回退层级超出预算时，
采用较粗层级，预览始终作为底图。`loadMode` 支持 `full`（默认）、`base` 和 `preview`；
`visible={false}` 仅预加载。`onReady` 在一个源的首个可绘制预览或瓦片就绪时触发一次，
预览失败时仍可通过瓦片就绪。错误与进度通过 `onPreviewError`、`onTileError`、
`onLoadProgress`、`onLevelChange` 提供；回调中的层级同样从 0 开始。
卸载时释放组件纹理，丢弃迟到的加载结果。

可以将 `SphereTile` 直接放在 `PanoViewer` 下，也可以在 `Scenes` 中使用
`type: "sphereTile"` 的 `SphereTileScene`。所有过渡预设（包括 `dissolve`）均支持
`sphere`、立方体 `tile` 和球面多级瓦片 `sphereTile` 之间的切换：

```tsx
import { Scenes, type Scene } from "@ericchen1990/pano-view";

const scenes: Scene[] = [
  {
    id: "courtyard",
    type: "sphereTile",
    baseUrl: "/panoramas/courtyard/",
    multires: "512,500x250,1000x500,2000x1000",
    previewUrl: "previews/400.webp",
    urlTemplate: "tiles/%l/%h_%v.webp",
    indexBase: 1,
  },
  // 在此添加 sphere、tile 或其他 sphereTile 场景。
];

<Scenes scenes={scenes} activeSceneId={activeSceneId} transition="dissolve" />;
```

`onSceneReady(sceneId)` 在首个场景可绘制、或旧画面截图完成且新场景接管时触发。
此时过渡可能仍在进行，可在该回调中设置新场景视角而不改变旧画面快照。
高分辨率细节在这次交接之后加载，转场期间也会继续加载。`transitionWaitForDetailMs`
可以在设定时限内保留旧快照，等待当前视野的目标细节层级就绪，但不会改变 `onSceneReady` 的触发时机。
`onTransitionEnd` 表示混合效果播放完成。

`SphereTileScene` 保留 `SphereTile` 的资源选项，包括 `indexBase`、`resolveTileUrl`
和 `yawOffset`。可见性、预加载、就绪判断与过渡由 `Scenes` 管理；通过其
`onTransitionEnd` 和 `onTransitionError` 接收结果。`Scenes` 的共享纹理预算与请求
并发上限同时作用于立方体和球面瓦片。独立使用的 `SphereTile` 仍保留原有缓存、
回调与加载选项。

## 无障碍颜色矩阵与标签排版

`PanoFilter.colorMatrix` 接收只读的行优先 4×5 RGBA 矩阵（20 个有限数值，与 SVG
`feColorMatrix` 一致），在预设滤镜之后、显示/sRGB 颜色空间中应用。`intensity`
控制各效果与其输入颜色的混合比例，`enabled={false}` 关闭预设和矩阵。`colorMatrixScope="all"`
将矩阵同时应用于热点纹理；默认 `"panorama"` 保持原有行为。艺术预设始终仅作用于
全景。HTML 标签、iframe 和其他 DOM 界面仍由宿主设置样式。

热点的 `tooltipAppearance` 支持 `fontFamily`、`lineHeight`、`letterSpacing`，
配合 `fontSize` 使用。数字 `lineHeight` 为无单位倍数，数字 `letterSpacing` 为 CSS 像素。

回归验证：`pnpm --filter @ericchen1990/pano-view test`（Node 22+）。

## 常见问题与故障排查

### 为什么推荐立方体瓦片？

[`Tile`](#tile) 根据视野和缩放加载立方体瓦片，可避免将完整全景作为单张超大纹理加载，并避开当前球面渲染在极点附近的瑕疵。已有等距圆柱瓦片可使用 [`SphereTile`](#球面多分辨率瓦片)，同样支持按视野加载；瓦片化本身不会消除球面极点附近的渲染瑕疵。`Sphere` 适合尺寸可控的单张图像。预览图用于改善首次显示速度，仍应控制其尺寸。详见 [Sphere](#sphere)。

### 没有数据库，怎样发布多个场景？

保留转换目录结构，编写引用各 `viewer.json` 的 `project.json`，用 `loadPanoProject` 和 `ProjectScenes` 展示。将 React 构建产物和资源上传到静态托管即可。部署到 `/demo/` 等子目录时，项目入口也要带正确前缀；项目内部优先用相对地址。

### JSON 或纹理跨域加载失败？

先看浏览器 Network 与 Console，确认具体失败的是配置、预览还是瓦片。服务端/CDN 必须允许前端 origin 读取这些资源。公开资源可以使用 `Access-Control-Allow-Origin: *`；携带 Cookie 等凭据时必须使用明确允许的 origin 和 `Access-Control-Allow-Credentials: true`，动态响应 origin 时设置 `Vary: Origin`。浏览器可能只向 JavaScript 暴露 `Failed to fetch`，库不会据此断言原因。

`no-cors` 得到不可读取的 opaque 响应，不能解析 JSON，也不能用于需要 CORS 的 WebGL 纹理。应修改服务器配置，不能靠前端关闭安全检查。详见 [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) 和 [WebGL 纹理](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL)。

S3 控制台的公开读取 CORS 示例（替换成实际网站 origin）：

```json
[{
  "AllowedOrigins": ["https://app.example.com"],
  "AllowedMethods": ["GET", "HEAD"],
  "AllowedHeaders": ["Authorization"]
}]
```

CORS 不授予对象读取权限。使用 CDN 时也需确保实际响应带有正确头。参阅 [S3 CORS 官方说明](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)。

### 404 或请求地址看起来不对？

比较 Network 中的完整 URL 与云端对象 key，检查 `baseUrl`、多一层目录、大小写及文件名。只换域名或前缀时调整根地址；内部文件也改名时使用资源映射。保留转换器的模板，尤其注意 `%v_%h` 与 `%h_%v` 的区别。

### 报 INVALID_JSON，响应却是 200？

打开响应正文检查是否为 HTML。常见原因是 SPA fallback 把不存在的 JSON 路径返回为首页，或认证系统重定向到登录页。修正配置地址和静态路由；HTTP 200 不代表内容一定是 JSON。

### JSON 正常，图片却是 401/403 或签名过期？

配置认证与图片读取权限分别处理。`requestInit` 的头和凭据只用于 JSON；配置 URL 的 token 不会自动附加到瓦片。为图片提供可用的公开 URL、签名 URL 或适合应用的认证访问方案。异步取得签名后再加载/映射，签名过期后重新获取；不要把临时凭据永久写入转换 JSON。

### 配置加载成功，为什么画面仍是空白？

检查 `PanoViewer` 的容器是否有非零高度、纹理是否成功，以及 Console 中的 WebGL 错误。保持 React、Three.js 和 React Three Fiber 单一副本。纯数据加载成功不代表资源可绘制，应观察 `onSceneReady` 和 `onTransitionError`。

### 预览正常，高清缺失或错位？

检查瓦片是否全部上传，使用实际层级尺寸及转换输出的 `urlTemplate`、`previewFaceOrder`、`indexBase`。不要假定层级总能乘二或混淆从零开始的逻辑地址与存储编号；自定义 resolver 需要返回原文件对应的地址。

### 热点不显示，或点击不跳转？

检查所属场景、`visible`、`interactive`、`pointerEvents`、角度与资源请求。场景过渡时热点会暂时隐藏。场景 ID 和热点 ID 按各自范围唯一，`action.sceneId` 必须存在；`preventDefault()` 会取消默认动作。未配置 action 的文本只是文字，不会自动创建弹窗。

### 音视频没有播放？

使用点击/键盘等用户手势触发播放，检查格式和权限，并用 `onHotspotError` 查看失败。浏览器可阻止非静音自动播放；隐藏的标签页和设备规则也可能影响播放。组件不会绕过浏览器限制。

### 双击本地 HTML、混合内容、缓存或版本问题？

通过本地 HTTP(S) 服务预览，不使用 `file://`。HTTPS 页面使用 HTTPS 资源。采用带版本的资源目录，并协调项目 JSON 与图片的缓存，避免旧配置请求新目录。`UNSUPPORTED_SCHEMA_VERSION` 需要匹配支持的配置版本；平面图没有 `viewer.json`，需要平面查看器。

转换阶段的问题另见 [converter 错误码与故障排查](../converter/README.zh-CN.md#错误码与故障排查)。

### 相机中心范围

`PanoViewer`、`Scenes` 的每个场景及 `project.json` 的每个场景均支持可选的 `viewLimits`：

```ts
viewLimits: {
  yaw: { min: 170, max: -170 },
  pitch: { min: -30, max: 45 },
  fov: { min: 40, max: 90 },
}
```

角度单位为度。Yaw 上下限在 −180…180 内；min > max 表示跨接缝，−180…180 表示完整一圈。Pitch 在 −90…90、FOV 在 1…179 内，均要求 min ≤ max。相等时锁定该轴。场景逐轴覆盖播放器设置；未配置的轴继承播放器，FOV 最后回退到原有 `minFov` / `maxFov`（默认 30 / 100）。范围限制相机中心，覆盖鼠标、触摸、键盘、惯性、自动旋转、陀螺仪及视角导航 API，不保证整个可见画面不超界。显式配置的轴即使启用 `bouncingLimits` 也使用硬边界。Yaw 动画沿允许区间插值，不走穿过禁区的最短路径；沉浸式 WebXR 继续由头显控制姿态。

新场景接管画面时先应用范围，再设置初始视角。实时修改会取消导航与惯性、收回越界视角，不修改保存的初始视角或重新加载纹理。移除场景范围时恢复播放器设置。

### 热点交互事件与自定义动作

`events` 为 `click`、`pointerenter`、`pointerleave` 分别绑定一个动作。三个事件均支持 `scene`、`view`、`popup` 和 `{ type: "custom", actionId, params? }`。`params` 是 JSON 对象；函数、凭据、API 实现和表单定义由宿主维护。参数内的字符串不作为素材解析或打包。

```json
{"events":{"click":{"type":"scene","sceneId":"hall"},"pointerenter":{"type":"custom","actionId":"product.preview","params":{"visible":true}},"pointerleave":{"type":"custom","actionId":"product.preview","params":{"visible":false}}}}
```

旧 `action` 继续作为点击动作的后备，`events.click` 优先；编辑或清除点击时移除旧字段。打开项目不自动迁移。新事件配置需要升级后的播放器，项目 schemaVersion 仍为 1。没有点击动作的媒体继续切换播放，悬停没有默认动作。

`ProjectScenes.onHotspotEvent(event)` 提供 `trigger`、`sceneId`、`hotspot`、`interaction` 和 `preventDefault()`。点击时先调用它，再调用原有 `onHotspotClick`，任一回调均可取消动作。`onCustomAction(event)` 额外提供 `action`，支持返回 Promise。宿主按稳定的 `action.actionId` 分发，校验业务参数，对未知动作抛出错误。缺少执行器、同步异常和 Promise 拒绝进入附带 `trigger` 的 `onHotspotError`。请求、鉴权、取消、防重复和迟到响应由宿主负责；各事件独立分发，不自动重试。

悬停按整个热点的边界触发一次，跳过触屏和键盘焦点，并遵循可见性、指针交互设置。切换场景、隐藏和卸载仅清理状态，不执行离开动作。原有 tooltip 行为独立保留。自定义渲染器需同时转发 `context.onHoverChange(hovered, interaction)` 和 `context.onClick`；调用 `context.renderDefault()` 会自动接线。
