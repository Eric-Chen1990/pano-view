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
import { controlInputClassName, controlLabelClassName, pageControlsClassName, segmentedButtonClassName } from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { ExamplePage } from "../ExamplePage";

const assets = "/fixtures/compare/v1";

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
  const viewer = usePanoViewer();
  const [layout, setLayout] = useState<PanoCompareLayout>("left-right");
  const [presentation, setPresentation] = useState<PanoComparePresentation>("wipe");
  const [activeId, setActiveId] = useState(scenes[0]!.id);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const selectScene = (id: string) => {
    setError("");
    setActiveId(id);
  };

  const snippet = `<PanoViewer style={{ height: 480 }}>
  <PanoCompare
    scenes={scenes}
    presentation="${presentation}"
    layout="${layout}"
  />
</PanoViewer>`;

  return (
    <ExamplePage title="Panorama comparison" description="Drag either image to look around. Choose how the two panoramas share the viewer.">
      <div className={pageControlsClassName}>
        <label className={controlLabelClassName}>
          Display
          <select className={controlInputClassName} value={presentation}
            onChange={(event) => setPresentation(event.target.value as PanoComparePresentation)}>
            <option value="wipe">Wipe</option>
            <option value="split-view">Split view</option>
          </select>
        </label>
        <label className={controlLabelClassName}>
          Layout
          <select className={controlInputClassName} value={layout}
            onChange={(event) => setLayout(event.target.value as PanoCompareLayout)}>
            <option value="left-right">Left and right</option>
            <option value="top-bottom">Top and bottom</option>
          </select>
        </label>
        <button className={segmentedButtonClassName} type="button" onClick={() => viewer.reset()}>Reset view</button>
        <button className={segmentedButtonClassName} type="button" onClick={() => void viewer.toggleFullscreen()}>Fullscreen</button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
      <PanoViewer ref={viewer.ref} aria-label="Panorama comparison" className="rounded-xl bg-slate-900"
        style={{ height: "clamp(340px, 65dvh, 620px)" }}>
        <PanoCompare
          scenes={scenes}
          activeSceneId={activeId}
          onActiveSceneIdChange={selectScene}
          presentation={presentation}
          layout={layout}
          onSceneError={({ side }) => setError(`Unable to load the ${side} image.`)}
          renderHotspots={() => (
            <GraphicHotspot id="comparison-info" ariaLabel="About this comparison"
              position={{ yaw: 0, pitch: 0 }} width={4} height={4}
              graphic={{ kind: "circle", fill: "#1578c9", stroke: "#ffffff", strokeWidth: 4 }}
              tooltip="About this comparison"
              onClick={() => setDialogOpen(true)}
            />
          )}
        />
        <PanoOverlay>
          <PanoSceneMenu activeId={activeId} items={menu} onSelect={selectScene}
            anchor={{ align: "bottom", inset: 12 }} collapsible />
          <PanoDialog open={dialogOpen} onOpenChange={setDialogOpen} title="About this comparison">
            Both panoramas use the same camera and share this hotspot.
          </PanoDialog>
        </PanoOverlay>
      </PanoViewer>
      <div className="mt-6">
        <CodeSnippet label="React" blurb="Pass a list of panorama pairs to PanoCompare." code={snippet} />
      </div>
    </ExamplePage>
  );
}
