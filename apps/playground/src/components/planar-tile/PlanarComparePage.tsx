import { usePlaygroundLanguage } from "../../i18n/language";
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
  const { t } = usePlaygroundLanguage();
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
    <ExamplePage title={t("Flat image comparison")}
      description={t("Drag either image to pan both. Use the scroll wheel or pinch to zoom.")}
    >
      <div className={pageControlsClassName}>
        <label className={controlLabelClassName}>{t("Display")}<select aria-label={t("Display")} className={controlInputClassName} value={presentation}
            onChange={(event) => setPresentation(event.target.value as PanoComparePresentation)}
          >
            <option value="wipe">{t("Wipe")}</option>
            <option value="split-view">{t("Split view")}</option>
          </select>
        </label>
        <label className={controlLabelClassName}>{t("Layout")}<select aria-label={t("Layout")} className={controlInputClassName} value={layout}
            onChange={(event) => setLayout(event.target.value as PanoCompareLayout)}
          >
            <option value="left-right">{t("Left and right")}</option>
            <option value="top-bottom">{t("Top and bottom")}</option>
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
              { label: t("Original manifest.json"), blurb: t("Use this URL for the original image."), url: before.manifestUrl },
              { label: t("Stylized manifest.json"), blurb: t("Use this URL for the stylized image."), url: after.manifestUrl },
            ] }}
          react={{
            label: "React",
            blurb: t("Give each pair two planar tile manifests."),
            code: snippet,
          }}
        />
      </div>
    </ExamplePage>
  );
}
