# 在 React 中复用 krpano 风格 cube tile

[English](./krpano-migration.md)

Pano View 可在 React 应用中渲染现有 krpano 风格立方体 tile 金字塔。它支持这种
输出格式，但不是 krpano 的插件、包装器、替代品或关联项目。

打开[支持 tile 的 Playground](https://pano-view-playground.vercel.app/hotspots?utm_source=github&utm_medium=docs&utm_campaign=krpano-migration&utm_content=tile-demo)
查看可运行场景。

## 直接映射 XML 中的值

请读取 krpano XML 的实际值。不要依赖 Pano View 的默认 tile 布局：常见 krpano
目录会在文件名中先写行、后写列，而本包默认模板是先列、后行。

| krpano XML | Tile prop |
| --- | --- |
| cube url | urlTemplate |
| cube multires | multires |
| preview url | previewUrl |
| preview striporder | previewFaceOrder（`LFRBUD` 时可省略） |

给定以下 XML：

~~~xml
<preview url="preview.jpg" />
<image>
  <cube
    url="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
    multires="512,1000,2000"
  />
</image>
~~~

将相同值传给 Tile。krpano 默认 `striporder` 为 `LFRBUD`，与 Tile 默认的
`previewFaceOrder` 一致，因此可以不填：

~~~tsx
import { PanoViewer, Tile } from "@ericchen1990/pano-view";

export function MigratedPanorama() {
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

## 先确认路径，再调整渲染设置

模板和预览路径相对于 baseUrl。根路径和 HTTP(S) URL 则直接使用。在怀疑投影、
LOD 或 WebGL 前，先在浏览器网络面板中对照每个面与层级生成的 URL。

- 预览必须是 1×6 cube-strip，不是缩略图。
- previewFaceOrder 按 atlas 从上到下的顺序列出面。默认是 `l`、`f`、`r`、
  `b`、`u`、`d`。仅在 `striporder` 不同时设置。
- Tile 的行列索引从 1 开始。
- multires 的第一项是 tile 大小，后续项为递增的立方体面大小。
- 无法用 urlTemplate 表示时，可使用 resolveTileUrl；它同样返回相对 baseUrl
  的路径，并优先于模板。

## 在 React 中映射热点，而不是 XML

Pano View 不会解析 krpano 热点动作。每个 `<hotspot>` 应作为 Tile 旁的 React
子组件，或写在 Scenes 的 `renderHotspots` 中。

| krpano XML | Hotspot prop |
| --- | --- |
| name | id |
| url | ImageHotspot src |
| ath | position.yaw |
| atv | −position.pitch |
| type="poly" 与 point ath/atv | PolygonHotspot vertices |
| onclick="loadscene(...)" | onClick 加上 Scenes 的 `activeSceneId` |

krpano 的 `atv` 向下为正。Pano View 的 `pitch` 向上为正，因此将 `ath` 复制为
`yaw`，并将 `atv` 取反。

给定以下 XML：

~~~xml
<hotspot
  name="to-garden"
  url="hotspots/arrow.png"
  ath="120"
  atv="8"
  onclick="loadscene(garden);"
/>
<hotspot
  name="exhibit"
  type="poly"
  fillcolor="0xDF6B42"
  fillalpha="0.32"
  bordercolor="0xF5FBFC"
  borderwidth="2"
>
  <point ath="16" atv="-8" />
  <point ath="31" atv="-7" />
  <point ath="27" atv="-19" />
  <point ath="19" atv="-16" />
</hotspot>
~~~

用相同位置渲染为 React 热点：

~~~tsx
import {
  ImageHotspot,
  PanoViewer,
  PolygonHotspot,
  Tile,
} from "@ericchen1990/pano-view";

export function MigratedPanorama() {
  return (
    <PanoViewer style={{ height: 560 }}>
      <Tile
        baseUrl="/panoramas/room"
        urlTemplate="tiles/%s/l%l/%v/l%l_%s_%v_%h.jpg"
        multires="512,1000,2000"
        previewUrl="preview.jpg"
      />
      <ImageHotspot
        id="to-garden"
        ariaLabel="Go to garden"
        position={{ yaw: 120, pitch: -8 }}
        src="/panoramas/room/hotspots/arrow.png"
        onClick={() => setActiveSceneId("garden")}
      />
      <PolygonHotspot
        id="exhibit"
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
      />
    </PanoViewer>
  );
}
~~~

- 热点 `url` 是普通资源路径，不是 tile 模板。按宿主其他图片同样的方式，相对
  场景目录解析。
- `width` 与 `height` 为角度（度），不是 krpano 的像素尺寸。
- `distorted="true"` 对应 `mode="surface"`。默认 billboard 模式对应未扭曲热点。
- 精灵图动画对应 SequenceHotspot。
- 不会执行动作字符串。用 React 状态驱动 Scenes，而不是 `loadscene`。

## 常见迁移失败

| 现象 | 首先检查 |
| --- | --- |
| 某个面缺失或错乱 | 对照 XML 模板与生成的 URL，确认行列占位符顺序。 |
| 初始图像不正确 | 使用 cube-strip 而非 thumb.jpg，并在需要时设置 previewFaceOrder。 |
| 请求遗漏全景目录 | 将相对 urlTemplate 和 previewUrl 放在 baseUrl 之下。 |
| Tile 能加载但长期模糊 | 确认所有 multires 值，并在移动或缩放时检查请求。 |
| 热点偏高或偏低 | 将 `atv` 取反：`pitch = -atv`。 |
| 点击热点无反应 | 将 `onclick` 映射为 React 处理函数；`loadscene` 不会被执行。 |

Tile prop、热点与场景过渡见 [API
参考](../packages/react/README.zh-CN.md#tile)。
