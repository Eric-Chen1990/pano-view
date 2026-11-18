# 在 React 中构建 360 视频体验

[English](./react-360-video.md)

PanoVideo 会把 2:1 等距圆柱视频映射到全景球面。它提供可选播放控制条，包括进度、
音量、速度、清晰度、字幕和全屏。可在[360 视频
Playground](https://pano-view-playground.vercel.app/video?utm_source=github&utm_medium=docs&utm_campaign=react-360-video&utm_content=video-demo)
中试用。

## 从静音内联播放开始

静音播放更容易通过浏览器的自动播放策略。PanoVideo 默认使用内联播放，并写入
WebKit 与 X5 属性，向 iPhone Safari、微信、QQ 和 UC 请求页内播放。实际行为取决于浏览器及其版本，这些设置不保证自动播放。

~~~tsx
import "@ericchen1990/pano-view/styles.css";
import { PanoViewer, PanoVideo } from "@ericchen1990/pano-view";

export function TourVideo() {
  return (
    <PanoViewer style={{ height: "min(560px, 68dvh)" }}>
      <PanoVideo
        autoPlay
        muted
        src="/tour.mp4"
      />
    </PanoViewer>
  );
}
~~~

生产环境请提供 poster、H.264 + AAC MP4 回退文件；远程文件还应提供 CORS，
服务器应支持 HTTP Range。

## 由宿主选择需要播放声音的媒体

当子组件带有初始播放意图时，PanoViewer 默认在浏览器需要用户手势时于首次交互
静默解锁有声播放；若自动播放策略已允许，则立即激活。随后由宿主决定启动视频、
背景音乐还是定点声音。不要默认同时播放全部媒体。

~~~tsx
<PanoViewer
  mediaActivation={{
    onActivate: (media) => {
      void media.playVideo({ unmute: true });
    },
  }}
  style={{ height: "min(560px, 68dvh)" }}
>
  <PanoVideo autoPlay src="/tour.mp4" />
</PanoViewer>
~~~

在 `onActivate` 中同步调用播放方法，避免在调用前等待其他异步任务，以保留用户手势上下文。
使用受控 `BackgroundAudio` 时，由宿主在该回调中更新 `playing` 状态。播放仍受[浏览器自动播放策略](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)约束。

## 让移动端在受限画质范围内自动选档

为同一段 2:1 点播视频生成两份 HLS 主清单。桌面使用完整清单，移动清单复用低档分片。可以从 30 fps 的 `1280×640`、`1920×960` 和 `2560×1280` 开始测试，按目标设备的首帧、掉帧和发热表现调整。原生 HLS 和 hls.js 都在收到的清单范围内自动选档。各档对齐时间轴和关键帧，准确声明分辨率、编码、帧率和码率。独立音轨的声明应保留在每份引用它的主清单里。

由宿主在首次加载前确定 `mobileProfile`。在自动档附上低分辨率 H.264 + AAC MP4，并把完整可播的单档主清单作为手选项。

~~~tsx
<PanoVideo
  defaultVariantId="auto"
  fallbackVariantId={mobileProfile ? "auto" : undefined}
  poster="/tour/poster.jpg"
  variants={[
    {
      id: "auto",
      label: "自动",
      sources: [
        { src: mobileProfile ? "/tour/mobile.m3u8" : "/tour/full.m3u8" },
        { src: "/tour/1280x640.mp4", type: "video/mp4" },
      ],
    },
    { id: "4k", label: "4K", sources: [{ src: "/tour/4k.m3u8" }] },
    { id: "8k", label: "8K", sources: [{ src: "/tour/8k.m3u8" }] },
  ]}
/>
~~~

已激活的源遇到解码、格式支持或纹理尺寸错误时，播放器尝试回退一次，并保留可恢复的进度和播放意图。原生 HLS 候选档准备失败时继续播放当前源。手选高档持续掉帧时，观众可切回自动档。

在 Playground 的 `/video` 选择 **Mobile HLS**，用画质菜单对比 **4K** 与 **Auto**。移动自动档和 **Full HLS ladder** 共用在线流的分片，移动自动档最高为 `2026×1080`，完整清单最高为 `3840×2048`。测试 8K 时请使用有原生 8K 档位的素材。记录实际分辨率、首个解码帧耗时、缓冲等待、视频掉帧率和转动视角时的 p95 帧间隔。在同一设备、同一档位下比较默认 DPR 和 **1×**。字节范围分片的 CDN 需对范围请求返回 `206 Partial Content`。

## 在真实设备上验证

构建与类型检查无法验证浏览器自动播放策略和触控行为。发布前请在当前版本的
iPhone/iPad Safari 和 Android Chrome 中确认：

- 视频在 iPhone Safari、微信、QQ 和 UC 中内联留在页面内。
- 需要时，首次用户手势解锁选定的有声媒体。
- 字幕与播放控制可通过触摸访问。
- 安全区域、横竖屏切换和短横屏中控制仍可用。
- 宿主可以处理未静音播放被浏览器阻止的情况。

变体、字幕、自定义控制和完整 prop 见
[PanoVideo](../packages/react/README.zh-CN.md#panovideo)。

VR 模式可使用 `PanoSpatialControls` + `PanoMediaControls` 连接现有视频 controller；普通模式仍保留原控制条。见[VR 控件指南](../packages/react/docs/dialogs.zh-CN.md#vr-图标控件与滚动)和 Playground `/video`。
