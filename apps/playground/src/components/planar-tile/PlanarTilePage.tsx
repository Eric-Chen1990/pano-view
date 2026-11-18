import { PlanarTileViewer } from "@ericchen1990/pano-view";
import { pageHeadingTitleClassName, pageSectionClassName, shellClassName } from "../../ui";
import { CodeSnippet } from "../CodeSnippet";
import { SiteFooter } from "../SiteFooter";
import { SiteHeader } from "../SiteHeader";

const manifestUrl = "/fixtures/planar-image/manifest.json";
const snippet = `import { PlanarTileViewer } from "@ericchen1990/pano-view";
import "@ericchen1990/pano-view/styles.css";

<PlanarTileViewer
  manifestUrl="${manifestUrl}"
  alt="Museum floor plan"
  style={{ height: 480 }}
/>`;

export function PlanarTilePage() {
  return (
    <div className={shellClassName}>
      <SiteHeader />
      <main className={pageSectionClassName}>
        <h1 className={pageHeadingTitleClassName}>Tiled flat image</h1>
        <p className="mb-5 text-sm text-slate-400">
          Drag to pan, scroll or pinch to zoom, and choose Fit to see the full image.
        </p>
        <PlanarTileViewer
          manifestUrl={manifestUrl}
          alt="Museum floor plan"
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
