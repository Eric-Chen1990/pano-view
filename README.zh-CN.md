# Pano View · [![许可证](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE) [![pano-view npm 版本](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-view.svg?style=flat&label=pano-view)](https://www.npmjs.com/package/@ericchen1990/pano-view) [![converter npm 版本](https://img.shields.io/npm/v/%40ericchen1990%2Fpano-converter.svg?style=flat&label=converter)](https://www.npmjs.com/package/@ericchen1990/pano-converter) [![CI](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/ci.yml) [![Converter](https://github.com/Eric-Chen1990/pano-view/actions/workflows/converter.yml/badge.svg?branch=main)](https://github.com/Eric-Chen1990/pano-view/actions/workflows/converter.yml) [![欢迎 PR](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/Eric-Chen1990/pano-view/pulls)

[English](./README.md) | **简体中文**

用于等距圆柱图像、360 视频与 krpano 风格多分辨率立方体瓦片的可组合
React 组件。在你的应用中构建全景体验，并保留自己的 React UI、控件、路由与数据。

在[在线 Playground](https://pano-view-playground.vercel.app/?utm_source=github&utm_medium=readme&utm_campaign=repository&utm_content=playground) 中试用热点、场景过渡、
360 视频、WebXR、滤镜与立方体瓦片场景。

## 目录

- [安装](#安装)
- [示例](#示例)
  - [等距圆柱图像](#等距圆柱图像)
  - [立方体瓦片](#立方体瓦片)
  - [360 视频](#360-视频)
  - [多场景](#多场景)
- [复用既有 krpano tile 输出](#复用既有-krpano-tile-输出)
- [指南](#指南)
- [本地开发](#本地开发)
- [验证](#验证)
- [发布](#发布)
- [维护与支持](#维护与支持)

## 安装

在宿主应用中安装查看器。npm 7+、pnpm 与 Bun 会一并安装对等依赖；Yarn 与
npm 6 不会，需按[包 README](./packages/react/README.zh-CN.md#安装)中的版本范围显式安装。

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

为 `PanoViewer` 指定明确尺寸，并在其中渲染一个全景源。下面是每种源的最短写法。完整 props、热点、控件与 Hook 见包 README。

### 等距圆柱图像

`Sphere` 需要 2:1 图像。`previewUrl` 为必填，在 `src` 加载期间显示低分辨率 2:1 图像。相对预览路径相对于 `src` 所在目录解析。

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

从 krpano XML 复制 `url`、`multires` 与预览路径。本包默认 tile 路径与 krpano 的磁盘命名不同。

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

把 `Sphere` 换成 `Tile` 之前，请阅读[krpano 迁移指南](./docs/krpano-migration.zh-CN.md)。占位符、预览面顺序与自定义解析器见 [Tile 参考](./packages/react/README.zh-CN.md#tile)。

### 360 视频

`PanoVideo` 把 2:1 等距圆柱视频贴到同一球面上。`muted` 默认为 `true`，以便在浏览器自动播放策略下有机会自动播放。

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

`Scenes` 用 GPU 快照混合切换球面与 tile 场景。周围 UI 需要当前场景 id 时，把 `activeSceneId` 留在宿主状态里。

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

## 复用既有 krpano tile 输出

Pano View 可在 React 应用中渲染 krpano 风格立方体 tile 金字塔。请从 krpano XML
复制实际值，不要假设它使用本包的默认路径布局：

| krpano XML | Pano View prop |
| --- | --- |
| cube url | urlTemplate |
| cube multires | multires |
| preview url | previewUrl |
| preview striporder | previewFaceOrder |

阅读[英文 krpano 迁移指南](./docs/krpano-migration.md)或[中文迁移指南](./docs/krpano-migration.zh-CN.md)。
Pano View 支持这种 tile 输出格式，但不是 krpano 的插件、包装器、替代品或关联项目。

## 指南

包导出 PanoViewer、Sphere、PanoVideo、Tile、Scenes、热点、控件、Hook 与辅助函数。

- [包 README](./packages/react/README.zh-CN.md) — 安装细节与组件 API
- [360 视频指南](./docs/react-360-video.zh-CN.md) — 页内播放、字幕与移动端激活
- [krpano 迁移指南](./docs/krpano-migration.zh-CN.md) — XML 属性到组件 props
- [@ericchen1990/pano-converter](./packages/converter/README.zh-CN.md) — Node.js 与 CLI 切图

本仓库是 pnpm workspace，包含查看器、转换器和 Vite Playground。转换器提供
Node.js/CLI 切图与还原，不依赖 React、云存储或数据库。Playground 直接导入组件源码，因此本地修改组件后无需重新构建包即可看到效果。

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

本仓库通过 Changesets 发布。不要直接运行 npm version 或 npm publish。

1. 运行 pnpm changeset 并描述包变更。
2. 运行 pnpm version-packages 生成版本和 changelog。
3. 仅在确认 changeset、changelog、typecheck 和 build 后运行 pnpm release。

## 维护与支持

由 [Eric Chen](https://github.com/Eric-Chen1990) 维护。请通过
[GitHub issue tracker](https://github.com/Eric-Chen1990/pano-view/issues) 报告 bug 和功能请求。
