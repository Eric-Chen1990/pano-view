# Pano View

[English](./README.md) | **简体中文**

用于等距圆柱图像、360 视频与 krpano 风格多分辨率立方体瓦片的可组合
React 组件。在你的应用中构建全景体验，并保留自己的 React UI、控件、路由与数据。

在[在线 Playground](https://pano-view-playground.vercel.app/?utm_source=github&utm_medium=readme&utm_campaign=repository&utm_content=playground) 中试用热点、场景过渡、
360 视频、WebXR、滤镜与立方体瓦片场景。

## 30 秒开始使用

~~~bash
pnpm add @ericchen1990/pano-view
~~~

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

请在宿主应用中安装兼容版本的 React、Three.js、React Three Fiber、Drei 与 XR
对等依赖。支持范围、样式表、Next.js 使用方式和完整 API 见包 README。

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

## 组件与指南

包导出 PanoViewer、Sphere、PanoVideo、Tile、Scenes、热点、控件、Hook 与辅助函数。
从[完整包 README](./packages/react/README.zh-CN.md)、[360 视频指南](./docs/react-360-video.zh-CN.md)
或[英文 360 视频指南](./docs/react-360-video.md)开始。

本仓库是 pnpm workspace，包含可发布的包和 Vite Playground。Playground 直接导入
组件源码，因此本地修改组件后无需重新构建包即可看到效果。

## 本地开发

~~~bash
pnpm install
pnpm dev
~~~

## 验证

~~~bash
pnpm typecheck
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
