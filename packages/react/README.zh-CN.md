# @ericchen1990/pano-view

[English](./README.md) | **简体中文**

用于等距圆柱（equirectangular）与 krpano 风格多分辨率全景查看器的可组合 React 组件。

在[在线 playground](https://pano-view-playground.vercel.app/?utm_source=github&utm_medium=readme&utm_campaign=package-readme&utm_content=playground) 中试用这些组件。

## 兼容 krpano 的 tile 输出

当你需要围绕等距圆柱图像或现有 krpano 立方体 tile 金字塔构建 React 原生查看器时，请使用本包。将 krpano `<cube>` 的 `url` 与 `multires` 属性复制到 `Tile` 的 `urlTemplate` 与 `multires`，并将 `<preview url>` 复制到 `previewUrl`；krpano 的磁盘命名与本包默认不同，省略这些值会加载错误的 tile 或预览图。渲染、控件、热点与场景过渡仍由你的 React 应用负责。本包兼容该 tile 输出格式，但与 krpano 无隶属关系。

## 安装

### 包

```bash
npm install @ericchen1990/pano-view
```

pnpm 与 Yarn 用法相同（`pnpm add` / `yarn add`）。

### 对等依赖

这些包必须安装在**宿主应用**中，而不是嵌套在本库之下。npm 7+ 与 pnpm 会自动安装；Yarn Classic 与 npm 6 不会，需显式安装。

| 包 | 支持范围 |
| --- | --- |
| `react` | `>=19.0.0 <19.3.0` |
| `react-dom` | `>=19.0.0 <19.3.0` |
| `three` | `^0.185.1` |
| `@react-three/fiber` | `^9.7.0` |
| `@react-three/drei` | `^10.0.0` |
| `@react-three/xr` | `^6.6.0` |

在宿主应用中保持 React、Three.js 与 React Three Fiber 相关包的**单一副本**。重复的 `three` 树是空白画布与上下文错误（`R3F: Hooks can only be used within the Canvas component`）的常见原因。若出现该问题，请检查 `npm ls three` / `pnpm why three` 并去重。

React 19.3 及更高版本不在支持范围内。

### 样式表（HTML 叠加层）

在宿主应用中导入一次随包样式表。WebGL 全景（`PanoViewer`、`Sphere`、`Tile`、3D 热点）无需该文件即可渲染。内置 **HTML** 叠加层则不行：它们使用带 `pano-` 前缀的类名做布局。

这些叠加层包括视频控件、字幕、默认右键菜单、热点 tooltip、仅无障碍界面元素，以及 WebVR 会话 UI。

```ts
import "@ericchen1990/pano-view/styles.css";
```

或在 CSS 中：

```css
@import "@ericchen1990/pano-view/styles.css";
```

仅当你不使用这些叠加层，或完全通过 `className`、`style` 与外观属性重设样式时，可跳过该导入。若不导入样式表，叠加层仍会挂载，但会无样式显示。

## 快速渲染一个全景图

为 PanoViewer 提供明确尺寸，并在其内部渲染一个全景源。使用内置 HTML 叠加层
（例如视频控件、字幕、tooltip、右键菜单或 WebVR UI）时，需导入一次样式表。

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

如需复用现有 krpano tile 金字塔，请在将 Sphere 换成 Tile 前阅读
[迁移指南](../../docs/krpano-migration.zh-CN.md)。指南说明 XML 到 prop 的映射与
相对路径规则。

## 导出组件

### 查看器

- [`PanoViewer`](#panoviewer) — 画布外壳、相机、默认控件与命令式视图 API
- [`Sphere`](#sphere) — 单张 2:1 等距圆柱图像
- [`PanoVideo`](#panovideo) — 全景球面上的 2:1 等距圆柱视频
- [`Tile`](#tile) — krpano 风格多分辨率立方体 tile
- [`Scenes`](#scenes) — 受控多场景过渡
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
- [`PanoContextMenu`](#panocontextmenu) — 右键重置 / 全屏菜单
- [`PanoVideoControls`](#panovideo) — `PanoVideo` 的播放界面（默认挂载）

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

## PanoViewer

`PanoViewer` 负责画布、透视相机与控件。为其容器指定明确尺寸，并在内部放置一个全景源。

角度对外以度为单位。偏航（yaw）为正表示向右看，俯仰（pitch）为正表示向上看。

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

句柄从单个 `ref` 暴露视图、全屏、场景、VR、视频与背景音乐控制，方便宿主自绘 UI：

**视图** — `getView`、`setView`、`reset`、`lookTo`、`moveTo`、`zoomTo`、`lookToHotspot`。

`setView` 与 `reset` 仍立即生效。导航方法返回
`Promise<{ status: "completed" | "cancelled" | "not-found" }>`；新的导航或用户操作会取消前一个导航。默认时长为 700ms，缓动为
`easeInOutCubic`，YAW 默认走最短路径。`lookTo` 与 `lookToHotspot`
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

**场景**（需 `<Scenes />`）— `setScene(id)`、`nextScene`、`previousScene`、`getActiveSceneId`、`getSceneIds`、`isSceneTransitioning`。`Scenes` 现支持可选 `defaultActiveSceneId`（非受控）或继续传 `activeSceneId`（受控）。受控模式下命令式调用会触发 `onActiveSceneIdChange`。

**WebVR**（需 `<WebVR />`）— `enterVR`、`exitVR`、`toggleVR`、`isVRAvailable`、`isVREnabled`、`getVRMode`、`requestVRPermission`。

**视频**（需 `<PanoVideo />`）— `getVideo` 返回 `PanoVideoController`，`subscribeVideo` 订阅宿主变更，另有快捷方法 `playVideo`、`pauseVideo`、`toggleVideo`、`seekVideo`、`setVideoVolume`、`setVideoMuted`、`toggleVideoMuted`。

**背景音乐**（需 `<BackgroundAudio />`）— `getBackgroundAudio` 返回 `BackgroundAudioController`，`subscribeBackgroundAudio` 订阅宿主变更，另有快捷方法 `playBackgroundAudio`、`pauseBackgroundAudio`、`toggleBackgroundAudio`、`setBackgroundAudioVolume`、`setBackgroundAudioMuted`、`toggleBackgroundAudioMuted`。`BackgroundAudio` 现支持可选 `playing`（受控）或 `defaultPlaying`（非受控）。

### 移动端媒体激活

默认情况下，只要子组件带有初始播放意图（`PanoVideo autoPlay`、播放中的 `BackgroundAudio`、`VideoHotspot` 或 `AudioHotspot`），查看器就会显示「Tap to enable sound」首触层。静音视频仍会内联预览；首触在同一用户手势内恢复 Web Audio，再把播放选择交给宿主，避免视频、BGM 与定点声同时出声。传 `mediaActivation={false}` 可保留 2.x 的无首触层行为。

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

`onActivate` 的 `media` 提供 `resumeAudio()`、`playVideo({ unmute })` 和 `playBackgroundAudio()`。背景音乐若使用受控 `playing`，仍由宿主在回调内更新该状态；`viewer.activateMedia()` 可供自定义入场按钮复用同一流程。

依赖未挂载子组件的方法（如无 `<WebVR />` 时调 `enterVR`）安全空操作，返回 `false`、`void` 或 `null`。

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

`enterVR` 与 `requestVRPermission` 须在用户手势中调用。

```tsx
import { PanoViewer, Sphere, WebVR, usePanoViewer } from "@ericchen1990/pano-view";

function VRExample() {
  const viewer = usePanoViewer();

  return (
    <>
      <button
        onClick={async () => {
          await viewer.requestVRPermission();
          await viewer.enterVR();
        }}
      >
        进入 VR
      </button>
      <button onClick={() => void viewer.exitVR()}>退出 VR</button>
      <button onClick={() => console.log(viewer.getVRMode())}>当前模式？</button>
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

### 一站式示例

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

拖拽与缩放会更新目标视图，相机平滑跟随。`rotateDamping` 与 `zoomDamping` 控制跟随速度，单位为秒⁻¹（默认分别为 `14` 与 `16`）；数值越低手感越柔和，`0` 表示该轴不做平滑。两者必须为非负有限数。命令式 `setView()` 与 `reset()` 仍为即时生效。

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

`previewUrl` 为必填项，在 `src` 加载期间显示低分辨率 2:1 图像。相对路径相对于 `src` 所在目录解析；根绝对路径与 `http(s)` URL 原样使用。对于 krpano 球面场景，将 [`<preview url>`](https://krpano.com/docu/xml/#preview) 复制到 `previewUrl`。该预览必须是等距圆柱，而非立方体条带。

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

## PanoVideo

`PanoVideo` 将 2:1 等距圆柱视频映射到与 `Sphere` 相同的内表面球体上。可传单个 `src`，或传含多档质量的 `variants`，以便浏览器选择 mp4 / webm，且控制栏可切换分辨率。切换质量时保留当前时间与播放/暂停状态。

默认播放栏挂载在查看器叠加层上：播放/暂停、进度、时间、音量、倍速、分辨率、字幕与全屏。当浏览器允许 `HTMLMediaElement.volume` 时，音量为悬停（或点击）垂直滑块；iOS Safari 仅暴露静音。倍速菜单列出当前元素接受的速率。字幕菜单还包含字幕字号与背景不透明度的设置面板。查看器较窄时，倍速、画质与字幕会收入「更多」菜单。传 `controls={false}` 可隐藏；传外观对象可重设默认实例样式；或将 `PanoVideoControls` 作为 `PanoViewer` 子组件以替换该实例。

字幕使用 WebVTT `tracks`。视频元素在屏幕外，因此 cue 文本以 HUD 叠加层渲染。`captions={false}` 会隐藏叠加层与语言菜单；对象会与默认外观合并（`color`、`background`、`fontSize`、`fontFamily`、`textShadow`、`padding`、`borderRadius`、`maxWidth`、`bottom`）。这些值作为字幕初始外观；观众仍可在运行时通过默认控制栏菜单调整字幕大小与背景。

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

`muted` 默认为 `true`，以便在浏览器自动播放规则下有机会自动播放；`playsInline` 也默认开启，并同时写入 `playsinline` / `webkit-playsinline`，避免 iPhone 将默认的 360 视频提取为原生全屏播放器。非静音播放仍需要用户手势；`play()` 被拒绝时 `onPlaybackStateChange` 会收到 `"blocked"`。非同源的远程视频与 VTT 文件应设置 `crossOrigin`（通常为 `"anonymous"`）。移动端请提供 H.264 + AAC 的 MP4 备选源、poster、CORS 与 Range 支持。

## Tile

`Tile` 渲染六个朝内的立方体面，并仅加载当前视野附近的 tile。省略 `urlTemplate` 时，相对于 `baseUrl` 的路径使用本包默认：

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

krpano 立方体 tile 输出不遵循该默认。从 krpano XML 读取 `url`、`multires` 与预览路径（[`<cube>`](https://krpano.com/docu/xml/#image.cube)、[`<preview>`](https://krpano.com/docu/xml/#preview)）并传入。若这些值缺失或与磁盘文件不匹配，tile 会解析到错误的 face、level 或行列，全景会看起来错乱。

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

MAKE PANO (MULTIRES) 文件夹布局常为 `tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg`，场景根目录有 `preview.jpg`。该文件名为 `%v_%h`（先行后列）。本包默认 tile 模板为 `%h_%v`（先列后行）。请复制 XML 中的值，不要假设两种约定一致。

`multires` 的第一个值为 tile 尺寸。其余值为 `l1`、`l2` 及更高层级的递增立方体面尺寸。`previewUrl` 为必填。相对路径相对于 `baseUrl` 解析；根绝对路径与 `http(s)` URL 原样使用。典型的 krpano MAKE PANO (MULTIRES) 场景如下：

```tsx
<Tile
  baseUrl="/panoramas/room"
  urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
  multires="512,1000,2000"
  previewUrl="preview.jpg"
  previewFaceOrder={["l", "f", "r", "b", "u", "d"]}
/>
```

`previewFaceOrder` 必须按自上而下 atlas 顺序列出六个面代码：`f`、`r`、`b`、`l`、`u`、`d`。预览图为竖向 1×6 立方体条带。krpano 的 `thumb.jpg` 是小缩略图，不是该 atlas。

快速旋转或缩放时，已加载 tile 保持可见；新进入视野的 tile 会使用其父级或预览作为局部回退。

对于非 krpano XML 的布局，可用占位符模板或解析器覆盖默认。两者均返回相对于 `baseUrl` 的路径：

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

对于 krpano 立方体 tile 模板，`%s` 为立方体面，`%l` 为多分辨率层级。水平 tile 索引支持等价的 `%h`、`%x`、`%u`、`%c` 占位符；垂直索引支持 `%v`、`%y`、`%w`、`%r`。在索引占位符前加零可填充：例如 `%0h` 为两位水平索引，`%00v` 为三位垂直索引。立体 `%t` 与帧 `%f` 占位符不适用于表示单一非立体立方体全景的 `Tile`。

## Scenes

`Scenes` 在受控的球面与立方体 tile 场景之间切换，采用纯 GPU 快照混合。目标场景先加载其球面或 tile 预览；就绪后，当前帧缓冲成为临时 GPU 纹理，释放其源纹理，目标场景再混合进入。这样避免在 WebGL 内存中同时持有两个高分辨率 tile 场景。

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

可用的 KRpano 风格预设包括 `none`、`crossfade`、`zoom`、`blackout`、`whiteFlash`、`slideRightToLeft`、`slideTopToBottom`、`slideDiagonal`、`circleOpen`、`verticalOpen`、`horizontalOpen`、`ellipticZoomOpen`。网格类预设为 `pixelate`、`gridWipe`、`gridWipeUp`、`gridWipeRight`、`gridWipeDiagonal`、`gridWipeCenter`、`gridWipeChecker`、`hexDissolve`。电影感预设为 `dissolve`、`shatter`、`particles`、`glitch`、`swirl`、`clockWipe`、`ripple`、`zoomBlur`、`filmBurn`。它们均在入画全景之上混合 GPU 帧缓冲快照，不会混合两个完整 360 纹理。传 `{ preset: "crossfade", duration: 0.6 }` 可覆盖预设时长。

过渡进行时，全景拖拽/缩放输入被锁定，`renderHotspots` 被隐藏。新的 `activeSceneId` 会取代仍在准备中的目标。`maxTextureMemoryMb` 与 `maxConcurrentTileLoads` 作用于整个 `Scenes` 查看器，而非每个 tile 场景单独计算。

## PanoFilter

在 `PanoViewer` 内渲染 `PanoFilter` 可对全景源（`Sphere`、`Tile`、`PanoVideo`）调色或风格化。滤镜仅作用于这些材质：3D 热点、tooltip、视频界面与 iframe 叠加层保持原色。WebXR / MobileVR 继承相同外观，因为修改的是全景着色器本身。

`intensity` 在滤镜结果与原图之间混合（`0`–`1`，默认 `1`）。省略组件、传 `preset="none"` 或设 `enabled={false}` 则保持源图无滤镜。

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

内置艺术效果使用屏幕空间边缘与世界空间颗粒，避免立方体 tile 出现滤镜接缝。有过滤器激活时，场景过渡快照会捕获带滤镜的全景。

## AutoRotate

自动旋转默认关闭。在 `PanoViewer` 内渲染 `AutoRotate` 以启用，并将旋转配置与用户输入控件分离。`speed` 为度/秒；负值向左旋转。`acceleration` 为度/秒²，从零平滑加速到 `speed`（默认 `18`，即默认速度约 1 秒达到）。设为 `0` 则立即以固定速度旋转。`startDelay` 为 `enabled` 变为 true 起的毫秒延迟。用户拖拽中，或拖拽惯性仍在衰减时，旋转暂停并在恢复时从零速度重新开始。

```tsx
<PanoViewer style={{ height: 560 }}>
  <AutoRotate enabled speed={12} acceleration={6} startDelay={2_000} />
  <Sphere src="/panoramas/room.webp" previewUrl="preview.webp" />
</PanoViewer>
```

## BackgroundAudio

`BackgroundAudio` 在查看器里播放背景音乐或环境声。它不是热点：没有球面位置、没有标记、音量也不随视角变化。必须作为 `PanoViewer` 的子组件，与 `Scenes`、`Sphere` 或 `Tile` **并列**。不要写进 `Scenes` 的 `renderHotspots`：场景过渡时热点会卸载，背景声也会被停掉。

`playing` 由宿主控制，组件不会自行改这个值。`loop` 默认 `true`。浏览器可能拦住自动播放；此时 `onPlaybackStateChange` 收到 `"blocked"`，在 `playing` 仍为 true 时会于下一次点击或按键后重试。

有两种用法，选一种即可。

**全部场景共用一条音轨** — 只传 `src`，不要传 `sources`。切换场景时音频继续播放，不会重头开始。

```tsx
import { BackgroundAudio, PanoViewer, Scenes } from "@ericchen1990/pano-view";

<PanoViewer style={{ height: 560 }}>
  <BackgroundAudio src="/bgm/tour.mp3" playing={isBgmPlaying} />
  <Scenes scenes={scenes} activeSceneId={activeSceneId} />
</PanoViewer>;
```

**每个场景一条音轨** — 传 `sources`（键为 `Scene.id`）和当前的 `sceneId`。省略 `sceneId` 会抛错。切换场景时，若文件变了会按 `fadeMs` 交叉淡化（默认 400 毫秒；`0` 为硬切）；若两个场景指向同一文件则继续播，不会重启。

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

上例中：`lobby` 播院子声，`terrace` 静音，其它场景播 `default.mp3`。

需要绑在全景某一点、随视角左右移动的声音，请用 `AudioHotspot`，不要用 `BackgroundAudio`。

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

`camroll`（默认 `true`）根据设备 roll 水平相机。`friction` 接受 `0` 到 `0.99`；越高越平滑但延迟更大。`softstart` 为启用时的混合时长（秒，默认 `0.5`）。`desktopSupport` 默认为 `false`，因桌面浏览器可能暴露 API 却无物理传感器。

`touchMode` 控制触控拖拽与设备运动的组合方式：

- `off` 忽略触控 yaw/pitch，仍保留双指 FOV。
- `horizontaloffset` 仅加水平偏移。
- `full` 加水平与垂直偏移；设备移动时垂直偏移会回到物理朝向。
- `disablegyro` 在下一次触控时关闭当前陀螺仪会话。

`GyroHandle` 暴露 `resetSensor(yaw?, pitch?)`、`isAvailable()`、`isEnabled()` 与 `requestPermission()`。陀螺仪活动会暂停 `AutoRotate`，并计为查看器交互以用于空闲追踪。传感器 API 通常需要 HTTPS。跨域 iframe 需宿主页允许，例如 `allow="gyroscope; accelerometer"` 与兼容的 `Permissions-Policy` 头。

## WebVR

`WebVR` 为最近的 `PanoViewer` 增加沉浸式观看。支持的头戴设备优先使用 `immersive-vr` WebXR 会话。无 WebXR 的手机使用设备方向的立体分屏；桌面可提供鼠标驱动的模拟 VR 预览。内置界面包括进入 VR、退出 VR 与 MobileVR 设置控件。

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

句柄暴露 `enterVR()`、`exitVR()`、`toggleVR()`、`isAvailable()`、`isEnabled()`、`getMode()` 与 `requestPermission()`。模式为 `"webxr"`、`"mobilevr"`、`"fake"`。`profile` 接受 `"none"`、`"cardboard-v1"`、`"cardboard-v2"`、`"gear-vr"`、`"daydream"`，或自定义 `{ fov, ipdMm, k1, k2 }` 镜头配置。MobileVR 设置值会版本化并保存在当前源的 `localStorage` 中。VR 中中心准星显示十字；注视可交互热点时绘制顺时针填充环，经 `cursorDwellMs`（默认 1500）后触发热点点击。设 `cursorDwellMs={0}` 可保留准星但不自动点击。模拟桌面 VR（`fake` 模式）默认请求指针锁定（`mousePointerLock`），隐藏光标并用鼠标环视；若浏览器释放锁定需再次点击视图。回退会话通过 Screen Wake Lock API 或在不支持时的循环隐藏视频保持屏幕常亮（`wakelock`）。

WebXR 需要 HTTPS 与用户手势。移动端传感器访问也需要 HTTPS，iOS 可能需显式权限提示。嵌入查看器需要适当的 `xr-spatial-tracking`、`gyroscope`、`accelerometer` 权限。iframe 热点、tooltip、视频控件等 DOM 叠加层在沉浸式头戴会话中不可见；基于 mesh 的热点仍可通过默认 WebXR 控制器射线交互。

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

见上文默认项。通过 `controls.mouse` 或渲染子组件 `<MouseControls />` 覆盖。

### TouchControls

单指拖拽与可选双指缩放（`pinchZoom`，默认 `true`）。通过 `controls.touch` 或渲染 `<TouchControls />` 覆盖。

### KeyboardControls

按住方向键（或自定义绑定）连续环视 / FOV；`0` 重置；可选场景绑定。默认：`rotateSpeed` `60`，`zoomSpeed` `30`，`shiftMultiplier` `3`。`invert` 仅翻转上下方向。通过 `controls.keyboard` 或渲染 `<KeyboardControls />` 覆盖。

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

默认绑定：方向键与 WASD 环视，`+/-` 调 FOV，`0` 重置；提供回调时 `[`/`PageUp` 与 `]`/`PageDown` 为上一/下一场景。`MouseControls` 与 `TouchControls` 同样可用子组件覆盖。仅当需要关闭某通道时使用 `controls.mouse={false}` / `controls.touch={false}` / `controls.keyboard={false}`。

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

- 视图：`onViewChange`（`onviewchange`）、`onViewSettled`、`onViewInteractionStart` / `onViewInteractionEnd`
- 全景外壳上的指针（非热点）：`onClick`、`onDoubleClick`、`onPointerDown`、`onPointerUp`、`onPointerMove`、`onContextMenu`
- `onWheel` — 仅鼠标滚轮；触控捏合不会合成 wheel 事件
- 空闲：`onIdle` / `onIdleEnd`，每实例 `idleTime`（毫秒，默认 `2000`）
- 全屏：`onEnterFullscreen` / `onExitFullscreen`
- `onResize` — 通过 `ResizeObserver` 获取画布 content-box 尺寸
- 自动旋转：`onAutoRotateStart` / `onAutoRotateStop` / `onAutoRotateOneRound`
- 陀螺仪：`onGyroAvailable` / `onGyroUnavailable` / `onGyroEnable` / `onGyroDisable` / `onGyroDenied`

`PanoViewer` 现有的 `onViewChange` / `onPanoramaClick` / `onPanoramaDoubleClick` / `onPanoramaPointerMove` props 仍受支持，共用同一事件总线。

资源加载与场景混合仍由各自组件负责：使用 `Sphere` / `Tile` 的 `onLoad` / `onError` / `onLoadProgress`，以及 `Scenes` 的 `onTransitionEnd` / `onTransitionError`。本包不镜像 krpano 的 xml/VR/帧渲染事件。

## PanoContextMenu

`PanoViewer` 会始终屏蔽浏览器原生右键菜单（画布、chrome 及其他 overlay 均生效），并挂载默认右键菜单。默认项：**Reset view** 与 **Enter fullscreen** / **Exit fullscreen**（文案与图标随全屏状态变化），中间有分隔线。

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

在预设上用 `{ preset: "fullscreen", label: "…" }` 覆盖展示。在 prop 外完全手动组装时（例如自定义 `PanoContextMenu` 子组件），调用 `createPanoContextMenuPresets({ reset, toggleFullscreen, isFullscreen })` 并使用 `.resetView` / `.fullscreen` / `.defaults`。

具体项可使用 `icon` React 节点或 `image` URL。分隔线始终来自 `"separator"` 预设。外观涵盖背景、文字色、边框、圆角、阴影、仅背景的 `opacity`（从 `MIN_PANO_CONTEXT_MENU_BACKGROUND_OPACITY` / `0.4` 到 `1` 钳制；标签与图标保持不透明）、悬停/禁用色与图标尺寸。若需半透明填充而不使用 `opacity`，仍可传 `background: "rgba(...)"`。

完全自定义 DOM 菜单时，设 `contextMenu={false}` 并渲染 `PanoContextMenu` 子组件。不要同时挂载默认菜单与子 `PanoContextMenu`。避免与 `controls.mouse.buttons: ["right"]` 同时使用 — 两者都会占用右键。

## 共享热点约定与保存的定义

每个热点有 `id`，以及可选的 `visible`、`interactive`、`pointerEvents`、`renderOrder` 与语义交互回调。点热点此外还使用受控 `position`、角度 `width`/`height`、热点 `mode` 与下文缩放选项。`interactive={false}` 保持热点可见，同时让绘制工具接收其下方的全景指针事件。`pointerEvents="none"` 忽略鼠标、触控与笔，事件穿透到全景，热点仍可键盘交互。可交互热点悬停时画布光标为 `pointer`；若设置了热点 `cursor` 则使用该值。

```tsx
<TextHotspot
  id="caption"
  pointerEvents="none"
  position={{ yaw: 12, pitch: -8 }}
  text="Decorative label"
/>
```

`onClick` 与 `onHoverChange` 接收位置与输入源（`"pointer"` 或 `"keyboard"`）。点热点可使用 `draggable`、`onDragStart`、`onPositionChange`、`onDragEnd`；宿主须将报告的位置写回状态。多边形与折线热点通过 `onVerticesChange` 报告受控 `vertices`。

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

持久化或宿主编辑器可使用导出的判别联合类型 `HotspotDefinition`。新增变体会破坏 exhaustive switch 的类型兼容；除现有点与路径类别外，还需处理 `audio`：

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

定义仅含数据。在宿主中用 switch 渲染，应用特定的点击行为、受控媒体状态与错误报告属于宿主职责。

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

`ImageHotspot` 调用 `onLoad(texture)` 与 `onError(error)`。

## GraphicHotspot

`GraphicHotspot` 接受内置 `circle`、`triangle`、`diamond`、`star`、`arrow`、`rectangle`、`ring` 图形、SVG URL，或带显式 viewBox 的安全 SVG path 数据。内置图形支持 `fill`、`stroke`、`strokeWidth`；矩形支持相对 `cornerRadius`（`0` 到 `0.5`）；环支持 `innerRadius`。

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

`cornerRadius` 相对于渲染图形较短边：`0` 为直角，`0.5` 为最大圆角。这取代了此前基于 Canvas 纹理像素的解释方式。

`GraphicHotspot` 与 `ImageHotspot` 相同，使用 `onLoad(texture)` 与 `onError(error)`。内置 path 本地栅格化；仅接受 SVG URL 或 SVG `path` 加显式 `viewBox`，不接受任意 SVG 标记。

## 热点模式与缩放行为

点热点使用统一的 `mode`，而非分离的方向与 placement 属性：

- `mode="surface"` 将平面附着于局部全景表面。
- `mode="billboard"` 使平面始终朝向相机并浮于壳层前方。用 `distance`（世界单位，默认 `10`）拉近。内置全景壳层约在 `1000` 单位；距离会自动上限，避免热点角点穿过壳层。
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

设 `fillOpacity={0}` 可得仅轮廓闭合多边形。填充与轮廓共用相同球面边采样，无意图性接缝。

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

`onInvalid` 仅报告一种无效运行时形状：少于两个顶点。

## SequenceHotspot

`SequenceHotspot` 动画播放精灵图：等尺寸帧组成的竖向或横向条带。与常见 krpano 动画热点格式一致。`width` 与 `height` 应使用单帧宽高比，而非整条带。`playing` 由宿主受控；`fps` 默认 `12`，`loop` 默认 `true`。

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

序列加载使用 `onLoadProgress` 与 `onError`。组件不会自行改变 `playing`：请在 UI、点击处理、`onEnded` 或播放错误中更新该 prop。

## VideoHotspot

`VideoHotspot` 使用 `HTMLVideoElement` 与 `VideoTexture`。其 `playing` prop 同样受控：在点击处理或应用状态中切换。源变更或卸载时元素暂停并释放纹理。`playsInline` 默认 `true`，`muted` 默认 `true`，`loop` 默认 `false`，`preload` 默认 `"metadata"`。

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

视频通过 `onError` 报告媒体与 poster 失败。与 `SequenceHotspot` 相同，不会自行改变 `playing`，以保证源变更、卸载与 React StrictMode 生命周期可预测。

## AudioHotspot

`AudioHotspot` 在球面位置播放定向声音。立体声像跟随相机朝向；`range` 为看离声源多少度后音量降到静音。默认 `360` 表示不因视角衰减（仅左右声像）。定点声源可使用较小值，例如 `90`。

播放走 Howler.js 的 Web Audio（已打进本包，宿主不必安装 `howler`）。文件需先解码再起播，推荐 MP3。`src` 可以是字符串或回退 URL 数组。不要用 HTML5 流式播放，否则会失去立体声像。

`playing` 与 `VideoHotspot` 一样受控。`loop` 默认 `false`，`muted` 默认 `false`，`volume` 默认 `1`，`pauseWhenHidden` 默认 `true`（标签页隐藏时暂停，仍为 `playing` 则回来后恢复）。首次用户手势会解锁音频；若自动播放被拦，会报告 `"blocked"`，并在 `playing` 仍为 true 时于下一次指针或按键后重试 `play()`。

默认标记在 **停止**（扬声器）与 **播放**（扬声器 + 声波）之间切换。可用 `icon` 自定义停止图标、`playingIcon` 自定义播放图标。只设 `icon` 时两种状态共用该图。`marker={false}` 则无视觉，仍作为定点声源。非空间的全 tour 或按场景背景声请使用 [`BackgroundAudio`](#backgroundaudio)。

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

与其他媒体热点相同，`AudioHotspot` 不会自行改变 `playing`。

## TextHotspot

`TextHotspot` 将纯文本栅格化到 canvas 纹理。不接受 HTML 或 Markdown。`\n` 为硬换行；`whiteSpace="normal"`（默认）在热点角向宽度内自动换行。尺寸与其他点热点一样为度。排版使用与 CSS 相同的名称（`fontFamily`、`fontSize`、`fontWeight`、`fontStyle`），但绘制在 canvas 上，非 DOM 样式。`fontSize` 为 canvas 像素（默认 96），不随面板高度缩放。`fontWeight` 默认 `600`，`fontStyle` 默认 `"normal"`。`padding` 与 `borderRadius` 仍为纹理较短边的比例，故仍随 `width` / `height` 变化。

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

`pointerPolicy="hotspot"`（默认）将 iframe 设为 `pointer-events: none`，点击与拖拽作用于 WebGL 平面。`"content"` 使页面可交互并阻止穿透拖拽。热点 `pointerEvents="none"` 也会强制 iframe 叠加层不捕获指针。`sandbox` 默认为 `allow-scripts allow-popups allow-forms`，不含 `allow-same-origin`。`referrerPolicy` 默认为 `strict-origin-when-cross-origin`。优先同源文档；许多第三方站点发送 `X-Frame-Options` 无法加载。

## Next.js 与 SSR

分发入口标记为客户端模块。请在 Client Component 边界之下渲染。全景资源在浏览器加载；无需 API 密钥或服务器配置。

在 Client Component 或全局 CSS 中导入一次样式表：

```ts
import "@ericchen1990/pano-view/styles.css";
```

见 [样式表（HTML 叠加层）](#样式表html-叠加层)。
