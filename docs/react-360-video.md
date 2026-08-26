# Build a 360 video experience in React

[中文](./react-360-video.zh-CN.md)

PanoVideo maps a 2:1 equirectangular video to the panorama sphere. It includes
an optional playback bar with seeking, volume, speed, quality selection,
captions, and fullscreen. Try it in the [360 video
Playground](https://pano-view-playground.vercel.app/video?utm_source=github&utm_medium=docs&utm_campaign=react-360-video&utm_content=video-demo).

## Start with inline, muted playback

Muted playback gives browsers a better chance to allow autoplay. PanoVideo uses
inline playback by default, including the WebKit attribute required to keep
iPhone Safari from opening the native player.

~~~tsx
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

When a child has initial playback intent, PanoViewer shows its media activation
entry layer by default. The user gesture unlocks audio, then the host decides
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

Do not await inside onActivate. Start audible media in the same synchronous
gesture call stack. A controlled BackgroundAudio instance remains owned by the
host: update its playing state in this callback if that is the media to start.

## Validate on real devices

Build and type checks cannot verify browser autoplay policy or touch behavior.
Before release, verify on current iPhone/iPad Safari and Android Chrome:

- Inline video remains in the page instead of opening a native player.
- The activation layer unlocks the selected audible source.
- Captions and playback controls remain reachable by touch.
- Safe areas, portrait/landscape changes, and short landscape viewports keep
  controls usable.
- A blocked unmuted play attempt is handled by the host experience.

For variants, captions, custom controls, and the full prop reference, see
[PanoVideo](../packages/react/README.md#panovideo).
