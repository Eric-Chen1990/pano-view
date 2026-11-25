import { usePlaygroundLanguage } from "../../i18n/language";
import {
  PANO_OVERLAY_ALIGNS,
  PanoCompare,
  PanoOverlay,
  PanoPerformanceMonitor,
  PanoViewer,
  Tile,
  type PanoOverlayAlign,
} from "@ericchen1990/pano-view";
import { useMemo, useState } from "react";
import { cubeTileProps } from "../../constants";
import {
  controlInputClassName,
  controlLabelClassName,
  pageControlsClassName,
  playgroundViewerHeight,
  segmentedButtonClassName,
} from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { ExamplePage } from "../ExamplePage";

const tile = cubeTileProps(1);
const compareAssets = "/fixtures/compare/v1";

function comparePanorama(name: string) {
  return {
    type: "tile" as const,
    baseUrl: `${compareAssets}/${name}.tiles/`,
    multires: "512,640,1152",
    previewUrl: "preview.jpg",
    urlTemplate: "%s/l%l/%0v/l%l_%s_%0v_%0h.jpg",
  };
}

const compareScenes = [
  {
    id: "pair-1",
    before: comparePanorama("a01"),
    after: comparePanorama("y01"),
  },
];

function performanceExample({
  renderer,
  frameloop,
  align,
  showGraph,
  littlePlanet,
  compare,
}: {
  renderer: "auto" | "webgl";
  frameloop: "always" | "demand";
  align: PanoOverlayAlign;
  showGraph: boolean;
  littlePlanet: boolean;
  compare: boolean;
}) {
  const introProp = littlePlanet ? "\n      littlePlanetIntro" : "";
  const graphProp = showGraph ? "" : "\n          showGraph={false}";
  const scene = compare
    ? `      <PanoCompare
        scenes={${JSON.stringify(compareScenes)}}
        activeSceneId="pair-1"
        presentation="wipe"
        layout="left-right"
      />`
    : `      <Tile
        baseUrl=${JSON.stringify(tile.baseUrl)}
        multires={${JSON.stringify(tile.multires)}}
        previewUrl=${JSON.stringify(tile.previewUrl)}
        urlTemplate=${JSON.stringify(tile.urlTemplate)}
        previewFaceOrder={${JSON.stringify(tile.previewFaceOrder)}}
      />`;
  const imports = compare
    ? "PanoCompare, PanoOverlay, PanoPerformanceMonitor, PanoViewer"
    : "PanoOverlay, PanoPerformanceMonitor, PanoViewer, Tile";
  return `import { ${imports} } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

export function PerformanceOverlay() {
  return (
    <PanoViewer
      renderer="${renderer}"
      frameloop="${frameloop}"${introProp}
      style={{ height: ${JSON.stringify(playgroundViewerHeight)} }}
    >
${scene}
      <PanoOverlay>
        <PanoPerformanceMonitor
          anchor={{ align: "${align}" }}${graphProp}
        />
      </PanoOverlay>
    </PanoViewer>
  );
}`;
}

export function PerformancePage() {
  const { t } = usePlaygroundLanguage();
  const [renderer, setRenderer] = useState<"auto" | "webgl">("auto");
  const [frameloop, setFrameloop] = useState<"always" | "demand">("always");
  const [align, setAlign] = useState<PanoOverlayAlign>("top-left");
  const [showGraph, setShowGraph] = useState(true);
  const [littlePlanet, setLittlePlanet] = useState(false);
  const [compare, setCompare] = useState(false);

  const code = useMemo(
    () =>
      performanceExample({
        renderer,
        frameloop,
        align,
        showGraph,
        littlePlanet,
        compare,
      }),
    [align, compare, frameloop, littlePlanet, renderer, showGraph],
  );

  return (
    <ExamplePage
      eyebrow={t("Start")}
      title={t("Performance monitor")}
      description={t(
        "Watch FPS, frame time, draw calls, and the active renderer backend. Switch frameloop or multi-pass modes to see how the counters respond.",
      )}
    >
      <div className={pageControlsClassName}>
        <div className={controlLabelClassName}>
          {t("Renderer")}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Renderer")}>
            {(["auto", "webgl"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={segmentedButtonClassName}
                aria-pressed={renderer === value}
                onClick={() => setRenderer(value)}
              >
                {value === "auto" ? t("Auto") : "WebGL"}
              </button>
            ))}
          </div>
        </div>
        <div className={controlLabelClassName}>
          {t("Frame loop")}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Frame loop")}>
            {(["always", "demand"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={segmentedButtonClassName}
                aria-pressed={frameloop === value}
                onClick={() => setFrameloop(value)}
              >
                {value === "always" ? t("Always render") : t("On demand")}
              </button>
            ))}
          </div>
        </div>
        <label className={controlLabelClassName}>
          {t("Anchor")}
          <select
            className={controlInputClassName}
            value={align}
            onChange={(event) => setAlign(event.currentTarget.value as PanoOverlayAlign)}
          >
            {PANO_OVERLAY_ALIGNS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className={`${controlLabelClassName} flex-row items-center gap-2`}>
          <input
            type="checkbox"
            checked={showGraph}
            onChange={(event) => setShowGraph(event.currentTarget.checked)}
          />
          {t("Show graph")}
        </label>
        <label className={`${controlLabelClassName} flex-row items-center gap-2`}>
          <input
            type="checkbox"
            checked={littlePlanet}
            onChange={(event) => setLittlePlanet(event.currentTarget.checked)}
          />
          {t("Little Planet intro")}
        </label>
        <label className={`${controlLabelClassName} flex-row items-center gap-2`}>
          <input
            type="checkbox"
            checked={compare}
            onChange={(event) => setCompare(event.currentTarget.checked)}
          />
          {t("Compare multi-pass")}
        </label>
      </div>

      <PanoViewer
        key={`${renderer}-${compare}-${littlePlanet}`}
        renderer={renderer}
        frameloop={frameloop}
        littlePlanetIntro={littlePlanet || undefined}
        style={{ height: playgroundViewerHeight }}
        className="mt-4 overflow-hidden rounded-lg border border-line"
      >
        {compare ? (
          <PanoCompare
            scenes={compareScenes}
            activeSceneId="pair-1"
            presentation="wipe"
            layout="left-right"
          />
        ) : (
          <Tile {...tile} />
        )}
        <PanoOverlay>
          <PanoPerformanceMonitor
            anchor={{ align }}
            showGraph={showGraph}
          />
        </PanoOverlay>
      </PanoViewer>

      <ExampleCode
        react={{
          label: t("Mount the performance monitor"),
          blurb: t(
            "Place PanoPerformanceMonitor inside PanoOverlay. The snippet follows the controls above.",
          ),
          code,
        }}
      />
    </ExamplePage>
  );
}
