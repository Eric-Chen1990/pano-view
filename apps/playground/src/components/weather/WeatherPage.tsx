import { PlaygroundVRViewer } from "../webvr/PlaygroundVRViewer";
import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileJsx, cubeTileProps } from "../../constants";
import {
  PANO_RAIN_PRESETS,
  PANO_SNOW_PRESETS,
  PanoWeather,
  Tile,
  WebVR,
  usePanoViewer,
  type PanoRainPreset,
  type PanoSnowPreset,
  type PanoWeatherProps,
} from "@ericchen1990/pano-view";
import { useState, useSyncExternalStore } from "react";
import { cn } from "../../cn";
import {
  controlInputClassName,
  controlLabelClassName,
  pageControlsClassName,
  pageSectionClassName,
  playgroundViewerHeight,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { PageHeading } from "../PageHeading";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const MODES = [
  { value: "off", label: "Off" },
  { value: "rain", label: "Rain" },
  { value: "snow", label: "Snow" },
] as const;

const PRESET_LABELS: Record<PanoRainPreset | PanoSnowPreset, string> = {
  drizzle: "Drizzle",
  steady: "Steady rain",
  downpour: "Downpour",
  powder: "Powder snow",
  crystal: "Crystal flakes",
  fluffy: "Fluffy flakes",
  star: "Star crystals",
  fern: "Fernlike flakes",
  needles: "Needle crystals",
};

function WeatherPresetSelect<Preset extends PanoRainPreset | PanoSnowPreset>({
  options, onChange, value,
}: {
  options: readonly Preset[];
  onChange: (preset: Preset) => void;
  value: Preset;
}) {
  const { t } = usePlaygroundLanguage();
  return (
    <label className={controlLabelClassName}>{t("Preset")}<select
        className={cn(controlInputClassName, "focus-visible:border-[#75cbd3]")}
        value={value}
        onChange={(event) => {
          const preset = options.find((option) => option === event.currentTarget.value);
          if (preset) onChange(preset);
        }}
      >
        {options.map((preset) => <option key={preset} value={preset}>{t(PRESET_LABELS[preset])}</option>)}
      </select>
    </label>
  );
}

function WeatherSlider({
  label, min, max = 1, step = 0.05, value, valueText = value.toFixed(2), onChange,
}: {
  label: string;
  min: number;
  max?: number;
  step?: number;
  value: number;
  valueText?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className={controlLabelClassName}>
      <span>{label} <span aria-hidden="true">{valueText}</span></span>
      <input
        className={cn(controlInputClassName, "w-36 p-0 focus-visible:outline-2 focus-visible:outline-[#75cbd3]")}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

export function WeatherPage() {
  const { t } = usePlaygroundLanguage();
  const [type, setType] = useState<PanoWeatherProps["type"]>("rain");
  const [enabled, setEnabled] = useState(true);
  const [rain, setRain] = useState<PanoRainPreset>("steady");
  const [snow, setSnow] = useState<PanoSnowPreset>("crystal");
  const [intensity, setIntensity] = useState(0.6);
  const [windX, setWindX] = useState(0);
  const [windZ, setWindZ] = useState(0);
  const [customSize, setCustomSize] = useState(false);
  const [sizeRange, setSizeRange] = useState<readonly [number, number]>([0.15, 0.65]);
  const [groundEnabled, setGroundEnabled] = useState(false);
  const [groundY, setGroundY] = useState(-8);
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(viewer.subscribeVR, viewer.getVRState, viewer.getVRState);

  const mode = enabled ? type : "off";
  const weather: PanoWeatherProps = type === "snow"
    ? {
        type,
        preset: snow,
        sizeRange: customSize ? sizeRange : undefined,
        groundY: groundEnabled ? groundY : undefined,
      }
    : { type: "rain", preset: rain };
  const optionalWeatherProps = [
    !enabled ? "        enabled={false}\n" : "",
    weather.type === "snow" && weather.sizeRange
      ? `        sizeRange={[${weather.sizeRange[0]}, ${weather.sizeRange[1]}]}\n` : "",
    weather.type === "snow" && weather.groundY !== undefined
      ? `        groundY={${weather.groundY}}\n` : "",
  ].join("");
  const code = `import { PanoViewer, PanoWeather, Tile } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PanoramaWeather() {
  return (
    <PanoViewer style={{ height: ${JSON.stringify(playgroundViewerHeight)} }}>
      ${cubeTileJsx()}
      <PanoWeather
        type="${weather.type}"
        preset="${weather.preset}"
        intensity={${intensity}}
        wind={[${windX}, ${windZ}]}
${optionalWeatherProps}      />
    </PanoViewer>
  );
}`;

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section aria-labelledby="weather-title" className={cn(pageSectionClassName, "mt-8")}>
        <PageHeading
          id="weather-title"
          eyebrow={t("Scenes")}
          title={t("360° weather")}
          description={t("Try nine spatial rain and snow effects in a panoramic viewer with adjustable intensity and wind.")}
        />
        <div className={pageControlsClassName}>
          <div className={controlLabelClassName}>{t("Weather")}<div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Weather")}>
              {MODES.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  className={segmentedButtonClassName}
                  aria-pressed={mode === value}
                  onClick={() => {
                    setEnabled(value !== "off");
                    if (value !== "off") setType(value);
                  }}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
          {mode === "rain" && <WeatherPresetSelect options={PANO_RAIN_PRESETS} value={rain} onChange={setRain} />}
          {mode === "snow" && <WeatherPresetSelect options={PANO_SNOW_PRESETS} value={snow} onChange={setSnow} />}
          {vr.available && (
            <button
              type="button"
              className={segmentedButtonClassName}
              onClick={() => void (vr.enabled ? viewer.exitVR() : viewer.enterVR())}
            >
              {vr.enabled ? t("Exit VR") : t("Enter VR")}
            </button>
          )}
        </div>
        <div className={pageControlsClassName} role="group" aria-label={t("Weather settings")}>
          <WeatherSlider label={t("Intensity")} min={0} value={intensity} valueText={`${Math.round(intensity * 100)}%`} onChange={setIntensity} />
          <WeatherSlider label={t("Wind X")} min={-1} value={windX} onChange={setWindX} />
          <WeatherSlider label={t("Wind Z")} min={-1} value={windZ} onChange={setWindZ} />
          <p className="m-0 hidden text-sm text-[#9ab1b7] motion-reduce:block">{t("Particles are paused because your system requests reduced motion.")}</p>
        </div>
        {mode === "snow" && (
          <div className={pageControlsClassName} role="group" aria-label={t("Snowflake size and ground")}>
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={customSize} onChange={(event) => setCustomSize(event.currentTarget.checked)} />{t("Custom size")}</label>
            {customSize && (
              <>
                <WeatherSlider
                  label={t("Minimum size")} min={0.02} max={2} step={0.01} value={sizeRange[0]}
                  onChange={(min) => setSizeRange(([, max]) => [min, Math.max(min, max)])}
                />
                <WeatherSlider
                  label={t("Maximum size")} min={0.02} max={2} step={0.01} value={sizeRange[1]}
                  onChange={(max) => setSizeRange(([min]) => [Math.min(min, max), max])}
                />
              </>
            )}
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={groundEnabled} onChange={(event) => setGroundEnabled(event.currentTarget.checked)} />{t("Ground cutoff")}</label>
            {groundEnabled && (
              <WeatherSlider label={t("Ground Y")} min={-100} max={0} step={1} value={groundY} valueText={String(groundY)} onChange={setGroundY} />
            )}
          </div>
        )}
        <PlaygroundVRViewer viewer={viewer} aria-label={t("Weather demo")} style={{ height: playgroundViewerHeight }}>
          <WebVR />
          <Tile {...cubeTileProps()} />
          <PanoWeather {...weather} enabled={enabled} intensity={intensity} wind={[windX, windZ]} />
        </PlaygroundVRViewer>
        <ExampleCode
          react={{
            label: "PanoWeather",
            blurb: t("Use the current weather settings in your viewer."),
            code: code,
          }}
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · 360° weather" />
    </main>
  );
}
