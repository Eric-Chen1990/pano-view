import { usePlaygroundLanguage } from "../../i18n/language";
import {
  GraphicHotspot,
  ImageHotspot,
  PanoFilter,
  PanoVideo,
  PanoViewer,
  Tile,
  WebVR,
  usePanoViewer,
  type PanoColorAdjustments,
  type PanoFilterPreset,
  type PanoVideoVariant,
} from "@ericchen1990/pano-view";
import { useMemo, useState, useSyncExternalStore } from "react";
import { cubeTileProps, FILTER_PRESET_GROUPS } from "../../constants";
import { cn } from "../../cn";
import {
  controlInputClassName,
  controlLabelClassName,
  eyebrowClassName,
  pageControlsClassName,
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  segmentedButtonActiveClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const TILE_PROPS = {
  ...cubeTileProps(3),
  maxConcurrentLoads: 3,
  maxTextureMemoryMb: 96,
};

const SOURCES = [
  { id: "tile", component: "Tile", label: "Cube tiles" },
  { id: "video", component: "PanoVideo", label: "360° video" },
] as const;
type SourceKind = (typeof SOURCES)[number]["id"];

const VIDEO_VARIANTS: readonly PanoVideoVariant[] = [
  { width: 1024, height: 512 },
  { width: 1920, height: 960 },
].map(({ width, height }) => {
  const base = `/fixtures/360video/1/video-${width}x${height}`;
  return {
    id: String(width),
    label: `${width} × ${height}`,
    poster: `${base}-poster.jpg`,
    sources: [
      { src: `${base}.mp4`, type: "video/mp4" },
      { src: `${base}.webm`, type: "video/webm" },
    ],
  };
});

const VIDEO_TRACKS = [
  { src: "/fixtures/360video/1/en.vtt", srcLang: "en", label: "English", default: true },
];

const ADJUSTMENTS = [
  { key: "exposure", label: "Exposure", limit: 2, unit: " EV" },
  { key: "saturation", label: "Saturation", limit: 1, unit: "" },
  { key: "contrast", label: "Contrast", limit: 1, unit: "" },
  { key: "clarity", label: "Clarity", limit: 1, unit: "" },
] as const;

function FilterSource({ source }: { source: SourceKind }) {
  return source === "tile"
    ? <Tile {...TILE_PROPS} />
    : <PanoVideo loop muted variants={VIDEO_VARIANTS} tracks={VIDEO_TRACKS} />;
}

function FilterHotspots() {
  const { t } = usePlaygroundLanguage();
  return (
    <>
      <ImageHotspot
        ariaLabel={t("Unfiltered image hotspot")}
        height={6}
        id="filter-image-marker"
        position={{ yaw: 18, pitch: 5 }}
        src="/fixtures/hotspots/signal.svg"
        tooltip={t("Hotspots stay unfiltered")}
        tooltipTrigger="hover"
        width={6}
      />
      <GraphicHotspot
        ariaLabel={t("Unfiltered graphic hotspot")}
        graphic={{ fill: "#df6b42", kind: "circle" }}
        height={8}
        id="filter-graphic-marker"
        position={{ yaw: -28, pitch: -6 }}
        tooltip={t("Original hotspot color")}
        tooltipTrigger="hover"
        width={8}
      />
    </>
  );
}

function buildFilterSnippet(
  source: SourceKind,
  preset: PanoFilterPreset,
  intensity: number,
  adjustments: PanoColorAdjustments,
  enabled: boolean,
): string {
  const component = SOURCES.find((option) => option.id === source)!.component;
  const sourceProps = source === "tile"
    ? TILE_PROPS
    : { variants: VIDEO_VARIANTS, tracks: VIDEO_TRACKS, loop: true, muted: true };
  const sourceAttributes = Object.entries(sourceProps)
    .map(([key, value]) => typeof value === "string"
      ? `        ${key}=${JSON.stringify(value)}`
      : `        ${key}={${JSON.stringify(value)}}`)
    .join("\n");
  const adjustmentLiteral = ADJUSTMENTS.map(({ key }) =>
    `${key}: ${adjustments[key] ?? 0}`,
  ).join(", ");

  return `import {
  GraphicHotspot,
  ImageHotspot,
  PanoFilter,
  PanoViewer,
  ${component},
} from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PanoramaFilter() {
  return (
    <PanoViewer style={{ height: 540 }}>
      <PanoFilter
        adjustments={{ ${adjustmentLiteral} }}
        enabled={${enabled}}
        preset="${preset}"
        intensity={${intensity}}
      />
      <${component}
${sourceAttributes}
      />
      <ImageHotspot
        id="filter-image-marker"
        position={{ yaw: 18, pitch: 5 }}
        src="/fixtures/hotspots/signal.svg"
        tooltip="Hotspots stay unfiltered"
        tooltipTrigger="hover"
        width={6}
        height={6}
      />
      <GraphicHotspot
        id="filter-graphic-marker"
        position={{ yaw: -28, pitch: -6 }}
        graphic={{ fill: "#df6b42", kind: "circle" }}
        tooltip="Original hotspot color"
        tooltipTrigger="hover"
        width={8}
        height={8}
      />
    </PanoViewer>
  );
}`;
}

export function FilterPage() {
  const { t } = usePlaygroundLanguage();
  const [source, setSource] = useState<SourceKind>("tile");
  const [preset, setPreset] = useState<PanoFilterPreset>("none");
  const [intensity, setIntensity] = useState(1);
  const [adjustments, setAdjustments] = useState<PanoColorAdjustments>({});
  const [showOriginal, setShowOriginal] = useState(false);
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(viewer.subscribeVR, viewer.getVRState, viewer.getVRState);
  const snippet = useMemo(
    () => buildFilterSnippet(source, preset, intensity, adjustments, !showOriginal),
    [intensity, preset, source, adjustments, showOriginal],
  );

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section
        aria-labelledby="filter-bench-title"
        className={cn(pageSectionClassName, "mt-8")}
      >
        <div className={pageHeadingWrapClassName}>
          <div>
            <p className={eyebrowClassName}>{t("Panorama filters")}</p>
            <h1 className={pageHeadingTitleClassName} id="filter-bench-title">{t("Real-time color adjustments")}</h1>
          </div>
          <p className={pageHeadingStatusClassName}>{t("Adjust exposure, color and local detail on panoramic images and video.")}</p>
        </div>
        <div className={pageControlsClassName}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Panorama source")}>
            {SOURCES.map(({ id, label }) => (
              <button
                aria-pressed={source === id}
                className={cn(segmentedButtonClassName, source === id && segmentedButtonActiveClassName)}
                key={id}
                onClick={() => setSource(id)}
                type="button"
              >
                {t(label)}
              </button>
            ))}
          </div>
          <button
            aria-pressed={showOriginal}
            className={cn(segmentedButtonClassName, showOriginal && segmentedButtonActiveClassName)}
            onClick={() => setShowOriginal((current) => !current)}
            type="button"
          >{t("Show original")}</button>
          <button
            className={segmentedButtonClassName}
            onClick={() => {
              setAdjustments({});
              setPreset("none");
              setIntensity(1);
              setShowOriginal(false);
            }}
            type="button"
          >{t("Reset filters")}</button>
          {vr.available ? (
            <button
              className={segmentedButtonClassName}
              onClick={() => void (vr.enabled ? viewer.exitVR() : viewer.enterVR())}
              type="button"
            >
              {vr.enabled ? t("Exit VR") : t("Enter VR")}
            </button>
          ) : null}
        </div>
        <div className={pageControlsClassName} role="group" aria-label={t("Color adjustments")}>
          {ADJUSTMENTS.map(({ key, label, limit, unit }) => (
            <label key={key} className={controlLabelClassName}>
              {t(label)} {(adjustments[key] ?? 0).toFixed(2)}{unit}
              <input
                aria-label={t(label)}
                className={cn(controlInputClassName, "w-28")}
                max={limit}
                min={-limit}
                onChange={(event) => {
                  const next = Number(event.currentTarget.value);
                  setAdjustments((current) => ({ ...current, [key]: next }));
                }}
                step={0.01}
                type="range"
                value={adjustments[key] ?? 0}
              />
            </label>
          ))}
        </div>
        <div className="bg-[#020607]">
          <PanoViewer
            ref={viewer.ref}
            aria-label={t("Panorama filter demo")}
            style={{ height: "min(540px, 68dvh)" }}
          >
            <WebVR />
            <PanoFilter
              adjustments={adjustments}
              enabled={!showOriginal}
              intensity={intensity}
              preset={preset}
            />
            <FilterSource source={source} />
            <FilterHotspots />
          </PanoViewer>
        </div>
        <div className={pageControlsClassName}>
          <label className={controlLabelClassName}>{t("Preset intensity") + " "}{Math.round(intensity * 100)}%
            <input
              aria-label={t("Filter intensity")}
              className={cn(controlInputClassName, "w-40")}
              max={1}
              min={0}
              onChange={(event) => setIntensity(Number(event.target.value))}
              step={0.01}
              type="range"
              value={intensity}
            />
          </label>
        </div>
        <div className="grid gap-4 border-b border-[#244047] px-6 py-4">
          {FILTER_PRESET_GROUPS.map((group) => (
            <div className="grid gap-2" key={group.label}>
              <p className="m-0 font-mono text-[0.68rem] font-semibold tracking-[0.1em] text-[#75cbd3] uppercase">
                {t(group.label)}
              </p>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("{category} filters", { category: t(group.label) })}>
                {group.presets.map((entry) => (
                  <button
                    aria-pressed={preset === entry.value}
                    className={cn(
                      segmentedButtonClassName,
                      preset === entry.value && segmentedButtonActiveClassName,
                    )}
                    key={entry.value}
                    onClick={() => setPreset(entry.value)}
                    type="button"
                  >
                    {t(entry.label)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <ExampleCode
          react={{
            blurb: t("Pass an adjustments object to PanoFilter. Its values apply to the panorama source."),
            code: snippet,
            label: "PanoFilter",
          }}
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · panorama filters" />
    </main>
  );
}
