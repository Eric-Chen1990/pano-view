# @ericchen1990/pano-editor

可嵌入的 React 全景编辑器，支持场景、初始视角、九种热点和场景跳转。输出沿用 `schemaVersion: 1` 的 `project.json`，可交给现有 `loadPanoProject` 与 `ProjectScenes` 播放。

[English](./README.md)

## 在线编辑本地项目

运行 `pnpm dev`，访问 `/editor`，即可编辑内置的双场景示例及文字、音频、跳转热点。页面提供已转换好的示例 ZIP，解压后可直接打开项目目录或测试拖放，无需先运行转换器。

使用自己的素材时，先在本地使用 `pano-convert` 生成切图，再选择整个项目根目录：

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

“添加场景”和“替换场景源”区分“本地文件夹”和“在线 URL”。在线入口需填写直接返回 viewer.json 的完整 HTTP(S) 地址；演示页使用无需登录的公开资源，预览图和全部瓦片也需在线可访问。跨站服务器需配置 CORS，HTTPS 编辑器应使用 HTTPS 资源。素材目录地址通常留空，默认从 viewer.json 所在目录解析相对路径；导出 JSON 不会下载或打包在线素材。

本地入口支持拖入或选择包含 `viewer.json`、预览和瓦片的文件夹，原有 URL 入口保留。添加会导入目录内的全部场景并保留当前编辑内容；替换要求目录内只有一个 `viewer.json`。追加目录使用独立的 `imports/<id>/<目录名>/` 路径，避免同名文件冲突。导出 JSON 不打包素材；自行托管时应按导出的场景源路径放置这些目录。

文件只通过目录选择和临时预览地址在浏览器中读取，不上传，不写 localStorage、IndexedDB、源文件或云端草稿。刷新会清空会话，离开前请导出项目包，将配置和资源一起保留。解压后可通过现有播放器和 HTTP 静态托管使用。也可仅导出 JSON，放回原根目录并保持资源目录结构；仅导出 JSON 不会复制素材。

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

左侧按“场景 → 热点”展示层级，可展开当前场景查看、编辑或删除其热点；拖拽场景标题左侧的手柄调整顺序，标题右侧可删除场景。键盘可用空格或 Enter 拾起手柄、方向键调整位置、空格或 Enter 放下，Escape 取消排序。场景和热点的删除（包括 Delete 快捷键）均需在确认弹窗中确认，取消不会修改文档。点击“添加热点”后选择类型，再到全景中放置或绘制；媒体类型先选择素材。选中热点后可在属性面板继续修改，也可拖动热点或顶点调整位置。删除支持撤销。

编辑态点击热点只选择，不播放媒体、不跳转；预览态使用查看器正常行为。属性面板与高级热点 JSON 保留未编辑的受支持字段。一次拖动或一次聚焦输入形成一条撤销记录。快捷键限定在编辑器内：Ctrl/Cmd+Z、Shift+Ctrl/Cmd+Z、Delete、Enter 完成绘制、Escape 取消、Backspace 删除最后一个草稿顶点；文本输入保留原生快捷键。

验证命令：`pnpm --filter @ericchen1990/pano-editor test`、`typecheck`、`build`；构建查看器与编辑器后运行 `pack:check`。这些命令不会发布包。

### 可携带的项目包

“导出项目包”下载 `panorama-project.zip`，包含 `project.json`、各场景的 `panoramas/<序号>/viewer.json`、所有预览图和全部层级的瓦片，以及 `assets/` 中的热点媒体、提示图片和光标图片。本地和在线资源均会复制到包中，并改写为包内相对路径。重新打开前请先解压，再通过“打开项目目录”选择解压目录。使用现有播放器时，通过 HTTP 托管该目录；包中不包含播放器页面。“导出 JSON”仍然仅下载配置。

打包最多同时传输四个资源，支持取消。任何资源缺失、无法读取或受到跨域限制时，会明确报错，且不会下载不完整 ZIP；不会拿编辑器的缺失瓦片占位图代替原文件。项目包限制为 60000 个文件、1 GB。含外部资源或脚本依赖的 HTML/CSS/SVG 无法保证资源完整，会停止导出；需先提供资源内嵌且没有运行时依赖的文档。错误中的路径指向包内条目，不包含签名地址的查询参数。

“悬停光标”提供常用样式选择、本地 PNG 图片选择（不超过 32 × 32 像素）、预览及恢复默认。本地光标保留在浏览器会话中，并包含在项目包中；旧的 CSS 光标配置及其偏移、回退样式仍可读取。宿主托管模式继续通过素材选择回调管理持久资源。

## 点击动作与共享内容

属性面板的“点击动作”支持切换场景、调整当前场景视角、打开共享弹窗。可用“使用当前视角”填写水平角、垂直角和视场角，默认动画 700 毫秒。未设置显式动作的媒体热点点击播放/暂停，其他热点无动作。

“测试此热点”进入真实预览，源场景就绪后执行一次点击；返回编辑恢复原场景、相机和热点选择，不修改文档。隐藏热点或关闭指针交互的热点需先启用再测试。编辑模式为了选中和拖动热点会覆盖交互并暂停媒体，预览才应用浏览者设置。

左栏切换“弹窗内容”可新建、复制和编辑共享内容。每项包含标题及有序的文字、图片、视频、音频块，支持添加、上下移动、删除和浏览资源。编辑草稿可暂留空标题或媒体路径，保存、导出前必须补全。文字按纯文本展示，不执行 HTML。

热点通过 `{ type: "popup", popupId }` 引用项目 `popups`。修改共享内容会影响全部引用；复制热点保留共享关系，复制弹窗则生成独立内容和新 ID。被引用弹窗不可直接删除，需先从引用列表跳到热点修改动作。删除场景不删除内容库。JSON 和项目包保留整个内容库，包括未被引用的条目，媒体文件去重打包。

已知默认值直接显示有效值，仅覆盖默认值时出现“重置”；光标保留明确的继承选项，浏览器默认设置也会注明。相机距离仅在浮动模式启用，参考视场角仅在固定屏幕尺寸模式启用。打开项目不会写入默认值或产生撤销记录。

`PanoEditorProps` 增加 `resolvePopupAssetUrl`（与查看器加载器相同）和 `onPickPopupAsset(request)`。后者收到 `{ kind: "image" | "video" | "audio", popupId, blockId, field: "src" | "poster", currentUrl? }`，返回持久资源路径或 undefined；原有 `onPickAsset` 场景/热点契约不变。本地会话使用目录资源，不调用宿主素材选择器。编辑器 CSS 会导入查看器独立 UI 样式，用于预览弹窗。

内容结构保存在 project.json，媒体保留为独立文件；宿主后端也可将同一份文档存进数据库。导出后的展示接线见[查看器弹窗集成](../react/README.zh-CN.md#热点动作与共享弹窗内容)：使用 `ProjectScenes.onPopupRequest` 配合 `ProjectPopupDialog` 或自定义 Overlay。
