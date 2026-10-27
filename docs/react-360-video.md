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
