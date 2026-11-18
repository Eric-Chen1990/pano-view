import {
  PlanarTileCompare, type PlanarTileCompareScene, type PanoCompareLayout, type PanoComparePresentation,
} from "@ericchen1990/pano-view";
import { useState } from "react";
import { controlInputClassName, controlLabelClassName, pageControlsClassName } from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { ExamplePage } from "../ExamplePage";

const assets = "/fixtures/planar-compare/v1";
const before = { manifestUrl: `${assets}/image1.tiles/manifest.json`, alt: "Original plaza photograph" };
const after = { manifestUrl: `${assets}/image-1.tiles/manifest.json`, alt: "Stylized plaza photograph" };
const scenes: PlanarTileCompareScene[] = [
  { id: "original", title: "Original → Stylized", before, after },
  { id: "reversed", title: "Stylized → Original", before: after, after: before },
];

export function PlanarComparePage() {
  const [presentation, setPresentation] = useState<PanoComparePresentation>("wipe");
  const [layout, setLayout] = useState<PanoCompareLayout>("left-right");

  const snippet = `<PlanarTileCompare
  scenes={scenes}
  presentation="${presentation}"
  layout="${layout}"
  style={{ height: 480 }}
/>`;

  return (
    <ExamplePage title="Flat image comparison"
      description="Drag either image to pan both. Use the scroll wheel or pinch to zoom."
    >
      <div className={pageControlsClassName}>
        <label className={controlLabelClassName}>
          Display
          <select aria-label="Display" className={controlInputClassName} value={presentation}
            onChange={(event) => setPresentation(event.target.value as PanoComparePresentation)}
          >
            <option value="wipe">Wipe</option>
            <option value="split-view">Split view</option>
          </select>
        </label>
        <label className={controlLabelClassName}>
          Layout
          <select aria-label="Layout" className={controlInputClassName} value={layout}
            onChange={(event) => setLayout(event.target.value as PanoCompareLayout)}
          >
            <option value="left-right">Left and right</option>
            <option value="top-bottom">Top and bottom</option>
          </select>
        </label>
      </div>
      <PlanarTileCompare scenes={scenes} presentation={presentation} layout={layout}
        className="rounded-xl" style={{ height: "clamp(340px, 65dvh, 620px)" }}
      />
      <div className="mt-6">
        <CodeSnippet label="React" blurb="Give each pair two planar tile manifests." code={snippet} />
      </div>
    </ExamplePage>
  );
}
