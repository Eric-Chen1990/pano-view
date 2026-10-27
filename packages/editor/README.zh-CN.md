# @ericchen1990/pano-editor

可嵌入的 React 全景编辑器，支持场景、初始视角、九种热点和场景跳转。输出沿用 `schemaVersion: 1` 的 `project.json`，可交给现有 `loadPanoProject` 与 `ProjectScenes` 播放。

[English](./README.md)

## 在线编辑本地项目

运行 `pnpm dev`，访问 `/editor`。先在本地使用 `pano-convert` 生成切图，再选择整个项目根目录：

```text
tour/
  project.json              # 首次使用可没有；导出后放回这里
  panoramas/lobby/
    viewer.json
    tiles/...
    previews/...
  media/marker.svg
```

根目录已有 `project.json` 时直接打开，否则从目录内的 `viewer.json` 选择场景。所选目录应包含瓦片、预览与热点素材；资源缺失会显示具体路径，不会回退请求在线编辑器服务器。

文件只通过目录选择和临时预览地址在浏览器中读取，不上传，不写 localStorage、IndexedDB、源文件或云端草稿。刷新会清空会话，离开前请导出 JSON。把 `project.json` 放回所选根目录，通过 HTTP 静态服务器或静态托管播放；保持原有资源目录结构。导出不会复制或打包素材。

本地模式面向支持目录选择的桌面浏览器，仅接收已经转换好的 `tile` / `sphereTile`，不在浏览器中转换原始全景图片。

本地 iframe 只作静态预览，禁用脚本和表单；导出的 JSON 保留原始沙箱设置，宿主接入模式维持查看器原有行为。

## 嵌入 React 项目

安装编辑器及兼容的 `@ericchen1990/pano-view` 对等依赖，导入两份样式。编辑器 CSS 带独立作用域，宿主无需配置 Tailwind。

```tsx
import { PanoEditor } from "@ericchen1990/pano-editor";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-editor/styles.css";

<PanoEditor
  defaultValue={project}
  baseUrl="https://cdn.example.com/tour/"
  locale="zh-CN"
  style={{ height: 780 }}
  onSave={async (updated) => {
    const response = await fetch("/api/my-project", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (!response.ok) throw new Error("保存失败");
  }}
/>
```

受控模式使用 `value/onChange`，非受控模式使用 `defaultValue`，不要同时提供。`onChange` 返回编辑草稿；删掉最后一个场景后可以是空场景列表，但保存、导出要求至少一个有效场景。浏览视角、选中状态、预览播放和未完成绘制不写进文档。

宿主切换项目时通过不同的 React `key` 重新挂载组件。外部替换受控文档会清空历史，正常回传 `onChange` 的文档保留历史。多个实例的文档、文件映射和取消状态相互独立。

## 接入自行部署的转换器

现有转换器是 Node.js 库和 CLI，不自带 HTTP 服务。宿主后端封装 `convertImage`、存储切图和预览，再提供 `viewer.json` 或 `viewerConfig + baseUrl`。编辑器不负责后端、鉴权、任务队列、数据库或存储。

```tsx
<PanoEditor
  baseUrl="https://cdn.example.com/tour/"
  onImportPanorama={async (file, { signal, onProgress }) => {
    const body = new FormData();
    body.append("image", file);
    onProgress({ stage: "convert" });
    const response = await fetch("/api/my-panorama-import", {
      method: "POST", body, signal,
    });
    if (!response.ok) throw new Error("转换失败");
    const result: { viewerUrl: string } = await response.json();
    return { viewerUrl: result.viewerUrl };
    // 也可以返回 { viewerConfig, baseUrl: "https://cdn.example.com/output/" }。
  }}
  onPickAsset={async (request) => {
    return myAssetLibrary.pick(request); // 返回素材地址；取消返回 undefined
  }}
/>
```

示例中的 API 和素材库由宿主实现。回调应等到 JSON 和资源可访问后才返回，内部可以使用直传、同步转换、轮询或流式进度。进度为 `{ stage: "upload" | "convert", progress?: number }`，数值范围 0–1，省略数值时显示不定进度。取消会触发 `signal` 并丢弃迟到结果；已经创建的远程任务、文件由宿主清理。

只有提供 `onImportPanorama` 才显示原图导入入口。公开在线页不配置上传或保存回调。嵌入时若用户选择本地目录，也进入本地会话，隐藏宿主上传和保存入口，且不会把本地文件交给宿主素材选择器。

## 接口与定制

| 属性 | 用途 |
| --- | --- |
| `value/defaultValue/onChange` | 复用现有 `PanoProjectDefinition`。 |
| `baseUrl` | HTTP(S) 项目资源根目录，默认宿主页面所在目录。 |
| `requestInit/resolveAssetUrl` | 复用查看器的 JSON 请求选项和同步资源映射；运行时映射结果不写回文档。 |
| `onImportPanorama` | 宿主负责 `File` → `PanoProjectSceneDefinition["source"]`。 |
| `onPickAsset` | 收到素材种类、场景/热点 ID、字段和当前地址，返回持久地址或 `undefined`。 |
| `onSave` | 接收校验后的项目，失败保留未保存状态。 |
| `locale` | 默认 `en`，支持 `zh-CN`。 |
| `className/style` | 设置尺寸和宿主样式。 |

主题变量为 `--pne-bg`、`--pne-panel`、`--pne-text`、`--pne-muted`、`--pne-border`、`--pne-accent`、`--pne-brand`。全屏作用于整个编辑器，弹层仍在全屏元素内。

编辑态点击热点只选择，不播放媒体、不跳转；预览态使用查看器正常行为。属性面板与高级热点 JSON 保留未编辑的受支持字段。一次拖动或一次聚焦输入形成一条撤销记录。快捷键限定在编辑器内：Ctrl/Cmd+Z、Shift+Ctrl/Cmd+Z、Delete、Enter 完成绘制、Escape 取消、Backspace 删除最后一个草稿顶点；文本输入保留原生快捷键。

验证命令：`pnpm --filter @ericchen1990/pano-editor test`、`typecheck`、`build`；构建查看器与编辑器后运行 `pack:check`。这些命令不会发布包。
