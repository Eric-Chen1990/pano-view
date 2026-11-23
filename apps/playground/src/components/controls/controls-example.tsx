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
  pageControlsClassName,
  segmentedButtonClassName,
  segmentedButtonActiveClassName,
  viewerChromeButtonClassName,
} from "../../ui";

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

export function ControlsExample({ example, onExampleChange }: {
  example: ControlExampleKind;
  onExampleChange: (example: ControlExampleKind) => void;
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
  return (
    <>
      <div
        className={pageControlsClassName}
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
              onClick={() =>
                void viewer
                  .lookTo({ yaw: 90, pitch: 8 }, { fov: 60 })
                  .then(({ status }) => setStatus(message("Look north: {status}", { status })))
              }
            >{t("Look north")}</button>
            <button
              type="button"
              className={segmentedButtonClassName}
              onClick={() =>
                void viewer
                  .lookToHotspot("target", { fov: 55 })
                  .then(({ status }) => setStatus(message("Look to hotspot: {status}", { status })))
              }
            >{t("Look to hotspot")}</button>
          </>
        ) : null}
        {example === "automatic" ? (
          <button
            type="button"
            className={segmentedButtonClassName}
            aria-pressed={autoRotate}
            onClick={() => setAutoRotate((value) => !value)}
          >
            {autoRotate ? t("Stop rotation") : t("Start rotation")}
          </button>
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
        style={{ height: 540 }}
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
        <AutoRotate enabled={autoRotate} speed={18} startDelay={1000} />
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
