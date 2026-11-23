import { usePlaygroundLanguage } from "../../i18n/language";
import {
  PanoSun, PanoViewer, Scenes, WebVR, usePanoViewer,
  type HotspotPosition, type PanoSunProps,
} from "@ericchen1990/pano-view";
import { useState, useSyncExternalStore } from "react";
import { cubeTileJsx, cubeTileProps } from "../../constants";
import { cn } from "../../cn";
import {
  controlInputClassName, controlLabelClassName, pageControlsClassName, pageHeadingTitleClassName,
  pageHeadingWrapClassName, pageSectionClassName, segmentedButtonActiveClassName, segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";
import { SunGuide } from "./SunGuide";

const SCENARIOS = {
  add: {
    label: "Add sun",
    panorama: cubeTileProps(1),
    initialView: { yaw: 120, pitch: 35, fov: 65 },
    settings: {
      position: { yaw: 140, pitch: 55 },
      angularSize: 0.55, glowAngularSize: 22, raysAngularSize: 14,
      intensity: 1, disc: 1, glow: 0.55, rays: 0.18, flare: 0.22,
    },
  },
  enhance: {
    label: "Enhance existing sun",
    panorama: cubeTileProps(4),
    initialView: { yaw: -100, pitch: 44, fov: 65 },
    settings: {
      position: { yaw: -81, pitch: 63 },
      angularSize: 1.2, glowAngularSize: 26, raysAngularSize: 16,
      intensity: 1, disc: 0, glow: 0.3, rays: 0.12, flare: 0.14,
    },
  },
} satisfies Record<string, {
  label: string;
  panorama: ReturnType<typeof cubeTileProps>;
  initialView: { yaw: number; pitch: number; fov: number };
  settings: PanoSunProps;
}>;
type Scenario = keyof typeof SCENARIOS;
type SunSettings = typeof SCENARIOS.add.settings;
type SunPlacement = Pick<SunSettings, "position" | "angularSize">;
type SunEdit = SunPlacement & { preview: boolean };

const SUN_SCENES = Object.entries(SCENARIOS).map(([id, { panorama }]) => ({
  id,
  type: "tile" as const,
  ...panorama,
}));

function SunSlider({ label, value, min, max, step, suffix = "", onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className={controlLabelClassName}>
      <span>{label} <span aria-hidden="true">{value.toFixed(step < 1 ? 2 : 1)}{suffix}</span></span>
      <input
        className={cn(controlInputClassName, "w-32 p-0 focus-visible:outline-2 focus-visible:outline-[#75cbd3]")}
        type="range" min={min} max={max} step={step} value={value}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </label>
  );
}

const DIAMETERS = [
  ["angularSize", "Disc size", 0.2, 6],
  ["glowAngularSize", "Glow width", 1, 60],
  ["raysAngularSize", "Ray span", 1, 50],
] as const;
const STRENGTHS = [
  ["intensity", "Intensity"], ["disc", "Disc"], ["glow", "Glow"], ["rays", "Rays"], ["flare", "Lens flare"],
] as const;

function SunExample({ scenario }: { scenario: Scenario }) {
  const { t } = usePlaygroundLanguage();
  const [displayedScenario, setDisplayedScenario] = useState(scenario);
  const { label, panorama, initialView, settings: defaults } = SCENARIOS[displayedScenario];
  const [settings, setSettings] = useState<SunSettings>(defaults);
  const [enabled, setEnabled] = useState(true);
  const [edit, setEdit] = useState<SunEdit | null>(null);
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(viewer.subscribeVR, viewer.getVRState, viewer.getVRState);
  const { position, ...layers } = edit
    ? { ...settings, position: edit.position, angularSize: edit.angularSize }
    : settings;
  const editing = edit !== null && !vr.enabled;

  function focusSun(target: HotspotPosition) {
    void viewer.lookTo(target, { fov: Math.min(12, viewer.getView().fov), duration: 0 });
  }

  function moveSun(next: HotspotPosition) {
    setEdit((current) => current && { ...current, position: next });
  }

  const layerProps = Object.entries(layers)
    .map(([name, value]) => `        ${name}={${value}}`)
    .join("\n");
  const code = `import { PanoSun, PanoViewer, Tile } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PanoramaSun() {
  return (
    <PanoViewer style={{ height: 480 }} initialView={${JSON.stringify(initialView)}}>
      ${cubeTileJsx(panorama)}
      <PanoSun
        position={{ yaw: ${Number(position.yaw.toFixed(4))}, pitch: ${Number(position.pitch.toFixed(4))} }}
${layerProps}${enabled ? "" : "\n        enabled={false}"}
      />
    </PanoViewer>
  );
}`;

  return (
    <>
      <div className={pageControlsClassName}>
        <button
          className={cn(segmentedButtonClassName, "disabled:opacity-50")} type="button"
          aria-pressed={enabled} disabled={editing}
          onClick={() => setEnabled((value) => !value)}
        >{t("Sun effect")}</button>
        {!vr.enabled && !editing && (
          <button className={segmentedButtonClassName} type="button" onClick={() => {
            setEdit({ position, angularSize: layers.angularSize, preview: false });
            focusSun(position);
          }}>{t("Edit sun")}</button>
        )}
        {vr.available && !vr.enabled && !editing && (
          <button className={segmentedButtonClassName} type="button" onClick={() => void viewer.enterVR()}>{t("Enter VR")}</button>
        )}
      </div>
      <PanoViewer
        ref={viewer.ref} aria-label={t(label)} initialView={initialView} minFov={5}
        onPanoramaClick={editing ? (event) => {
          if (event.button === 0) moveSun(event.position);
        } : undefined}
        renderOverlay={() => editing && edit && (
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center sm:inset-x-4 sm:bottom-4">
            <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-[#3e6c73] bg-[#081619]/95 px-3 py-2 text-[#f5fbfc] sm:max-w-xl"
              role="group" aria-label={t("Sun editing controls")}>
              <p className="m-0 basis-full text-xs text-[#b9d7db]">{t("Select a point in the sky or drag the center marker.")}</p>
              <SunSlider label={t("Disc size")} value={edit.angularSize} min={0.2} max={6} step={0.01} suffix="°"
                onChange={(angularSize) => setEdit((current) => current && { ...current, angularSize })} />
              <button type="button" className={segmentedButtonClassName} onClick={() => focusSun(edit.position)}>{t("Focus sun")}</button>
              <button type="button"
                className={cn(segmentedButtonClassName, "aria-pressed:border-[#75cbd3] aria-pressed:bg-[#173136]")}
                aria-pressed={edit.preview}
                onClick={() => setEdit((current) => current && { ...current, preview: !current.preview })}>{t("Preview light")}</button>
              <button type="button" className={segmentedButtonClassName} onClick={() => setEdit(null)}>{t("Cancel")}</button>
              <button type="button" className={cn(segmentedButtonClassName, segmentedButtonActiveClassName)}
                onClick={() => {
                  setSettings((current) => ({ ...current, position: edit.position, angularSize: edit.angularSize }));
                  setEdit(null);
                }}>{t("Done")}</button>
            </div>
          </div>
        )}
        style={{ height: "min(550px, 65dvh)" }}
      >
        <WebVR />
        <Scenes
          scenes={SUN_SCENES}
          activeSceneId={scenario}
          transition="none"
          onSceneReady={(id) => {
            if (id !== scenario || id === displayedScenario) return;
            const next = SCENARIOS[scenario];
            viewer.setView(next.initialView, { immediate: true });
            setDisplayedScenario(scenario);
            setSettings(next.settings);
            setEnabled(true);
            setEdit(null);
          }}
        />
        <PanoSun {...layers} position={position} enabled={editing ? edit.preview : enabled} />
        {editing && <SunGuide position={position} angularSize={layers.angularSize} onMove={moveSun} />}
      </PanoViewer>
      <div className={pageControlsClassName} role="group" aria-label={t("Sun placement and size")}>
        {(["yaw", "pitch"] as const).map((axis) => {
          const limit = axis === "yaw" ? 180 : 90;
          return (
            <SunSlider key={axis} label={axis === "yaw" ? t("Yaw") : t("Pitch")}
              value={position[axis]} min={-limit} max={limit} step={0.1} suffix="°"
              onChange={(value) => {
                const next = { ...position, [axis]: value };
                if (editing) moveSun(next);
                else setSettings((current) => ({ ...current, position: next }));
              }} />
          );
        })}
        {DIAMETERS.filter(([key]) => !editing || key !== "angularSize").map(([key, name, min, max]) => (
          <SunSlider key={key} label={t(name)} value={layers[key]} min={min} max={max} step={0.01} suffix="°"
            onChange={(value) => setSettings((current) => ({ ...current, [key]: value }))} />
        ))}
      </div>
      <div className={pageControlsClassName} role="group" aria-label={t("Light strength")}>
        {STRENGTHS.map(([key, name]) => (
          <SunSlider key={key} label={t(name)} value={settings[key]} min={0} max={1} step={0.01}
            onChange={(value) => setSettings((current) => ({ ...current, [key]: value }))} />
        ))}
      </div>
      <ExampleCode
        react={{
          code: code,
          label: "PanoSun",
          blurb: t("Copy the current sun position, sizes, and strengths."),
        }}
      />
    </>
  );
}

export function SunPage() {
  const { t } = usePlaygroundLanguage();
  const [scenario, setScenario] = useState<Scenario>("add");
  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section aria-labelledby="sun-heading" className={cn(pageSectionClassName, "mt-8")}>
        <div className={pageHeadingWrapClassName}>
          <h1 id="sun-heading" className={pageHeadingTitleClassName}>{t("Panorama sunlight")}</h1>
        </div>
        <div className={pageControlsClassName}>
          <div className={controlLabelClassName}>{t("Sun examples")}<div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label={t("Sun examples")}
            >
              {(["add", "enhance"] as const).map((option) => (
                <button key={option} className={segmentedButtonClassName} type="button"
                  aria-pressed={scenario === option} onClick={() => setScenario(option)}>
                  {t(SCENARIOS[option].label)}
                </button>
              ))}
            </div>
          </div>
        </div>
        <SunExample scenario={scenario} />
      </section>
      <SiteFooter label="@ericchen1990/pano-view · Panorama sunlight" />
    </main>
  );
}
