import { useState, useSyncExternalStore } from "react";
import {
  GraphicHotspot,
  PanoEvents,
  PanoViewer,
  Sphere,
  WebVR,
  usePanoViewer,
} from "@ericchen1990/pano-view";
import { pageControlsClassName, segmentedButtonClassName } from "../../ui";

export function VRBasicsExample() {
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(
    viewer.subscribeVR,
    viewer.getVRState,
    viewer.getVRState,
  );
  const [status, setStatus] = useState("Detecting VR capabilities…");
  const [count, setCount] = useState(0);
  return (
    <>
      <div className={pageControlsClassName}>
        <button
          type="button"
          className={segmentedButtonClassName}
          disabled={!vr.available}
          onClick={() =>
            void (vr.enabled ? viewer.exitVR() : viewer.enterVR()).catch(() =>
              setStatus(
                "VR could not start. Check browser support and permissions, then retry.",
              ),
            )
          }
        >
          {vr.enabled ? "Exit VR" : "Enter VR"}
        </button>
        <span role="status" className="text-sm">
          {status}
        </span>
        <span role="status" className="text-sm">
          Marker activations: {count}
        </span>
      </div>
      <PanoViewer
        ref={viewer.ref}
        aria-label="VR basics viewer"
        style={{ height: 560 }}
      >
        <PanoEvents
          onVRAvailable={() => setStatus("VR available")}
          onVRUnavailable={() => setStatus("VR unavailable in this browser")}
          onVRDenied={() =>
            setStatus("VR permission denied; check permissions and retry")
          }
          onVREnter={(mode) => setStatus(`Active mode: ${mode}`)}
          onVRExit={() => setStatus("VR session ended")}
          onVRUnknownDevice={() =>
            setStatus("Unknown device — open VR Setup to calibrate")
          }
        />
        <WebVR />
        <Sphere
          src="/fixtures/panorama/panos/1/sphere.webp"
          previewUrl="preview.webp"
        />
        <GraphicHotspot
          id="gaze-target"
          ariaLabel="Activate marker"
          position={{ yaw: 0, pitch: 0 }}
          graphic={{ kind: "circle", fill: "#df6b42" }}
          width={8}
          height={8}
          tooltip="Look here to activate"
          onClick={() => setCount((value) => value + 1)}
        />
      </PanoViewer>
    </>
  );
}
