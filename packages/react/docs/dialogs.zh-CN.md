# 弹窗使用与自定义样式

[English](./dialogs.md) | **简体中文** · [组件参考](../README.zh-CN.md#dom-overlay-与弹窗)

本指南说明如何为热点添加图文、视频、画册和 iframe 弹窗。viewer 负责提供支持全屏的挂载位置，应用负责选择热点、内容和样式。示例使用当前 Overlay API 与可选的 `@ericchen1990/pano-view/ui` 入口。在本仓库运行 `pnpm dev`，打开 `/overlays` 可体验三种接入方式。

## 目录

- [选择接入方式](#choose-an-approach)
- [快速开始](#quick-start)
- [按热点选择内容](#choose-content-by-hotspot)
- [定制默认弹窗外观](#customize-the-default-appearance)
- [组合自己的布局](#compose-a-different-layout)
- [接入已有 Dialog](#use-an-existing-dialog)
- [二级 Portal](#nested-portals)
- [全屏与生命周期](#fullscreen-and-lifecycle)
- [API 参考](#api-reference)
- [常见问题](#troubleshooting)

<a id="choose-an-approach"></a>
## 选择接入方式

| 需求 | 推荐方式 | 应用负责 |
| --- | --- | --- |
| 直接使用弹窗，仅调整主题 | `PanoOverlay` + `PanoDialog` + CSS 变量 | 打开状态和内容 |
| 自定义标题栏、关闭按钮、底部操作或布局 | `PanoOverlay` + 组合 `PanoDialog*` 组件 | 结构、样式和内容 |
| 已有 Dialog 或设计系统 | `PanoOverlay` + `usePanoOverlay` + `usePanoModal` | 弹窗实现、无障碍行为和样式 |

默认弹窗与组成组件负责焦点、遮罩关闭、Escape 和 viewer 输入锁。第三方弹窗保留自己的无障碍行为；`usePanoModal` 只协调 viewer 输入。以上方式均不要求修改热点定义或项目 JSON。

<a id="quick-start"></a>
## 快速开始

按 [安装说明](../README.zh-CN.md#安装) 安装 viewer 与现有 peer dependencies。viewer 样式只需导入一次；使用默认弹窗外观时，再导入独立的 UI 样式：

```tsx
import { useState } from "react";
import {
  PanoOverlay,
  PanoViewer,
  ProjectScenes,
  usePanoOverlay,
  usePanoViewer,
  type LoadedPanoProject,
  type ProjectHotspotDefinition,
} from "@ericchen1990/pano-view";
import { PanoDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";
import "./tour.css";

function FullscreenButton({ onToggle }: { onToggle: () => void }) {
  const { isFullscreen } = usePanoOverlay();
  return (
    <button
      type="button"
      style={{ position: "absolute", right: 16, bottom: 16, pointerEvents: "auto" }}
      onClick={onToggle}
    >
      {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    </button>
  );
}

export function Tour({ project }: { project: LoadedPanoProject }) {
  const viewer = usePanoViewer();
  const [selected, setSelected] = useState<ProjectHotspotDefinition | null>(null);

  return (
    <PanoViewer
      ref={viewer.ref}
      className="my-tour"
      style={{ height: 560 }}
    >
      <ProjectScenes
        project={project}
        onHotspotClick={(event) => {
          if (event.hotspot.id !== "details") return;
          event.preventDefault();
          setSelected(event.hotspot);
        }}
        onActiveSceneIdChange={() => setSelected(null)}
      />
      <PanoOverlay>
        <FullscreenButton onToggle={() => void viewer.toggleFullscreen()} />
        <PanoDialog
          open={selected !== null}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          title={selected?.label ?? "Details"}
          description="Discover more about this place."
          closeLabel="Close details"
        >
          {selected ? <p key={selected.id}>Content for {selected.label ?? selected.id}</p> : null}
        </PanoDialog>
      </PanoOverlay>
    </PanoViewer>
  );
}
```

传入已加载的项目，并在项目中准备一个 ID 为 `details` 的热点；`loadPanoProject` 用法见[静态项目与 JSON 数据](../README.zh-CN.md#静态项目与-json-数据)。按自己的内容映射调整选中条件。只有应用接管点击时才调用 `preventDefault()`；其他热点继续使用默认的场景跳转或媒体播放。示例显式选择在切换场景时关闭弹窗，库本身不强制这种业务策略。

`PanoViewer` 的场景子节点留在 Three.js 树中。普通 DOM 弹窗放在 `PanoOverlay` 里，不要作为会进入场景树的裸兄弟节点与 `Sphere`、`ProjectScenes` 并列。全屏变化时保持 overlay 树稳定；以全屏状态作为 key 会重置内容。

多个热点的接入请继续看[下方完整映射示例](#choose-content-by-hotspot)：一个弹窗复用五份内容，并提供对应的项目 JSON。

<a id="choose-content-by-hotspot"></a>
## 按热点选择内容

热点的标记类型描述它在全景中的外观，热点 ID 用于查找应用自己的弹窗内容。**一个 `PanoDialog` 是复用的外壳：选中的热点改变时，标题和内容随之改变。** 同一时刻展示一个选中热点的内容，关闭后再点击另一个背景热点。

### 完整示例：五个热点，对应五份内容

下方映射为每个场景配置两份不同的图文、一段视频、一组画册和一个 iframe。两个场景刻意复用同一组热点 ID，因此查找时同时使用 `sceneId` 和 `hotspot.id`，而不是按标记类型或内容类型选择。

| 场景 | 热点 ID | 内容类型 | 弹窗标题 |
| --- | --- | --- | --- |
| `entrance` | `story` | article | Courtyard story |
| `entrance` | `details` | article | Garden details |
| `entrance` | `clip` | video | Courtyard video |
| `entrance` | `photos` | gallery | Courtyard gallery |
| `entrance` | `guide` | iframe | Courtyard guide |
| `hall` | `story` | article | Hall story |

下面是完整源码，包含所有内容组件、映射、选中状态和点击处理。`/overlays` 页的 Default dialog 展示这份源码；Compose parts 与 Third-party dialog 会换成各自的弹窗示例。保存为 `multi-hotspot-example.tsx`，以 `project` 传入已加载的项目即可；在仓库外使用时，将 `/fixtures/...` 替换为自己的资源地址。

```tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  PanoOverlay,
  PanoViewer,
  ProjectScenes,
  type LoadedPanoProject,
} from "@ericchen1990/pano-view";
import { PanoDialog } from "@ericchen1990/pano-view/ui";
import "@ericchen1990/pano-view/styles.css";
import "@ericchen1990/pano-view/ui/styles.css";

function Story({ image, text }: { image: number; text: string }) {
  return <article style={{ display: "grid", gap: 16 }}>
    <img src={`/fixtures/panorama/panos/${image}/sphere.webp`} alt={text}
      style={{ display: "block", width: "100%", height: "auto" }} />
    <p>{text}</p>
    <label style={{ display: "grid", gap: 8 }}>Your notes
      <input placeholder="Keep a note while switching fullscreen"
        style={{ padding: 8, border: "1px solid currentColor", background: "transparent", color: "inherit" }} />
    </label>
  </article>;
}

function Movie({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = ref.current;
    return () => { video?.pause(); };
  }, []);
  if (failed) return <p role="alert">This video could not be loaded. Close and reopen to try again.</p>;
  return <video ref={ref} src={src} controls playsInline preload="metadata"
    onError={() => setFailed(true)} style={{ display: "block", width: "100%" }} />;
}

function Gallery({ images }: { images: number[] }) {
  const [index, setIndex] = useState(0);
  if (!images.length) return <p>No images available.</p>;
  return <figure style={{ margin: 0 }}>
    <img src={`/fixtures/panorama/panos/${images[index % images.length]}/sphere.webp`}
      alt={`Panorama ${images[index % images.length]}`}
      style={{ display: "block", width: "100%", height: "auto" }} />
    <figcaption style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
      <button type="button" onClick={() => setIndex((index + images.length - 1) % images.length)}>Previous image</button>
      <span aria-live="polite">{index % images.length + 1} / {images.length}</span>
      <button type="button" onClick={() => setIndex((index + 1) % images.length)}>Next image</button>
    </figcaption>
  </figure>;
}

type PopupDefinition = {
  kind: "article" | "video" | "gallery" | "iframe";
  title: string;
  body: ReactNode;
};
export type PopupSelection = { sceneId: string; hotspotId: string };

// Application content, separate from the marker's type and project JSON.
export const POPUPS_BY_SCENE: Partial<Record<string, Partial<Record<string, PopupDefinition>>>> = {
  entrance: {
    story: { kind: "article", title: "Courtyard story", body: <Story image={1} text="The courtyard opens onto a quiet garden and a path beside the water." /> },
    details: { kind: "article", title: "Garden details", body: <Story image={2} text="Explore the planting, stone paths and small details around the garden." /> },
    clip: { kind: "video", title: "Courtyard video", body: <Movie src="/fixtures/hotspots/loop.webm" /> },
    photos: { kind: "gallery", title: "Courtyard gallery", body: <Gallery images={[1, 2, 3]} /> },
    guide: { kind: "iframe", title: "Courtyard guide", body: <iframe title="Courtyard visitor guide" src="/fixtures/hotspots/embed.html" sandbox="allow-same-origin" style={{ width: "100%", height: 320, border: 0 }} /> },
  },
  hall: {
    story: { kind: "article", title: "Hall story", body: <Story image={3} text="Inside the hall, follow the architecture and the view toward the next room." /> },
    details: { kind: "article", title: "Hall details", body: <Story image={1} text="Discover how the hall connects the building to its surrounding landscape." /> },
    clip: { kind: "video", title: "Hall video", body: <Movie src="/fixtures/hotspots/loop.webm" /> },
    photos: { kind: "gallery", title: "Hall gallery", body: <Gallery images={[3, 1, 2]} /> },
    guide: { kind: "iframe", title: "Hall guide", body: <iframe title="Hall visitor guide" src="/fixtures/hotspots/embed.html" sandbox="allow-same-origin" style={{ width: "100%", height: 320, border: 0 }} /> },
  },
};

// The project must contain these hotspot IDs in entrance / hall.
export function MultiHotspotTour({ project }: { project: LoadedPanoProject }) {
  const [selected, setSelected] = useState<PopupSelection | null>(null);
  const popup = selected ? POPUPS_BY_SCENE[selected.sceneId]?.[selected.hotspotId] : undefined;
  const contentKey = selected ? JSON.stringify([selected.sceneId, selected.hotspotId]) : "closed";

  return (
    <PanoViewer style={{ height: 560 }}>
      <ProjectScenes
        project={project}
        onHotspotClick={(event) => {
          const mapped = POPUPS_BY_SCENE[event.sceneId]?.[event.hotspot.id];
          if (!mapped) return; // Keep default navigation/playback for unmapped hotspots.
          event.preventDefault();
          setSelected({ sceneId: event.sceneId, hotspotId: event.hotspot.id });
        }}
        onActiveSceneIdChange={() => setSelected(null)}
      />
      <PanoOverlay>
        <PanoDialog
          open={popup !== undefined}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          title={popup?.title ?? "Hotspot content"}
        >
          {popup ? <div key={contentKey}>{popup.body}</div> : null}
        </PanoDialog>
      </PanoOverlay>
    </PanoViewer>
  );
}
```

### 在项目中注册对应的热点标记

内容映射不会自动创建标记，项目中的场景 ID 和热点 ID 必须与映射键一致。以下是该示例的完整项目结构；将每个场景生成的 `viewer.json` 及资源放在对应目录，再按[静态项目与 JSON 数据](../README.zh-CN.md#静态项目与-json-数据)中的方式使用 `loadPanoProject` 加载。

```json
{
  "schemaVersion": 1,
  "initialSceneId": "entrance",
  "scenes": [
    {
      "id": "entrance",
      "source": {"viewerUrl": "entrance/viewer.json"},
      "hotspots": [
        {"id":"story","type":"graphic","label":"story","position":{"yaw":-28,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"details","type":"graphic","label":"details","position":{"yaw":-14,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"clip","type":"graphic","label":"clip","position":{"yaw":0,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"photos","type":"graphic","label":"photos","position":{"yaw":14,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"guide","type":"graphic","label":"guide","position":{"yaw":28,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"next-room","type":"graphic","label":"Go to next room","position":{"yaw":0,"pitch":-18},"width":7,"height":7,"graphic":{"kind":"arrow","fill":"#67e8f9"},"action":{"type":"scene","sceneId":"hall"}}
      ]
    },
    {
      "id": "hall",
      "source": {"viewerUrl": "hall/viewer.json"},
      "hotspots": [
        {"id":"story","type":"graphic","label":"story","position":{"yaw":-28,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"details","type":"graphic","label":"details","position":{"yaw":-14,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"clip","type":"graphic","label":"clip","position":{"yaw":0,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"photos","type":"graphic","label":"photos","position":{"yaw":14,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"guide","type":"graphic","label":"guide","position":{"yaw":28,"pitch":0},"width":7,"height":7,"graphic":{"kind":"circle","fill":"#df6b42"}},
        {"id":"next-room","type":"graphic","label":"Go to next room","position":{"yaw":0,"pitch":-18},"width":7,"height":7,"graphic":{"kind":"arrow","fill":"#67e8f9"},"action":{"type":"scene","sceneId":"entrance"}}
      ]
    }
  ]
}
```

所有标记均使用 `type: "graphic"`。`POPUPS_BY_SCENE` 中的 `kind` 仅是应用用于说明内容和绘制映射表的元数据，不是新增的热点类型，也不需要写入项目 JSON。两个图文条目虽然同为 article，却拥有不同的文字和图片。

### 点击后的数据流

1. `onHotspotClick` 提供场景 ID 和热点 ID。`POPUPS_BY_SCENE[event.sceneId]?.[event.hotspot.id]` 查找对应内容定义。
2. 没有配置时直接返回，不调用 `preventDefault()`。因此 `next-room` 标记仍执行默认场景跳转，其他未映射的媒体标记仍保留默认播放行为。
3. 找到内容后调用 `preventDefault()` 取消该标记原本的默认动作，再用 `setSelected` 仅保存 `{ sceneId, hotspotId }`。
4. 下一次渲染从选中状态派生出 `popup`。同一个 `PanoDialog` 接收新的 `popup.title` 和 `popup.body`，不必为每个热点创建单独的弹窗实例。
5. 内容容器的 key 同时包含两个 ID。通过代码直接切换选中热点时，旧内容的表单/画册状态会重置并执行清理，包括暂停原视频；外层弹窗和焦点范围继续复用。
6. 关闭弹窗或切换场景会清空 `selected`，卸载内容并释放模态锁。切换全屏不改变选中热点的 key，因此不会重置内容。

在 `/overlays` 中分别打开 **Courtyard story** 和 **Garden details**，比较两个图文热点，再尝试视频、画册和指南。点击 **Go to next room** 进入 hall 后，同样的 `story` ID 会打开内容不同的 **Hall story**。viewer 下的映射表与可复制代码会展示实际对应关系。

`body` 接受任意 React 节点：原生媒体、业务组件、图文内容，或请求 API 数据的组件。加载中/错误状态在内容组件中处理，自定义播放器和订阅在 cleanup 中释放。如果内容来自 JSON，应将已校验的内容类型映射到 React 渲染器，不要将 React 节点写进 JSON。iframe 的权限按嵌入来源配置，第三方响应头可能禁止嵌入；视频自动播放需明确开启，并受浏览器策略限制。

<a id="customize-the-default-appearance"></a>
## 定制默认弹窗外观

### 1. 使用 CSS 变量设置整个 viewer 的主题

使用快速开始示例中的 `my-tour` 类，将以下样式写入 `tour.css`，并在默认 UI 样式之后加载：

```css
.my-tour {
  --pano-dialog-width: 760px;
  --pano-dialog-background: #ffffff;
  --pano-dialog-color: #17212b;
  --pano-dialog-backdrop: rgb(0 0 0 / 55%);
  --pano-dialog-border: 1px solid #d0d7de;
  --pano-dialog-radius: 16px;
  --pano-dialog-shadow: 0 20px 64px rgb(0 0 0 / 25%);
  --pano-dialog-padding: 24px;
  --pano-dialog-muted-color: #52616f;
  --pano-dialog-focus-color: #005fcc;
}
```

变量会继承到当前 viewer 内所有弹窗及其遮罩，全屏时仍然有效。不同 viewer 可使用不同的主题类。

| 变量 | 默认值 | 作用范围 |
| --- | --- | --- |
| `--pano-dialog-width` | `640px` | 内容期望宽度，仍受可见空间上限约束 |
| `--pano-dialog-background` | `#161b22` | 内容背景 |
| `--pano-dialog-color` | `#f4f4f4` | 内容和关闭按钮文字颜色 |
| `--pano-dialog-backdrop` | `rgb(0 0 0 / 65%)` | 遮罩背景 |
| `--pano-dialog-border` | `1px solid #39424e` | 内容边框 |
| `--pano-dialog-radius` | `12px` | 内容圆角 |
| `--pano-dialog-shadow` | `0 16px 64px rgb(0 0 0 / 45%)` | 内容阴影 |
| `--pano-dialog-padding` | `20px` | 标题栏、内容间距和关闭按钮上/右边距 |
| `--pano-dialog-muted-color` | `#a7b4c4` | 描述文字颜色 |
| `--pano-dialog-focus-color` | `#ffb300` | 默认关闭按钮的焦点轮廓颜色 |

`--pano-dialog-width` 由组件的结构布局读取，即使不导入可选样式文件也有效；其余外观变量由该样式文件使用。`--pano-dialog-available-width` 和 `--pano-dialog-available-height` 由组件计算，请调整期望宽度变量，不要覆盖这些测量值。

**变量放置位置很重要。** `PanoDialog.className` 和 `PanoDialog.style` 作用于 Content。Backdrop 是并列节点，因此在 Content 上设置 `style={{ "--pano-dialog-backdrop": "..." }}` 不会改变遮罩。遮罩变量应放在 viewer/祖先上，或组合 `PanoDialogBackdrop` 并直接设置它的 `style`。

### 2. 用 className 或内联 style 定制单个弹窗

`className` 作用于内容面板，可通过默认类名定位后代：

```css
.my-dialog .pano-dialog-title { font-size: 1.4rem; }
.my-dialog .pano-dialog-description { line-height: 1.6; }
.my-dialog .pano-dialog-body { line-height: 1.7; }
.my-dialog .pano-dialog-close { color: #b42318; }
```

TypeScript 中动态设置 CSS 自定义属性时，为其补充兼容类型：

```tsx
import type { CSSProperties } from "react";
import { PanoDialog, type PanoDialogProps } from "@ericchen1990/pano-view/ui";

const style: CSSProperties & { "--pano-dialog-width": string } = {
  "--pano-dialog-width": "720px",
  background: "#fff",
  color: "#17212b",
  borderRadius: 8,
};

// Render this component inside PanoOverlay.
export function StyledDialog(props: PanoDialogProps) {
  return <PanoDialog {...props} className="my-dialog" style={style} />;
}
```

默认面板的定位、宽度、最大高度、flex 布局、overflow 和 pointer events 使用内联结构样式。普通 CSS 的 width 规则不能覆盖内联宽度，应使用 `--pano-dialog-width`。需要改变其他结构样式时，可显式传入 `style` 并保留可见空间约束，或使用组成组件。CSS Modules 可用 `.dialog :global(.pano-dialog-title)` 定位后代；需要继承的主题变量放在 viewer 的 module 类上。

| 默认选择器 | 含义 |
| --- | --- |
| `.pano-dialog-backdrop` | 遮罩，位于 Content 外部 |
| `.pano-dialog-content` | 内容面板，接收 `PanoDialog.className` 和 `style` |
| `.pano-dialog-header` | 默认标题与描述的容器 |
| `.pano-dialog-title` | 标题 |
| `.pano-dialog-description` | 可选描述 |
| `.pano-dialog-close` | 默认 36×36 关闭按钮，使用居中的 SVG |
| `.pano-dialog-body` | 默认可滚动内容区 |

<a id="compose-a-different-layout"></a>
## 组合自己的布局

需要底部操作、不同的关闭控件或完全控制内容结构时，使用组成组件。下面示例提供自己的视觉样式，不需要 `ui/styles.css`。在 `PanoOverlay` 中渲染 `CustomLayoutDialog`，传入打开状态和内容即可。

```tsx
import type { ReactNode } from "react";
import {
  PanoDialogRoot, PanoDialogBackdrop, PanoDialogContent,
  PanoDialogTitle, PanoDialogDescription, PanoDialogClose,
} from "@ericchen1990/pano-view/ui";

export function CustomLayoutDialog({ open, onOpenChange, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <PanoDialogRoot open={open} onOpenChange={onOpenChange}>
      <PanoDialogBackdrop style={{ background: "rgb(0 0 0 / 60%)" }} />
      <PanoDialogContent className="custom-panel" style={{ overflow: "hidden" }}>
        <header className="custom-header">
          <div>
            <PanoDialogTitle className="custom-title">Visitor guide</PanoDialogTitle>
            <PanoDialogDescription className="custom-description">Explore this location.</PanoDialogDescription>
          </div>
          <PanoDialogClose className="custom-close" type="button" aria-label="Close guide">Close</PanoDialogClose>
        </header>
        <div className="custom-body">{children}</div>
        <footer className="custom-footer">
          <PanoDialogClose className="custom-close" type="button">Done</PanoDialogClose>
        </footer>
      </PanoDialogContent>
    </PanoDialogRoot>
  );
}
```

```css
.custom-panel.pano-dialog-content {
  background: #fff;
  color: #17212b;
  border: 1px solid #d0d7de;
  border-radius: 12px;
}
.custom-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px;
  flex-shrink: 0;
}
.custom-title { margin: 0; font-size: 1.25rem; }
.custom-description { margin: 8px 0 0; color: #52616f; }
.custom-body { min-height: 0; overflow: auto; padding: 0 20px 20px; }
.custom-footer { flex-shrink: 0; padding: 16px 20px; border-top: 1px solid #d0d7de; }
.custom-close { padding: 8px 12px; color: inherit; background: transparent; border: 1px solid currentColor; border-radius: 6px; cursor: pointer; }
.custom-close:focus-visible { outline: 2px solid #005fcc; outline-offset: 2px; }
```

Root 已经获取 viewer 模态锁，不要再为它调用 `usePanoModal`。Backdrop 与 Content 分别创建自己的 Portal，无需再包一层 Portal。Content 保留测量定位和二级 Portal 容器，明确不接受 `asChild` 与 `forceMount`；Title、Description 和 Close 保留 Radix 的组合 props。始终提供有意义的 Title；如果没有描述，省略 Description，并给 Content 传入 `aria-describedby={undefined}`。

需要阻止 Escape 或外部点击关闭时，在 Content 上使用 `onEscapeKeyDown` 或 `onInteractOutside`，并针对需要阻止的行为调用 `event.preventDefault()`，同时保留可用的 Close 控件。自定义初始焦点和返回焦点使用 `onOpenAutoFocus` / `onCloseAutoFocus`；调用 `preventDefault()` 后由应用接管焦点处理。这些高级事件位于 `PanoDialogContent`，不属于便捷组件 `PanoDialog` 的 props。

<a id="use-an-existing-dialog"></a>
## 接入已有 Dialog

viewer 不强制应用使用可选 UI 组件。第三方接入需要连接三件事：本地 Portal 容器、测量布局与 viewer 输入协调。下面以 Radix 为例，组件应在 `PanoOverlay` 中渲染。应用直接导入 `@radix-ui/react-dialog` 时，需要将它安装为自己的直接依赖。

```tsx
import { useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  PanoOverlayPortalProvider, usePanoModal, usePanoOverlay,
} from "@ericchen1990/pano-view";

export function ExistingDialog({ open, onOpenChange, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const { portalContainer, visibleRect } = usePanoOverlay();
  const [localContainer, setLocalContainer] = useState<HTMLDivElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  usePanoModal(open);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {portalContainer ? (
        <Dialog.Portal container={portalContainer}>
          <Dialog.Overlay style={{ position: "absolute", inset: 0, background: "rgb(0 0 0 / 60%)", pointerEvents: "auto" }} />
          <Dialog.Content
            aria-describedby={undefined}
            style={{
              position: "absolute",
              left: visibleRect.left + visibleRect.width / 2,
              top: visibleRect.top + visibleRect.height / 2,
              transform: "translate(-50%, -50%)",
              width: Math.min(720, Math.max(0, visibleRect.width - 32)),
              maxHeight: Math.max(0, visibleRect.height - 32),
              display: "flex", flexDirection: "column", overflow: "hidden",
              background: "#fff", color: "#17212b", pointerEvents: "auto",
            }}
            onOpenAutoFocus={() => {
              const active = portalContainer.ownerDocument.activeElement;
              previousFocus.current = active instanceof HTMLElement ? active : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const previous = previousFocus.current;
              const canvas = portalContainer.closest("[data-pano-viewer]")?.querySelector("canvas");
              const target = previous?.isConnected && previous !== previous.ownerDocument.body && !previous.closest("[inert]") ? previous : canvas;
              if (target && !target.closest("[inert]")) target.focus({ preventScroll: true });
            }}
          >
            <header style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: 20, flexShrink: 0 }}>
              <Dialog.Title style={{ margin: 0 }}>Visitor guide</Dialog.Title>
              <Dialog.Close type="button">Close</Dialog.Close>
            </header>
            <PanoOverlayPortalProvider container={localContainer}>
              <div style={{ minHeight: 0, overflow: "auto", padding: 20 }}>{children}</div>
            </PanoOverlayPortalProvider>
            <div ref={setLocalContainer} style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }} />
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}
```

等待容器非 null 后再创建 Portal；viewer 挂载期间也不能让第三方 Portal 回退到 `document.body`。已有 MUI、Ant Design、shadcn 或其他封装，需要能配置等价的挂载目标；按实际暴露的 Portal API 适配。仅将组件放进 `PanoOverlay`，不会自动修复它内部写死的 body Portal。

`usePanoModal(open)` 暂停 viewer 输入与自动旋转，让背景 viewer 界面 inert 并关闭其右键菜单。它不会为第三方弹窗提供焦点约束、无障碍名称、关闭控件或页面滚动管理。锁按 viewer 隔离、引用计数；关闭弹窗不会释放其他弹窗或转场持有的锁。hook 应在 `PanoOverlay` 下的子组件中无条件调用，不要写在 `PanoViewer` 的父组件里。

<a id="nested-portals"></a>
## 二级 Portal

在 `PanoDialogContent` 内，`usePanoOverlay().portalContainer` 指向该弹窗内部的二级容器。菜单、Popover、Select、Tooltip 使用它，才能同时留在弹窗的焦点/交互范围与全屏子树中。下面以原生 React Portal 展示一个简单 Tooltip：

```tsx
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { usePanoOverlay } from "@ericchen1990/pano-view";

// Render inside PanoDialog's content, or inside PanoDialogContent.
export function DialogHelp() {
  const { portalContainer } = usePanoOverlay();
  const id = useId();
  const [visible, setVisible] = useState(false);
  return <>
    <button type="button" aria-describedby={visible ? id : undefined}
      onFocus={() => setVisible(true)} onBlur={() => setVisible(false)}
      onPointerEnter={() => setVisible(true)} onPointerLeave={() => setVisible(false)}>
      About this place
    </button>
    {visible && portalContainer ? createPortal(
      <div id={id} role="tooltip" style={{ position: "absolute", top: 80, left: 16, padding: 12, background: "#17212b", color: "#fff", pointerEvents: "none" }}>
        Follow the path to explore the next room.
      </div>,
      portalContainer,
    ) : null}
  </>;
}
```

示例中的固定坐标仅用于说明挂载位置；正式的浮层应根据触发元素定位。可交互 Popover 的实际面板需要 `pointer-events: auto`。第三方 Dialog 可按上一示例在 Content 内创建本地容器，并使用 `PanoOverlayPortalProvider` 包裹内容。它只替换后代读取到的 Portal 容器；`size` 和 `visibleRect` 仍描述原始 viewer，不能直接用作二级浮层的定位坐标。

<a id="fullscreen-and-lifecycle"></a>
## 全屏与生命周期

- 全屏是 viewer 全局功能。按钮放在全局 viewer 界面，如快速开始示例所示；弹窗本身不包含全屏按钮。
- 普通模式和元素全屏复用同一个 viewer 内的稳定容器。不要在切换时更换容器或 key，表单值、视频节点和 iframe 文档才可以保持挂载。
- `size` 测量完整 viewer；`visibleRect` 表示其与 visual viewport 的可见交集，考虑页面滚动和视口变化。内置弹窗在可见矩形中居中，并预留 16px 边距。默认内容区滚动，标题栏和 Close 保持可用；关闭按钮上侧和右侧采用同一个 padding 变量，上侧额外考虑安全区域。
- 关闭会卸载内容，重新打开会重新初始化。需要跨关闭保留的表单状态应提升到弹窗外部；热点间直接切换时使用热点 ID 作为内容 key，重置该热点独立的状态。
- 浏览器可能优先用 Escape 退出全屏。iframe 内的键盘事件不会冒泡到外层页面。保留可见的关闭按钮，并在目标浏览器验证原生或第三方播放器行为。
- 此处是普通查看模式与标准/WebKit 元素全屏下的 DOM 界面。原生视频全屏和沉浸式 WebXR 使用不同的呈现区域。

在 Next.js 中，将需要状态的 viewer/弹窗放入 Client Component（`"use client"`）。保持服务端与客户端初始状态一致，不在 render 中读取 `document`。初始挂载时 Portal 容器为 null 属于正常情况。

<a id="api-reference"></a>
## API 参考

### `/ui` 导出的 `PanoDialog`

| Prop | 类型 / 默认值 | 含义 |
| --- | --- | --- |
| `open` | `boolean`，必填 | 受控打开状态 |
| `onOpenChange` | `(open: boolean) => void`，必填 | 宿主更新状态；关闭时可清空选中的热点 |
| `title` | `ReactNode`，必填 | 可见且可被辅助技术读取的标题 |
| `children` | `ReactNode`，必填 | 应用内容 |
| `description` | `ReactNode`，可选 | 标题下的描述文字 |
| `closeLabel` | `string`，`"Close"` | 默认关闭按钮的无障碍名称 |
| `className` | `string`，可选 | Content 上的附加类，不作用于 Backdrop |
| `style` | `CSSProperties`，可选 | Content 样式；自定义属性需补充兼容的 TS 类型 |

`PanoDialog` 是便捷组件，不会透传所有 Radix props。额外的关闭策略、焦点事件、DOM 和布局选项使用组成组件设置。

### `/ui` 导出的组成组件

| 导出 | 约定 |
| --- | --- |
| `PanoDialogRoot` | 必填 `open`、`onOpenChange`、`children`；模态行为与 viewer 锁 |
| `PanoDialogBackdrop` | Radix Overlay props 与 div ref，不接受 `forceMount`；自带 Portal |
| `PanoDialogContent` | Radix Content props 与 div ref，不接受 `asChild` / `forceMount`；测量布局、焦点恢复、二级 Portal 容器 |
| `PanoDialogTitle` | Radix Title props/ref；提供有意义的标题 |
| `PanoDialogDescription` | Radix Description props/ref；没有描述时省略，并关闭 `aria-describedby` |
| `PanoDialogClose` | Radix Close props/ref；负责关闭，不自带便捷组件的图标或 class |

每个组件均有对应的 `*Props` 类型。Root 受控，不提供 `defaultOpen`、`modal` 或 Trigger 配置。Close、Title 和 Description 支持 Radix `asChild` 与合适的 DOM 组件组合。

### 主入口导出的 Overlay API

| API | 约定 |
| --- | --- |
| `PanoOverlay` | 推荐的屏幕平面包裹；作为 `PanoViewer` 的直接子节点（或其下 Fragment 内） |
| `PanoViewer.renderOverlay(context)` | 可选的回调式 DOM 内容，位于 Canvas 之外；不是调用 hook 的位置 |
| `usePanoOverlay()` | 为 DOM 后代提供相同 context；在 Overlay provider 外调用会抛错 |
| `usePanoModal(open)` | 获取/释放当前 viewer 的模态输入锁，无返回值 |
| `PanoOverlayPortalProvider` | 必填 `container: HTMLDivElement \| null`、`children`；只覆盖后代的 Portal 目标 |
| `PanoOverlayRenderContext` | 导出的 context 类型 |

| Context 字段 | 含义 |
| --- | --- |
| `portalContainer` | viewer 内稳定的 `HTMLDivElement \| null`；在 Content 内为二级目标 |
| `size` | 完整 viewer 的 `{ width, height }`，单位为 CSS 像素 |
| `visibleRect` | viewer 与视口可见交集的 `{ left, top, width, height }`，以 viewer 为坐标基准 |
| `isFullscreen` | viewer 是否处于相关的元素全屏状态 |

<a id="troubleshooting"></a>
## 常见问题

| 现象 | 检查与处理 |
| --- | --- |
| 全屏时弹窗不见了 | 检查实际 Portal DOM。弹窗和所有二级浮层均应挂在 viewer 内；单纯提高 body Portal 的 `z-index` 不会将它移入全屏子树。 |
| 遮罩颜色变量无效 | 放在 viewer/祖先上，或直接给组成组件 Backdrop 设置 `style`；Content 样式无法影响并列节点。 |
| 面板宽度 class 无效 | 使用 `--pano-dialog-width`；普通样式规则不能覆盖内联结构宽度。 |
| 标题栏、内容区或关闭按钮定制无效 | 在 Content 的 class 下定位后代，或使用组成组件。`PanoDialog` 没有 header/body/close 的 slot props。 |
| 不导入默认样式仍然有定位 | 结构定位、尺寸和指针行为按设计使用内联样式。省略 `ui/styles.css` 后提供自己的外观；完全控制 DOM 时接入自己的 Dialog。 |
| 长内容把关闭按钮挤走 | 组成布局中，header/footer 设置 `flex-shrink: 0`，body 设置 `min-height: 0; overflow: auto`，并保持 Content 的测量尺寸约束。 |
| 切换全屏后视频/表单重置 | 移除依赖全屏状态的 key、容器切换、不同弹窗实现间的条件切换，以及在 render 回调内定义的组件函数。 |
| 自定义弹窗后面的全景仍会移动 | 在 `PanoOverlay` 下的自定义组件中调用 `usePanoModal(open)`；默认/组成组件的 Root 已经处理。 |
| 二级 Popover 被隐藏或不可点击 | 使用 `usePanoOverlay()` 返回的 Content 内部容器，并在实际面板上开启 pointer events。 |
| hook 提示缺少 provider | 把自定义 DOM 组件放在 `PanoOverlay` 内；不要在 `PanoViewer` 的父组件调用 Overlay hook。 |

接入时应确认普通模式与真实元素全屏、viewer 部分滚出屏幕、键盘开关与焦点恢复、长内容、二级 Portal、媒体清理及目标 Safari/移动设备的表现。最大化浏览器窗口不能替代 Fullscreen API 验证。

## VR 空间弹窗与凝视操作

`PanoDialog`、组合式 `PanoDialogRoot/Content` 和 `ProjectPopupDialog` 会自动使用同一份内容切换为空间面板。原弹窗右上角的关闭按钮继续可用；面板底部只提供内容操作，不增加关闭或退出 VR 按钮。VR 中热点 Tooltip 使用固定于热点的三维精灵，与场景共用双眼投影和镜片校正，保留显示并位于弹窗下方。手机和模拟 VR 的弹窗通过每眼独立平面图层合成，不经过全景镜片畸变；最后统一应用镜片可见区域遮罩，弹窗不会越过遮罩。

第三方弹窗可使用主入口的 `usePanoDialogSurface({ open, onOpenChange })`，将 `contentRef` 连接到内容节点，使用返回的 `portalContainer`、`visibleRect` 和 `presentation`。将返回的 `onInteractOutside` 传给弹窗内容：空间模式和操作 viewer 外的宿主控件（包括进入 VR）时会阻止自动关闭，普通模式仍支持 viewer 内的遮罩点击关闭。空间模式将内容放到 viewer 内的离屏测量区域（保留 DOM 实例），不要对内容调用 `display:none` 或将 portal 移到 `body`。保留可凝视点击的关闭按钮。完整接入参见 Playground 的第三方弹窗示例。

宿主模型使用 `usePanoSpatialControls(elementRef, adapter)` 接入一次。`PanoSpatialControlAdapter` 支持 `rotateBy(yawDegrees, pitchDegrees)`、`zoomBy(factor)`、`resetView()`、`canExecute(action)`、`subscribeFrame(invalidate)` 和同一 WebGL 上下文的 `texture`。动作名为 `left/right/up/down/in/out/reset`。仅显示已提供能力；宿主负责限制观察角度、缩放范围及复位状态。独立 Canvas 应在渲染结束后提供可读取的画面；纹理必须属于当前 viewer 的渲染上下文。不会重新加载模型或改变项目 JSON。

连续操作在凝视计时完成后开始，移开即停；滚动默认每隔 700 毫秒移动一小步；旋转每秒 30 度、缩放每秒 1.5 倍。关闭、复位、图集切换为单次操作。明确禁用 `cursor` 或将 `cursorDwellMs` 设为零仍会禁用自动凝视。文字输入和虚拟键盘不在支持范围。跨域 iframe、不可读取的 Canvas 或被浏览器阻止的媒体需要退出 VR 后查看或授权；凝视不能替代浏览器要求的可信用户手势。

空间窗口默认距视点约 2 米，外框按宽不超过 32°、高不超过 40°的视角缩放，避免长内容撑满双眼视野。关闭按钮视觉尺寸在普通模式和 VR 中均为 36px；VR 使用至少 56px 的不可见凝视命中范围。原生捕获会完整检测 `content="drawable"` 和绘制 API；旧实验 API 使用兼容捕获。可通过内容节点的 `data-pano-spatial-state`（`loading`、`ready`、`error`）观察捕获状态。

`PanoOverlay` / `renderOverlay` 内的屏幕平面 UI 在 VR 中隐藏且不可聚焦，退出后恢复。Portal 容器保持挂载和可测量，以便已注册的弹窗继续渲染为空间面板。内置 VR 会话控制仍可使用。

## VR 图标控件与滚动

这些新增控件只在 VR 模式显示；退出后隐藏且不可聚焦。普通模式继续使用视频原生控件、鼠标模型交互和原生滚动。无需改变项目 JSON。

主入口导出 `PanoMediaControls`、`PanoModelControls`、`PanoScrollControls`、`PanoControlGroup`、`PanoControlButton`、`PanoSpatialControls`、`usePanoMediaController`，以及 `PanoMediaController`、`PanoControlAction` 类型。导入 `@ericchen1990/pano-view/styles.css`。

```tsx
const mediaRef = useRef<HTMLVideoElement>(null);
const controller = usePanoMediaController(mediaRef);
// 在 PanoDialog 内；同一个 video 保留原生控件供普通模式使用。
<video ref={mediaRef} src="/movie.mp4" controls playsInline />
<PanoMediaControls controller={controller} />
```

场景内按钮组放在 `PanoOverlay` 内，使用 `PanoSpatialControls` 将 DOM 内容呈现为空间面板：

```tsx
<PanoOverlay>
  <PanoSpatialControls position={{ yaw: 55, pitch: -14 }} width={28} distance={10}>
    <PanoMediaControls controller={controller} />
  </PanoSpatialControls>
</PanoOverlay>
```

`position` 使用与热点相同的 yaw/pitch 度数；`width` 是角宽（默认 28°），`distance` 默认 2。省略 position 时，面板出现在进入 VR 时的视线下方并保持位置。面板应位于内容旁边，避免遮挡视频。360° 视频可通过 `usePanoViewer()` 的 `getVideo` / `subscribeVideo` 获取 controller；订阅后用同一组件。`VideoHotspot` 的 `ref` 返回 controller，配合 `onPlaybackStateChange` 同步宿主的 `playing` 状态。关闭、切源和卸载仍遵循媒体本身的生命周期。

`PanoModelControls` 接收已有 `adapter`，支持 `rotateSpeed`（默认每秒 30°）、`zoomSpeed`（默认每秒 1.5 倍）；不会加载模型或接管宿主视角状态。宿主通过 `canExecute` 限制角度和缩放范围。

默认 VR 弹窗自动提供半透明滚动图标，使用双箭头，贴在可滚动区域的上下边缘，并可与模型操作同时存在。仅显示仍可滚动的方向；没有溢出时隐藏。默认不透明度为 0.3，凝视或悬停时提升至 0.9。默认弹窗绑定正文；嵌套内容可自动选择最近滚动区域。第三方弹窗可向 `usePanoDialogSurface({ open, onOpenChange, scrollTargetRef })` 传入滚动容器 ref；组合弹窗可传给 `PanoDialogRoot`。显式绑定优先于自动选择。也可自行添加 `<PanoScrollControls targetRef={scrollRef} speed={0.2} />`，组件会将按钮叠加到目标滚动区域边缘。跨域 iframe 的内部页面无法访问，仍需退出 VR 操作。

所有操作组支持 `actions` 数组：内置动作 ID 与自定义动作可混合排序。媒体 ID 为 `play/pause/rewind/forward/vol-/vol+/mute/unmute`，模型 ID 为 `left/right/up/down/in/out/reset`，滚动 ID 为 `up/down/left/right`。播放与静音 ID 随状态变化；筛选时同时包含两种状态。

```tsx
<PanoMediaControls controller={controller} actions={["rewind", "play", "pause", "forward"]}>
  {actions => <div className="my-layout">{actions.map(action =>
    <PanoControlButton key={action.id === "pause" ? "play" : action.id} action={action} />
  )}</div>}
</PanoMediaControls>
```

自定义动作包含 `id`、无障碍 `label`、可选 React `icon`、`disabled` / `enabled()`、单次 `activate()`、连续 `update(seconds)` 和停止 `end()`；可选 `repeatIntervalMs` 将连续动作改为间隔执行。使用 `PanoControlButton` 保留凝视绑定；切换播放／静音图标时保持按钮 key 稳定，防止重新计时。`PanoControlGroup` 可直接渲染自定义动作数组。

可通过 `className`、`style` 和 `--pano-control-background/color/border/radius/size/gap/padding/focus` CSS 变量定制显式按钮组。自动操作区支持 background 变量；完整布局或图标替换需显式按钮组。同一目标的显式媒体、模型或滚动组会替代自动操作组。

凝视完成 `cursorDwellMs` 后，播放、静音、复位执行一次；跳转、音量和模型持续执行；滚动每隔 700 毫秒执行一小步，移开即停。默认跳转每秒 10 秒（`seekSpeed`），音量每秒 0.25（`volumeSpeed`），滚动每秒 0.2 个可见区域（`speed`），每步默认移动 0.14 个可见区域。`PanoScrollControls.repeatIntervalMs` 可调整重复间隔；间隔计时不受组件重新渲染影响，移开会清零，重新凝视需重新完成 dwell。关闭、退出 VR、禁用和失焦会停止操作。凝视不能替代浏览器要求的可信用户手势；音量不可调整的平台禁用音量按钮，仍可静音。

通过 `--pano-scroll-opacity`、`--pano-scroll-active-opacity`、`--pano-scroll-background` 和 `--pano-scroll-color` 定制滚动按钮。

在 Playground `/overlays` 查看长正文、嵌套滚动、模型鼠标／键盘操作、场景视频和自定义主题；`/video` 展示 360° 视频空间控制条。
