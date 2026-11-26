import { message, type LocalizedMessage } from "../../i18n/locale";
import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileProps } from "../../constants";
import { useRef, useState } from "react";
import {
  AutoRotate,
  GraphicHotspot,
  Gyro,
  PanoOverlay,
  PanoViewer,
  Tile,
  usePanoOverlay,
  usePanoViewer,
  type GyroHandle,
} from "@ericchen1990/pano-view";
import { cn } from "../../cn";
import {
  controlInputClassName,
  controlLabelClassName,
  pageControlsClassName,
  playgroundViewerHeight,
  segmentedButtonActiveClassName,
  segmentedButtonClassName,
  viewerChromeButtonClassName,
} from "../../ui";

/** Degrees per second. Negative values rotate left. */
export const autoRotateSpeedLimits = {
  min: -90,
  max: 90,
  step: 1,
  initial: 18,
} as const;

export const navigationSpeedPresets = [
  {
    id: "slow",
    label: "Slow",
    speed: 0.4,
    acceleration: 0.5,
    deceleration: 0.32,
    maxDuration: 8000,
  },
  { id: "default", label: "Default", speed: 0.8 },
  { id: "fast", label: "Fast", speed: 3, acceleration: 6, deceleration: 4 },
] as const;

export type NavigationSpeedPresetId = (typeof navigationSpeedPresets)[number]["id"];
export type NavigationSpeedPreset = (typeof navigationSpeedPresets)[number];

function FullscreenButton({ toggle }: { toggle: () => void }) {
  const { t } = usePlaygroundLanguage();
  const { isFullscreen } = usePanoOverlay();
  return (
    <button
      type="button"
      className={`${viewerChromeButtonClassName} absolute right-4 bottom-4 pointer-events-auto`}
      onClick={toggle}
    >
      {isFullscreen ? t("Exit fullscreen") : t("Enter fullscreen")}
    </button>
  );
}

export type ControlExampleKind = "navigation" | "automatic" | "gyro";

export function ControlsExample({
  example,
  onExampleChange,
  rotateSpeed,
  onRotateSpeedChange,
  navigationPreset,
  onNavigationPresetChange,
  flyOut,
  onFlyOutChange,
}: {
  example: ControlExampleKind;
  onExampleChange: (example: ControlExampleKind) => void;
  rotateSpeed: number;
  onRotateSpeedChange: (speed: number) => void;
  navigationPreset: NavigationSpeedPreset;
  onNavigationPresetChange: (preset: NavigationSpeedPreset) => void;
  flyOut: boolean;
  onFlyOutChange: (flyOut: boolean) => void;
}) {
  const { t } = usePlaygroundLanguage();
  const viewer = usePanoViewer();
  const gyro = useRef<GyroHandle>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroStatus, setGyroStatus] = useState("Detecting sensor support…");
  const [status, setStatus] = useState<LocalizedMessage>(
    "Drag to look around. Focus the canvas to use arrow keys; scroll or pinch to zoom.",
  );

  const reportNavigation = (
    label: "Look north" | "Look to hotspot",
    startedAt: number,
  ) =>
    (result: { status: string }) => {
      const elapsedMs = Math.round(performance.now() - startedAt);
      setStatus(
        message("{label}: {status} ({duration} ms)", {
          label: t(label),
          status: result.status,
          duration: elapsedMs,
        }),
      );
    };

  return (
    <>
      <div className={pageControlsClassName}>
        <div className={controlLabelClassName}>{t("Control example")}<div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={t("Control example")}
          >
            {(["navigation", "automatic", "gyro"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={example === value}
                className={cn(
                  segmentedButtonClassName,
                  example === value && segmentedButtonActiveClassName,
                )}
                onClick={() => {
                  onExampleChange(value);
                  setAutoRotate(false);
                  setGyroEnabled(false);
                }}
              >
                {
                  {
                    navigation: t("Navigation"),
                    automatic: t("Auto rotate"),
                    gyro: t("Gyro"),
                  }[value]
                }
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={pageControlsClassName}>
        {example === "navigation" ? (
          <>
            <button
              type="button"
              className={segmentedButtonClassName}
              onClick={() => {
                viewer.reset();
                setStatus("View reset");
              }}
            >{t("Reset view")}</button>
            <button
              type="button"
              className={segmentedButtonClassName}
              onClick={() => {
                const startedAt = performance.now();
                void viewer
                  .lookTo({ yaw: 90, pitch: 8 }, { fov: 60 })
                  .then(reportNavigation("Look north", startedAt));
              }}
            >{t("Look north")}</button>
            <button
              type="button"
              className={segmentedButtonClassName}
              onClick={() => {
                const startedAt = performance.now();
                void viewer
                  .lookToHotspot("target", { fov: 55 })
                  .then(reportNavigation("Look to hotspot", startedAt));
              }}
            >{t("Look to hotspot")}</button>
            <div className={controlLabelClassName}>
              {t("Navigation speed")}
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label={t("Navigation speed")}
              >
                {navigationSpeedPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={navigationPreset.id === preset.id}
                    className={cn(
                      segmentedButtonClassName,
                      navigationPreset.id === preset.id &&
                        segmentedButtonActiveClassName,
                    )}
                    onClick={() => onNavigationPresetChange(preset)}
                  >
                    {t(preset.label)}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              className={cn(
                segmentedButtonClassName,
                flyOut && segmentedButtonActiveClassName,
              )}
              aria-pressed={flyOut}
              onClick={() => onFlyOutChange(!flyOut)}
            >
              {t("Fly out on long turns")}
            </button>
          </>
        ) : null}
        {example === "automatic" ? (
          <>
            <button
              type="button"
              className={segmentedButtonClassName}
              aria-pressed={autoRotate}
              onClick={() => setAutoRotate((value) => !value)}
            >
              {autoRotate ? t("Stop rotation") : t("Start rotation")}
            </button>
            <label className={controlLabelClassName}>
              <span>
                {t("Rotation speed")}{" "}
                <span aria-hidden="true" className="font-mono tracking-normal normal-case">
                  {rotateSpeed}°/s
                </span>
              </span>
              <input
                type="range"
                min={autoRotateSpeedLimits.min}
                max={autoRotateSpeedLimits.max}
                step={autoRotateSpeedLimits.step}
                value={rotateSpeed}
                className={cn(
                  controlInputClassName,
                  "w-44 p-0 focus-visible:outline-2 focus-visible:outline-[#75cbd3]",
                )}
                onChange={(event) => {
                  const speed = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(speed)) onRotateSpeedChange(speed);
                }}
              />
            </label>
          </>
        ) : null}
        {example === "gyro" ? (
          <>
            <button
              type="button"
              className={segmentedButtonClassName}
              aria-pressed={gyroEnabled}
              onClick={() => {
                if (gyroEnabled) {
                  setGyroEnabled(false);
                  return;
                }
                if (!window.isSecureContext) {
                  setGyroStatus("Gyro requires HTTPS");
                  return;
                }
                void gyro.current?.requestPermission().then((granted) => {
                  setGyroEnabled(granted);
                  setGyroStatus(
                    granted
                      ? "Permission granted; move your device"
                      : "Sensor unavailable or permission denied",
                  );
                });
              }}
            >
              {gyroEnabled ? t("Disable gyro") : t("Enable gyro")}
            </button>
            <span role="status" className="text-sm">
              {t(gyroStatus)}
            </span>
          </>
        ) : null}
      </div>
      <p role="status" className="px-6 text-sm">
        {t(status)}
      </p>
      <PanoViewer
        ref={viewer.ref}
        aria-label={t("View controls viewer")}
        controls={{ keyboard: true, inertia: true }}
        navigation={{
          speed: navigationPreset.speed,
          ...("acceleration" in navigationPreset
            ? { acceleration: navigationPreset.acceleration }
            : {}),
          ...("deceleration" in navigationPreset
            ? { deceleration: navigationPreset.deceleration }
            : {}),
          ...("maxDuration" in navigationPreset
            ? { maxDuration: navigationPreset.maxDuration }
            : {}),
          flyOut,
        }}
        style={{ height: playgroundViewerHeight }}
      >
        <Tile {...cubeTileProps()} />
        <GraphicHotspot
          id="target"
          ariaLabel={t("Navigation target")}
          position={{ yaw: -62, pitch: 4 }}
          width={8}
          height={8}
          graphic={{ kind: "circle", fill: "#df6b42" }}
          tooltip={t("Navigation target")}
        />
        <AutoRotate enabled={autoRotate} speed={rotateSpeed} startDelay={1000} />
        <Gyro
          ref={gyro}
          enabled={gyroEnabled}
          onAvailable={() =>
            setGyroStatus("Sensor available; enable to request permission")
          }
          onUnavailable={() =>
            setGyroStatus("Sensor unavailable on this browser or device")
          }
          onDenied={() => {
            setGyroEnabled(false);
            setGyroStatus("Sensor permission denied");
          }}
        />
        <PanoOverlay>
          <FullscreenButton toggle={() => void viewer.toggleFullscreen()} />
        </PanoOverlay>
      </PanoViewer>
    </>
  );
}
