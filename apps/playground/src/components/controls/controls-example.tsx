import { useRef, useState } from "react";
import {
  AutoRotate,
  GraphicHotspot,
  Gyro,
  PanoOverlay,
  PanoViewer,
  Sphere,
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
  const { isFullscreen } = usePanoOverlay();
  return (
    <button
      type="button"
      className={`${viewerChromeButtonClassName} absolute right-4 bottom-4 pointer-events-auto`}
      onClick={toggle}
    >
      {isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    </button>
  );
}

export function ControlsExample() {
  const viewer = usePanoViewer();
  const gyro = useRef<GyroHandle>(null);
  const [example, setExample] = useState<"navigation" | "automatic" | "gyro">(
    "navigation",
  );
  const [autoRotate, setAutoRotate] = useState(false);
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [gyroStatus, setGyroStatus] = useState("Detecting sensor support…");
  const [status, setStatus] = useState(
    "Drag to look around. Focus the canvas to use arrow keys; scroll or pinch to zoom.",
  );
  return (
    <>
      <div
        className={pageControlsClassName}
        role="group"
        aria-label="Control example"
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
              setExample(value);
              setAutoRotate(false);
              setGyroEnabled(false);
            }}
          >
            {
              {
                navigation: "Navigation",
                automatic: "Auto rotate",
                gyro: "Gyro",
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
            >
              Reset view
            </button>
            <button
              type="button"
              className={segmentedButtonClassName}
              onClick={() =>
                void viewer
                  .lookTo({ yaw: 90, pitch: 8 }, { fov: 60 })
                  .then(({ status }) => setStatus(`Look north: ${status}`))
              }
            >
              Look north
            </button>
            <button
              type="button"
              className={segmentedButtonClassName}
              onClick={() =>
                void viewer
                  .lookToHotspot("target", { fov: 55 })
                  .then(({ status }) => setStatus(`Look to hotspot: ${status}`))
              }
            >
              Look to hotspot
            </button>
          </>
        ) : null}
        {example === "automatic" ? (
          <button
            type="button"
            className={segmentedButtonClassName}
            aria-pressed={autoRotate}
            onClick={() => setAutoRotate((value) => !value)}
          >
            {autoRotate ? "Stop rotation" : "Start rotation"}
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
              {gyroEnabled ? "Disable gyro" : "Enable gyro"}
            </button>
            <span role="status" className="text-sm">
              {gyroStatus}
            </span>
          </>
        ) : null}
      </div>
      <p role="status" className="px-6 text-sm">
        {status}
      </p>
      <PanoViewer
        ref={viewer.ref}
        aria-label="View controls viewer"
        controls={{ keyboard: true, inertia: true }}
        style={{ height: 540 }}
      >
        <Sphere
          src="/fixtures/panorama/panos/1/sphere.webp"
          previewUrl="preview.webp"
        />
        <GraphicHotspot
          id="target"
          ariaLabel="Navigation target"
          position={{ yaw: -62, pitch: 4 }}
          width={8}
          height={8}
          graphic={{ kind: "circle", fill: "#df6b42" }}
          tooltip="Navigation target"
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
