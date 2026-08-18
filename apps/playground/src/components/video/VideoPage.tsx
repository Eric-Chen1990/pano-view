import {
  PanoViewer,
  PanoVideo,
  type PanoVideoCaptionAppearance,
  type PanoVideoTrack,
  type PanoVideoVariant,
} from "@ericchen1990/pano-view";
import { useMemo, useState } from "react";
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

<PanoViewer style={{ height: 540 }}>
  <PanoVideo
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
    <main className="app-shell">
      <SiteHeader />
      <section className="transition-bench" aria-labelledby="video-bench-title">
        <div className="transition-bench-heading">
          <div>
            <p className="eyebrow">360 video bench</p>
            <h1 id="video-bench-title">Sphere-mapped playback</h1>
          </div>
          <p>{status}</p>
        </div>
        <div className="transition-bench-controls video-bench-controls">
          <label>
            <input
              checked={loop}
              onChange={(event) => setLoop(event.currentTarget.checked)}
              type="checkbox"
            />
            Loop
          </label>
          <label>
            Captions
            <select
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
          <label>
            Caption size
            <input
              disabled={captionLang === "off"}
              max={28}
              min={12}
              onChange={(event) => setFontSize(Number(event.currentTarget.value))}
              step={1}
              type="range"
              value={fontSize}
            />
            <span>{fontSize}px</span>
          </label>
          <label>
            Caption color
            <input
              disabled={captionLang === "off"}
              onChange={(event) => setCaptionColor(event.currentTarget.value)}
              type="color"
              value={captionColor}
            />
          </label>
        </div>
        <div className="transition-viewer">
          <PanoViewer
            aria-label="360 panorama video demo"
            style={{ height: 540 }}
          >
            <PanoVideo
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
      <footer>
        <span>@ericchen1990/pano-view · 360 video sphere</span>
        <span>Stage 8</span>
      </footer>
    </main>
  );
}
