# Pano View · [![许可证](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![pano-view npm 版本](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-view.svg?style=flat&label=pano-view)](https://www.npmjs.com/package/@ericchen1990/pano-view) [![converter npm 版本](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-converter.svg?style=flat&label=converter)](https://www.npmjs.com/package/@ericchen1990/pano-converter) [![CI](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml) [![Converter](https://github.com/Eric-Chen1990/pano-view/actions/workflows/converter.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/converter.yml) [![欢迎 PR](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Eric-Chen1990/pano-view/pulls)

[English](./README.md) | **简体中文**

Pano View 提供用于全景图像与 360 视频的 React 查看器、编辑器和 Node.js 转换器。
宿主应用通过 React 组件构建全景体验，并管理界面、控件、路由与数据。

在[在线 Playground](https://pano-view-playground.vercel.app/?utm_source=github&utm_medium=readme&utm_campaign=repository&utm_content=playground) 中试用热点、场景过渡、
360 视频、WebXR、滤镜与立方体瓦片场景。

## 目录

- [包](#包)
- [数据来源与选型](#数据来源与选型)
- [静态多场景项目](#静态多场景项目)
- [安装](#安装)
- [全屏 Overlay 与弹窗](#全屏-overlay-与弹窗)
- [示例](#示例)
  - [等距圆柱图像](#等距圆柱图像)
  - [立方体瓦片](#立方体瓦片)
  - [360 视频](#360-视频)
  - [多场景](#多场景)
- [复用既有 krpano 瓦片输出](#复用既有-krpano-瓦片输出)
- [指南](#指南)
- [本地开发](#本地开发)
- [验证](#验证)
- [发布](#发布)
- [维护与支持](#维护与支持)

## 包

[可嵌入的漫游编辑器](./packages/editor/README.zh-CN.md) 支持读取本地项目目录、编辑场景、热点与平面图并导出 JSON。运行 `pnpm dev` 后访问 `/editor`，文件不上传、不持久保存；嵌入时通过回调接入宿主的保存、素材库和转换服务。

| 包 | 作用 |
| --- | --- |
| [@ericchen1990/pano-editor](./packages/editor/README.zh-CN.md) | 可嵌入的场景、热点与平面图编辑器，支持本地目录预览、JSON 导出和宿主转换、保存回调。 |
| [@ericchen1990/pano-view](./packages/react/README.zh-CN.md) | 用于等距圆柱图像、360 视频与 krpano 风格多分辨率立方体瓦片的可组合 React 组件。 |
| [@ericchen1990/pano-converter](./packages/converter/README.zh-CN.md) | Node.js 库与 `pano-convert` CLI。生成瓦片金字塔、预览图，以及 React 包渲染所用的 `viewerConfig`。不依赖 React、云存储或数据库。 |

下文示例使用查看器。用转换器生成新的瓦片金字塔，再把它的 `viewerConfig` 交给 `Tile`、`SphereTile` 或 `Scenes`。

## 数据来源与选型

查看器接收配置对象，或通过 HTTP 加载 JSON。由你的应用选择配置的存储和提供方式：

- **静态 JSON + CDN：** 将 `project.json` 和各场景的 `viewer.json` 部署到静态托管。加载配置无需查询数据库，仍有存储、请求和流量成本；更新需要发布文件并管理缓存。
- **数据库 + 后端 API：** 后端查询数据并完成鉴权，再提供配置对象或 JSON API 响应。查看器不直接连接数据库。适合编辑、私有内容和个性化配置；后端可用性、查询成本及缓存管理由应用负责。

**公开、已发布的漫游优先使用 JSON + CDN；编辑预览、私有和个性化内容优先使用数据库 + API。** 同时需要两者时，以数据库作为编辑来源，发布时生成 JSON 快照。两条路径均不会自动订阅配置变化：已打开页面需要宿主应用重新加载数据并更新查看器。

利弊对比及数据库示例见 [数据来源与选型](./packages/react/README.zh-CN.md#数据来源与选型)；版本化 URL、缓存响应头和 CDN 失效见 [缓存与发布更新](./packages/react/README.zh-CN.md#缓存与发布更新)。

## 静态多场景项目

转换器同时生成完整的 `manifest.json` 和轻量 `viewer.json`。前者用于归档和还原，后者用于前端渲染。无需数据库时，编写一份 `project.json` 引用各场景的 `viewer.json`，并保存视角、热点、场景跳转，以及可选的平面图。

```tsx
import { loadPanoProject, PanoViewer, ProjectScenes } from "@ericchen1990/pano-view";

const project = await loadPanoProject("/tour/project.json");
// 配置加载完成后在 React 应用中渲染：
<PanoViewer style={{ height: 600 }}>
  <ProjectScenes project={project} transition="dissolve" />
</PanoViewer>;
```

保留输出目录结构即可上传静态托管；自定义域名和云目录使用 `baseUrl`，重命名资源使用同步 URL 映射。服务端纯数据方法从 `@ericchen1990/pano-view/data` 导入。运行 `pnpm dev` 后访问 `/project` 查看静态双场景示例，访问 `/map` 查看平面图 overlay。

完整配置、React 加载/错误/取消示例见 [静态项目与 JSON 数据](./packages/react/README.zh-CN.md#静态项目与-json-数据)；跨域、404、认证、空白画面及媒体限制见 [常见问题与故障排查](./packages/react/README.zh-CN.md#常见问题与故障排查)。

## 全屏 Overlay 与弹窗

优先通过 `PanoOverlay` 在 Three.js 渲染树之外渲染普通 DOM 界面。viewer 提供稳定的本地 Portal 容器、实际可用尺寸和全屏状态；已有 Dialog 可以直接使用该容器。可选默认弹窗从 `@ericchen1990/pano-view/ui` 导入，默认外观单独导入 `@ericchen1990/pano-view/ui/styles.css`。

本地 Playground 的 `/overlays` 展示图文、视频、画册、iframe，以及默认弹窗、组成组件定制和第三方 Dialog 接入。独立的[弹窗使用与自定义样式指南](./packages/react/docs/dialogs.zh-CN.md)提供完整示例、主题变量、组件 API、二级 Portal、焦点和媒体清理说明。此能力支持元素全屏；沉浸式 WebXR 与原生视频全屏需使用相应界面。

## 安装

在宿主应用中安装 [@ericchen1990/pano-view](./packages/react/README.zh-CN.md)。对等依赖是否自动安装取决于包管理器及其配置；请按[包 README](./packages/react/README.zh-CN.md#对等依赖)中的版本范围确认所需依赖已安装。
[@ericchen1990/pano-converter](./packages/converter/README.zh-CN.md#安装) 的安装说明在它自己的 README 中。

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

使用内置 HTML 叠加层（视频控件、字幕、tooltip、右键菜单或 WebVR UI）时，在宿主应用中导入一次样式表。WebGL 全景本身不依赖该文件。

```ts
import "@ericchen1990/pano-view/styles.css";
```

支持的 React、Three.js、React Three Fiber、Drei 与 XR 范围、Next.js 用法和完整 API 见[包 README](./packages/react/README.zh-CN.md)。

## 示例

为 `PanoViewer` 指定明确尺寸，并在其中渲染一个全景源。下面是每种源的基本用法。完整 props、热点、控件与 Hook 见包 README。

### 等距圆柱图像

`Sphere` 需要 2:1 图像。`previewUrl` 为必填，在 `src` 加载期间显示低分辨率 2:1 图像。相对预览路径相对于 `src` 所在目录解析。

高分辨率全景优先使用[立方体瓦片](#立方体瓦片)，按视野加载以降低单张超大纹理的开销。`Sphere` 加载完整图像，受设备纹理尺寸与可用内存限制；当前球面渲染在极点附近仍可能出现可见瑕疵。应提供尺寸较小的 `previewUrl` 以加快首次显示。详见 [Sphere](./packages/react/README.zh-CN.md#sphere)。

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

### 立方体瓦片

从 krpano XML 复制 `url`、`multires` 与预览路径。本包默认瓦片路径与 krpano 的磁盘命名不同。

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

把 `Sphere` 换成 `Tile` 之前，请阅读[krpano 迁移指南](./docs/krpano-migration.zh-CN.md)。占位符、预览面顺序与自定义解析器见 [Tile 参考](./packages/react/README.zh-CN.md#tile)。[@ericchen1990/pano-converter](./packages/converter/README.zh-CN.md) 可以生成这套金字塔，并在 `viewerConfig` 上返回相同的 `urlTemplate`、`multires` 与 `previewUrl`。

### 360 视频

`PanoVideo` 将 2:1 等距圆柱视频映射到全景球面。`muted` 默认为 `true`，以提高自动播放的兼容性；实际播放仍受浏览器策略约束。

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

多档画质、字幕与自定义控件见[360 视频指南](./docs/react-360-video.zh-CN.md)与 [PanoVideo 参考](./packages/react/README.zh-CN.md#panovideo)。可在 [Playground](https://pano-view-playground.vercel.app/video?utm_source=github&utm_medium=readme&utm_campaign=repository&utm_content=video) 中试用。

### 多场景

`Scenes` 通过 GPU 快照混合切换单张图像、立方体瓦片与等距圆柱瓦片场景。宿主界面需要读取当前场景 ID 时，使用受控的 `activeSceneId`。

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

场景字段、过渡预设与热点见 [Scenes 参考](./packages/react/README.zh-CN.md#scenes)。[场景过渡 Playground](https://pano-view-playground.vercel.app/scene-transitions?utm_source=github&utm_medium=readme&utm_campaign=repository&utm_content=scenes) 运行的是同一组件。

## 复用既有 krpano 瓦片输出

Pano View 可在 React 应用中渲染 krpano 风格立方体瓦片金字塔。请从 krpano XML
复制实际值，不要假设它使用本包的默认路径布局：

| krpano XML | Pano View prop |
| --- | --- |
| cube url | urlTemplate |
| cube multires | multires |
| preview url | previewUrl |
| preview striporder | previewFaceOrder |

阅读[英文 krpano 迁移指南](./docs/krpano-migration.md)或[中文迁移指南](./docs/krpano-migration.zh-CN.md)。
Pano View 支持这种瓦片输出格式，但不是 krpano 的插件、包装器、替代品或关联项目。

## 指南

- [@ericchen1990/pano-view](./packages/react/README.zh-CN.md) — 组件 API、热点、控件与 Hook
- [@ericchen1990/pano-converter](./packages/converter/README.zh-CN.md) — Node.js 与 CLI 切图和还原
- [360 视频指南](./docs/react-360-video.zh-CN.md) — 页内播放、字幕与移动端激活
- [弹窗使用与自定义样式指南](./packages/react/docs/dialogs.zh-CN.md) — 多热点内容映射、主题、布局组合与第三方弹窗
- [平面图](./packages/react/README.zh-CN.md#平面图地图) — 项目 `map`、场景点位、随水平角转动的扇形，以及停靠或对话框呈现
- [krpano 迁移指南](./docs/krpano-migration.zh-CN.md) — XML 属性到组件 props

本仓库中的 Vite Playground 直接导入查看器源码，因此本地修改组件后无需重新构建包即可看到效果。

## 本地开发

~~~bash
pnpm install
pnpm dev
~~~

## 验证

~~~bash
pnpm typecheck
pnpm test
pnpm build
pnpm pack:check
git diff --check
~~~

## 发布

本仓库通过 Changesets 发布，不要直接运行 `npm version` 或 `npm publish`。

1. 运行 `pnpm changeset` 描述包变更。
2. 运行 `pnpm version-packages` 生成版本和更新日志。
3. 审核并提交生成的包版本、锁文件和 changelog，再合并到 `main`。`main` 上的包清单变更会触发 `.github/workflows/release.yml`，依次运行类型检查、测试、构建和 tarball 检查，再通过 Changesets 发布 npm 上尚不存在的版本。

PR 和 **Actions → Release → Run workflow** 都只做验证，不会发布。工作流不自动升级版本、不创建版本 PR、不推送 Git 标签，也不创建 GitHub Release。仅支持正式版本；遇到未消费的 changeset、缺失的更新日志、预期之外的公开包、registry 请求失败或会使 `latest` 倒退的版本会停止。

构建验证与发布分为两个任务，发布使用已验证的构建产物，禁用生命周期脚本，不依赖长期 npm Token。CI 使用 `pnpm exec changeset publish --no-git-tag`，即 `pnpm release` 中的发布部分，避免重新构建已测试的产物。本地经明确授权的发布仍可在完成相同检查后使用 `pnpm release`。

### 一次性可信发布设置

先合并工作流，在 GitHub **Settings → Environments** 创建名为 `npm` 的环境，将允许部署的分支限定为 `main`。可选配置 required reviewer；开启后每次发布都会等待审批。工作流对仓库仅有读取权限，不需要创建 PR 或推送标签的权限。

对以下**三个现有 npm 包分别**进入 **Settings → Trusted publishing**，新增 **GitHub Actions** publisher：

| 设置项 | 填写值 |
| --- | --- |
| Organization or user | `Eric-Chen1990` |
| Repository | `pano-view` |
| Workflow filename | `release.yml`，仅文件名 |
| Environment name | `npm` |
| Allowed actions | 允许直接 `npm publish`；不需要管理 dist-tag 的权限 |

包设置入口：[pano-view](https://www.npmjs.com/package/@ericchen1990/pano-view/access)、[pano-editor](https://www.npmjs.com/package/@ericchen1990/pano-editor/access)、[pano-converter](https://www.npmjs.com/package/@ericchen1990/pano-converter/access)。无需为此工作流添加 `NPM_TOKEN` 或 `NODE_AUTH_TOKEN` Secret。

等下一版准备好时再创建 publisher：按照当前 [npm 官方规则](https://docs.npmjs.com/trusted-publishers/)，新授权若未在 **2 天内**完成首次成功发布会过期，需要删除后重新创建。首次 OIDC 发布成功后，可将 npm 的 Publishing access 改为 **Require two-factor authentication and disallow tokens**，并在确认其他流程不再使用后撤销旧发布 Token。公开仓库的公开包会附带 provenance 来源证明。

如果一轮发布只有部分包成功，或返回结果不确定，先核对 npm 上的精确版本，再处理授权或临时故障并重新运行失败的 `main` push 工作流；已发布版本会跳过。不要仅为了重试而升级版本。发布后的检查验证 registry 可见性，npm 延迟可能导致上传成功后检查仍失败，工作流不会自动重试上传。

## 维护与支持

由 [Eric Chen](https://github.com/Eric-Chen1990) 维护。请通过
[GitHub issue tracker](https://github.com/Eric-Chen1990/pano-view/issues) 报告 bug 和功能请求。
