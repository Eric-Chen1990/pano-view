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
