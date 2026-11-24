import { message, type LocalizedMessage } from "../../i18n/locale";
import { usePlaygroundLanguage } from "../../i18n/language";
import fullSource from "./VideoPage.tsx?raw";
import {
  PanoVideo,
  WebVR,
  usePanoViewer,
  type PanoVideoCaptionAppearance,
  type PanoVideoControlButton,
  type PanoVideoControlsOptions,
  type PanoVideoTrack,
  type PanoVideoVariant,
} from "@ericchen1990/pano-view";
import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "../../cn";
import {
  controlInputClassName,
  controlLabelClassName,
  pageControlsClassName,
  pageSectionClassName,
  shellClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { ExampleCode } from "../ExampleCode";
import { PageHeading } from "../PageHeading";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { PlaygroundVRViewer } from "../webvr/PlaygroundVRViewer";
import { VideoMotionSampler, VideoPerformanceMetrics, type VideoMotionStats } from "./VideoPerformance";

const HLS_SAMPLE = "https://storage.web-3d.tech/videos/ZyCNIoP5er5jEpgDwHvHKo6zJ0etSgeY/T3T1UcnAhNPAGK_a/hls/h264/video.m3u8";
const HLS_EXAMPLE_URL = "/your-360-video/master.m3u8";
const exampleSource = fullSource.split(HLS_SAMPLE).join(HLS_EXAMPLE_URL);
const QUALITY_PATH = "/fixtures/360video/quality";
const AUTO_VARIANT = "auto";
const MOBILE_VARIANTS: readonly PanoVideoVariant[] = [
  {
    id: AUTO_VARIANT,
    label: "Auto (up to 2026 × 1080)",
    sources: [{ src: `${QUALITY_PATH}/mobile.m3u8` }],
  },
  { id: "4k", label: "4K (3840 × 2048)", sources: [{ src: `${QUALITY_PATH}/4k.m3u8` }] },
];

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

const HLS_TRACKS = VIDEO_TRACKS.map((track) => ({
  ...track,
  src: `/fixtures/360video/hls-${track.srcLang}.vtt`,
}));

type CaptionLang = "zh" | "en" | "off";
type VideoProfile = "mobile" | "desktop" | "files";

const CONTROL_BUTTONS = {
  play: "Play / pause",
  volume: "Volume",
  playbackRate: "Playback speed",
  quality: "Quality",
  captions: "Captions",
  vr: "VR",
  fullscreen: "Fullscreen",
} satisfies Record<PanoVideoControlButton, string>;

type VideoButtons = NonNullable<PanoVideoControlsOptions["buttons"]>;

function buildVideoSnippet(
  loop: boolean,
  captionLang: CaptionLang,
  fontSize: number,
  captionColor: string,
  profile: VideoProfile,
  clickToTogglePlayback: boolean,
  showCenterPlayButton: boolean,
  buttons: VideoButtons,
): string {
  const defaultTrack = captionLang === "zh" ? "zh" : "en";
  const tracks = profile === "files" ? VIDEO_TRACKS : HLS_TRACKS;
  const variants = profile === "files" ? VIDEO_VARIANTS : profile === "mobile" ? MOBILE_VARIANTS : undefined;
  const sourceProps = variants ? [
    `        defaultVariantId="${profile === "files" ? "1024" : AUTO_VARIANT}"`,
    ...(profile === "mobile" ? [`        fallbackVariantId="${AUTO_VARIANT}"`, '        crossOrigin="anonymous"'] : []),
    `        variants={${JSON.stringify(variants, null, 2).replace(/\n/g, "\n        ")}}`,
  ].join("\n") : `        src="${HLS_SAMPLE}"\n        crossOrigin="anonymous"`;
  const captionsProp =
    captionLang === "off"
      ? "false"
      : `{ fontSize: ${fontSize}, color: "${captionColor}" }`;
  return `import { PanoViewer, PanoVideo, WebVR } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PanoramaVideo() {
  return (
    <PanoViewer
      mediaActivation={{
        onActivate: (media) => {
          void media.playVideo({ unmute: true });
        },
      }}
      style={{ height: "min(540px, 68dvh)" }}
    >
      <WebVR />
      <PanoVideo
        autoPlay
        loop={${loop}}
        clickToTogglePlayback={${clickToTogglePlayback}}
        showCenterPlayButton={${showCenterPlayButton}}
        captions={${captionsProp}}
        controls={{ buttons: ${JSON.stringify(buttons)} }}
${sourceProps}
        tracks={[
${tracks.map((track) => `          { src: "${track.src}", srcLang: "${track.srcLang}", label: "${track.label}"${defaultTrack === track.srcLang ? ", default: true" : ""} },`).join("\n")}
        ]}
      />
    </PanoViewer>
  );
}`;
}

export function VideoPage() {
  const { t } = usePlaygroundLanguage();
  const viewer = usePanoViewer();
  const [profile, setProfile] = useState<VideoProfile>(() =>
    window.matchMedia("(pointer: coarse)").matches ? "mobile" : "desktop",
  );
  const viewerRoot = useRef<HTMLDivElement>(null);
  const motion = useRef<VideoMotionStats>({ lastViewChange: -Infinity, frames: [], nextFrame: 0 }).current;
  const markViewChange = useCallback(() => {
    motion.lastViewChange = performance.now();
  }, [motion]);
  const [loop, setLoop] = useState(true);
  const [clickToTogglePlayback, setClickToTogglePlayback] = useState(true);
  const [showCenterPlayButton, setShowCenterPlayButton] = useState(true);
  const [buttons, setButtons] = useState<VideoButtons>({});
  const controls = useMemo(() => ({ buttons }), [buttons]);
  const [captionLang, setCaptionLang] = useState<CaptionLang>("en");
  const [fontSize, setFontSize] = useState(16);
  const [captionColor, setCaptionColor] = useState("#ffffff");
  const [playbackMessage, setPlaybackMessage] = useState<LocalizedMessage | null>(null);

  const tracks = useMemo(() => {
    const sourceTracks = profile === "files" ? VIDEO_TRACKS : HLS_TRACKS;
    if (captionLang === "off") return sourceTracks;
    return sourceTracks.map((track) => ({
      ...track,
      default: track.srcLang === captionLang,
    }));
  }, [captionLang, profile]);

  const captions = useMemo((): boolean | PanoVideoCaptionAppearance => {
    if (captionLang === "off") {
      return false;
    }
    return { fontSize, color: captionColor };
  }, [captionColor, captionLang, fontSize]);

  const snippet = useMemo(
    () => buildVideoSnippet(loop, captionLang, fontSize, captionColor, profile, clickToTogglePlayback, showCenterPlayButton, buttons),
    [buttons, captionColor, captionLang, clickToTogglePlayback, fontSize, loop, profile, showCenterPlayButton],
  );

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section
        aria-labelledby="video-bench-title"
        className={cn(pageSectionClassName, "mt-8")}
      >
        <PageHeading
          id="video-bench-title"
          eyebrow={t("Media")}
          title={t("Play a 360 video")}
        />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line px-6 py-4">
          <label className={controlLabelClassName}>{t("Video source")}<select
              aria-describedby="video-source-help"
              className={cn(controlInputClassName, "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand")}
              value={profile}
              onChange={(event) => {
                setPlaybackMessage(null);
                setProfile(event.currentTarget.value as VideoProfile);
              }}
            >
              <option value="mobile">{t("Mobile HLS · Auto up to 1080p")}</option>
              <option value="desktop">{t("Full HLS ladder · Auto up to 4K")}</option>
              <option value="files">MP4 / WebM</option>
            </select>
          </label>
          <dl id="video-source-help" className="grid min-w-0 flex-1 basis-80 gap-1 text-xs leading-5 text-[#9ab1b7]">
            <div>
              <dt className="inline font-semibold text-[#e7f2f5]">{t("Mobile HLS")}</dt>{" "}
              <dd className="inline">{t("limits automatic quality to 1080p to reduce playback load. You can still select 4K in the player.")}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-[#e7f2f5]">{t("Full HLS ladder")}</dt>{" "}
              <dd className="inline">{t("plays the same stream and can select 4K automatically when the connection and device allow it.")}</dd>
            </div>
            <div>
              <dt className="inline font-semibold text-[#e7f2f5]">MP4 / WebM</dt>{" "}
              <dd className="inline">{t("plays a separate short clip at the resolution you select.")}</dd>
            </div>
          </dl>
        </div>
        <div className={pageControlsClassName}>
          <label className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.08em] text-[#88a6ac]">
            <input
              className="accent-[#df6b42]"
              checked={loop}
              onChange={(event) => setLoop(event.currentTarget.checked)}
              type="checkbox"
            />{t("Loop")}</label>
          <label className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.08em] text-[#88a6ac]">
            <input
              className="accent-[#df6b42]"
              checked={clickToTogglePlayback}
              onChange={(event) => setClickToTogglePlayback(event.currentTarget.checked)}
              type="checkbox"
            />{t("Click to play or pause")}</label>
          <label className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.08em] text-[#88a6ac]">
            <input
              className="accent-[#df6b42]"
              checked={showCenterPlayButton}
              onChange={(event) => setShowCenterPlayButton(event.currentTarget.checked)}
              type="checkbox"
            />{t("Center play button")}</label>
          <label className={controlLabelClassName}>{t("Captions")}<select
              className={controlInputClassName}
              onChange={(event) =>
                setCaptionLang(event.currentTarget.value as CaptionLang)
              }
              value={captionLang}
            >
              <option value="en">English</option>
              <option value="zh">中文</option>
              <option value="off">{t("Off")}</option>
            </select>
          </label>
          <label className={controlLabelClassName}>{t("Caption size")}<input
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
          <label className={controlLabelClassName}>{t("Caption color")}<input
              className="h-[34px] border border-[#38545b] bg-[#08191d] p-[3px] disabled:opacity-50"
              disabled={captionLang === "off"}
              onChange={(event) => setCaptionColor(event.currentTarget.value)}
              type="color"
              value={captionColor}
            />
          </label>
        </div>
        <details className="border-b border-line px-6 py-3 text-sm">
          <summary className="w-fit cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            {t("Playback buttons")}
          </summary>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label={t("Playback buttons")}>
            {(Object.keys(CONTROL_BUTTONS) as PanoVideoControlButton[]).map((button) => (
              <label className="inline-flex min-h-9 items-center gap-2" key={button}>
                <input
                  checked={buttons[button] !== false}
                  className="accent-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setButtons((current) => ({ ...current, [button]: checked }));
                  }}
                  type="checkbox"
                />
                {t(CONTROL_BUTTONS[button])}
              </label>
            ))}
          </div>
        </details>
        <div role="status" className={playbackMessage ? "border-b border-line px-6 py-3 text-sm text-[#e7f2f5]" : undefined}>
          {playbackMessage && t(playbackMessage)}
        </div>
        <div className="bg-[#020607]" ref={viewerRoot}>
          <PlaygroundVRViewer
            viewer={viewer}
            aria-label={t("360 panorama video demo")}
            onViewChange={markViewChange}
            mediaActivation={{
              onActivate: (media) => {
                void media.playVideo({ unmute: true });
              },
            }}
            style={{ height: "min(540px, 68dvh)" }}
          >
            <WebVR />
            <VideoMotionSampler stats={motion} />
            <PanoVideo
              key={profile}
              autoPlay
              captions={captions}
              clickToTogglePlayback={clickToTogglePlayback}
              controls={controls}
              defaultVariantId={profile === "files" ? "1024" : profile === "mobile" ? AUTO_VARIANT : undefined}
              fallbackVariantId={profile === "mobile" ? AUTO_VARIANT : undefined}
              loop={loop}
              showCenterPlayButton={showCenterPlayButton}
              tracks={tracks}
              src={profile === "desktop" ? HLS_SAMPLE : undefined}
              crossOrigin={profile === "files" ? undefined : "anonymous"}
              variants={profile === "files" ? VIDEO_VARIANTS : profile === "mobile" ? MOBILE_VARIANTS : undefined}
              onError={({ source, error }) => {
                if (error instanceof DOMException && error.name === "NotAllowedError") return;
                setPlaybackMessage(message("Could not load {name}.", { name: source }));
              }}
              onPlaybackStateChange={(state) => {
                if (state === "blocked") {
                  setPlaybackMessage("Press Play to start the video.");
                } else if (state === "playing") {
                  setPlaybackMessage(null);
                }
              }}
              onVariantChange={() => setPlaybackMessage(null)}
            />
          </PlaygroundVRViewer>
        </div>
        <VideoPerformanceMetrics root={viewerRoot} motion={motion} />
        <ExampleCode
          react={{
            blurb: t("Replace the sample URLs with your own video sources and captions."),
            code: snippet,
            label: "PanoVideo",
          }}
        />
      <details className="border-t border-line p-5"><summary>{t("Complete running example")}</summary>
        <CodeSnippet label={t("360 video page")} blurb={t("Full page implementation, including the displayed controls, loading/error status and example code generation.")} code={exampleSource} />
      </details>
      </section>
      <SiteFooter label="@ericchen1990/pano-view · 360 video sphere" />
    </main>
  );
}
