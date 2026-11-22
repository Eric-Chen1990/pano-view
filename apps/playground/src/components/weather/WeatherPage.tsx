import {
  PANO_RAIN_PRESETS,
  PANO_SNOW_PRESETS,
  PanoViewer,
  PanoWeather,
  Sphere,
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
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const src = "/fixtures/panorama/panos/1/sphere.webp";
const previewUrl = "preview.webp";
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
  return (
    <label className={controlLabelClassName}>
      Preset
      <select
        className={cn(controlInputClassName, "focus-visible:border-[#75cbd3]")}
        value={value}
        onChange={(event) => {
          const preset = options.find((option) => option === event.currentTarget.value);
          if (preset) onChange(preset);
        }}
      >
        {options.map((preset) => <option key={preset} value={preset}>{PRESET_LABELS[preset]}</option>)}
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
  const weatherCode = `  <PanoWeather
    type="${weather.type}"
    preset="${weather.preset}"
    intensity={${intensity}}
    wind={[${windX}, ${windZ}]}${!enabled ? "\n    enabled={false}" : ""}${type === "snow" && customSize
      ? `\n    sizeRange={[${sizeRange[0]}, ${sizeRange[1]}]}`
      : ""}${type === "snow" && groundEnabled ? `\n    groundY={${groundY}}` : ""}
  />`;
  const code = `import { PanoViewer, PanoWeather, Sphere } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PanoramaWeather() {
  return (
    <PanoViewer style={{ height: 480 }}>
      <Sphere src="${src}" previewUrl="${previewUrl}" />
    ${weatherCode}
    </PanoViewer>
  );
}`;

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section aria-labelledby="weather-title" className={cn(pageSectionClassName, "mt-8")}>
        <div className={pageHeadingWrapClassName}>
          <h1 id="weather-title" className={pageHeadingTitleClassName}>360° weather</h1>
        </div>
        <div className={pageControlsClassName}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weather">
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
                {label}
              </button>
            ))}
          </div>
          {mode === "rain" && <WeatherPresetSelect options={PANO_RAIN_PRESETS} value={rain} onChange={setRain} />}
          {mode === "snow" && <WeatherPresetSelect options={PANO_SNOW_PRESETS} value={snow} onChange={setSnow} />}
          {vr.available && (
            <button
              type="button"
              className={segmentedButtonClassName}
              onClick={() => void (vr.enabled ? viewer.exitVR() : viewer.enterVR())}
            >
              {vr.enabled ? "Exit VR" : "Enter VR"}
            </button>
          )}
        </div>
        <div className={pageControlsClassName} role="group" aria-label="Weather settings">
          <WeatherSlider label="Intensity" min={0} value={intensity} valueText={`${Math.round(intensity * 100)}%`} onChange={setIntensity} />
          <WeatherSlider label="Wind X" min={-1} value={windX} onChange={setWindX} />
          <WeatherSlider label="Wind Z" min={-1} value={windZ} onChange={setWindZ} />
          <p className="m-0 hidden text-sm text-[#9ab1b7] motion-reduce:block">
            Particles are paused because your system requests reduced motion.
          </p>
        </div>
        {mode === "snow" && (
          <div className={pageControlsClassName} role="group" aria-label="Snowflake size and ground">
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={customSize} onChange={(event) => setCustomSize(event.currentTarget.checked)} />
              Custom size
            </label>
            {customSize && (
              <>
                <WeatherSlider
                  label="Minimum size" min={0.02} max={2} step={0.01} value={sizeRange[0]}
                  onChange={(min) => setSizeRange(([, max]) => [min, Math.max(min, max)])}
                />
                <WeatherSlider
                  label="Maximum size" min={0.02} max={2} step={0.01} value={sizeRange[1]}
                  onChange={(max) => setSizeRange(([min]) => [Math.min(min, max), max])}
                />
              </>
            )}
            <label className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={groundEnabled} onChange={(event) => setGroundEnabled(event.currentTarget.checked)} />
              Ground cutoff
            </label>
            {groundEnabled && (
              <WeatherSlider label="Ground Y" min={-100} max={0} step={1} value={groundY} valueText={String(groundY)} onChange={setGroundY} />
            )}
          </div>
        )}
        <PanoViewer ref={viewer.ref} aria-label="Weather demo" style={{ height: "min(540px, 68dvh)" }}>
          <WebVR />
          <Sphere src={src} previewUrl={previewUrl} />
          <PanoWeather {...weather} enabled={enabled} intensity={intensity} wind={[windX, windZ]} />
        </PanoViewer>
        <ExampleCode
          react={{
            label: "PanoWeather",
            blurb: "Use the current weather settings in your viewer.",
            code: code,
          }}
        />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · 360° weather" />
    </main>
  );
}
