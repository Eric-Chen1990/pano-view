import {
  PanoViewer,
  PanoVideo,
  type PanoVideoCaptionAppearance,
  type PanoVideoTrack,
  type PanoVideoVariant,
} from "@ericchen1990/pano-view";
import { useMemo, useState } from "react";
import { cn } from "../../cn";
import {
  controlInputClassName,
  controlLabelClassName,
  eyebrowClassName,
  footerClassName,
  pageControlsClassName,
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  shellClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { SiteHeader } from "../SiteHeader";

const VIDEO_VARIANTS: readonly PanoVideoVariant[] = [
  {
    id: "1024",
    label: "1024p",
    poster: "/fixtures/360video/1/video-1024x512-poster.jpg",
    sources: [
      { src: "/fixtures/360video/1/video-1024x512.mp4", type: "video/mp4" },
      { src: "/fixtures/360video/1/video-1024x512.webm", type: "video/webm" },
    ],
  },
  {
    id: "1920",
    label: "1920p",
    poster: "/fixtures/360video/1/video-1920x960-poster.jpg",
    sources: [
      { src: "/fixtures/360video/1/video-1920x960.mp4", type: "video/mp4" },
      { src: "/fixtures/360video/1/video-1920x960.webm", type: "video/webm" },
    ],
  },
];

const VIDEO_TRACKS: readonly PanoVideoTrack[] = [
  {
    src: "/fixtures/360video/1/en.vtt",
    srcLang: "en",
    label: "English",
    default: true,
  },
  {
    src: "/fixtures/360video/1/zh.vtt",
    srcLang: "zh",
    label: "中文",
  },
];

type CaptionLang = "zh" | "en" | "off";

function buildVideoSnippet(
  loop: boolean,
  captionLang: CaptionLang,
  fontSize: number,
  captionColor: string,
): string {
  const defaultTrack = captionLang === "zh" ? "zh" : "en";
  const captionsProp =
    captionLang === "off"
      ? "false"
      : `{ fontSize: ${fontSize}, color: "${captionColor}" }`;
  return `import { PanoViewer, PanoVideo } from "@ericchen1990/pano-view";

<PanoViewer
  mediaActivation={{
    onActivate: (media) => {
      void media.playVideo({ unmute: true });
    },
  }}
  style={{ height: "min(540px, 68dvh)" }}
>
  <PanoVideo
    autoPlay
    defaultVariantId="1024"
    loop={${loop}}
    captions={${captionsProp}}
    variants={[
      {
        id: "1024",
        label: "1024p",
        poster: "/fixtures/360video/1/video-1024x512-poster.jpg",
        sources: [
          { src: "/fixtures/360video/1/video-1024x512.mp4", type: "video/mp4" },
          { src: "/fixtures/360video/1/video-1024x512.webm", type: "video/webm" },
        ],
      },
      {
        id: "1920",
        label: "1920p",
        poster: "/fixtures/360video/1/video-1920x960-poster.jpg",
        sources: [
          { src: "/fixtures/360video/1/video-1920x960.mp4", type: "video/mp4" },
          { src: "/fixtures/360video/1/video-1920x960.webm", type: "video/webm" },
        ],
      },
    ]}
    tracks={[
      { src: "/fixtures/360video/1/en.vtt", srcLang: "en", label: "English"${defaultTrack === "en" ? ", default: true" : ""} },
      { src: "/fixtures/360video/1/zh.vtt", srcLang: "zh", label: "中文"${defaultTrack === "zh" ? ", default: true" : ""} },
    ]}
  />
</PanoViewer>`;
}

export function VideoPage() {
  const [loop, setLoop] = useState(true);
  const [captionLang, setCaptionLang] = useState<CaptionLang>("en");
  const [fontSize, setFontSize] = useState(16);
  const [captionColor, setCaptionColor] = useState("#ffffff");
  const [status, setStatus] = useState("Play the 360 clip, then switch quality or captions.");

  const tracks = useMemo(() => {
    if (captionLang === "off") {
      return VIDEO_TRACKS;
    }
    return VIDEO_TRACKS.map((track) => ({
      ...track,
      default: track.srcLang === captionLang,
    }));
  }, [captionLang]);

  const captions = useMemo((): boolean | PanoVideoCaptionAppearance => {
    if (captionLang === "off") {
      return false;
    }
    return { fontSize, color: captionColor };
  }, [captionColor, captionLang, fontSize]);

  const snippet = useMemo(
    () => buildVideoSnippet(loop, captionLang, fontSize, captionColor),
    [captionColor, captionLang, fontSize, loop],
  );

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section
        aria-labelledby="video-bench-title"
        className={cn(pageSectionClassName, "mt-8")}
      >
        <div className={pageHeadingWrapClassName}>
          <div>
            <p className={eyebrowClassName}>360 video bench</p>
            <h1 className={pageHeadingTitleClassName} id="video-bench-title">
              Play a 360 video
            </h1>
          </div>
          <p className={pageHeadingStatusClassName}>{status}</p>
        </div>
        <div className={pageControlsClassName}>
          <label className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.08em] text-[#88a6ac]">
            <input
              className="accent-[#df6b42]"
              checked={loop}
              onChange={(event) => setLoop(event.currentTarget.checked)}
              type="checkbox"
            />
            Loop
          </label>
          <label className={controlLabelClassName}>
            Captions
            <select
              className={controlInputClassName}
              onChange={(event) =>
                setCaptionLang(event.currentTarget.value as CaptionLang)
              }
              value={captionLang}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label className={controlLabelClassName}>
            Caption size
            <input
              className="accent-[#df6b42]"
              disabled={captionLang === "off"}
              max={28}
              min={12}
              onChange={(event) => setFontSize(Number(event.currentTarget.value))}
              step={1}
              type="range"
              value={fontSize}
            />
            <span className="font-mono text-[0.62rem] text-[#dcecef]">{fontSize}px</span>
          </label>
          <label className={controlLabelClassName}>
            Caption color
            <input
              className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px] disabled:opacity-50"
              disabled={captionLang === "off"}
              onChange={(event) => setCaptionColor(event.currentTarget.value)}
              type="color"
              value={captionColor}
            />
          </label>
        </div>
        <div className="bg-[#020607]">
          <PanoViewer
            aria-label="360 panorama video demo"
            mediaActivation={{
              onActivate: (media) => {
                void media.playVideo({ unmute: true });
              },
            }}
            style={{ height: "min(540px, 68dvh)" }}
          >
            <PanoVideo
              autoPlay
              captions={captions}
              defaultVariantId="1024"
              loop={loop}
              tracks={tracks}
              variants={VIDEO_VARIANTS}
              onError={({ source }) => {
                setStatus(`Could not load ${source}.`);
              }}
              onPlaybackStateChange={(state) => {
                if (state === "blocked") {
                  setStatus("Playback blocked until you press play.");
                  return;
                }
                setStatus(`Playback ${state}.`);
              }}
              onTrackChange={(id) => {
                setStatus(id ? `Captions: ${id}` : "Captions off");
              }}
              onVariantChange={(id) => {
                setStatus(`Quality ${id}`);
              }}
            />
          </PanoViewer>
        </div>
        <CodeSnippet
          blurb="Equirectangular mp4/webm variants, WebVTT tracks, and caption appearance."
          code={snippet}
          label="PanoVideo"
        />
      </section>
      <footer className={footerClassName}>
        <span>@ericchen1990/pano-view · 360 video sphere</span>
        <span>Stage 8</span>
      </footer>
    </main>
  );
}
