import {
  GraphicHotspot,
  PanoEvents,
  PanoViewer,
  Sphere,
  WebVR,
  type WebVRHandle,
} from "@ericchen1990/pano-view";
import { useRef, useState } from "react";
import {
  eyebrowClassName,
  pageHeadingStatusClassName,
  pageHeadingTitleClassName,
  pageHeadingWrapClassName,
  pageSectionClassName,
  segmentedButtonClassName,
  shellClassName,
} from "../../ui";
import { SiteHeader } from "../SiteHeader";

const GAZE_TARGETS = [
  {
    id: "north",
    label: "North",
    position: { yaw: 0, pitch: 2 },
    rotation: 90,
    graphic: {
      kind: "arrow" as const,
      fill: "#df6b42",
      stroke: "#f5fbfc",
      strokeWidth: 10,
    },
  },
  {
    id: "east",
    label: "East lookout",
    position: { yaw: 38, pitch: -2 },
    rotation: 0,
    graphic: {
      kind: "circle" as const,
      fill: "#75cbd3",
      stroke: "#f5fbfc",
      strokeWidth: 10,
    },
  },
  {
    id: "west",
    label: "West door",
    position: { yaw: -42, pitch: -6 },
    rotation: 0,
    graphic: {
      kind: "diamond" as const,
      fill: "#f4c542",
      stroke: "#f5fbfc",
      strokeWidth: 10,
    },
  },
  {
    id: "up",
    label: "Upper terrace",
    position: { yaw: 18, pitch: 16 },
    rotation: 0,
    graphic: {
      kind: "star" as const,
      fill: "#f5fbfc",
      stroke: "#df6b42",
      strokeWidth: 8,
    },
  },
];

export function WebVRPage() {
  const webVRRef = useRef<WebVRHandle>(null);
  const [status, setStatus] = useState("Detecting VR capabilities…");
  const [lastClick, setLastClick] = useState("Look at a hotspot in VR to click");

  return (
    <main className={shellClassName}>
      <SiteHeader />
      <section className={`${pageSectionClassName} mt-6`}>
        <div className={pageHeadingWrapClassName}>
          <div>
            <p className={eyebrowClassName}>Immersive viewer</p>
            <h1 className={pageHeadingTitleClassName}>WebVR</h1>
          </div>
          <p className={pageHeadingStatusClassName}>
            WebXR is preferred on headsets. Phones fall back to stereoscopic
            gyro viewing, while desktop browsers can preview simulated VR. In
            VR, look at a hotspot until the reticle ring fills to click it.
          </p>
        </div>
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <button
            className={segmentedButtonClassName}
            onClick={() => void webVRRef.current?.toggleVR()}
            type="button"
          >
            Toggle VR
          </button>
          <span className="font-mono text-xs text-muted-2">{status}</span>
          <span className="font-mono text-xs text-muted-2">{lastClick}</span>
        </div>
        <div className="h-[min(68vh,680px)] min-h-105">
          <PanoViewer contextMenu={false} style={{ height: "100%" }}>
            <PanoEvents
              onVRAvailable={() => setStatus("VR is available")}
              onVRDenied={(error) =>
                setStatus(
                  error instanceof Error
                    ? `VR denied: ${error.message}`
                    : "VR permission was denied",
                )
              }
              onVREnter={(mode) => setStatus(`Active mode: ${mode}`)}
              onVRExit={() => setStatus("VR session ended")}
              onVRUnavailable={() => setStatus("VR is unavailable")}
              onVRUnknownDevice={() =>
                setStatus("Unknown screen size — open VR Setup to calibrate")
              }
            />
            <WebVR
              ref={webVRRef}
              chrome={{
                accent: "#75cbd3",
                background: "rgba(7, 19, 22, 0.82)",
              }}
            />
            {GAZE_TARGETS.map((target) => (
              <GraphicHotspot
                ariaLabel={target.label}
                graphic={target.graphic}
                height={10}
                id={target.id}
                key={target.id}
                onClick={() => setLastClick(`Clicked: ${target.label}`)}
                position={target.position}
                rotation={target.rotation}
                tooltip={target.label}
                tooltipTrigger="hover"
                width={10}
              />
            ))}
            <Sphere src="/fixtures/panorama/panos/1.jpg" />
          </PanoViewer>
        </div>
      </section>
    </main>
  );
}
