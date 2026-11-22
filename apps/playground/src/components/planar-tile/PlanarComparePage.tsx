import {
  PlanarTileCompare, type PlanarTileCompareScene, type PanoCompareLayout, type PanoComparePresentation,
} from "@ericchen1990/pano-view";
import { useState } from "react";
import { controlInputClassName, controlLabelClassName, pageControlsClassName } from "../../ui";
import { ExampleCode } from "../ExampleCode";
import { ExamplePage } from "../ExamplePage";

const assets = "/fixtures/planar-compare/v1";
const minScale = 1.25;
const maxScale = 4;
const dividerColor = "#38bdf8";
const dividerWidth = 4;
const before = { manifestUrl: `${assets}/image1.tiles/manifest.json`, alt: "Original plaza photograph" };
const after = { manifestUrl: `${assets}/image-1.tiles/manifest.json`, alt: "Stylized plaza photograph" };
const scenes: PlanarTileCompareScene[] = [
  { id: "original", title: "Original → Stylized", before, after },
  { id: "reversed", title: "Stylized → Original", before: after, after: before },
];

export function PlanarComparePage() {
  const [presentation, setPresentation] = useState<PanoComparePresentation>("wipe");
  const [layout, setLayout] = useState<PanoCompareLayout>("left-right");

  const snippet = `import { PlanarTileCompare, type PlanarTileCompareScene } from "@ericchen1990/pano-view";

import "@ericchen1990/pano-view/styles.css";

const scenes: PlanarTileCompareScene[] = ${JSON.stringify(scenes, null, 2)};

export function FlatImageComparison() {
  return (
    <PlanarTileCompare
      scenes={scenes}
      presentation="${presentation}"
      layout="${layout}"
      minScale={${minScale}}
      maxScale={${maxScale}}
      dividerColor="${dividerColor}"
      dividerWidth={${dividerWidth}}
      style={{ height: 480 }}
    />
  );
}`;

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
        minScale={minScale} maxScale={maxScale} dividerColor={dividerColor} dividerWidth={dividerWidth}
        className="rounded-xl" style={{ height: "clamp(340px, 65dvh, 620px)" }}
      />
      <div className="mt-6">
        <ExampleCode
          json={{ format: "manifest", files: [
              { label: "Original manifest.json", blurb: "Use this URL for the original image.", url: before.manifestUrl },
              { label: "Stylized manifest.json", blurb: "Use this URL for the stylized image.", url: after.manifestUrl },
            ] }}
          react={{
            label: "React",
            blurb: "Give each pair two planar tile manifests.",
            code: snippet,
          }}
        />
      </div>
    </ExamplePage>
  );
}
