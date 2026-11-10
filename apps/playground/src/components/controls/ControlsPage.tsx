import { CodeSnippet } from "../CodeSnippet";
import { ExamplePage } from "../ExamplePage";
import { ControlsExample } from "./controls-example";
import source from "./controls-example.tsx?raw";

const minimalCode = `import { PanoViewer, Sphere, GraphicHotspot, usePanoViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function ViewNavigation() {
  const viewer = usePanoViewer();
  return <>
    <button onClick={() => viewer.reset()}>Reset view</button>
    <button onClick={() => void viewer.lookTo({ yaw: 90, pitch: 8 }, { fov: 60 })}>Look north</button>
    <button onClick={() => void viewer.lookToHotspot("target", { fov: 55 })}>Look to hotspot</button>
    <PanoViewer ref={viewer.ref} controls={{ keyboard: true, inertia: true }} style={{ height: 540 }}>
      <Sphere src="/fixtures/panorama/panos/1/sphere.webp" previewUrl="preview.webp" />
      <GraphicHotspot id="target" ariaLabel="Navigation target" position={{ yaw: -62, pitch: 4 }} width={8} height={8} graphic={{ kind: "circle", fill: "#df6b42" }} />
    </PanoViewer>
  </>;
}`;

export function ControlsPage() {
  return (
    <ExamplePage
      title="View controls"
      description="Learn direct input and imperative view navigation, then try automatic rotation or device orientation independently. The fullscreen button stays inside the viewer."
    >
      <ControlsExample />
      <CodeSnippet
        label="View navigation: minimal setup"
        blurb="Direct input and imperative navigation share one viewer handle. Open the complete example for fullscreen, automatic rotation and permission-based Gyro controls."
        code={minimalCode}
      />
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
