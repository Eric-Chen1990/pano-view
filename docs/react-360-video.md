# Build a 360 video experience in React

[中文](./react-360-video.zh-CN.md)

PanoVideo maps a 2:1 equirectangular video to the panorama sphere. It includes
an optional playback bar with seeking, volume, speed, quality selection,
captions, and fullscreen. Try it in the [360 video
Playground](https://pano-view-playground.vercel.app/video?utm_source=github&utm_medium=docs&utm_campaign=react-360-video&utm_content=video-demo).

## Start with inline, muted playback

Muted playback gives browsers a better chance to allow autoplay. PanoVideo uses
inline playback by default and sets WebKit and X5 attributes to request playback
within the page on iPhone Safari and in WeChat, QQ, and UC. Actual behavior
depends on the browser and its version; autoplay is not guaranteed.

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

For production delivery, provide a poster, an H.264 + AAC MP4 fallback, CORS
headers when files are remote, and HTTP Range support.

## Let the host choose what becomes audible

When a child has initial playback intent, PanoViewer silently unlocks audible
playback by default on the first user gesture when the browser requires one, or
immediately when autoplay policy already allows it. The host then decides
whether video, background audio, or positional sound should start. Do not start
all media sources by assumption.

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

Call playback methods synchronously in `onActivate`, before awaiting other
work, to preserve the user-gesture context. For a controlled `BackgroundAudio`
instance, update its `playing` state in this callback. Playback remains subject
to [browser autoplay policy](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

## Keep mobile automatic quality within a smaller ladder

Publish two HLS multivariant playlists for the same 2:1 on-demand video. Use the full playlist on desktop and reference the same lower renditions from the mobile playlist. Start mobile testing at 30 fps with `1280×640`, `1920×960`, and `2560×1280`, then adjust for startup, dropped frames, and thermal behavior on target devices. Native HLS and hls.js adapt within the playlist they receive. Align timestamps and keyframes across renditions, declare resolution, codec, frame rate and bandwidth, and keep referenced audio groups in each playlist.

Select `mobileProfile` in the host before loading the player. The Auto variant includes a lower-resolution H.264/AAC MP4 fallback. Each manual high-resolution variant points to a complete single-rendition playlist.

~~~tsx
<PanoVideo
  defaultVariantId="auto"
  fallbackVariantId={mobileProfile ? "auto" : undefined}
  poster="/tour/poster.jpg"
  variants={[
    {
      id: "auto",
      label: "Auto",
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

If the active source hits a decoding, format support or texture size error, the player tries the fallback variant once and restores playback position and intent where possible. If a native HLS candidate fails while preparing for a handoff, the current source keeps playing. Viewers can return to Auto whenever a manually selected rendition struggles.

Select **Mobile HLS** on Playground's `/video` page to compare **4K** and **Auto**. Mobile and **Full HLS ladder** share the online stream's segments. Mobile Auto tops out at `2026×1080`, and the full playlist reaches `3840×2048`. Use a source with a native 8K rendition for 8K testing. Record decoded resolution, time to the first decoded frame, buffer waits, video frame drop rate, and p95 frame time while moving the view. Compare the default canvas pixel ratio and **1×** on the same device and rendition. For byte-range segments, confirm the CDN answers range requests with `206 Partial Content`.

## Validate on real devices

Build and type checks cannot verify browser autoplay policy or touch behavior.
Before release, verify on current iPhone/iPad Safari and Android Chrome:

- Inline video remains in the page on iPhone Safari and in WeChat, QQ, and UC.
- The first user gesture unlocks the selected audible source when required.
- Captions and playback controls remain reachable by touch.
- Safe areas, portrait/landscape changes, and short landscape viewports keep
  controls usable.
- A blocked unmuted play attempt is handled by the host experience.

For variants, captions, custom controls, and the full prop reference, see
[PanoVideo](../packages/react/README.md#panovideo).

For VR, connect the existing controller to `PanoSpatialControls` + `PanoMediaControls`. The ordinary control bar stays available outside VR. See the [VR controls guide](../packages/react/docs/dialogs.md#vr-icon-controls-and-scrolling) and Playground `/video`.
