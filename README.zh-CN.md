# Pano View

[English](./README.md) | **简体中文**

用于构建单图球面与六面体多分辨率全景浏览体验的可组合 React 组件。

`@ericchen1990/pano-view` 是一个轻量级 React 方案，适用于需要在自定义应用中展示等距圆柱全景或 krpano 风格立方体瓦片输出的项目。将 krpano `<cube>` 的 `url` 与 `multires` 属性复制到 `urlTemplate` 与 `multires`，并将 `<preview url>` 复制到 `previewUrl`；这些值与本包的默认路径布局不同，只有传入正确值才能在不使用 krpano 查看器运行时的情况下复用现有瓦片金字塔。

在[在线 Playground](https://pano-view-playground.vercel.app/) 中试用组件。

本仓库是一个 `pnpm` workspace，包含可发布的 `@ericchen1990/pano-view` 包和本地 Vite playground。

## 本地开发

```bash
pnpm install
pnpm dev
```

Playground 通过 Vite 启动，并直接导入组件包源码，因此修改组件后无需重新构建包即可看到效果。

## 验证

```bash
pnpm build
pnpm typecheck
pnpm pack:check
```

## 发布

在首次公开发布前，请确认你拥有 `@ericchen1990` npm scope，然后登录并在包目录中发布：

```bash
npm login
cd packages/react
npm publish --access public
```

该包导出可组合的全景查看器组件，例如 `PanoViewer`、`Sphere`、`PanoVideo`、`Tile` 和 `Scenes`。完整列表见 [`@ericchen1990/pano-view` README](./packages/react/README.zh-CN.md#导出组件) 中的[导出组件](./packages/react/README.zh-CN.md#导出组件)，涵盖控件、事件、热点、Hooks、辅助函数、krpano 兼容瓦片布局、无障碍与 Next.js 用法。领域术语见 [CONTEXT.md](./CONTEXT.md)。

## 维护与支持

由 [Eric Chen](https://github.com/Eric-Chen1990) 维护。请通过 [GitHub issue tracker](https://github.com/Eric-Chen1990/pano-view/issues) 报告 bug 和功能请求。
