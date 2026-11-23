import { PlaygroundVRViewer } from "./PlaygroundVRViewer";
import { message, type LocalizedMessage } from "../../i18n/locale";
import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileProps } from "../../constants";
import { useState, useSyncExternalStore } from "react";
import {
  GraphicHotspot,
  PanoEvents,
  Tile,
  WebVR,
  usePanoViewer,
  type WebVRInteractionMode,
} from "@ericchen1990/pano-view";
import { pageControlsClassName, segmentedButtonClassName } from "../../ui";

export function VRBasicsExample() {
  const { t } = usePlaygroundLanguage();
  const viewer = usePanoViewer();
  const vr = useSyncExternalStore(
    viewer.subscribeVR,
    viewer.getVRState,
    viewer.getVRState,
  );
  const [status, setStatus] = useState<LocalizedMessage>("Detecting VR capabilities…");
  const [denial, setDenial] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<WebVRInteractionMode>("auto");
  const [count, setCount] = useState(0);
  return (
    <>
      <div className={pageControlsClassName}>
        <button
          type="button"
          className={segmentedButtonClassName}
          disabled={!vr.available}
          onClick={() => {
            setDenial(null);
            void (vr.enabled ? viewer.exitVR() : viewer.enterVR()).catch(() =>
              setDenial("VR could not start. Check browser support and permissions, then retry."),
            );
          }}
        >
          {vr.enabled ? t("Exit VR") : t("Enter VR")}
        </button>
        <span role="status" className="text-sm">
          {denial ? t("VR denied: {reason}", { reason: t(denial) }) : t(status)}
        </span>
        <label className="text-sm">{t("Interaction") + " "}<select aria-label={t("VR interaction mode")} value={interactionMode}
          onChange={e => setInteractionMode(e.target.value as WebVRInteractionMode)}>
          <option value="auto">{t("Auto")}</option><option value="gaze">{t("Gaze")}</option><option value="pointer">{t("Pointer")}</option>
        </select></label>
        <span role="status" className="text-sm">{t("Input:") + " "}{t(vr.input?.mode ?? "inactive")} · {t(vr.input?.source ?? "waiting")}</span>
        <span role="status" className="text-sm">{t("Marker activations:") + " "}{count}
        </span>
      </div>
      <PlaygroundVRViewer
        viewer={viewer}
        aria-label={t("VR basics viewer")}
        style={{ height: 560 }}
      >
        <PanoEvents
          onVRAvailable={() => setStatus("VR available")}
          onVRUnavailable={() => setStatus("VR unavailable in this browser")}
          onVRDenied={(error) =>
            setDenial(error instanceof Error ? error.message : "VR permission denied; check permissions and retry")
          }
          onVREnter={(mode) => setStatus(message("Active mode: {mode}", { mode }))}
          onVRExit={() => setStatus("VR session ended")}
          onVRUnknownDevice={() =>
            setStatus("Unknown device — open VR Setup to calibrate")
          }
        />
        <WebVR interactionMode={interactionMode} />
        <Tile {...cubeTileProps()} />
        <GraphicHotspot
          id="gaze-target"
          ariaLabel={t("Activate marker")}
          position={{ yaw: 0, pitch: 0 }}
          graphic={{ kind: "circle", fill: "#df6b42" }}
          width={8}
          height={8}
          tooltip={t("Point and select, or look here in gaze mode")}
          onClick={() => setCount((value) => value + 1)}
        />
      </PlaygroundVRViewer>
    </>
  );
}
