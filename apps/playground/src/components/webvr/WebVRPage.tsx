import { useState } from "react";
import type { WebVRInteractionMode } from "@ericchen1990/pano-view";
import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileJsx } from "../../constants";
import { playgroundViewerHeight } from "../../ui";
import { ExamplePage } from "../ExamplePage";
import { CodeSnippet } from "../CodeSnippet";
import { ExampleCode } from "../ExampleCode";
import { VRBasicsExample, VR_BASICS_MENU } from "./vr-basics-example";
import source from "./vr-basics-example.tsx?raw";

function minimalCode(interactionMode: WebVRInteractionMode, menu: { title: string; marker: string; reset: string }) {
  return `import { useState } from "react";
import { PanoViewer, Tile, GraphicHotspot, WebVR, WebVRMenu, WebVRMenuLabel, WebVRMenuButton, usePanoViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function VRPanorama() {
  const viewer = usePanoViewer();
  const [showMarker, setShowMarker] = useState(true);
  const [count, setCount] = useState(0);
  return <>
    <button onClick={() => void viewer.enterVR()}>Enter VR</button>
    <PanoViewer ref={viewer.ref} style={{ height: ${JSON.stringify(playgroundViewerHeight)} }}>
      <WebVR interactionMode={${JSON.stringify(interactionMode)}} />
      ${cubeTileJsx()}
      <WebVRMenu aria-label={${JSON.stringify(menu.title)}}>
        <WebVRMenuLabel>{${JSON.stringify(menu.title)}}</WebVRMenuLabel>
        <WebVRMenuButton pressed={showMarker} onClick={() => setShowMarker(visible => !visible)}>
          {${JSON.stringify(menu.marker)}}
        </WebVRMenuButton>
        <WebVRMenuButton disabled={count === 0} onClick={() => setCount(0)}>
          {${JSON.stringify(menu.reset)}}
        </WebVRMenuButton>
      </WebVRMenu>
      {showMarker && <GraphicHotspot id="gaze-target" ariaLabel="Activate marker" position={{ yaw: 0, pitch: 0 }} width={8} height={8} graphic={{ kind: "circle", fill: "#df6b42" }} onClick={() => setCount(value => value + 1)} />}
    </PanoViewer>
  </>;
}`;
}

export function WebVRPage() {
  const { t } = usePlaygroundLanguage();
  const [interactionMode, setInteractionMode] = useState<WebVRInteractionMode>("auto");
  return (
    <ExamplePage
      eyebrow={t("Immersive")}
      title={t("VR basics")}
      description={t("Enter VR, then look at the orange marker until the reticle fills. Supported headsets use WebXR; phones use stereoscopic gyro viewing; desktop browsers provide a simulated preview. Exit and Setup controls appear within the session.")}
    >
      <VRBasicsExample interactionMode={interactionMode} onInteractionModeChange={setInteractionMode} />
      <p className="px-6 text-sm text-muted-2">{t("Press a controller grip to open or close the menu. In gaze mode, quickly look down to open it and look up to close it.")}</p>
      <p className="px-6 text-sm text-muted-2">{t("In desktop preview, right-click releases the pointer. Left-click locks it again; gaze pauses while unlocked. Phones need HTTPS and sensor permission. Use a supported physical device to verify its immersive mode.")}</p>
      <ExampleCode
        react={{
          label: t("VR basics: minimal setup"),
          blurb: t("WebVR supplies immersive presentation and gaze activation. The complete example adds capability and permission status, an activation counter, and host-owned entry/exit controls."),
          code: minimalCode(interactionMode, {
            title: t(VR_BASICS_MENU.title), marker: t(VR_BASICS_MENU.marker), reset: t(VR_BASICS_MENU.reset),
          }),
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
