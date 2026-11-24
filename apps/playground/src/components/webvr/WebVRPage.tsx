import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileJsx } from "../../constants";
import { ExamplePage } from "../ExamplePage";
import { CodeSnippet } from "../CodeSnippet";
import { ExampleCode } from "../ExampleCode";
import { VRBasicsExample } from "./vr-basics-example";
import source from "./vr-basics-example.tsx?raw";

const minimalCode = `import { PanoViewer, Tile, GraphicHotspot, WebVR, usePanoViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function VRPanorama() {
  const viewer = usePanoViewer();
  return <>
    <button onClick={() => void viewer.enterVR()}>Enter VR</button>
    <PanoViewer ref={viewer.ref} style={{ height: 560 }}>
      <WebVR />
      ${cubeTileJsx()}
      <GraphicHotspot id="gaze-target" ariaLabel="Activate marker" position={{ yaw: 0, pitch: 0 }} width={8} height={8} graphic={{ kind: "circle", fill: "#df6b42" }} onClick={() => console.log("Marker activated")} />
    </PanoViewer>
  </>;
}`;

export function WebVRPage() {
  const { t } = usePlaygroundLanguage();
  return (
    <ExamplePage
      eyebrow={t("Immersive")}
      title={t("VR basics")}
      description={t("Enter VR, then look at the orange marker until the reticle fills. Supported headsets use WebXR; phones use stereoscopic gyro viewing; desktop browsers provide a simulated preview. Exit and Setup controls appear within the session.")}
    >
      <VRBasicsExample />
      <p className="px-6 text-sm text-muted-2">{t("In desktop preview, right-click releases the pointer. Left-click locks it again; gaze pauses while unlocked. Phones need HTTPS and sensor permission. Use a supported physical device to verify its immersive mode.")}</p>
      <ExampleCode
        react={{
          label: t("VR basics: minimal setup"),
          blurb: t("WebVR supplies immersive presentation and gaze activation. The complete example adds capability and permission status, an activation counter, and host-owned entry/exit controls."),
          code: minimalCode,
        }}
      />
      <details className="border-t border-line p-5">
        <summary>{t("Complete VR example")}</summary>
        <CodeSnippet
          label={t("VR basics: complete example")}
          blurb={t("Mount WebVR beside a source and hotspots. usePanoViewer controls entry/exit; PanoEvents reports support, permission and session state.")}
          code={source}
        />
      </details>
    </ExamplePage>
  );
}
