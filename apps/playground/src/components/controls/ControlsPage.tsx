import { useState } from "react";
import { playgroundViewerHeight } from "../../ui";
import { usePlaygroundLanguage } from "../../i18n/language";
import { cubeTileJsx } from "../../constants";
import { CodeSnippet } from "../CodeSnippet";
import { ExampleCode } from "../ExampleCode";
import { ExamplePage } from "../ExamplePage";
import {
  ControlsExample,
  autoRotateAccelerationLimits,
  autoRotateSpeedLimits,
  navigationSpeedPresets,
  type ControlExampleKind,
  type NavigationSpeedPreset,
} from "./controls-example";
import source from "./controls-example.tsx?raw";

function navigationCode(preset: NavigationSpeedPreset, flyOut: boolean) {
  const fields = [`speed: ${preset.speed}`];
  if ("acceleration" in preset) fields.push(`acceleration: ${preset.acceleration}`);
  if ("deceleration" in preset) fields.push(`deceleration: ${preset.deceleration}`);
  if ("maxDuration" in preset) fields.push(`maxDuration: ${preset.maxDuration}`);
  fields.push(`flyOut: ${flyOut}`);
  return `import { PanoViewer, Tile, GraphicHotspot, usePanoViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function ViewNavigation() {
  const viewer = usePanoViewer();
  return <>
    <button onClick={() => viewer.reset()}>Reset view</button>
    <button onClick={() => void viewer.lookTo({ yaw: 90, pitch: 8 }, { fov: 60 })}>Look north</button>
    <button onClick={() => void viewer.lookToHotspot("target", { fov: 55 })}>Look to hotspot</button>
    <PanoViewer
      ref={viewer.ref}
      controls={{ keyboard: true, inertia: true }}
      navigation={{ ${fields.join(", ")} }}
      style={{ height: ${JSON.stringify(playgroundViewerHeight)} }}
    >
      ${cubeTileJsx()}
      <GraphicHotspot id="target" ariaLabel="Navigation target" position={{ yaw: -62, pitch: 4 }} width={8} height={8} graphic={{ kind: "circle", fill: "#df6b42" }} />
    </PanoViewer>
  </>;
}`;
}

function automaticCode(speed: number, acceleration: number, restoreFov: boolean) {
  const fovProp = restoreFov ? "" : " fov={false}";
  return `import { useState } from "react";
import { AutoRotate, PanoViewer, Tile } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function AutomaticRotation() {
  const [enabled, setEnabled] = useState(false);
  const [speed, setSpeed] = useState(${speed});
  const [acceleration, setAcceleration] = useState(${acceleration});
  return (
    <>
      <button type="button" onClick={() => setEnabled((value) => !value)}>
        {enabled ? "Stop rotation" : "Start rotation"}
      </button>
      <label>
        Rotation speed ({speed}°/s)
        <input
          type="range"
          min={${autoRotateSpeedLimits.min}}
          max={${autoRotateSpeedLimits.max}}
          step={${autoRotateSpeedLimits.step}}
          value={speed}
          onChange={(event) => setSpeed(event.currentTarget.valueAsNumber)}
        />
      </label>
      <label>
        Acceleration ({acceleration}°/s²)
        <input
          type="range"
          min={${autoRotateAccelerationLimits.min}}
          max={${autoRotateAccelerationLimits.max}}
          step={${autoRotateAccelerationLimits.step}}
          value={acceleration}
          onChange={(event) => setAcceleration(event.currentTarget.valueAsNumber)}
        />
      </label>
      <PanoViewer style={{ height: ${JSON.stringify(playgroundViewerHeight)} }}>
        ${cubeTileJsx(undefined, "        ")}
        <AutoRotate enabled={enabled} speed={speed} acceleration={acceleration} startDelay={1000}${fovProp} />
      </PanoViewer>
    </>
  );
}`;
}

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
      <PanoViewer style={{ height: ${JSON.stringify(playgroundViewerHeight)} }}>
        ${cubeTileJsx(undefined, "        ")}
        <Gyro ref={gyro} enabled={enabled} onDenied={() => setEnabled(false)} />
      </PanoViewer>
    </>
  );
}`;

const gyroExample = {
  label: "Gyro",
  blurb: "Request device motion permission from a button on an HTTPS page.",
  code: gyroCode,
};

export function ControlsPage() {
  const { t } = usePlaygroundLanguage();
  const [example, setExample] = useState<ControlExampleKind>("navigation");
  const [rotateSpeed, setRotateSpeed] = useState<number>(autoRotateSpeedLimits.initial);
  const [rotateAcceleration, setRotateAcceleration] = useState<number>(
    autoRotateAccelerationLimits.initial,
  );
  const [restoreFov, setRestoreFov] = useState(true);
  const [navigationPreset, setNavigationPreset] = useState<NavigationSpeedPreset>(
    navigationSpeedPresets[1],
  );
  const [flyOut, setFlyOut] = useState(false);
  const reactExample =
    example === "automatic"
      ? {
          label: "AutoRotate",
          blurb:
            "Turn automatic rotation on or off, set speed and acceleration, and choose whether starting restores the initial FOV. Speed is degrees per second at the reference FOV; negative values rotate left.",
          code: automaticCode(rotateSpeed, rotateAcceleration, restoreFov),
        }
      : example === "navigation"
        ? {
            label: "View navigation",
            blurb:
              "Pass the viewer handle to navigation buttons. Speed and fly-out use the viewer navigation defaults.",
            code: navigationCode(navigationPreset, flyOut),
          }
        : gyroExample;
  return (
    <ExamplePage
      eyebrow={t("Start")}
      title={t("View controls")}
      description={t("Learn direct input and imperative view navigation, then try automatic rotation or device orientation independently. The fullscreen button stays inside the viewer.")}
    >
      <ControlsExample
        example={example}
        onExampleChange={setExample}
        rotateSpeed={rotateSpeed}
        onRotateSpeedChange={setRotateSpeed}
        rotateAcceleration={rotateAcceleration}
        onRotateAccelerationChange={setRotateAcceleration}
        restoreFov={restoreFov}
        onRestoreFovChange={setRestoreFov}
        navigationPreset={navigationPreset}
        onNavigationPresetChange={setNavigationPreset}
        flyOut={flyOut}
        onFlyOutChange={setFlyOut}
      />
      <ExampleCode react={reactExample} />
      <details className="border-t border-line p-5">
        <summary>{t("Complete controls example")}</summary>
        <CodeSnippet
          label={t("View controls: complete example")}
          blurb={t("The running example uses reset, lookTo, lookToHotspot and toggleFullscreen. Gyro requests permission from the Enable button; switching topics stops rotation and sensor control.")}
          code={source}
        />
      </details>
    </ExamplePage>
  );
}
