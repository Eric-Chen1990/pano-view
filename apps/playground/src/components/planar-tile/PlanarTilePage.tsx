import { PlanarTileViewer } from "@ericchen1990/pano-view";
import { useState } from "react";
import {
  checkboxLabelClassName, controlInputClassName, controlLabelClassName,
  pageControlsClassName, pageHeadingTitleClassName, pageSectionClassName, shellClassName,
} from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const manifestUrl = "/fixtures/planar-compare/v1/image1.tiles/manifest.json";
const alt = "Original plaza photograph";
export function PlanarTilePage() {
  const [maxScale, setMaxScale] = useState<number>();
  const [bounce, setBounce] = useState(true);
  const [showMinimap, setShowMinimap] = useState(false);
  const snippet = `import { PlanarTileViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

<PlanarTileViewer
  manifestUrl="${manifestUrl}"
  alt="${alt}"
${maxScale === undefined ? "" : `  maxScale={${maxScale}}\n`}${bounce ? "" : "  dragMotion={{ bounce: false }}\n"}${showMinimap ? "  showMinimap\n" : ""}  style={{ height: 480 }}
/>`;

  return (
    <div className={shellClassName}>
      <SiteHeader />
      <main className={pageSectionClassName}>
        <h1 className={pageHeadingTitleClassName}>Tiled flat image</h1>
        <p className="mb-5 text-sm text-slate-400">
          Drag to pan, scroll or pinch to zoom, and choose Fit to see the full image.
        </p>
        <div className={pageControlsClassName}>
          <label className={controlLabelClassName}>
            Maximum zoom
            <select
              className={controlInputClassName}
              value={maxScale ?? ""}
              onChange={(event) => setMaxScale(event.target.value ? Number(event.target.value) : undefined)}
            >
              <option value="">Automatic</option>
              <option value={2}>2×</option>
              <option value={3}>3×</option>
            </select>
          </label>
          <label className={checkboxLabelClassName}>
            <input type="checkbox" checked={bounce} onChange={(event) => setBounce(event.target.checked)} />
            Edge bounce
          </label>
          <label className={checkboxLabelClassName}>
            <input type="checkbox" checked={showMinimap} onChange={(event) => setShowMinimap(event.target.checked)} />
            Minimap
          </label>
        </div>
        <PlanarTileViewer
          manifestUrl={manifestUrl}
          alt={alt}
          maxScale={maxScale}
          dragMotion={{ bounce }}
          showMinimap={showMinimap}
          className="rounded-xl"
          style={{ height: "clamp(320px, 65vh, 600px)" }}
        />
        <div className="mt-6">
          <CodeSnippet label="React" blurb="Point the viewer at the generated manifest." code={snippet} />
        </div>
      </main>
      <SiteFooter label="Pano View Playground by" />
    </div>
  );
}
