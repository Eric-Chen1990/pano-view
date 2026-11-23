import { cubeTileJsx } from "../../constants";
import { CodeSnippet } from "../CodeSnippet";
import { ExampleCode } from "../ExampleCode";
import { ExamplePage } from "../ExamplePage";
import { ControlsExample, type ControlExampleKind } from "./controls-example";
import source from "./controls-example.tsx?raw";

const minimalCode = `import { PanoViewer, Tile, GraphicHotspot, usePanoViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function ViewNavigation() {
  const viewer = usePanoViewer();
  return <>
    <button onClick={() => viewer.reset()}>Reset view</button>
    <button onClick={() => void viewer.lookTo({ yaw: 90, pitch: 8 }, { fov: 60 })}>Look north</button>
    <button onClick={() => void viewer.lookToHotspot("target", { fov: 55 })}>Look to hotspot</button>
    <PanoViewer ref={viewer.ref} controls={{ keyboard: true, inertia: true }} style={{ height: 540 }}>
      ${cubeTileJsx()}
      <GraphicHotspot id="target" ariaLabel="Navigation target" position={{ yaw: -62, pitch: 4 }} width={8} height={8} graphic={{ kind: "circle", fill: "#df6b42" }} />
    </PanoViewer>
  </>;
}`;

const automaticCode = `import { useState } from "react";
import { AutoRotate, PanoViewer, Tile } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function AutomaticRotation() {
  const [enabled, setEnabled] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setEnabled((value) => !value)}>
        {enabled ? "Stop rotation" : "Start rotation"}
      </button>
      <PanoViewer style={{ height: 540 }}>
        ${cubeTileJsx(undefined, "        ")}
        <AutoRotate enabled={enabled} speed={18} startDelay={1000} />
      </PanoViewer>
    </>
  );
}`;

const gyroCode = `import { useRef, useState } from "react";
import { Gyro, PanoViewer, Tile, type GyroHandle } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function DeviceOrientation() {
  const gyro = useRef<GyroHandle>(null);
  const [enabled, setEnabled] = useState(false);
  return (
    <>
      <button type="button" onClick={() => {
        if (enabled) setEnabled(false);
        else void gyro.current?.requestPermission().then(setEnabled);
      }}>
        {enabled ? "Disable gyro" : "Enable gyro"}
      </button>
      <PanoViewer style={{ height: 540 }}>
        ${cubeTileJsx(undefined, "        ")}
        <Gyro ref={gyro} enabled={enabled} onDenied={() => setEnabled(false)} />
      </PanoViewer>
    </>
  );
}`;

const examples = {
  navigation: { label: "View navigation", blurb: "Pass the viewer handle to navigation buttons.", code: minimalCode },
  automatic: { label: "AutoRotate", blurb: "Turn automatic rotation on or off from a button.", code: automaticCode },
  gyro: { label: "Gyro", blurb: "Request device motion permission from a button on an HTTPS page.", code: gyroCode },
} satisfies Record<ControlExampleKind, { label: string; blurb: string; code: string }>;

export function ControlsPage() {
  const [example, setExample] = useState<ControlExampleKind>("navigation");
  return (
    <ExamplePage
      title="View controls"
      description="Learn direct input and imperative view navigation, then try automatic rotation or device orientation independently. The fullscreen button stays inside the viewer."
    >
      <ControlsExample example={example} onExampleChange={setExample} />
      <ExampleCode react={examples[example]} />
      <details className="border-t border-line p-5">
        <summary>Complete controls example</summary>
        <CodeSnippet
          label="View controls: complete example"
          blurb="The running example uses reset, lookTo, lookToHotspot and toggleFullscreen. Gyro requests permission from the Enable button; switching topics stops rotation and sensor control."
          code={source}
        />
      </details>
    </ExamplePage>
  );
}
import { useState } from "react";
