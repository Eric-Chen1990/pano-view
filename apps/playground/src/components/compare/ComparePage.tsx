import { message, type LocalizedMessage } from "../../i18n/locale";
import { usePlaygroundLanguage } from "../../i18n/language";
import {
  GraphicHotspot,
  PanoCompare,
  PanoOverlay,
  PanoSceneMenu,
  PanoViewer,
  usePanoViewer,
  type PanoCompareLayout,
  type PanoComparePresentation,
  type PanoCompareScene,
  type PanoCompareSource,
} from "@ericchen1990/pano-view";
import { PanoDialog } from "@ericchen1990/pano-view/ui";
import { useState } from "react";
import { controlInputClassName, controlLabelClassName, pageControlsClassName, playgroundViewerHeight, segmentedButtonClassName } from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { ExamplePage } from "../ExamplePage";

const assets = "/fixtures/compare/v1";
const viewLimits = { fov: { min: 35, max: 90 } };

function panorama(name: string): PanoCompareSource {
  return {
    type: "tile",
    baseUrl: `${assets}/${name}.tiles/`,
    multires: "512,640,1152",
    previewUrl: "preview.jpg",
    urlTemplate: "%s/l%l/%0v/l%l_%s_%0v_%0h.jpg",
  };
}

const scenes: PanoCompareScene[] = [
  { id: "pair-1", before: panorama("a01"), after: panorama("y01") },
  { id: "pair-2", before: panorama("a02"), after: panorama("y02"), initialView: { yaw: 0, pitch: 0 } },
  // The y03 fixture has the legacy krpano prealign rotation baked into its tiles.
  { id: "pair-3", before: panorama("a03"), after: panorama("y03-aligned") },
];
const menu = scenes.map((scene, index) => ({
  id: scene.id,
  title: `Panorama pair ${index + 1}`,
  thumbnailUrl: `${assets}/a0${index + 1}.tiles/thumb.jpg`,
}));

export function ComparePage() {
  const { t } = usePlaygroundLanguage();
  const viewer = usePanoViewer();
  const [layout, setLayout] = useState<PanoCompareLayout>("left-right");
  const [presentation, setPresentation] = useState<PanoComparePresentation>("wipe");
  const [showDividerHandle, setShowDividerHandle] = useState(false);
  const [activeId, setActiveId] = useState(scenes[0]!.id);
  const [error, setError] = useState<LocalizedMessage>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const selectScene = (id: string) => {
    setError("");
    setActiveId(id);
  };

  const snippet = `import { PanoCompare, PanoViewer, type PanoCompareScene } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

const scenes: PanoCompareScene[] = ${JSON.stringify(scenes, null, 2)};

export function PanoramaComparison() {
  return (
    <PanoViewer viewLimits={{ fov: { min: 35, max: 90 } }} style={{ height: ${JSON.stringify(playgroundViewerHeight)} }}>
      <PanoCompare
        scenes={scenes}
        activeSceneId="${activeId}"
        presentation="${presentation}"
        layout="${layout}"${showDividerHandle ? `
        showDividerHandle` : ""}
      />
    </PanoViewer>
  );
}`;

  return (
    <ExamplePage
      eyebrow={t("Scenes")}
      title={t("Panorama comparison")}
      description={t("Drag either image to look around. Choose how the two panoramas share the viewer.")}
    >
      <div className={pageControlsClassName}>
        <label className={controlLabelClassName}>{t("Display")}<select className={controlInputClassName} value={presentation}
            onChange={(event) => setPresentation(event.target.value as PanoComparePresentation)}>
            <option value="wipe">{t("Wipe")}</option>
            <option value="split-view">{t("Split view")}</option>
          </select>
        </label>
        <label className={controlLabelClassName}>{t("Layout")}<select className={controlInputClassName} value={layout}
            onChange={(event) => setLayout(event.target.value as PanoCompareLayout)}>
            <option value="left-right">{t("Left and right")}</option>
            <option value="top-bottom">{t("Top and bottom")}</option>
          </select>
        </label>
        <label className={`${controlLabelClassName} flex-row items-center gap-2`}>
          <input
            type="checkbox"
            checked={showDividerHandle}
            onChange={(event) => setShowDividerHandle(event.currentTarget.checked)}
          />
          {t("Show divider handle")}
        </label>
        <button className={segmentedButtonClassName} type="button" onClick={() => viewer.reset()}>{t("Reset view")}</button>
        <button className={segmentedButtonClassName} type="button" onClick={() => void viewer.toggleFullscreen()}>{t("Fullscreen")}</button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-300">{t(error)}</p>}
      <PanoViewer ref={viewer.ref} aria-label={t("Panorama comparison")} className="rounded-xl bg-slate-900"
        viewLimits={viewLimits}
        style={{ height: playgroundViewerHeight }}>
        <PanoCompare
          scenes={scenes}
          activeSceneId={activeId}
          onActiveSceneIdChange={selectScene}
          presentation={presentation}
          layout={layout}
          showDividerHandle={showDividerHandle}
          onSceneError={({ side }) => setError(message("Unable to load the {side} image.", { side }))}
          renderHotspots={() => (
            <GraphicHotspot id="comparison-info" ariaLabel={t("About this comparison")}
              position={{ yaw: 0, pitch: 0 }} width={4} height={4}
              graphic={{ kind: "circle", fill: "#1578c9", stroke: "#ffffff", strokeWidth: 4 }}
              tooltip={t("About this comparison")}
              onClick={() => setDialogOpen(true)}
            />
          )}
        />
        <PanoOverlay>
          <PanoSceneMenu activeId={activeId} items={menu} onSelect={selectScene}
            anchor={{ align: "bottom", inset: 12 }} collapsible />
          <PanoDialog closeLabel={t("Close")} open={dialogOpen} onOpenChange={setDialogOpen} title={t("About this comparison")}>{t("Both panoramas use the same camera and share this hotspot.")}</PanoDialog>
        </PanoOverlay>
      </PanoViewer>
      <div className="mt-6">
        <ExampleCode
          react={{
            label: "React",
            blurb: t("Pass a list of panorama pairs to PanoCompare."),
            code: snippet,
          }}
        />
      </div>
    </ExamplePage>
  );
}
